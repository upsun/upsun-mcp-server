import { describe, it, expect, jest, beforeAll, beforeEach, afterEach } from '@jest/globals';
import { McpServer } from '@modelcontextprotocol/server';
import request from 'supertest';
import { ResponseError } from 'upsun-sdk-node/dist/core/runtime.js';

import { GatewayServer } from '../../../src/core/gateway';
import { HttpTransport } from '../../../src/core/transport/http';
import { JwtTokenVerifier, WritableMode } from '../../../src/core/authentication';
import { ToolWrapper } from '../../../src/core/helper';
import { createTestAuth } from '../../helpers/jwt';
import type { TestAuth } from '../../helpers/jwt';

/** Adapter whose server has one tool that fails with an upstream 401. */
class StubAdapter {
  static instances: StubAdapter[] = [];
  readonly server = new McpServer({ name: 'stub', version: '1.0.0' });
  readonly client = {} as any;
  readonly useApiKey = jest.fn();
  readonly useBearerToken = jest.fn();

  constructor(public readonly mode: WritableMode) {
    StubAdapter.instances.push(this);
    this.server.registerTool(
      'fail-401',
      { description: 'Fails with an upstream 401' },
      ToolWrapper.trace('fail-401', async () => {
        throw new ResponseError(
          new globalThis.Response('{"title":"Unauthorized"}', {
            status: 401,
            headers: {
              'www-authenticate': 'Bearer error="invalid_token"',
              'content-type': 'application/problem+json',
            },
          })
        );
      })
    );
  }

  isMode(): boolean {
    return this.mode !== WritableMode.READONLY;
  }
}

// Signed in beforeAll; the cases read it lazily because describe.each runs first.
let auth: TestAuth;
let jwt: string;

const authCases = [
  {
    name: 'API key',
    headers: () => ({ 'upsun-api-token': 'the-key' }),
    use: 'useApiKey',
    token: () => 'the-key',
  },
  {
    name: 'bearer',
    headers: () => ({ authorization: `Bearer ${jwt}` }),
    use: 'useBearerToken',
    token: () => jwt,
  },
] as const;

const modernMeta = {
  'io.modelcontextprotocol/protocolVersion': '2026-07-28',
  'io.modelcontextprotocol/clientCapabilities': {},
};

const toolCall = {
  legacy: {
    headers: { 'mcp-protocol-version': '2025-06-18' },
    body: {
      jsonrpc: '2.0',
      id: 1,
      method: 'tools/call',
      params: { name: 'fail-401', arguments: {} },
    },
  },
  modern: {
    headers: {
      'mcp-protocol-version': '2026-07-28',
      'mcp-method': 'tools/call',
      'mcp-name': 'fail-401',
    },
    body: {
      jsonrpc: '2.0',
      id: 1,
      method: 'tools/call',
      params: { name: 'fail-401', arguments: {}, _meta: modernMeta },
    },
  },
};

const initialize = {
  jsonrpc: '2.0',
  id: 1,
  method: 'initialize',
  params: {
    protocolVersion: '2025-06-18',
    capabilities: {},
    clientInfo: { name: 'test', version: '1.0.0' },
  },
};

