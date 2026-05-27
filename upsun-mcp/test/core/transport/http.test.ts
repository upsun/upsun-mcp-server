import { describe, it, expect, jest, beforeEach, afterEach } from '@jest/globals';
import { GatewayServer } from '../../../src/core/gateway';
import { HttpTransport } from '../../../src/core/transport/http';
import { API_KEY_CLIENT_ID, sessionOwnerFromAuth } from '../../../src/core/authentication';

describe('HttpTransport', () => {
  let gateway: GatewayServer<any>;
  let httpTransport: HttpTransport;
  let handleRequestSpy: jest.SpiedFunction<any> | undefined;

  beforeEach(() => {
    gateway = {
      /* minimal mock */
    } as any;
    httpTransport = new HttpTransport(gateway);
  });

  afterEach(() => {
    handleRequestSpy?.mockRestore();
    handleRequestSpy = undefined;
  });

  it('should initialize with an empty streamable object', () => {
    expect(httpTransport.streamable).toBeDefined();
    expect(typeof httpTransport.streamable).toBe('object');
    expect(Object.keys(httpTransport.streamable)).toHaveLength(0);
  });

  it('should have a postSessionRequest method', () => {
    expect(typeof httpTransport.postSessionRequest).toBe('function');
  });

  it('should call setCurrentBearerToken and handleRequest if sessionId and bearer auth', async () => {
    const setCurrentBearerToken = jest.fn();
    const handleRequest = jest.fn();
    httpTransport.streamable['sess2'] = {
      transport: { handleRequest },
      server: { setCurrentBearerToken },
      owner: { authType: 'bearer' },
    } as any;
    const req = {
      headers: { 'mcp-session-id': 'sess2' },
      body: {},
      auth: { token: 'token', clientId: 'user-1', scopes: [] },
    } as any;
    const res = {} as any;
    await httpTransport.postSessionRequest(req, res);
    expect(setCurrentBearerToken).toHaveBeenCalledWith('token');
    expect(handleRequest).toHaveBeenCalled();
  });

  it('should rebind the bearer token on every reuse so refreshed tokens take effect', async () => {
    const setCurrentBearerToken = jest.fn();
    const handleRequest = jest.fn();
    httpTransport.streamable['sess2b'] = {
      transport: { handleRequest },
      server: { setCurrentBearerToken },
      owner: { authType: 'bearer' },
    } as any;
    const req = {
      headers: { 'mcp-session-id': 'sess2b' },
      body: {},
      auth: { token: 'refreshed-token', clientId: 'user-1', scopes: [] },
    } as any;
    await httpTransport.postSessionRequest(req, { headers: {} } as any);
    expect(setCurrentBearerToken).toHaveBeenCalledWith('refreshed-token');
  });

  it('should reject reuse of a bearer session when an API key header is presented', async () => {
    const setCurrentBearerToken = jest.fn();
    const handleRequest = jest.fn();
    httpTransport.streamable['sess3'] = {
      transport: { handleRequest },
      server: { setCurrentBearerToken },
      owner: { authType: 'bearer' },
    } as any;
    const req = {
      headers: { 'mcp-session-id': 'sess3' },
      body: {},
      auth: { token: 'attacker-key', clientId: API_KEY_CLIENT_ID, scopes: [] },
    } as any;
    const setHeader = jest.fn().mockReturnThis();
    const res = {
      status: jest.fn().mockReturnThis(),
      set: setHeader,
      json: jest.fn(),
    } as any;
    await httpTransport.postSessionRequest(req, res);
    expect(res.status).toHaveBeenCalledWith(401);
    expect(setCurrentBearerToken).not.toHaveBeenCalled();
    expect(handleRequest).not.toHaveBeenCalled();
  });

  it('should reject reuse of an API-key session presented with a different key', async () => {
    const handleRequest = jest.fn();
    const owner = sessionOwnerFromAuth({
      token: 'victim-key',
      clientId: API_KEY_CLIENT_ID,
      scopes: [],
    } as any);
    httpTransport.streamable['sess4'] = {
      transport: { handleRequest },
      server: { setCurrentBearerToken: jest.fn() },
      owner,
    } as any;
    const req = {
      headers: { 'mcp-session-id': 'sess4' },
      body: {},
      auth: { token: 'attacker-key', clientId: API_KEY_CLIENT_ID, scopes: [] },
    } as any;
    const res = {
      status: jest.fn().mockReturnThis(),
      set: jest.fn().mockReturnThis(),
      json: jest.fn(),
    } as any;
    await httpTransport.postSessionRequest(req, res);
    expect(res.status).toHaveBeenCalledWith(401);
    expect(handleRequest).not.toHaveBeenCalled();
  });

  it('should allow reuse of an API-key session presented with the same key', async () => {
    const handleRequest = jest.fn();
    const setCurrentBearerToken = jest.fn();
    const owner = sessionOwnerFromAuth({
      token: 'same-key',
      clientId: API_KEY_CLIENT_ID,
      scopes: [],
    } as any);
    httpTransport.streamable['sess5'] = {
      transport: { handleRequest },
      server: { setCurrentBearerToken },
      owner,
    } as any;
    const req = {
      headers: { 'mcp-session-id': 'sess5' },
      body: {},
      auth: { token: 'same-key', clientId: API_KEY_CLIENT_ID, scopes: [] },
    } as any;
    await httpTransport.postSessionRequest(req, { headers: {} } as any);
    // API-key sessions are already bound to the key, so no bearer rebind occurs.
    expect(setCurrentBearerToken).not.toHaveBeenCalled();
    expect(handleRequest).toHaveBeenCalled();
  });

  it('should create transport with enableJsonResponse: true on init', async () => {
    const connectWithApiKey = jest.fn().mockResolvedValue(undefined);
    const handleRequest = jest.fn(async () => {});
    const fakeAdapter = {
      connectWithApiKey,
      connectWithBearer: jest.fn(),
      setCurrentBearerToken: jest.fn(),
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
      auth: { token: 'test-key', clientId: API_KEY_CLIENT_ID, scopes: [] },
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

  it('should create a new session on init with bearer', async () => {
    const connectWithBearer = jest.fn();
    const fakeAdapter = {
      connectWithBearer,
      connectWithApiKey: jest.fn(),
      setCurrentBearerToken: jest.fn(),
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
      auth: { token: 'bearer-token', clientId: 'user-1', scopes: [] },
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
  });

  it('should create a new session on init with API key', async () => {
    const connectWithApiKey = jest.fn().mockResolvedValue(undefined);
    const handleRequest = jest.fn(async () => {});
    const fakeAdapter = {
      connectWithApiKey,
      connectWithBearer: jest.fn(),
      setCurrentBearerToken: jest.fn(),
      server: {},
      client: {},
      isMode: jest.fn(),
    } as any;

    httpTransport.gateway.makeInstanceAdapterMcpServer = jest.fn(() => fakeAdapter);

    const req = {
      headers: {},
      body: { jsonrpc: '2.0', method: 'initialize', id: 1, params: {} },
      auth: { token: 'test-api-key', clientId: API_KEY_CLIENT_ID, scopes: [] },
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

  it('should return 400 if no sessionId and not an init request', async () => {
    const req = {
      headers: {},
      body: {},
      auth: { token: 'tok', clientId: 'user-1', scopes: [] },
    } as any;
    const res = { status: jest.fn().mockReturnThis(), json: jest.fn() } as any;
    await httpTransport.postSessionRequest(req, res);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ error: expect.anything() }));
  });

  it('should call handleSessionRequest and return 400 if sessionId missing', async () => {
    const req = { headers: {}, auth: { token: 'tok', clientId: 'user-1', scopes: [] } } as any;
    const res = { status: jest.fn().mockReturnThis(), send: jest.fn() } as any;
    await httpTransport.handleSessionRequest(req, res);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.send).toHaveBeenCalledWith('Invalid or missing session ID');
  });

  it('should handle handleSessionRequest with valid sessionId owned by the requester', async () => {
    const handleRequest = jest.fn(async () => {});
    httpTransport.streamable['valid-sess'] = {
      transport: { handleRequest },
      server: { setCurrentBearerToken: jest.fn() },
      owner: { authType: 'bearer' },
    } as any;

    const req = {
      headers: { 'mcp-session-id': 'valid-sess' },
      body: {},
      auth: { token: 'tok', clientId: 'user-1', scopes: [] },
    } as any;
    const res = {} as any;

    await httpTransport.handleSessionRequest(req, res);
    expect(handleRequest).toHaveBeenCalled();
  });

  it('should reject handleSessionRequest from a non-owning principal', async () => {
    const handleRequest = jest.fn(async () => {});
    httpTransport.streamable['owned-sess'] = {
      transport: { handleRequest },
      server: { setCurrentBearerToken: jest.fn() },
      owner: { authType: 'bearer' },
    } as any;

    const req = {
      headers: { 'mcp-session-id': 'owned-sess' },
      body: {},
      auth: { token: 'attacker-key', clientId: API_KEY_CLIENT_ID, scopes: [] },
    } as any;
    const res = {
      status: jest.fn().mockReturnThis(),
      set: jest.fn().mockReturnThis(),
      json: jest.fn(),
    } as any;

    await httpTransport.handleSessionRequest(req, res);
    expect(res.status).toHaveBeenCalledWith(401);
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
});
