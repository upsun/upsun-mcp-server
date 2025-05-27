import { describe, expect, it, jest, beforeEach, afterEach } from '@jest/globals';
import { GatewayServer, LocalServer } from '../../src/core/gateway.js';
import { McpAdapter } from '../../src/core/adapter.js';
import express from 'express';

// Mock the MCP SDK modules
jest.mock('@modelcontextprotocol/sdk/server/streamableHttp.js', () => ({
  StreamableHTTPServerTransport: jest.fn().mockImplementation((options) => ({
    sessionId: 'test-session-id',
    handleRequest: jest.fn().mockResolvedValue(undefined),
    onclose: null,
    close: jest.fn().mockResolvedValue(undefined),
    // Call the session initialized callback when created
    constructor: function() {
      if (options?.onsessioninitialized) {
        setTimeout(() => options.onsessioninitialized('test-session-id'), 0);
      }
      return this;
    }
  }))
}));

jest.mock('@modelcontextprotocol/sdk/server/sse.js', () => ({
  SSEServerTransport: jest.fn().mockImplementation((path, res) => ({
    sessionId: 'test-sse-session-id',
    handlePostMessage: jest.fn().mockResolvedValue(undefined),
    close: jest.fn().mockResolvedValue(undefined)
  }))
}));

jest.mock('@modelcontextprotocol/sdk/server/stdio.js', () => ({
  StdioServerTransport: jest.fn().mockImplementation(() => ({
    sessionId: 'test-stdio-session-id',
    close: jest.fn().mockResolvedValue(undefined)
  }))
}));

// Mock isInitializeRequest with proper jest mock
const mockIsInitializeRequest = jest.fn();
jest.mock('@modelcontextprotocol/sdk/types.js', () => ({
  isInitializeRequest: mockIsInitializeRequest
}));

// Mock crypto.randomUUID
jest.mock('crypto', () => ({
  randomUUID: jest.fn().mockReturnValue('mocked-uuid-1234')
}));

// Create a mock implementation of McpAdapter for testing
class MockAdapter implements McpAdapter {
  server: any;
  client: any;
  
  constructor() {
    this.server = {
      connect: jest.fn().mockResolvedValue(undefined),
      tool: jest.fn()
    };
    this.client = {};
  }

  connect = jest.fn().mockImplementation((transport, apiKey) => {
    return this.server.connect(transport, apiKey);
  });
}

describe('LocalServer', () => {
  let localServer: LocalServer<MockAdapter>;
  let mockAdapterFactory: jest.MockedFunction<new () => MockAdapter>;
  let mockAdapter: MockAdapter;

  beforeEach(() => {
    jest.clearAllMocks();
    mockAdapterFactory = jest.fn().mockImplementation(() => new MockAdapter());
    localServer = new LocalServer(mockAdapterFactory);
    mockAdapter = localServer.server;
  });

  describe('constructor', () => {
    it('should create a LocalServer with stdio transport and adapter', () => {
      expect(mockAdapterFactory).toHaveBeenCalledTimes(1);
      expect(localServer.server).toBeInstanceOf(MockAdapter);
    });
  });

  describe('listen', () => {
    beforeEach(() => {
      // Mock environment variable
      process.env.UPSUN_API_KEY = 'test-api-key';
    });

    afterEach(() => {
      delete process.env.UPSUN_API_KEY;
    });

    it('should connect the server with API key from environment', async () => {
      await localServer.listen();
      
      expect(mockAdapter.connect).toHaveBeenCalledWith(
        expect.anything(), // transport
        'test-api-key'
      );
    });

    it('should connect with empty string when no API key is set', async () => {
      delete process.env.UPSUN_API_KEY;
      
      await localServer.listen();
      
      expect(mockAdapter.connect).toHaveBeenCalledWith(
        expect.anything(), // transport
        ''
      );
    });
  });
});

