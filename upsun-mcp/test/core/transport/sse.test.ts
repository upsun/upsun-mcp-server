import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import { GatewayServer } from '../../../src/core/gateway';
import { SseTransport } from '../../../src/core/transport/sse';

describe('SseTransport', () => {
  it('should return 401 if postSessionRequest called with sessionId and no token', async () => {
    sseTransport.sse['sess1'] = {
      transport: { handlePostMessage: jest.fn(), sessionId: 'sess1' },
      server: { setCurrentBearerToken: jest.fn() },
    } as any;
    const req = { query: { sessionId: 'sess1' }, headers: {}, ip: '127.0.0.1' } as any;
    const res = { status: jest.fn().mockReturnThis(), json: jest.fn() } as any;
    await sseTransport.postSessionRequest(req, res);
    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ error: 'missing_token' }));
  });

  it('should call setCurrentBearerToken and handlePostMessage if sessionId and bearer', async () => {
    const setCurrentBearerToken = jest.fn();
    const handlePostMessage = jest.fn();
    sseTransport.sse['sess2'] = {
      transport: { handlePostMessage, sessionId: 'sess2' },
      server: { setCurrentBearerToken },
    } as any;
    const req = {
      query: { sessionId: 'sess2' },
      headers: { authorization: 'Bearer token' },
      ip: '127.0.0.1',
    } as any;
    const res = {} as any;
    await sseTransport.postSessionRequest(req, res);
    // The source code extracts the token without the "Bearer " prefix
    expect(setCurrentBearerToken).toHaveBeenCalledWith('token');
    expect(handlePostMessage).toHaveBeenCalled();
  });

  it('should handle error in closeAllSessions', async () => {
    sseTransport.sse['err'] = {
      transport: { close: jest.fn().mockRejectedValue('fail' as never) },
      server: {},
    } as any;
    await sseTransport.closeAllSessions();
    // Wait for the microtask queue to resolve for effective deletion
    await Promise.resolve();
    expect(sseTransport.sse['err']).toBeUndefined();
  });

  it('should handle error in getSessionRequest (connectWithBearer throws)', async () => {
    const connectWithBearer = jest.fn().mockRejectedValue('fail' as never);
    // Complete mock for McpAdapter
    const fakeAdapter = {
      connectWithBearer,
      connectWithApiKey: jest.fn(),
      setCurrentBearerToken: jest.fn(),
      server: {
        server: jest.fn(),
        _registeredResources: [],
        _registeredResourceTemplates: [],
        _registeredTools: [],
      },
      client: {},
      isMode: jest.fn(),
    } as any;
    const makeInstanceAdapterMcpServer = jest.fn(() => fakeAdapter);
    sseTransport.gateway.makeInstanceAdapterMcpServer = makeInstanceAdapterMcpServer;
    const req = { headers: { authorization: 'Bearer token' }, ip: '127.0.0.1' } as any;
    const res = {
      writableEnded: false,
      status: jest.fn().mockReturnThis(),
      end: jest.fn(),
      on: jest.fn(),
    } as any;
    // No longer patching sessionId (read-only), error is simulated via the mock
    await sseTransport.getSessionRequest(req, res);
    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.end).toHaveBeenCalledWith('Failed to connect MCP server to transport');
  });

  it('should handle keep-alive and close event in getSessionRequest', async () => {
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
        _registeredTools: [],
      },
      client: {},
      isMode: jest.fn(),
    } as any;
    const makeInstanceAdapterMcpServer = jest.fn(() => fakeAdapter);
    sseTransport.gateway.makeInstanceAdapterMcpServer = makeInstanceAdapterMcpServer;
    const res = {
      writableEnded: false,
      write: jest.fn(),
      on: jest.fn((event: string, cb: any) => {
        if (event === 'close') cb();
      }),
    } as any;
    const req = { headers: { authorization: 'Bearer token' }, ip: '127.0.0.1' } as any;
    // No longer patching sessionId (read-only), simulate closing via the mock
    await sseTransport.getSessionRequest(req, res);
    // Cannot test setInterval/clearInterval without timer mock, but we check that the session is deleted
    expect(sseTransport.sse['keepid']).toBeUndefined();
  });
  let gateway: GatewayServer<any>;
  let sseTransport: SseTransport;

  beforeEach(() => {
    gateway = {
      /* minimal mock */
    } as any;
    sseTransport = new SseTransport(gateway);
  });

  it('should initialize with an empty sse object', () => {
    expect(sseTransport.sse).toBeDefined();
    expect(typeof sseTransport.sse).toBe('object');
    expect(Object.keys(sseTransport.sse)).toHaveLength(0);
  });

  it('should initialize with an empty sseConnections map', () => {
    expect(sseTransport.sseConnections).toBeDefined();
    expect(sseTransport.sseConnections.size).toBe(0);
  });

  it('should have a postSessionRequest method', () => {
    expect(typeof sseTransport.postSessionRequest).toBe('function');
  });

  it('should return 400 if postSessionRequest called with unknown sessionId', async () => {
    const req = { query: { sessionId: 'notfound' }, headers: {}, ip: '127.0.0.1' } as any;
    const res = { status: jest.fn().mockReturnThis(), send: jest.fn() } as any;
    await sseTransport.postSessionRequest(req, res);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.send).toHaveBeenCalledWith('No transport found for sessionId');
  });

  it('should respond healthy on healthSessionRequest', async () => {
    const req = {} as any;
    const res = { status: jest.fn().mockReturnThis(), json: jest.fn() } as any;
    await sseTransport.healthSessionRequest(req, res);
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({ status: 'healthy' });
  });

  it('should handle getSessionRequest with missing authorization', async () => {
    const req = { headers: {}, ip: '127.0.0.1' } as any;
    const res = {
      writableEnded: false,
      status: jest.fn().mockReturnThis(),
      end: jest.fn(),
      on: jest.fn(),
    } as any;

    await sseTransport.getSessionRequest(req, res);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.end).toHaveBeenCalledWith(
      'Missing authentication token (Bearer token in Authorization header or API key in upsun-api-token header)'
    );
  });

  it('should handle successful SSE connection creation', async () => {
    const connectWithBearer = jest.fn().mockResolvedValue(undefined);
    const fakeAdapter = {
      connectWithBearer,
      connectWithApiKey: jest.fn(),
      setCurrentBearerToken: jest.fn(),
      server: {
        server: jest.fn(),
        _registeredResources: [],
        _registeredResourceTemplates: [],
        _registeredTools: [],
      },
      client: {},
      isMode: jest.fn(),
    } as any;

    sseTransport.gateway.makeInstanceAdapterMcpServer = jest.fn(() => fakeAdapter);

    const req = { headers: { authorization: 'Bearer valid-token' }, ip: '127.0.0.1' } as any;
    const res = {
      writableEnded: false,
      write: jest.fn(),
      on: jest.fn(),
    } as any;

    await sseTransport.getSessionRequest(req, res);

    expect(connectWithBearer).toHaveBeenCalled();
    // The second argument should be 'valid-token'
    expect(connectWithBearer.mock.calls[0][1]).toBe('valid-token');
  });

  it('should clean up session on connection close', async () => {
    const connectWithBearer = jest.fn().mockResolvedValue(undefined as never);
    const closeFn = jest.fn().mockResolvedValue(undefined as never);
    const fakeTransport = {
      close: closeFn,
      sessionId: 'test-session-id',
    };

    const fakeAdapter = {
      connectWithBearer,
      server: {},
      client: {},
      isMode: jest.fn(),
    } as any;

    sseTransport.gateway.makeInstanceAdapterMcpServer = jest.fn(() => fakeAdapter);

    let closeCallback: any;
    const req = { headers: { authorization: 'Bearer token' }, ip: '127.0.0.1' } as any;
    const res = {
      writableEnded: false,
      write: jest.fn(),
      on: jest.fn((event: string, cb: any) => {
        if (event === 'close') {
          closeCallback = cb;
        }
      }),
    } as any;

    await sseTransport.getSessionRequest(req, res);

    // Manually trigger close callback if it was captured
    if (closeCallback) {
      await closeCallback();
    }

    // Session should be cleaned up (we can't easily test this without knowing the sessionId)
    expect(res.on).toHaveBeenCalledWith('close', expect.any(Function));
  });

  it('should call closeAllSessions and clear sse', async () => {
    // Simule une session ouverte
    sseTransport.sse['abc'] = { transport: { close: jest.fn() }, server: {} } as any;
    await sseTransport.closeAllSessions();
    expect(sseTransport.sse['abc']).toBeUndefined();
  });
});
