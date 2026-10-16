import { describe, it, expect, jest, beforeEach, afterEach } from '@jest/globals';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { GatewayServer } from '../../../src/core/gateway';
import { HttpTransport } from '../../../src/core/transport/http';
import { API_KEY_CLIENT_ID, AuthType } from '../../../src/core/authentication';

const apiKeyAuth = (token: string) => ({
  token,
  clientId: API_KEY_CLIENT_ID,
  scopes: [],
  authType: AuthType.ApiKey,
});

const bearerAuth = (token: string, clientId = 'user-1') => ({
  token,
  clientId,
  scopes: [],
  authType: AuthType.Bearer,
});

const makeAdapter = () =>
  ({
    connectWithApiKey: jest.fn().mockResolvedValue(undefined),
    connectWithBearer: jest.fn().mockResolvedValue(undefined),
    server: {},
    client: {},
    isMode: jest.fn(),
  }) as any;

const makeRes = () =>
  ({
    status: jest.fn().mockReturnThis(),
    set: jest.fn().mockReturnThis(),
    json: jest.fn(),
  }) as any;

const authCases = [
  { name: 'API key', auth: apiKeyAuth('the-token'), connect: 'connectWithApiKey' },
  { name: 'bearer', auth: bearerAuth('the-token'), connect: 'connectWithBearer' },
] as const;

describe('HttpTransport', () => {
  let gateway: GatewayServer<any>;
  let httpTransport: HttpTransport;
  let adapter: any;
  let handleRequestSpy: jest.SpiedFunction<any>;
  let closeSpy: jest.SpiedFunction<any>;
  let handledBy: StreamableHTTPServerTransport[];

  beforeEach(() => {
    adapter = makeAdapter();
    gateway = { makeInstanceAdapterMcpServer: jest.fn(() => adapter) } as any;
    httpTransport = new HttpTransport(gateway);
    handledBy = [];
    handleRequestSpy = jest
      .spyOn(StreamableHTTPServerTransport.prototype, 'handleRequest')
      .mockImplementation(async function (this: StreamableHTTPServerTransport) {
        handledBy.push(this);
      });
    closeSpy = jest.spyOn(StreamableHTTPServerTransport.prototype, 'close');
  });

  afterEach(() => {
    handleRequestSpy.mockRestore();
    closeSpy.mockRestore();
  });

  describe.each(authCases)('$name requests', ({ auth, connect }) => {
    it.each(['initialize', 'tools/list'])(
      'should handle %s with a fresh stateless transport',
      async method => {
        const req = {
          headers: {},
          body: { jsonrpc: '2.0', method, id: 1, params: {} },
          auth,
        } as any;
        const res = makeRes();

        await httpTransport.handlePost(req, res);

        expect(adapter[connect]).toHaveBeenCalledWith(expect.anything(), 'the-token');
        expect(handleRequestSpy).toHaveBeenCalledWith(req, res, req.body);
        expect(handledBy).toHaveLength(1);
        const inner = (handledBy[0] as any)._webStandardTransport;
        expect(inner.sessionIdGenerator).toBeUndefined();
        expect(inner._enableJsonResponse).toBe(true);
        expect(closeSpy).toHaveBeenCalled();
        expect(res.status).not.toHaveBeenCalled();
      }
    );

    it('should ignore a client-supplied mcp-session-id', async () => {
      const req = {
        headers: { 'mcp-session-id': 'stale-sess' },
        body: { jsonrpc: '2.0', method: 'tools/list', id: 2 },
        auth,
      } as any;
      const res = makeRes();

      await httpTransport.handlePost(req, res);

      expect(handleRequestSpy).toHaveBeenCalledWith(req, res, req.body);
      expect(res.status).not.toHaveBeenCalled();
    });

    it('should use a new adapter for every request', async () => {
      const body = { jsonrpc: '2.0', method: 'tools/list', id: 3 };
      await httpTransport.handlePost({ headers: {}, body, auth } as any, makeRes());
      await httpTransport.handlePost({ headers: {}, body, auth } as any, makeRes());

      expect(gateway.makeInstanceAdapterMcpServer).toHaveBeenCalledTimes(2);
      expect(handledBy[0]).not.toBe(handledBy[1]);
    });

    it('should preserve request errors when transport cleanup fails', async () => {
      handleRequestSpy.mockRejectedValue(new Error('request failed'));
      closeSpy.mockRejectedValue(new Error('cleanup failed'));
      const req = {
        headers: {},
        body: { jsonrpc: '2.0', method: 'tools/list', id: 4 },
        auth,
      } as any;

      await expect(httpTransport.handlePost(req, makeRes())).rejects.toThrow('request failed');
      expect(closeSpy).toHaveBeenCalled();
    });

    it('should return 405 Allow: POST for GET/DELETE', async () => {
      const res = makeRes();

      await httpTransport.handleMethodNotAllowed({ headers: {}, auth } as any, res);

      expect(res.status).toHaveBeenCalledWith(405);
      expect(res.set).toHaveBeenCalledWith('Allow', 'POST');
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: expect.objectContaining({ message: 'Method not allowed.' }),
        })
      );
    });
  });

  it('should return 500 if the auth middleware did not run', async () => {
    const res = makeRes();

    await httpTransport.handlePost({ headers: {}, body: {} } as any, res);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(handleRequestSpy).not.toHaveBeenCalled();
  });
});
