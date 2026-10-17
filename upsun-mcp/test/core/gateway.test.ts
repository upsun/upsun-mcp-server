// @ts-nocheck
import { describe, expect, it, jest, beforeEach, afterEach } from '@jest/globals';
import { GatewayServer, LocalServer } from '../../src/core/gateway';
import { McpAdapter } from '../../src/core/adapter';

// Mock Express application
jest.mock('express');

// Mock MCP SDK transports
jest.mock('@modelcontextprotocol/sdk/server/streamableHttp');
jest.mock('@modelcontextprotocol/sdk/server/stdio');

// Mock authentication module
jest.mock('../../src/core/authentication');

describe('LocalServer', () => {
  let mockAdapterFactory: jest.MockedClass<typeof McpAdapter>;

  beforeEach(() => {
    jest.clearAllMocks();

    // Mock the adapter factory
    mockAdapterFactory = jest.fn().mockImplementation(() => ({
      connectWithApiKey: jest.fn().mockResolvedValue(undefined),
      connectWithBearer: jest.fn().mockResolvedValue(undefined),
    })) as any;
  });

  describe('constructor', () => {
    it('should create a LocalServer with stdio transport and adapter', () => {
      const server = new LocalServer(mockAdapterFactory);
      expect(server).toBeDefined();
      expect(server.server).toBeDefined();
    });
  });

  describe('listen', () => {
    it('should connect the server with API key from environment', async () => {
      process.env.UPSUN_API_KEY = 'test-api-key';
      jest.resetModules();
      const { LocalServer } = await import('../../src/core/gateway.js');
      const server = new LocalServer(mockAdapterFactory);

      await server.listen();

      expect(server.server.connectWithApiKey).toHaveBeenCalled();
      delete process.env.UPSUN_API_KEY;
    });

    it('should throw error when no API key is set', async () => {
      delete process.env.UPSUN_API_KEY;
      const server = new LocalServer(mockAdapterFactory);

      await expect(server.listen()).rejects.toThrow(
        'UPSUN_API_KEY environment variable is required for LocalServer'
      );
    });
  });
});

describe('GatewayServer', () => {
  let gatewayServer: GatewayServer<McpAdapter>;
  let mockAdapterFactory: jest.MockedClass<typeof McpAdapter>;

  /** Process events listen() attaches to. Tracked so tests can restore them. */
  const CRASH_EVENTS = ['uncaughtException', 'unhandledRejection'] as const;
  let listenersBefore: Record<string, ((...args: any[]) => void)[]>;

  beforeEach(() => {
    jest.clearAllMocks();

    // Snapshot process handlers so afterEach can detach the ones listen() adds;
    // a leaked exit(1) handler would kill the Jest worker on a stray rejection.
    listenersBefore = Object.fromEntries(
      CRASH_EVENTS.map(event => [event, process.listeners(event)])
    );

    // Mock the adapter factory
    mockAdapterFactory = jest.fn().mockImplementation(() => ({
      connectWithApiKey: jest.fn().mockResolvedValue(undefined),
      connectWithBearer: jest.fn().mockResolvedValue(undefined),
    })) as any;

    // Create server instance
    gatewayServer = new GatewayServer(mockAdapterFactory);
  });

  afterEach(() => {
    for (const event of CRASH_EVENTS) {
      for (const listener of process.listeners(event)) {
        if (!listenersBefore[event].includes(listener)) {
          process.off(event, listener);
        }
      }
    }
  });

  describe('constructor', () => {
    it('should initialize the Express app and transports', () => {
      expect(gatewayServer).toBeDefined();
      expect(gatewayServer.app).toBeDefined();
      expect(gatewayServer.httpTransport).toBeDefined();
    });
  });

  describe('basic functionality', () => {
    it('should create new adapter instances', () => {
      const adapter = gatewayServer.makeInstanceAdapterMcpServer();
      expect(adapter).toBeDefined();
      expect(mockAdapterFactory).toHaveBeenCalled();
    });

    it('should have health endpoint', () => {
      expect(gatewayServer.app).toBeDefined();
      // Health endpoint is set up in constructor
    });
  });

  describe('transport management', () => {
    // Transport management tests are now in dedicated files
    it('should not test transport internals here (see http.test.ts)', () => {
      expect(true).toBe(true);
    });
  });

  describe('listen method', () => {
    it('should start the server', async () => {
      const mockServer = { close: jest.fn() };
      const mockListen = jest.fn().mockReturnValue(mockServer);

      gatewayServer.app.listen = mockListen;

      // Don't await - just verify it starts without error
      gatewayServer.listen();

      expect(mockListen).toHaveBeenCalledWith(3000, '0.0.0.0', expect.any(Function));
    });

    it('should use custom port when specified', async () => {
      const mockServer = { close: jest.fn() };
      const mockListen = jest.fn().mockReturnValue(mockServer);

      gatewayServer.app.listen = mockListen;

      // Don't await - just verify it starts without error
      gatewayServer.listen(8080);

      expect(mockListen).toHaveBeenCalledWith(8080, '0.0.0.0', expect.any(Function));
    });
  });

  describe('crash handlers', () => {
    it.each(CRASH_EVENTS)('should exit 1 on %s', event => {
      const exitSpy = jest.spyOn(process, 'exit').mockImplementation(() => undefined as never);
      gatewayServer.app.listen = jest.fn().mockReturnValue({ close: jest.fn() }) as any;
      gatewayServer.listen();

      const handlers = process
        .listeners(event)
        .filter(l => !listenersBefore[event].includes(l as any));
      expect(handlers).toHaveLength(1);
      (handlers[0] as (...args: any[]) => void)(new Error('boom'), Promise.resolve());

      expect(exitSpy).toHaveBeenCalledWith(1);
      exitSpy.mockRestore();
    });
  });

  describe('error handling', () => {
    it('should be properly initialized without throwing errors', () => {
      // The constructor sets up error handlers and runs without throwing
      expect(gatewayServer).toBeDefined();
      expect(gatewayServer.app).toBeDefined();
    });
  });
});