describe('HttpTransport', () => {
  let gateway: GatewayServer<any>;
  const crashListeners = () => [
    ...process.listeners('uncaughtException'),
    ...process.listeners('unhandledRejection'),
  ];
  let listenersBefore: unknown[];

  const post = (headers: Record<string, string>, body: unknown) =>
    request(gateway.app)
      .post('/mcp')
      .set('Accept', 'application/json, text/event-stream')
      .set(headers)
      .send(body as object);

  beforeAll(async () => {
    auth = await createTestAuth();
    jwt = await auth.sign({ sub: 'user-1' });
  });

  beforeEach(() => {
    StubAdapter.instances = [];
    listenersBefore = crashListeners();
    gateway = new GatewayServer(StubAdapter as any, undefined, auth.verifier());
  });

  afterEach(() => {
    expect(crashListeners()).toEqual(listenersBefore);
  });

  describe.each(authCases)('$name requests', ({ headers, use, token }) => {
    it('should serve a legacy initialize as a JSON response', async () => {
      const res = await post(headers(), initialize);

      expect(res.status).toBe(200);
      expect(res.headers['content-type']).toMatch(/^application\/json/);
      expect(res.headers['mcp-session-id']).toBeUndefined();
      expect(res.body.result.protocolVersion).toBe('2025-06-18');
      expect(StubAdapter.instances).toHaveLength(1);
      expect(StubAdapter.instances[0][use]).toHaveBeenCalledWith(token());
    });

    it('should serve a modern server/discover', async () => {
      const res = await post(
        { ...headers(), 'mcp-protocol-version': '2026-07-28', 'mcp-method': 'server/discover' },
        { jsonrpc: '2.0', id: 1, method: 'server/discover', params: { _meta: modernMeta } }
      );

      expect(res.status).toBe(200);
      expect(res.body.result.supportedVersions).toContain('2026-07-28');
      expect(StubAdapter.instances[0][use]).toHaveBeenCalledWith(token());
    });

    it.each(['legacy', 'modern'] as const)(
      'should forward an upstream 401 from a %s tool call',
      async era => {
        const res = await post({ ...headers(), ...toolCall[era].headers }, toolCall[era].body);

        expect(res.status).toBe(401);
        expect(res.headers['www-authenticate']).toBe('Bearer error="invalid_token"');
        expect(res.headers['content-type']).toBe('application/problem+json');
        expect(res.text).toBe('{"title":"Unauthorized"}');
      }
    );
  });

  // The token is checked before any MCP server instance exists or any tool runs.
  it('should refuse a bearer token with a changed payload before it builds a server', async () => {
    const [header, , signature] = jwt.split('.');
    const payload = Buffer.from(JSON.stringify({ sub: 'other-user', exp: 4102444800 })).toString(
      'base64url'
    );

    const res = await post(
      { authorization: `Bearer ${header}.${payload}.${signature}` },
      toolCall.legacy.body
    );

    expect(res.status).toBe(401);
    expect(res.headers['www-authenticate']).toContain('error="invalid_token"');
    expect(res.body.error_description).toBe('Invalid token signature');
    expect(StubAdapter.instances).toHaveLength(0);
  });

  it('should keep a legacy response when server cleanup fails', async () => {
    const closeSpy = jest
      .spyOn(McpServer.prototype, 'close')
      .mockRejectedValue(new Error('cleanup failed'));
    try {
      const res = await post({ 'upsun-api-token': 'the-key' }, initialize);

      expect(closeSpy).toHaveBeenCalled();
      expect(res.status).toBe(200);
      expect(res.body.result.protocolVersion).toBe('2025-06-18');
    } finally {
      closeSpy.mockRestore();
    }
  });

  it('should use a new adapter for every request', async () => {
    const headers = { 'upsun-api-token': 'the-key', 'mcp-session-id': 'stale-sess' };
    await post(headers, initialize);
    await post(headers, initialize);

    expect(StubAdapter.instances).toHaveLength(2);
    expect(StubAdapter.instances[0].server).not.toBe(StubAdapter.instances[1].server);
  });

  const eraRequests = {
    legacy: { headers: {}, body: initialize },
    modern: {
      headers: { 'mcp-protocol-version': '2026-07-28', 'mcp-method': 'server/discover' },
      body: { jsonrpc: '2.0', id: 1, method: 'server/discover', params: { _meta: modernMeta } },
    },
  };

  describe.each(['legacy', 'modern'] as const)('%s requests', era => {
    it.each([
      [undefined, WritableMode.READONLY],
      ['false', WritableMode.READONLY],
      ['true', WritableMode.WRITABLE],
    ])('should map enable-write %s to mode %s', async (enableWrite, mode) => {
      const headers: Record<string, string> = {
        'upsun-api-token': 'the-key',
        ...eraRequests[era].headers,
      };
      if (enableWrite !== undefined) {
        headers['enable-write'] = enableWrite;
      }

      const res = await post(headers, eraRequests[era].body);

      expect(res.status).toBe(200);
      expect(StubAdapter.instances[0].mode).toBe(mode);
    });
  });

  it.each(['get', 'delete'] as const)('should answer a legacy %s with 405', async method => {
    const res = await request(gateway.app)[method]('/mcp').set('upsun-api-token', 'the-key');

    expect(res.status).toBe(405);
    expect(res.headers['allow']).toBe('POST');
    expect(res.body.error.message).toBe('Method not allowed.');
  });

  it('should require authentication', async () => {
    const res = await post({}, initialize);

    expect(res.status).toBe(401);
    expect(StubAdapter.instances).toHaveLength(0);
  });

  it('should return 500 if the auth middleware did not run', async () => {
    const httpTransport = new HttpTransport(gateway);
    const res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    } as any;

    await httpTransport.handle({ method: 'POST', headers: {}, body: {} } as any, res);

    expect(res.status).toHaveBeenCalledWith(500);
  });
});

describe('GatewayServer default verifier', () => {
  // The audience check must use the resource that the protected resource metadata publishes.
  it('checks the audience against the published protected resource', async () => {
    const fromConfig = jest.spyOn(JwtTokenVerifier, 'fromConfig');
    try {
      const { app } = new GatewayServer(StubAdapter as any);
      const res = await request(app).get('/.well-known/oauth-protected-resource/mcp');

      expect(res.status).toBe(200);
      expect(res.body.resource).toMatch(/\/mcp$/);
      expect(fromConfig).toHaveBeenCalledWith(res.body.resource);
    } finally {
      fromConfig.mockRestore();
    }
  });
});
