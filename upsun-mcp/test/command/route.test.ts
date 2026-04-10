import { describe, expect, it, jest, beforeEach, afterEach } from '@jest/globals';
import { McpAdapter } from '../../src/core/adapter';
import { registerRoute } from '../../src/command/route';
import { setupTestEnvironment, teardownTestEnvironment } from '../helpers/test-env.js';

// Mock the logger module
const mockLogger = {
  debug: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
};

jest.mock('../../src/core/logger', () => ({
  createLogger: jest.fn(() => mockLogger),
}));

const mockRoutesApi = {
  get: jest.fn(),
  list: jest.fn(),
};

// Mock the adapter
const mockAdapter: McpAdapter = {
  client: {
    routes: mockRoutesApi,
  },
  server: {
    tool: jest.fn(),
  },
  isMode: () => true,
} as any;

describe('Route Command Module', () => {
  let toolCallbacks: Record<string, any> = {};
  const originalEnv = process.env;

  beforeEach(() => {
    setupTestEnvironment(jest, originalEnv);
    jest.clearAllMocks() as any;
    toolCallbacks = {};

    // Reset logger mocks
    mockLogger.debug.mockClear();
    mockLogger.info.mockClear();
    mockLogger.warn.mockClear();
    mockLogger.error.mockClear();

    // Setup mock server.registerTool to capture callbacks
    // @ts-ignore
    mockAdapter.server.registerTool = jest.fn().mockImplementation((name: any, ...args: any[]) => {
      const callback = args[args.length - 1];
      toolCallbacks[name] = callback;
      return mockAdapter.server;
    }) as any;

    // Register routes to populate toolCallbacks
    registerRoute(mockAdapter) as any;
  });

  afterEach(() => {
    teardownTestEnvironment(originalEnv);
    jest.restoreAllMocks();
  });

  describe('registerRoute function', () => {
    it('should register all route tools', () => {
      // Don't call registerRoute again since it's already called in beforeEach
      expect(mockAdapter.server.registerTool).toHaveBeenCalledTimes(2) as any;

      // Verify all tools are registered
      expect(toolCallbacks['get-route']).toBeDefined() as any;
      expect(toolCallbacks['list-route']).toBeDefined() as any;
    });

    it('should register tools with correct names and descriptions', () => {
      // Don't call registerRoute again since it's already called in beforeEach
      const calls = (mockAdapter.server.registerTool as unknown as jest.Mock).mock.calls;

      expect(calls[0]).toEqual([
        'get-route',
        {
          annotations: { readOnlyHint: true },
          description: 'Get route URL of upsun project',
          inputSchema: expect.any(Object),
        },
        expect.any(Function),
      ]) as any;

      expect(calls[1]).toEqual([
        'list-route',
        {
          annotations: { readOnlyHint: true },
          description: 'List routes URL of upsun project',
          inputSchema: expect.any(Object),
        },
        expect.any(Function),
      ]) as any;
<<<<<<< HEAD
<<<<<<< HEAD
=======

      expect(calls[2]).toEqual([
        'get-console',
        {
          annotations: { readOnlyHint: true },
          description: 'Get console URL of upsun project',
          inputSchema: expect.any(Object),
        },
        expect.any(Function),
      ]) as any;
>>>>>>> 2b40403 (feat: add MCP tool annotations for read-only and destructive hints (#20))
=======
>>>>>>> 8613ec4 (fix: remove unimplemented list-sshkey and get-console tools)
    });
  });

  describe('get-route tool', () => {
    it('should get route with route_id', async () => {
      const mockRouteData = {
        id: 'route-123',
        url: 'https://example.com',
        upstream: 'app',
        cache: { enabled: true },
      };

      // @ts-ignore
      mockAdapter.client.routes.get = jest.fn().mockResolvedValue(mockRouteData) as any;

      const callback = toolCallbacks['get-route'];
      const params = {
        project_id: 'test-project-13',
        environment_name: 'main',
        route_id: 'route-123',
      };

      const result = (await callback(params)) as any;

      expect(mockAdapter.client.routes.get).toHaveBeenCalledWith(
        'test-project-13',
        'main',
        'route-123'
      ) as any;
      expect(result).toEqual({
        content: [
          {
            type: 'text',
            text: JSON.stringify(mockRouteData, null, 2),
          },
        ],
      }) as any;
    }) as any;

    it('should get route without route_id (primary route)', async () => {
      const mockRouteData = {
        id: 'primary-route',
        url: 'https://main-abcdef.example.com',
        upstream: 'app',
      };

      // @ts-ignore
      mockAdapter.client.routes.get = jest.fn().mockResolvedValue(mockRouteData) as any;

      const callback = toolCallbacks['get-route'];
      const params = {
        project_id: 'test-project-13',
        environment_name: 'main',
      };

      const result = (await callback(params)) as any;

      expect(mockAdapter.client.routes.get).toHaveBeenCalledWith(
        'test-project-13',
        'main',
        ''
      ) as any;
      expect(result).toEqual({
        content: [
          {
            type: 'text',
            text: JSON.stringify(mockRouteData, null, 2),
          },
        ],
      }) as any;
    }) as any;

    it('should handle different environments', async () => {
      const mockRouteData = {
        id: 'staging-route',
        url: 'https://staging-abcdef.example.com',
        upstream: 'app',
      };

      // @ts-ignore
      mockAdapter.client.routes.get = jest.fn().mockResolvedValue(mockRouteData) as any;

      const callback = toolCallbacks['get-route'];
      const params = {
        project_id: 'test-project-13',
        environment_name: 'staging',
        route_id: 'staging-route',
      };

      const result = (await callback(params)) as any;

      expect(mockAdapter.client.routes.get).toHaveBeenCalledWith(
        'test-project-13',
        'staging',
        'staging-route'
      ) as any;
      expect(result).toEqual({
        content: [
          {
            type: 'text',
            text: JSON.stringify(mockRouteData, null, 2),
          },
        ],
      }) as any;
    }) as any;

    it('should handle route with caching configuration', async () => {
      const mockRouteData = {
        id: 'cached-route',
        url: 'https://cached.example.com',
        upstream: 'app',
        cache: {
          enabled: true,
          ttl: 3600,
          cookies: ['session_id'],
        },
      };

      // @ts-ignore
      mockAdapter.client.routes.get = jest.fn().mockResolvedValue(mockRouteData) as any;

      const callback = toolCallbacks['get-route'];
      const params = {
        project_id: 'test-project-13',
        environment_name: 'main',
        route_id: 'cached-route',
      };

      const result = (await callback(params)) as any;

      expect(result).toEqual({
        content: [
          {
            type: 'text',
            text: JSON.stringify(mockRouteData, null, 2),
          },
        ],
      }) as any;
    }) as any;
  }) as any;

  describe('list-route tool', () => {
    it('should list all routes for environment', async () => {
      const mockRoutesData = [
        {
          id: 'route-1',
          url: 'https://main.example.com',
          upstream: 'app',
        },
        {
          id: 'route-2',
          url: 'https://api.example.com',
          upstream: 'api',
        },
      ];

      // @ts-ignore
      mockAdapter.client.routes.list = jest.fn().mockResolvedValue(mockRoutesData) as any;

      const callback = toolCallbacks['list-route'];
      const params = {
        project_id: 'test-project-13',
        environment_name: 'main',
      };

      const result = (await callback(params)) as any;

      expect(mockAdapter.client.routes.list).toHaveBeenCalledWith('test-project-13', 'main') as any;
      expect(result).toEqual({
        content: [
          {
            type: 'text',
            text: JSON.stringify(mockRoutesData, null, 2),
          },
        ],
      }) as any;
    }) as any;

    it('should handle empty routes list', async () => {
      // @ts-ignore
      mockAdapter.client.routes.list = jest.fn().mockResolvedValue([]) as any;

      const callback = toolCallbacks['list-route'];
      const params = {
        project_id: 'test-project-13',
        environment_name: 'empty-env',
      };

      const result = (await callback(params)) as any;

      expect(mockAdapter.client.routes.list).toHaveBeenCalledWith(
        'test-project-13',
        'empty-env'
      ) as any;
      expect(result).toEqual({
        content: [
          {
            type: 'text',
            text: JSON.stringify([], null, 2),
          },
        ],
      }) as any;
    }) as any;

    it('should handle production environment routes', async () => {
      const mockRoutesData = [
        {
          id: 'prod-route-1',
          url: 'https://www.example.com',
          upstream: 'app',
          tls: { enabled: true },
        },
        {
          id: 'prod-route-2',
          url: 'https://api.example.com',
          upstream: 'api',
          tls: { enabled: true },
        },
      ];

      // @ts-ignore
      mockAdapter.client.routes.list = jest.fn().mockResolvedValue(mockRoutesData) as any;

      const callback = toolCallbacks['list-route'];
      const params = {
        project_id: 'prod-project',
        environment_name: 'production',
      };

      const result = (await callback(params)) as any;

      expect(result).toEqual({
        content: [
          {
            type: 'text',
            text: JSON.stringify(mockRoutesData, null, 2),
          },
        ],
      }) as any;
    }) as any;
  }) as any;

  describe('error handling and edge cases', () => {
    it('should handle API errors for get-route', async () => {
      const error = new Error('Route not found') as any;
      // @ts-ignore
      mockAdapter.client.routes.get = jest.fn().mockRejectedValue(error) as any;

      const callback = toolCallbacks['get-route'];
      const params = {
        project_id: 'test-project-13',
        environment_name: 'main',
        route_id: 'nonexistent-route',
      };

      (await expect(callback(params)).rejects.toThrow('Route not found')) as any;
    }) as any;

    it('should handle API errors for list-route', async () => {
      const error = new Error('Environment not found') as any;
      // @ts-ignore
      mockAdapter.client.routes.list = jest.fn().mockRejectedValue(error) as any;

      const callback = toolCallbacks['list-route'];
      const params = {
        project_id: 'test-project-13',
        environment_name: 'nonexistent-env',
      };

      (await expect(callback(params)).rejects.toThrow('Environment not found')) as any;
    }) as any;

    it('should handle null/undefined responses', async () => {
      // @ts-ignore
      mockAdapter.client.routes.get = jest.fn().mockResolvedValue(null) as any;

      const callback = toolCallbacks['get-route'];
      const params = {
        project_id: 'test-project-13',
        environment_name: 'main',
      };

      const result = (await callback(params)) as any;

      expect(result).toEqual({
        content: [
          {
            type: 'text',
            text: JSON.stringify(null, null, 2),
          },
        ],
      }) as any;
    }) as any;

    it('should handle complex route configurations', async () => {
      const complexRoute = {
        id: 'complex-route',
        url: 'https://{all}.example.com',
        upstream: 'app:http',
        cache: {
          enabled: true,
          default_ttl: 3600,
          cookies: ['*'],
          headers: ['Accept', 'Accept-Language'],
        },
        redirects: {
          expires: '1d',
          paths: {
            '/old-path': '/new-path',
          },
        },
        tls: {
          strict_transport_security: {
            enabled: true,
            include_subdomains: true,
            preload: true,
          },
        },
      };

      // @ts-ignore
      mockAdapter.client.routes.get = jest.fn().mockResolvedValue(complexRoute) as any;

      const callback = toolCallbacks['get-route'];
      const params = {
        project_id: 'test-project-13',
        environment_name: 'main',
        route_id: 'complex-route',
      };

      const result = (await callback(params)) as any;

      expect(result).toEqual({
        content: [
          {
            type: 'text',
            text: JSON.stringify(complexRoute, null, 2),
          },
        ],
      }) as any;
    }) as any;
  }) as any;
});
