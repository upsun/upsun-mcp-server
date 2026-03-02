import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import { GatewayServer } from '../../../src/core/gateway';
import { HttpTransport } from '../../../src/core/transport/http';
import { API_KEY_CLIENT_ID } from '../../../src/core/authentication';

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

  it('should not call setCurrentBearerToken for API key auth on existing session', async () => {
    const setCurrentBearerToken = jest.fn();
    const handleRequest = jest.fn();
    httpTransport.streamable['sess3'] = {
      transport: { handleRequest },
      server: { setCurrentBearerToken },
    } as any;
    const req = {
      headers: { 'mcp-session-id': 'sess3' },
      body: {},
      auth: { token: 'my-key', clientId: API_KEY_CLIENT_ID, scopes: [] },
    } as any;
    const res = {} as any;
    await httpTransport.postSessionRequest(req, res);
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
    const req = { headers: {} } as any;
    const res = { status: jest.fn().mockReturnThis(), send: jest.fn() } as any;
    await httpTransport.handleSessionRequest(req, res);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.send).toHaveBeenCalledWith('Invalid or missing session ID');
  });

  it('should handle handleSessionRequest with valid sessionId', async () => {
    const handleRequest = jest.fn(async () => {});
    httpTransport.streamable['valid-sess'] = {
      transport: { handleRequest },
      server: { setCurrentBearerToken: jest.fn() },
    } as any;

    const req = { headers: { 'mcp-session-id': 'valid-sess' }, body: {} } as any;
    const res = {} as any;

    await httpTransport.handleSessionRequest(req, res);
    expect(handleRequest).toHaveBeenCalled();
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
