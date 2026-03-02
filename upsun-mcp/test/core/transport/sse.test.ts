import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import { GatewayServer } from '../../../src/core/gateway';
import { SseTransport } from '../../../src/core/transport/sse';
import { API_KEY_CLIENT_ID } from '../../../src/core/authentication';

describe('SseTransport', () => {
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

  it('should call setCurrentBearerToken and handlePostMessage if sessionId and bearer', async () => {
    const setCurrentBearerToken = jest.fn();
    const handlePostMessage = jest.fn();
    sseTransport.sse['sess2'] = {
      transport: { handlePostMessage, sessionId: 'sess2' },
      server: { setCurrentBearerToken },
    } as any;
    const req = {
      query: { sessionId: 'sess2' },
      headers: {},
      ip: '127.0.0.1',
      auth: { token: 'token', clientId: 'user-1', scopes: [] },
    } as any;
    const res = {} as any;
    await sseTransport.postSessionRequest(req, res);
    expect(setCurrentBearerToken).toHaveBeenCalledWith('token');
    expect(handlePostMessage).toHaveBeenCalled();
  });

  it('should not call setCurrentBearerToken for API key auth', async () => {
    const setCurrentBearerToken = jest.fn();
    const handlePostMessage = jest.fn();
    sseTransport.sse['sess3'] = {
      transport: { handlePostMessage, sessionId: 'sess3' },
      server: { setCurrentBearerToken },
    } as any;
    const req = {
      query: { sessionId: 'sess3' },
      headers: {},
      ip: '127.0.0.1',
      auth: { token: 'my-key', clientId: API_KEY_CLIENT_ID, scopes: [] },
    } as any;
    const res = {} as any;
    await sseTransport.postSessionRequest(req, res);
    expect(setCurrentBearerToken).not.toHaveBeenCalled();
    expect(handlePostMessage).toHaveBeenCalled();
  });

  it('should return 400 if postSessionRequest called with unknown sessionId', async () => {
    const req = {
      query: { sessionId: 'notfound' },
      headers: {},
      ip: '127.0.0.1',
      auth: { token: 'tok', clientId: 'user-1', scopes: [] },
    } as any;
    const res = { status: jest.fn().mockReturnThis(), send: jest.fn() } as any;
    await sseTransport.postSessionRequest(req, res);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.send).toHaveBeenCalledWith('No transport found for sessionId');
  });

  it('should handle successful SSE connection creation with bearer', async () => {
    const connectWithBearer = jest.fn().mockResolvedValue(undefined);
    const fakeAdapter = {
      connectWithBearer,
      connectWithApiKey: jest.fn(),
      setCurrentBearerToken: jest.fn(),
      server: {},
      client: {},
      isMode: jest.fn(),
    } as any;

    sseTransport.gateway.makeInstanceAdapterMcpServer = jest.fn(() => fakeAdapter);

    const req = {
      headers: {},
      ip: '127.0.0.1',
      auth: { token: 'valid-token', clientId: 'user-1', scopes: [] },
    } as any;
    const res = {
      writableEnded: false,
      write: jest.fn(),
      on: jest.fn(),
    } as any;

    await sseTransport.getSessionRequest(req, res);

    expect(connectWithBearer).toHaveBeenCalled();
    expect(connectWithBearer.mock.calls[0][1]).toBe('valid-token');
  });

  it('should handle SSE connection creation with API key', async () => {
    const connectWithApiKey = jest.fn().mockResolvedValue(undefined);
    const fakeAdapter = {
      connectWithApiKey,
      connectWithBearer: jest.fn(),
      setCurrentBearerToken: jest.fn(),
      server: {},
      client: {},
      isMode: jest.fn(),
    } as any;

    sseTransport.gateway.makeInstanceAdapterMcpServer = jest.fn(() => fakeAdapter);

    const req = {
      headers: {},
      ip: '127.0.0.1',
      auth: { token: 'my-api-key', clientId: API_KEY_CLIENT_ID, scopes: [] },
    } as any;
    const res = {
      writableEnded: false,
      write: jest.fn(),
      on: jest.fn(),
    } as any;

    await sseTransport.getSessionRequest(req, res);

    expect(connectWithApiKey).toHaveBeenCalledWith(expect.anything(), 'my-api-key');
  });

  it('should handle error in getSessionRequest (connectWithBearer throws)', async () => {
    const connectWithBearer = jest.fn().mockRejectedValue('fail' as never);
    const fakeAdapter = {
      connectWithBearer,
      connectWithApiKey: jest.fn(),
      setCurrentBearerToken: jest.fn(),
      server: {},
      client: {},
      isMode: jest.fn(),
    } as any;
    sseTransport.gateway.makeInstanceAdapterMcpServer = jest.fn(() => fakeAdapter);
    const req = {
      headers: {},
      ip: '127.0.0.1',
      auth: { token: 'token', clientId: 'user-1', scopes: [] },
    } as any;
    const res = {
      writableEnded: false,
      status: jest.fn().mockReturnThis(),
      end: jest.fn(),
      on: jest.fn(),
    } as any;
    await sseTransport.getSessionRequest(req, res);
    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.end).toHaveBeenCalledWith('Failed to connect MCP server to transport');
  });

  it('should handle keep-alive and close event in getSessionRequest', async () => {
    const connectWithBearer = jest.fn();
    const fakeAdapter = {
      connectWithBearer,
      connectWithApiKey: jest.fn(),
      setCurrentBearerToken: jest.fn(),
      server: {},
      client: {},
      isMode: jest.fn(),
    } as any;
    sseTransport.gateway.makeInstanceAdapterMcpServer = jest.fn(() => fakeAdapter);
    const res = {
      writableEnded: false,
      write: jest.fn(),
      on: jest.fn((event: string, cb: any) => {
        if (event === 'close') cb();
      }),
    } as any;
    const req = {
      headers: {},
      ip: '127.0.0.1',
      auth: { token: 'token', clientId: 'user-1', scopes: [] },
    } as any;
    await sseTransport.getSessionRequest(req, res);
    expect(sseTransport.sse['keepid']).toBeUndefined();
  });

  it('should clean up session on connection close', async () => {
    const connectWithBearer = jest.fn().mockResolvedValue(undefined as never);
    const fakeAdapter = {
      connectWithBearer,
      server: {},
      client: {},
      isMode: jest.fn(),
    } as any;

    sseTransport.gateway.makeInstanceAdapterMcpServer = jest.fn(() => fakeAdapter);

    let closeCallback: any;
    const req = {
      headers: {},
      ip: '127.0.0.1',
      auth: { token: 'token', clientId: 'user-1', scopes: [] },
    } as any;
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

    if (closeCallback) {
      await closeCallback();
    }

    expect(res.on).toHaveBeenCalledWith('close', expect.any(Function));
  });

  it('should respond healthy on healthSessionRequest', async () => {
    const req = {} as any;
    const res = { status: jest.fn().mockReturnThis(), json: jest.fn() } as any;
    await sseTransport.healthSessionRequest(req, res);
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({ status: 'healthy' });
  });

  it('should call closeAllSessions and clear sse', async () => {
    sseTransport.sse['abc'] = { transport: { close: jest.fn() }, server: {} } as any;
    await sseTransport.closeAllSessions();
    expect(sseTransport.sse['abc']).toBeUndefined();
  });

  it('should handle error in closeAllSessions', async () => {
    sseTransport.sse['err'] = {
      transport: { close: jest.fn().mockRejectedValue('fail' as never) },
      server: {},
    } as any;
    await sseTransport.closeAllSessions();
    await Promise.resolve();
    expect(sseTransport.sse['err']).toBeUndefined();
  });
});
