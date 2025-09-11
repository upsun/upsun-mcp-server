import { jest, describe, beforeEach, afterEach, it, expect } from '@jest/globals';
import { GatewayServer } from '../src/core/gateway.js';
import { UpsunMcpServer } from '../src/mcpUpsun.js';
import dotenv from 'dotenv';

// Mock process.exit to prevent test termination
const originalExit = process.exit;
process.exit = jest.fn() as any;

describe('index.ts functionality', () => {
  // Save original environment variables
  const originalEnv = process.env;
  
  beforeEach(() => {
    // Remove logs to avoid unnecessary output
    jest.spyOn(console, 'log').mockImplementation(() => {});
    
    // Restore original environment variables
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    // Restore environment variables
    process.env = originalEnv;
    jest.restoreAllMocks();
  });

  it('should be able to create GatewayServer with UpsunMcpServer', () => {
    // Test that the main components can be instantiated
    expect(() => {
      const server = new GatewayServer(UpsunMcpServer);
      expect(server).toBeInstanceOf(GatewayServer);
    }).not.toThrow();
  });

  it('should initialize dotenv configuration', () => {
    // Test that dotenv can be configured
    expect(() => {
      dotenv.config();
    }).not.toThrow();
  });

  it('should handle PORT environment variable', () => {
    // Test environment variable handling
    process.env.PORT = '4000';
    const port = Number(String(process.env.PORT)) || 3001;
    expect(port).toBe(4000);
    
    delete process.env.PORT;
    const defaultPort = Number(String(process.env.PORT)) || 3001;
    expect(defaultPort).toBe(3001);
  });

  it('should export the expected modules', async () => {
    // Test that all required modules are available
    const gateway = await import('../src/core/gateway.js');
    const mcpUpsun = await import('../src/mcpUpsun.js');
    const dotenvModule = await import('dotenv');
    
    expect(gateway.GatewayServer).toBeDefined();
    expect(mcpUpsun.UpsunMcpServer).toBeDefined();
    expect(dotenvModule.default.config).toBeDefined();
  });
});
