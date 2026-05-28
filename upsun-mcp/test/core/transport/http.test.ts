import { describe, it, expect, jest, beforeEach, afterEach } from '@jest/globals';
import { GatewayServer } from '../../../src/core/gateway';
import { HttpTransport } from '../../../src/core/transport/http';
import {
  API_KEY_CLIENT_ID,
  AuthType,
  sessionOwnerFromAuth,
} from '../../../src/core/authentication';

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

describe('HttpTransport', () => {
  let gateway: GatewayServer<any>;
  let httpTransport: HttpTransport;
  let handleRequestSpy: jest.SpiedFunction<any> | undefined;
  let closeSpy: jest.SpiedFunction<any> | undefined;

  beforeEach(() => {
    gateway = {
      /* minimal mock */
    } as any;
    httpTransport = new HttpTransport(gateway);
  });

  afterEach(() => {
    handleRequestSpy?.mockRestore();
    handleRequestSpy = undefined;
    closeSpy?.mockRestore();
    closeSpy = undefined;
  });

  it('should initialize with an empty streamable object', () => {
    expect(httpTransport.streamable).toBeDefined();
    expect(typeof httpTransport.streamable).toBe('object');
    expect(Object.keys(httpTransport.streamable)).toHaveLength(0);
  });

  it('should have a postSessionRequest method', () => {
    expect(typeof httpTransport.postSessionRequest).toBe('function');
  });

  it('should dispatch API key requests to the session when the same token is presented', async () => {
    const handleRequest = jest.fn();
    const owner = sessionOwnerFromAuth(apiKeyAuth('token'));
    httpTransport.streamable['sess2'] = {
      transport: { handleRequest },
      server: {},
      owner,
    } as any;
    const req = {
      headers: { 'mcp-session-id': 'sess2' },
      body: {},
      auth: apiKeyAuth('token'),
    } as any;
    const res = {} as any;
    await httpTransport.postSessionRequest(req, res);
    expect(handleRequest).toHaveBeenCalled();
  });

  it('should reject API key reuse with a different token as 404 Session not found', async () => {
    const handleRequest = jest.fn();
    const owner = sessionOwnerFromAuth(apiKeyAuth('victim-token'));
    httpTransport.streamable['sess3'] = {
      transport: { handleRequest },
      server: {},
      owner,
    } as any;
    const req = {
      headers: { 'mcp-session-id': 'sess3' },
      body: {},
      auth: apiKeyAuth('attacker-token'),
    } as any;
    const res = { status: jest.fn().mockReturnThis(), json: jest.fn() } as any;
    await httpTransport.postSessionRequest(req, res);
    expect(res.status).toHaveBeenCalledWith(404);
    expect(handleRequest).not.toHaveBeenCalled();
  });

  it('should reject an unknown API key session id as 404, indistinguishable from a wrong token', async () => {
    const req = {
      headers: { 'mcp-session-id': 'does-not-exist' },
      body: {},
      auth: apiKeyAuth('token'),
    } as any;
    const res = { status: jest.fn().mockReturnThis(), json: jest.fn() } as any;
    await httpTransport.postSessionRequest(req, res);
    expect(res.status).toHaveBeenCalledWith(404);
  });

  it('should create transport with enableJsonResponse: true on init', async () => {
    const connectWithApiKey = jest.fn().mockResolvedValue(undefined);
    const handleRequest = jest.fn(async () => {});
    const fakeAdapter = {
      connectWithApiKey,
      connectWithBearer: jest.fn(),
      server: {},
      client: {},
      isMode: jest.fn(),
    } as any;

    httpTransport.gateway.makeInstanceAdapterMcpServer = jest.fn(() => fakeAdapter);

    const mod = await import('@modelcontextprotocol/sdk/server/streamableHttp.js');
    handleRequestSpy = jest
      .spyOn(mod.StreamableHTTPServerTransport.prototype, 'handleRequest')
      .mockImplementation(handleRequest);

    const req = {
      headers: {},
      body: { jsonrpc: '2.0', method: 'initialize', id: 1, params: {} },
      auth: apiKeyAuth('test-key'),
    } as any;
    const res = { status: jest.fn().mockReturnThis(), json: jest.fn() } as any;

    await httpTransport.postSessionRequest(req, res);

    // Verify the transport was created and connected.
    expect(connectWithApiKey).toHaveBeenCalled();
    expect(handleRequest).toHaveBeenCalled();

    // Verify enableJsonResponse was passed through to the inner transport.
    const sessions = Object.values(httpTransport.streamable);
    if (sessions.length > 0) {
      const inner = (sessions[0].transport as any)._webStandardTransport;
      expect(inner._enableJsonResponse).toBe(true);
    }
  });

  it('should handle bearer requests with a stateless transport', async () => {
    const connectWithBearer = jest.fn();
    const fakeAdapter = {
      connectWithBearer,
      connectWithApiKey: jest.fn(),
      server: {},
      client: {},
      isMode: jest.fn(),
    } as any;
    const handleRequest = jest.fn(async () => {});
    const makeInstanceAdapterMcpServer = jest.fn(() => fakeAdapter);
    httpTransport.gateway.makeInstanceAdapterMcpServer = makeInstanceAdapterMcpServer;
    const req = {
      headers: {},
      body: { jsonrpc: '2.0', method: 'initialize', id: 1, params: {} },
      auth: bearerAuth('bearer-token', API_KEY_CLIENT_ID),
    } as any;
    const res = { status: jest.fn().mockReturnThis(), json: jest.fn() } as any;
    const mod = await import('@modelcontextprotocol/sdk/server/streamableHttp.js');
    handleRequestSpy = jest
      .spyOn(mod.StreamableHTTPServerTransport.prototype, 'handleRequest')
      .mockImplementation(handleRequest);
    await httpTransport.postSessionRequest(req, res);
    expect(makeInstanceAdapterMcpServer).toHaveBeenCalled();
    expect(connectWithBearer).toHaveBeenCalledWith(expect.anything(), 'bearer-token');
    expect(handleRequest).toHaveBeenCalled();
    expect(Object.keys(httpTransport.streamable)).toHaveLength(0);
  });

  it('should preserve bearer request errors when stateless transport cleanup fails', async () => {
    const connectWithBearer = jest.fn();
    const fakeAdapter = {
      connectWithBearer,
      connectWithApiKey: jest.fn(),
      server: {},
      client: {},
      isMode: jest.fn(),
    } as any;
    const requestError = new Error('request failed');
    const cleanupError = new Error('cleanup failed');

    httpTransport.gateway.makeInstanceAdapterMcpServer = jest.fn(() => fakeAdapter);

    const req = {
      headers: {},
      body: { jsonrpc: '2.0', method: 'tools/list', id: 2 },
      auth: bearerAuth('bearer-token'),
    } as any;
    const res = { status: jest.fn().mockReturnThis(), json: jest.fn() } as any;

    const mod = await import('@modelcontextprotocol/sdk/server/streamableHttp.js');
    handleRequestSpy = jest
      .spyOn(mod.StreamableHTTPServerTransport.prototype, 'handleRequest')
      .mockRejectedValue(requestError);
    closeSpy = jest
      .spyOn(mod.StreamableHTTPServerTransport.prototype, 'close')
      .mockRejectedValue(cleanupError);

    await expect(httpTransport.postSessionRequest(req, res)).rejects.toThrow('request failed');
    expect(closeSpy).toHaveBeenCalled();
  });

  it('should ignore stale session IDs for bearer stateless requests', async () => {
    const connectWithBearer = jest.fn();
    const handleRequest = jest.fn(async () => {});
    const fakeAdapter = {
      connectWithBearer,
      connectWithApiKey: jest.fn(),
      server: {},
      client: {},
      isMode: jest.fn(),
    } as any;

    httpTransport.gateway.makeInstanceAdapterMcpServer = jest.fn(() => fakeAdapter);

    const owner = sessionOwnerFromAuth(bearerAuth('old-bearer-token'));
    httpTransport.streamable['stale-sess'] = {
      transport: { handleRequest: jest.fn() },
      server: {},
      owner,
    } as any;

    const req = {
      headers: { 'mcp-session-id': 'stale-sess' },
      body: { jsonrpc: '2.0', method: 'tools/list', id: 2 },
      auth: bearerAuth('refreshed-bearer-token'),
    } as any;
    const res = { status: jest.fn().mockReturnThis(), json: jest.fn() } as any;

    const mod = await import('@modelcontextprotocol/sdk/server/streamableHttp.js');
    handleRequestSpy = jest
      .spyOn(mod.StreamableHTTPServerTransport.prototype, 'handleRequest')
      .mockImplementation(handleRequest);

    await httpTransport.postSessionRequest(req, res);

    expect(connectWithBearer).toHaveBeenCalledWith(expect.anything(), 'refreshed-bearer-token');
    expect(handleRequest).toHaveBeenCalledWith(req, res, req.body);
    expect(res.status).not.toHaveBeenCalledWith(404);
  });

  it('should create a new session on init with API key', async () => {
    const connectWithApiKey = jest.fn().mockResolvedValue(undefined);
    const handleRequest = jest.fn(async () => {});
    const fakeAdapter = {
      connectWithApiKey,
      connectWithBearer: jest.fn(),
      server: {},
      client: {},
      isMode: jest.fn(),
    } as any;

    httpTransport.gateway.makeInstanceAdapterMcpServer = jest.fn(() => fakeAdapter);

    const req = {
      headers: {},
      body: { jsonrpc: '2.0', method: 'initialize', id: 1, params: {} },
      auth: apiKeyAuth('test-api-key'),
    } as any;
    const res = { status: jest.fn().mockReturnThis(), json: jest.fn() } as any;

    const mod = await import('@modelcontextprotocol/sdk/server/streamableHttp.js');
    handleRequestSpy = jest
      .spyOn(mod.StreamableHTTPServerTransport.prototype, 'handleRequest')
      .mockImplementation(handleRequest);

    await httpTransport.postSessionRequest(req, res);

    expect(connectWithApiKey).toHaveBeenCalledWith(expect.anything(), 'test-api-key');
    expect(handleRequest).toHaveBeenCalled();
  });

  it('should return 400 for an API key request if no sessionId and not an init request', async () => {
    const req = {
      headers: {},
      body: {},
      auth: apiKeyAuth('tok'),
    } as any;
    const res = { status: jest.fn().mockReturnThis(), json: jest.fn() } as any;
    await httpTransport.postSessionRequest(req, res);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ error: expect.anything() }));
  });

  it('should call handleSessionRequest and return 400 if API key sessionId is missing', async () => {
    const req = {
      headers: {},
      auth: apiKeyAuth('tok'),
    } as any;
    const res = { status: jest.fn().mockReturnThis(), send: jest.fn() } as any;
    await httpTransport.handleSessionRequest(req, res);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.send).toHaveBeenCalledWith('Invalid or missing session ID');
  });

  it('should return 405 for bearer GET/DELETE streamable requests', async () => {
    const req = {
      headers: {},
      auth: bearerAuth('tok', API_KEY_CLIENT_ID),
    } as any;
    const res = {
      status: jest.fn().mockReturnThis(),
      set: jest.fn().mockReturnThis(),
      json: jest.fn(),
    } as any;
    await httpTransport.handleSessionRequest(req, res);
    expect(res.status).toHaveBeenCalledWith(405);
    expect(res.set).toHaveBeenCalledWith('Allow', 'POST');
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        error: expect.objectContaining({
          message: 'Method not allowed for stateless bearer transport.',
        }),
      })
    );
  });

  it('should handle handleSessionRequest with valid API key sessionId and matching token', async () => {
    const handleRequest = jest.fn(async () => {});
    const owner = sessionOwnerFromAuth(apiKeyAuth('tok'));
    httpTransport.streamable['valid-sess'] = {
      transport: { handleRequest },
      server: {},
      owner,
    } as any;

    const req = {
      headers: { 'mcp-session-id': 'valid-sess' },
      body: {},
      auth: apiKeyAuth('tok'),
    } as any;
    const res = {} as any;

    await httpTransport.handleSessionRequest(req, res);
    expect(handleRequest).toHaveBeenCalled();
  });

  it('should reject handleSessionRequest presenting a different API key token as 404', async () => {
    const handleRequest = jest.fn(async () => {});
    const owner = sessionOwnerFromAuth(apiKeyAuth('owner-tok'));
    httpTransport.streamable['owned-sess'] = {
      transport: { handleRequest },
      server: {},
      owner,
    } as any;

    const req = {
      headers: { 'mcp-session-id': 'owned-sess' },
      body: {},
      auth: apiKeyAuth('attacker-token'),
    } as any;
    const res = { status: jest.fn().mockReturnThis(), json: jest.fn() } as any;

    await httpTransport.handleSessionRequest(req, res);
    expect(res.status).toHaveBeenCalledWith(404);
    expect(handleRequest).not.toHaveBeenCalled();
  });

  it('should call closeAllSessions and clear streamable', async () => {
    httpTransport.streamable['abc'] = { transport: { close: jest.fn() }, server: {} } as any;
    await httpTransport.closeAllSessions();
    expect(httpTransport.streamable['abc']).toBeUndefined();
  });

  it('should handle error in closeAllSessions', async () => {
    httpTransport.streamable['err'] = {
      transport: { close: jest.fn().mockRejectedValue('fail' as never) },
      server: {},
    } as any;
    await httpTransport.closeAllSessions();
    await Promise.resolve();
    expect(httpTransport.streamable['err']).toBeUndefined();
  });

  it('should close a session when its token expiry is reached', async () => {
    jest.useFakeTimers();
    try {
      const close = jest.fn(async () => {});
      httpTransport.streamable['exp-sess'] = {
        transport: { close },
        server: {},
        owner: 'deadbeef',
      } as any;
      const expiresAt = Math.floor(Date.now() / 1000) + 60;
      (httpTransport as any).scheduleExpiry('exp-sess', expiresAt);

      // Still present before the token expires.
      jest.advanceTimersByTime(59_000);
      expect(close).not.toHaveBeenCalled();

      jest.advanceTimersByTime(1_000);
      await Promise.resolve();
      expect(close).toHaveBeenCalled();
    } finally {
      jest.useRealTimers();
    }
  });

  it('should not schedule expiry for tokens without an expiry (e.g. API keys)', () => {
    httpTransport.streamable['no-exp'] = {
      transport: { close: jest.fn() },
      server: {},
      owner: 'deadbeef',
    } as any;
    (httpTransport as any).scheduleExpiry('no-exp', undefined);
    expect(httpTransport.streamable['no-exp'].expiryTimer).toBeUndefined();
  });
});
