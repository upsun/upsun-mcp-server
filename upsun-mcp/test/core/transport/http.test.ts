import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import { GatewayServer } from '../../../src/core/gateway';
import { HttpTransport } from '../../../src/core/transport/http';

// Local patch to simulate isInitializeRequest if the dependency is missing
function isInitializeRequest(body: any): boolean {
  return body && body.jsonrpc === '2.0' && body.method === 'initialize';
}

describe('HttpTransport', () => {
  it('should return 401 if sessionId exists but no token', async () => {
    httpTransport.streamable['sess1'] = {
      transport: { handleRequest: jest.fn() },
      server: { setCurrentBearerToken: jest.fn() },
    } as any;
    const req = { headers: { 'mcp-session-id': 'sess1' }, body: {} } as any;
    const res = { status: jest.fn().mockReturnThis(), json: jest.fn() } as any;
    await httpTransport.postSessionRequest(req, res);
    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ error: 'missing_token' }));
  });

  it('should call setCurrentBearerToken and handleRequest if sessionId and bearer', async () => {
    const setCurrentBearerToken = jest.fn();
    const handleRequest = jest.fn();
    httpTransport.streamable['sess2'] = {
      transport: { handleRequest },
      server: { setCurrentBearerToken },
    } as any;
    const req = {
      headers: { 'mcp-session-id': 'sess2', authorization: 'Bearer token' },
      body: {},
      get: () => 'Bearer token',
    } as any;
    const res = {} as any;
    await httpTransport.postSessionRequest(req, res);
    // The source code extracts the token without the "Bearer " prefix
    expect(setCurrentBearerToken).toHaveBeenCalledWith('token');
    expect(handleRequest).toHaveBeenCalled();
  });

  it('should create a new session on init with bearer', async () => {
    const connectWithBearer = jest.fn();
    // Complete mock for McpAdapter
    const fakeAdapter = {
      connectWithBearer,
      connectWithApiKey: jest.fn(),
      setCurrentBearerToken: jest.fn(),
      server: {
        server: jest.fn(),
        _registeredResources: [],
        _registeredResourceTemplates: [],
        _registeredTools: [] /* ...autres props mockées... */,
      },
      client: {},
      isMode: jest.fn(),
    } as any;
    // Patch StreamableHTTPServerTransport to inject a compatible handleRequest
    const handleRequest = jest.fn(async () => {});
    const makeInstanceAdapterMcpServer = jest.fn(() => fakeAdapter);
    httpTransport.gateway.makeInstanceAdapterMcpServer = makeInstanceAdapterMcpServer;
    // No session header, body strictly conforms to isInitializeRequest
    const req = {
      headers: { authorization: 'Bearer token' },
      body: { jsonrpc: '2.0', method: 'initialize', id: 1, params: {} },
      get: () => 'Bearer token',
    } as any;
    // No need to patch isInitializeRequest anymore, the local version is used in the source code
    // Mock res.status and res.json to avoid the error
    const res = { status: jest.fn().mockReturnThis(), json: jest.fn() } as any;
    // Patch StreamableHTTPServerTransport to inject handleRequest (import dynamique ESM)
    const mod = await import('@modelcontextprotocol/sdk/server/streamableHttp.js');
    mod.StreamableHTTPServerTransport.prototype.handleRequest = handleRequest;
    await httpTransport.postSessionRequest(req, res);
    expect(makeInstanceAdapterMcpServer).toHaveBeenCalled();
    expect(connectWithBearer).toHaveBeenCalled();
    expect(handleRequest).toHaveBeenCalled();
  });

  it('should handle error in closeAllSessions', async () => {
    httpTransport.streamable['err'] = {
      transport: { close: jest.fn().mockRejectedValue('fail' as never) },
      server: {},
    } as any;
    await httpTransport.closeAllSessions();
    // Wait for the microtask queue to resolve for effective deletion
    await Promise.resolve();
    expect(httpTransport.streamable['err']).toBeUndefined();
  });
  let gateway: GatewayServer<any>;
  let httpTransport: HttpTransport;

  beforeEach(() => {
    gateway = {
      /* minimal mock */
    } as any;
    httpTransport = new HttpTransport(gateway);
  });

  it('should initialize with an empty streamable object', () => {
    expect(httpTransport.streamable).toBeDefined();
    expect(typeof httpTransport.streamable).toBe('object');
    expect(Object.keys(httpTransport.streamable)).toHaveLength(0);
  });

  it('should have a postSessionRequest method', () => {
    expect(typeof httpTransport.postSessionRequest).toBe('function');
  });

  it('should return 400 if no sessionId and not an init request', async () => {
    const req = { headers: {}, body: {} } as any;
    const res = { status: jest.fn().mockReturnThis(), json: jest.fn() } as any;
    await httpTransport.postSessionRequest(req, res);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ error: expect.anything() }));
  });

  it('should return 401 if init request but no token', async () => {
    const req = { headers: {}, body: { jsonrpc: '2.0', method: 'initialize' } } as any;
    const res = { status: jest.fn().mockReturnThis(), json: jest.fn() } as any;
    await httpTransport.postSessionRequest(req, res);
    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ error: expect.anything() }));
  });

  it('should call handleSessionRequest and return 400 if sessionId missing', async () => {
    const req = { headers: {} } as any;
    const res = { status: jest.fn().mockReturnThis(), send: jest.fn() } as any;
    await httpTransport.handleSessionRequest(req, res);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.send).toHaveBeenCalledWith('Invalid or missing session ID');
  });

  it('should call closeAllSessions and clear streamable', async () => {
    // Simulate an open session
    httpTransport.streamable['abc'] = { transport: { close: jest.fn() }, server: {} } as any;
    await httpTransport.closeAllSessions();
    expect(httpTransport.streamable['abc']).toBeUndefined();
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

  it('should handle handleSessionRequest with missing sessionId', async () => {
    const req = { headers: {} } as any;
    const res = { status: jest.fn().mockReturnThis(), send: jest.fn() } as any;

    await httpTransport.handleSessionRequest(req, res);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.send).toHaveBeenCalledWith('Invalid or missing session ID');
  });

  it('should handle POST with API key', async () => {
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
      headers: { 'upsun-api-token': 'test-api-key' },
      body: { jsonrpc: '2.0', method: 'initialize', id: 1, params: {} },
    } as any;
    const res = { status: jest.fn().mockReturnThis(), json: jest.fn() } as any;

    const mod = await import('@modelcontextprotocol/sdk/server/streamableHttp.js');
    mod.StreamableHTTPServerTransport.prototype.handleRequest = handleRequest;

    await httpTransport.postSessionRequest(req, res);

    expect(connectWithApiKey).toHaveBeenCalled();
    expect(handleRequest).toHaveBeenCalled();
  });
});
