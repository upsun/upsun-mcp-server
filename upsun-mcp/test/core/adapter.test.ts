import { McpAdapter } from '../../src/core/adapter.js';
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { Transport } from "@modelcontextprotocol/sdk/shared/transport.js";
import { describe, expect, it, jest, beforeEach } from '@jest/globals';

// Mock the MCP SDK
jest.mock("@modelcontextprotocol/sdk/server/mcp.js", () => {
  return {
    McpServer: jest.fn().mockImplementation(() => ({
      connect: jest.fn().mockResolvedValue(undefined),
      tool: jest.fn()
    }))
  };
});

describe('McpAdapter Interface', () => {
  beforeEach(() => {
    // Reset all mocks
    jest.clearAllMocks();
  });
  
  it('should define the required properties and methods', () => {
    // Create a mock implementation of the McpAdapter interface
    // @ts-ignore
    class MockAdapter implements McpAdapter {
      readonly server = new McpServer({
        name: "test-server",
        version: "0.1.0",
        description: "Test server"
      });

      async connect(transport: Transport, apiKey: string): Promise<void> {
        return this.server.connect(transport);
      }
    }

    const mockAdapter = new MockAdapter();
    
    // Check that it has the required properties
    expect(mockAdapter.server).toBeDefined();
    
    // Check that it has the required methods
    expect(typeof mockAdapter.connect).toBe('function');
  });

  it('should connect to transport', async () => {
    // Create a mock implementation of the McpAdapter interface
    // @ts-ignore
    class MockAdapter implements McpAdapter {
      server: any;
      
      constructor() {
        this.server = {
          connect: jest.fn().mockResolvedValue(undefined)
        };
      }

      async connect(transport: Transport, apiKey: string): Promise<void> {
        return this.server.connect(transport);
      }
    }

    const mockAdapter = new MockAdapter();
    const mockTransport = {} as Transport;
    const mockApiKey = "test-api-key";
    
    await mockAdapter.connect(mockTransport, mockApiKey);
    
    // Check that the server's connect method was called with the transport
    expect(mockAdapter.server.connect).toHaveBeenCalledWith(mockTransport);
  });
});