describe('GatewayServer', () => {
  let gatewayServer: GatewayServer<MockAdapter>;
  let mockExpressApp: any;
  let mockRequest: any;
  let mockResponse: any;
  let mockAdapterFactory: jest.MockedFunction<new () => MockAdapter>;

  beforeEach(() => {
    // Reset all mocks
    jest.clearAllMocks();
    mockIsInitializeRequest.mockClear();
    
    // Mock Express response object
    mockResponse = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
      send: jest.fn().mockReturnThis(),
      write: jest.fn().mockReturnThis(),
      end: jest.fn().mockReturnThis(),
      on: jest.fn(),
      writableEnded: false,
      setHeader: jest.fn(),
      writeHead: jest.fn()
    };

    // Mock Express request object
    mockRequest = {
      headers: {},
      body: {},
      query: {},
      ip: '127.0.0.1'
    };
    
    // Mock Express app and its methods
    mockExpressApp = {
      use: jest.fn(),
      post: jest.fn(),
      get: jest.fn(),
      delete: jest.fn(),
      listen: jest.fn((port, host, callback) => {
        if (callback) callback();
        return mockExpressApp;
      }),
    };
    
    // Mock the adapter factory function
    mockAdapterFactory = jest.fn().mockImplementation(() => new MockAdapter());
    
    // Create a new GatewayServer instance with the mock Express app
    gatewayServer = new GatewayServer(mockAdapterFactory, mockExpressApp as unknown as express.Express);
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  describe('constructor', () => {
    it('should initialize the Express app and set up transports', () => {
      // Verify express.json middleware was added
      expect(mockExpressApp.use).toHaveBeenCalled();
      
      // Verify routes were set up
      expect(mockExpressApp.post).toHaveBeenCalledWith('/mcp', expect.any(Function));
      expect(mockExpressApp.get).toHaveBeenCalledWith('/mcp', expect.any(Function));
      expect(mockExpressApp.delete).toHaveBeenCalledWith('/mcp', expect.any(Function));
      expect(mockExpressApp.get).toHaveBeenCalledWith('/sse', expect.any(Function));
      expect(mockExpressApp.post).toHaveBeenCalledWith('/messages', expect.any(Function));
      expect(mockExpressApp.get).toHaveBeenCalledWith('/health', expect.any(Function));
    });
  });

  describe('Streamable HTTP Transport', () => {
    let postHandler: Function;
    let getHandler: Function;
    let deleteHandler: Function;

    beforeEach(() => {
      // Extract the route handlers
      const postCall = mockExpressApp.post.mock.calls.find((call: any) => call[0] === '/mcp');
      const getCall = mockExpressApp.get.mock.calls.find((call: any) => call[0] === '/mcp');
      const deleteCall = mockExpressApp.delete.mock.calls.find((call: any) => call[0] === '/mcp');
      
      postHandler = postCall[1];
      getHandler = getCall[1];
      deleteHandler = deleteCall[1];
    });

    describe('POST /mcp', () => {
      it('should handle initialization request with API key', async () => {
        mockRequest.headers = {
          'upsun-api-token': 'test-api-key'
        };
        mockRequest.body = { method: 'initialize' };

        // Mock isInitializeRequest to return true
        mockIsInitializeRequest.mockReturnValue(true);

        await postHandler(mockRequest, mockResponse);

        expect(mockAdapterFactory).toHaveBeenCalled();
      });

      it('should reject request without API key for initialization', async () => {
        mockRequest.headers = {};
        mockRequest.body = { method: 'initialize' };

        // Mock isInitializeRequest to return true
        mockIsInitializeRequest.mockReturnValue(true);

        await postHandler(mockRequest, mockResponse);

        expect(mockResponse.status).toHaveBeenCalledWith(400);
        expect(mockResponse.send).toHaveBeenCalledWith('Missing API key for 127.0.0.1');
      });

      it('should handle request with existing session ID', async () => {
        // First create a session by adding it to the transports
        const mockTransport = {
          handleRequest: jest.fn().mockResolvedValue(undefined)
        };
        gatewayServer.transports.streamable['test-session-id'] = mockTransport as any;

        mockRequest.headers = {
          'mcp-session-id': 'test-session-id'
        };
        mockRequest.body = { method: 'some-method' };

        await postHandler(mockRequest, mockResponse);

        expect(mockTransport.handleRequest).toHaveBeenCalledWith(
          mockRequest,
          mockResponse,
          mockRequest.body
        );
      });

      it('should reject invalid request without session ID or initialize', async () => {
        mockIsInitializeRequest.mockReturnValue(false);

        mockRequest.headers = {};
        mockRequest.body = { method: 'other' };

        await postHandler(mockRequest, mockResponse);

        expect(mockResponse.status).toHaveBeenCalledWith(400);
        expect(mockResponse.json).toHaveBeenCalledWith({
          jsonrpc: '2.0',
          error: {
            code: -32000,
            message: 'Bad Request: No valid session ID provided',
          },
          id: null,
        });
      });

      it('should handle transport initialization with session callback', async () => {
        mockRequest.headers = {
          'upsun-api-token': 'test-api-key'
        };
        mockRequest.body = { method: 'initialize' };
        mockIsInitializeRequest.mockReturnValue(true);

        // Create a mock transport that calls the session initialized callback
        const { StreamableHTTPServerTransport } = jest.requireMock('@modelcontextprotocol/sdk/server/streamableHttp.js');
        const mockTransport = {
          sessionId: 'new-session-id',
          handleRequest: jest.fn().mockResolvedValue(undefined),
          onclose: null,
          close: jest.fn().mockResolvedValue(undefined)
        };

        StreamableHTTPServerTransport.mockImplementationOnce((options) => {
          // Simulate calling the session initialized callback
          if (options?.onsessioninitialized) {
            setTimeout(() => options.onsessioninitialized('new-session-id'), 0);
          }
          return mockTransport;
        });

        await postHandler(mockRequest, mockResponse);

        // Wait for async callback
        await new Promise(resolve => setTimeout(resolve, 10));

        expect(mockTransport.handleRequest).toHaveBeenCalledWith(
          mockRequest,
          mockResponse,
          mockRequest.body
        );
      });

      it('should setup transport cleanup when closed', async () => {
        mockRequest.headers = {
          'upsun-api-token': 'test-api-key'
        };
        mockRequest.body = { method: 'initialize' };
        mockIsInitializeRequest.mockReturnValue(true);

        const { StreamableHTTPServerTransport } = jest.requireMock('@modelcontextprotocol/sdk/server/streamableHttp.js');
        const mockTransport = {
          sessionId: 'cleanup-session-id',
          handleRequest: jest.fn().mockResolvedValue(undefined),
          onclose: null,
          close: jest.fn().mockResolvedValue(undefined)
        };

        StreamableHTTPServerTransport.mockImplementationOnce((options) => {
          if (options?.onsessioninitialized) {
            setTimeout(() => options.onsessioninitialized('cleanup-session-id'), 0);
          }
          return mockTransport;
        });

        await postHandler(mockRequest, mockResponse);

        // Wait for session initialization
        await new Promise(resolve => setTimeout(resolve, 10));

        // Verify transport was stored
        expect(gatewayServer.transports.streamable['cleanup-session-id']).toBeDefined();

        // Simulate transport close
        if (mockTransport.onclose) {
          mockTransport.onclose();
        }

        // Verify cleanup
        expect(gatewayServer.transports.streamable['cleanup-session-id']).toBeUndefined();
      });
    });

    describe('GET /mcp', () => {
      it('should handle valid session request', async () => {
        mockRequest.headers = {
          'mcp-session-id': 'test-session-id'
        };
        gatewayServer.transports.streamable['test-session-id'] = {
          handleRequest: jest.fn().mockResolvedValue(undefined)
        } as any;

        await getHandler(mockRequest, mockResponse);

        expect(gatewayServer.transports.streamable['test-session-id'].handleRequest)
          .toHaveBeenCalledWith(mockRequest, mockResponse);
      });

      it('should reject request with invalid session ID', async () => {
        mockRequest.headers = {
          'mcp-session-id': 'invalid-session-id'
        };

        await getHandler(mockRequest, mockResponse);

        expect(mockResponse.status).toHaveBeenCalledWith(400);
        expect(mockResponse.send).toHaveBeenCalledWith('Invalid or missing session ID');
      });

      it('should reject request without session ID', async () => {
        mockRequest.headers = {};

        await getHandler(mockRequest, mockResponse);

        expect(mockResponse.status).toHaveBeenCalledWith(400);
        expect(mockResponse.send).toHaveBeenCalledWith('Invalid or missing session ID');
      });
    });

    describe('DELETE /mcp', () => {
      it('should handle session termination', async () => {
        mockRequest.headers = {
          'mcp-session-id': 'test-session-id'
        };
        gatewayServer.transports.streamable['test-session-id'] = {
          handleRequest: jest.fn().mockResolvedValue(undefined)
        } as any;

        await deleteHandler(mockRequest, mockResponse);

        expect(gatewayServer.transports.streamable['test-session-id'].handleRequest)
          .toHaveBeenCalledWith(mockRequest, mockResponse);
      });
    });
  });

  describe('SSE Transport', () => {
    let sseHandler: Function;
    let messageHandler: Function;
    let healthHandler: Function;

    beforeEach(() => {
      // Extract the route handlers
      const sseCall = mockExpressApp.get.mock.calls.find((call: any) => call[0] === '/sse');
      const messageCall = mockExpressApp.post.mock.calls.find((call: any) => call[0] === '/messages');
      const healthCall = mockExpressApp.get.mock.calls.find((call: any) => call[0] === '/health');
      
      sseHandler = sseCall[1];
      messageHandler = messageCall[1];
      healthHandler = healthCall[1];
    });

    describe('GET /sse', () => {
      it('should establish SSE connection', async () => {
        mockRequest.headers = {
          'x-forwarded-for': '192.168.1.1'
        };

        await sseHandler(mockRequest, mockResponse);

        expect(gatewayServer.sseConnections.size).toBeGreaterThan(0);
        expect(mockAdapterFactory).toHaveBeenCalled();
      });

      it('should handle connection close event', async () => {
        mockRequest.headers = {
          'x-forwarded-for': '192.168.1.1'
        };

        // Mock the response.on method to simulate close event
        mockResponse.on.mockImplementation((event: string, callback: Function) => {
          if (event === 'close') {
            // Simulate close event immediately
            setTimeout(callback, 0);
          }
        });

        await sseHandler(mockRequest, mockResponse);

        // Wait for the close event to be processed
        await new Promise(resolve => setTimeout(resolve, 10));

        // Verify cleanup happened
        expect(gatewayServer.sseConnections.size).toBe(0);
      });

      it('should handle server connection error', async () => {
        mockRequest.headers = {
          'x-forwarded-for': '192.168.1.1'
        };

        // Make the adapter connection fail
        const mockAdapter = new MockAdapter();
        mockAdapter.connect.mockRejectedValue(new Error('Connection failed'));
        mockAdapterFactory.mockImplementation(() => mockAdapter);

        await sseHandler(mockRequest, mockResponse);

        expect(mockResponse.status).toHaveBeenCalledWith(500);
        expect(mockResponse.end).toHaveBeenCalledWith('Failed to connect MCP server to transport');
      });

      it('should handle keep-alive interval cleanup', async () => {
        mockRequest.headers = {
          'x-forwarded-for': '192.168.1.1'
        };

        // Mock clearInterval
        const mockClearInterval = jest.fn();
        global.clearInterval = mockClearInterval;

        await sseHandler(mockRequest, mockResponse);

        // Verify connection was established
        expect(gatewayServer.sseConnections.size).toBe(1);

        // Get the connection and verify interval ID exists
        const connections = Array.from(gatewayServer.sseConnections.values());
        expect(connections[0].intervalId).toBeDefined();
      });

      it('should handle writableEnded response in keep-alive', async () => {
        mockRequest.headers = {
          'x-forwarded-for': '192.168.1.1'
        };

        // Set up response to simulate being ended
        mockResponse.writableEnded = true;

        await sseHandler(mockRequest, mockResponse);

        // Verify connection was still established
        expect(gatewayServer.sseConnections.size).toBe(1);
      });
    });

    describe('POST /messages', () => {
      it('should handle message with valid session', async () => {
        mockRequest.query = { sessionId: 'test-sse-session-id' };
        mockRequest.headers = {
          'x-forwarded-for': '192.168.1.1'
        };

        const mockTransport = {
          handlePostMessage: jest.fn().mockResolvedValue(undefined)
        };
        gatewayServer.transports.sse['test-sse-session-id'] = mockTransport as any;

        await messageHandler(mockRequest, mockResponse);

        expect(mockTransport.handlePostMessage).toHaveBeenCalledWith(
          mockRequest,
          mockResponse,
          mockRequest.body
        );
      });

      it('should reject message with invalid session', async () => {
        mockRequest.query = { sessionId: 'invalid-session-id' };
        mockRequest.headers = {
          'x-forwarded-for': '192.168.1.1'
        };

        await messageHandler(mockRequest, mockResponse);

        expect(mockResponse.status).toHaveBeenCalledWith(400);
        expect(mockResponse.send).toHaveBeenCalledWith('No transport found for sessionId');
      });

      it('should handle missing session ID', async () => {
        mockRequest.query = {}; // No sessionId
        mockRequest.headers = {
          'x-forwarded-for': '192.168.1.1'
        };

        await messageHandler(mockRequest, mockResponse);

        expect(mockResponse.status).toHaveBeenCalledWith(400);
        expect(mockResponse.send).toHaveBeenCalledWith('No transport found for sessionId');
      });
    });

    describe('GET /health', () => {
      it('should return health status', async () => {
        await healthHandler(mockRequest, mockResponse);

        expect(mockResponse.status).toHaveBeenCalledWith(200);
        expect(mockResponse.json).toHaveBeenCalledWith({ status: 'healthy' });
      });
    });
  });

  describe('listen method', () => {
    it('should start the server and listen on the specified port', () => {
      gatewayServer.listen(8080);
      
      expect(mockExpressApp.listen).toHaveBeenCalledWith(8080, "0.0.0.0", expect.any(Function));
    });

    it('should use default port 3000 if no port is specified', () => {
      gatewayServer.listen();
      
      expect(mockExpressApp.listen).toHaveBeenCalledWith(3000, "0.0.0.0", expect.any(Function));
    });

    it('should handle SIGINT signal for graceful shutdown', () => {
      // Mock process event listeners
      const mockProcessOn = jest.spyOn(process, 'on').mockImplementation(() => process as any);
      
      gatewayServer.listen(3000);
      
      expect(mockProcessOn).toHaveBeenCalledWith('SIGINT', expect.any(Function));
      expect(mockProcessOn).toHaveBeenCalledWith('uncaughtException', expect.any(Function));
      expect(mockProcessOn).toHaveBeenCalledWith('unhandledRejection', expect.any(Function));

      mockProcessOn.mockRestore();
    });

    it('should cleanup transports during SIGINT', async () => {
      // Mock process.exit to prevent actual exit
      const mockExit = jest.spyOn(process, 'exit').mockImplementation(() => undefined as never);
      const mockProcessOn = jest.spyOn(process, 'on').mockImplementation((event, callback) => {
        if (event === 'SIGINT') {
          // Call the SIGINT handler immediately for testing
          setTimeout(() => (callback as Function)(), 0);
        }
        return process as any;
      });

      // Add some mock transports to test cleanup
      gatewayServer.transports.sse['test-sse'] = {
        close: jest.fn().mockResolvedValue(undefined)
      } as any;
      gatewayServer.transports.streamable['test-streamable'] = {
        close: jest.fn().mockResolvedValue(undefined)
      } as any;

      gatewayServer.listen(3000);

      // Wait for SIGINT handler to execute
      await new Promise(resolve => setTimeout(resolve, 10));

      expect(gatewayServer.transports.sse['test-sse'].close).toHaveBeenCalled();
      expect(gatewayServer.transports.streamable['test-streamable'].close).toHaveBeenCalled();

      mockExit.mockRestore();
      mockProcessOn.mockRestore();
    });

    it('should handle transport close errors during shutdown', async () => {
      const mockConsoleError = jest.spyOn(console, 'error').mockImplementation(() => {});
      const mockExit = jest.spyOn(process, 'exit').mockImplementation(() => undefined as never);
      const mockProcessOn = jest.spyOn(process, 'on').mockImplementation((event, callback) => {
        if (event === 'SIGINT') {
          setTimeout(() => (callback as Function)(), 0);
        }
        return process as any;
      });

      // Add mock transports that fail to close
      gatewayServer.transports.sse['test-sse'] = {
        close: jest.fn().mockRejectedValue(new Error('Close failed'))
      } as any;

      gatewayServer.listen(3000);

      // Wait for SIGINT handler to execute
      await new Promise(resolve => setTimeout(resolve, 10));

      expect(mockConsoleError).toHaveBeenCalledWith(
        'Error closing transport SSE for session test-sse:',
        expect.any(Error)
      );

      mockConsoleError.mockRestore();
      mockExit.mockRestore();
      mockProcessOn.mockRestore();
    });
  });

  describe('private methods', () => {
    it('should create new adapter instances', () => {
      // Access private method through type assertion
      const result = (gatewayServer as any).makeInstanceAdapterMcpServer();
      
      expect(result).toBeInstanceOf(MockAdapter);
      expect(mockAdapterFactory).toHaveBeenCalled();
    });

    it('should validate API key presence', () => {
      mockRequest.headers = {
        'upsun-api-token': 'test-api-key'
      };

      const result = (gatewayServer as any).hasAPIKey(mockRequest, mockResponse);
      
      expect(result).toBe('test-api-key');
    });

    it('should handle missing API key', () => {
      mockRequest.headers = {};

      const result = (gatewayServer as any).hasAPIKey(mockRequest, mockResponse);
      
      expect(result).toBeUndefined();
      expect(mockResponse.status).toHaveBeenCalledWith(400);
      expect(mockResponse.send).toHaveBeenCalledWith('Missing API key for 127.0.0.1');
    });

    it('should log API key with masking', () => {
      const mockConsoleLog = jest.spyOn(console, 'log').mockImplementation(() => {});
      
      mockRequest.headers = {
        'upsun-api-token': 'test-long-api-key-value'
      };

      const result = (gatewayServer as any).hasAPIKey(mockRequest, mockResponse);
      
      expect(result).toBe('test-long-api-key-value');
      expect(mockConsoleLog).toHaveBeenCalledWith('Authenticate from 127.0.0.1 with API key: test-xxxxxxx');

      mockConsoleLog.mockRestore();
    });

    it('should handle x-forwarded-for header for IP detection', () => {
      mockRequest.headers = {
        'x-forwarded-for': '192.168.1.100',
        'upsun-api-token': 'test-api-key'
      };
      mockRequest.ip = '127.0.0.1';

      const result = (gatewayServer as any).hasAPIKey(mockRequest, mockResponse);
      
      expect(result).toBe('test-api-key');
    });
  });

  describe('Session management', () => {
    it('should store and manage streamable transport sessions', async () => {
      expect(gatewayServer.transports.streamable).toBeDefined();
      expect(gatewayServer.transports.sse).toBeDefined();
    });

    it('should manage SSE connections with keep-alive', () => {
      expect(gatewayServer.sseConnections).toBeInstanceOf(Map);
    });
  });

  describe('Error handling and edge cases', () => {
    it('should handle transport errors in streamable HTTP', async () => {
      const postCall = mockExpressApp.post.mock.calls.find((call: any) => call[0] === '/mcp');
      const postHandler = postCall[1];

      mockRequest.headers = {
        'mcp-session-id': 'test-session-id'
      };
      mockRequest.body = { method: 'some-method' };

      const mockTransport = {
        handleRequest: jest.fn().mockRejectedValue(new Error('Transport error'))
      };
      gatewayServer.transports.streamable['test-session-id'] = mockTransport as any;

      await postHandler(mockRequest, mockResponse);

      expect(mockTransport.handleRequest).toHaveBeenCalled();
    });

    it('should handle transport errors in SSE messages', async () => {
      const messageCall = mockExpressApp.post.mock.calls.find((call: any) => call[0] === '/messages');
      const messageHandler = messageCall[1];

      mockRequest.query = { sessionId: 'test-sse-session-id' };
      mockRequest.headers = {
        'x-forwarded-for': '192.168.1.1'
      };

      const mockTransport = {
        handlePostMessage: jest.fn().mockRejectedValue(new Error('Transport error'))
      };
      gatewayServer.transports.sse['test-sse-session-id'] = mockTransport as any;

      await messageHandler(mockRequest, mockResponse);

      expect(mockTransport.handlePostMessage).toHaveBeenCalled();
    });

    it('should handle response already ended during error cleanup', async () => {
      const sseCall = mockExpressApp.get.mock.calls.find((call: any) => call[0] === '/sse');
      const sseHandler = sseCall[1];

      mockRequest.headers = {
        'x-forwarded-for': '192.168.1.1'
      };

      // Set response as already ended
      mockResponse.writableEnded = true;

      // Make the adapter connection fail
      const mockAdapter = new MockAdapter();
      mockAdapter.connect.mockRejectedValue(new Error('Connection failed'));
      mockAdapterFactory.mockImplementation(() => mockAdapter);

      await sseHandler(mockRequest, mockResponse);

      // Verify status was called but end was not called since response was already ended
      expect(mockResponse.status).not.toHaveBeenCalled();
      expect(mockResponse.end).not.toHaveBeenCalled();
    });

    it('should handle uncaught exceptions and unhandled rejections', () => {
      const mockProcessOn = jest.spyOn(process, 'on').mockImplementation(() => process as any);
      const mockConsoleError = jest.spyOn(console, 'error').mockImplementation(() => {});
      
      gatewayServer.listen(3000);
      
      // Find the uncaughtException and unhandledRejection handlers
      const uncaughtHandler = mockProcessOn.mock.calls.find(call => call[0] === 'uncaughtException')?.[1] as Function;
      const unhandledHandler = mockProcessOn.mock.calls.find(call => call[0] === 'unhandledRejection')?.[1] as Function;
      
      expect(uncaughtHandler).toBeDefined();
      expect(unhandledHandler).toBeDefined();
      
      // Test the handlers
      uncaughtHandler(new Error('Test uncaught exception'));
      unhandledHandler('Test reason', Promise.resolve());
      
      expect(mockConsoleError).toHaveBeenCalledWith('Uncaught Exception:', expect.any(Error));
      expect(mockConsoleError).toHaveBeenCalledWith('Unhandled Rejection at:', expect.any(Promise), 'reason:', 'Test reason');

      mockProcessOn.mockRestore();
      mockConsoleError.mockRestore();
    });
  });
});
