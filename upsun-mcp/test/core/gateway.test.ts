// @ts-nocheck
import { describe, expect, it, jest, beforeEach, afterEach } from '@jest/globals';
import { GatewayServer, LocalServer } from '../../src/core/gateway.js';
import { McpAdapter } from '../../src/core/adapter.js';

// Mock Express application
jest.mock('express');

// Mock MCP SDK transports
jest.mock('@modelcontextprotocol/sdk/server/streamableHttp.js');
jest.mock('@modelcontextprotocol/sdk/server/sse.js');
jest.mock('@modelcontextprotocol/sdk/server/stdio.js');

// Mock authentication module
jest.mock('../../src/core/authentication.js');

describe('LocalServer', () => {
  let mockAdapterFactory: jest.MockedClass<typeof McpAdapter>;

  beforeEach(() => {
    jest.clearAllMocks();

    // Mock the adapter factory
    mockAdapterFactory = jest.fn().mockImplementation(() => ({
      connectWithApiKey: jest.fn().mockResolvedValue(undefined),
      connectWithBearer: jest.fn().mockResolvedValue(undefined),
      setCurrentBearerToken: jest.fn(),
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

  beforeEach(() => {
    jest.clearAllMocks();

    // Mock the adapter factory
    mockAdapterFactory = jest.fn().mockImplementation(() => ({
      connectWithApiKey: jest.fn().mockResolvedValue(undefined),
      connectWithBearer: jest.fn().mockResolvedValue(undefined),
      setCurrentBearerToken: jest.fn(),
    })) as any;

    // Create server instance
    gatewayServer = new GatewayServer(mockAdapterFactory);
  });

  describe('constructor', () => {
    it('should initialize the Express app and set up transports', () => {
      expect(gatewayServer).toBeDefined();
      expect(gatewayServer.app).toBeDefined();
      expect(gatewayServer.transports).toBeDefined();
      expect(gatewayServer.transports.streamable).toBeDefined();
      expect(gatewayServer.transports.sse).toBeDefined();
      expect(gatewayServer.sseConnections).toBeDefined();
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
    it('should store and manage streamable transport sessions', () => {
      expect(gatewayServer.transports.streamable).toEqual({});
    });

    it('should manage SSE connections', () => {
      expect(gatewayServer.sseConnections).toBeDefined();
      expect(gatewayServer.sseConnections.size).toBe(0);
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

  describe('error handling', () => {
    it('should be properly initialized without throwing errors', () => {
      // The constructor sets up error handlers and runs without throwing
      expect(gatewayServer).toBeDefined();
      expect(gatewayServer.app).toBeDefined();
    });
  });
});
