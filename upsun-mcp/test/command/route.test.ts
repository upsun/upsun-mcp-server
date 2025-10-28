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

// Mock the adapter
const mockAdapter: McpAdapter = {
  client: {
    route: {
      get: jest.fn(),
      list: jest.fn(),
      web: jest.fn(),
    },
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

    // Setup mock server.tool to capture callbacks
    // @ts-ignore
    mockAdapter.server.tool = jest.fn().mockImplementation((name: any, ...args: any[]) => {
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
      expect(mockAdapter.server.tool).toHaveBeenCalledTimes(3) as any;

      // Verify all tools are registered
      expect(toolCallbacks['get-route']).toBeDefined() as any;
      expect(toolCallbacks['list-route']).toBeDefined() as any;
      expect(toolCallbacks['get-console']).toBeDefined() as any;
    });

    it('should register tools with correct names and descriptions', () => {
      // Don't call registerRoute again since it's already called in beforeEach
      const calls = (mockAdapter.server.tool as unknown as jest.Mock).mock.calls;

      expect(calls[0]).toEqual([
        'get-route',
        'Get route URL of upsun project',
        expect.any(Object),
        expect.any(Function),
      ]) as any;

      expect(calls[1]).toEqual([
        'list-route',
        'List routes URL of upsun project',
        expect.any(Object),
        expect.any(Function),
      ]) as any;

      expect(calls[2]).toEqual([
        'get-console',
        'Get console URL of upsun project',
        expect.any(Object),
        expect.any(Function),
      ]) as any;
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
      mockAdapter.client.route.get = jest.fn().mockResolvedValue(mockRouteData) as any;

      const callback = toolCallbacks['get-route'];
      const params = {
        project_id: 'test-project-13',
        environment_name: 'main',
        route_id: 'route-123',
      };

      const result = (await callback(params)) as any;

      expect(mockAdapter.client.route.get).toHaveBeenCalledWith(
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
      mockAdapter.client.route.get = jest.fn().mockResolvedValue(mockRouteData) as any;

      const callback = toolCallbacks['get-route'];
      const params = {
        project_id: 'test-project-13',
        environment_name: 'main',
      };

      const result = (await callback(params)) as any;

      expect(mockAdapter.client.route.get).toHaveBeenCalledWith(
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
      mockAdapter.client.route.get = jest.fn().mockResolvedValue(mockRouteData) as any;

      const callback = toolCallbacks['get-route'];
      const params = {
        project_id: 'test-project-13',
        environment_name: 'staging',
        route_id: 'staging-route',
      };

      const result = (await callback(params)) as any;

      expect(mockAdapter.client.route.get).toHaveBeenCalledWith(
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
      mockAdapter.client.route.get = jest.fn().mockResolvedValue(mockRouteData) as any;

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
      mockAdapter.client.route.list = jest.fn().mockResolvedValue(mockRoutesData) as any;

      const callback = toolCallbacks['list-route'];
      const params = {
        project_id: 'test-project-13',
        environment_name: 'main',
      };

      const result = (await callback(params)) as any;

      expect(mockAdapter.client.route.list).toHaveBeenCalledWith('test-project-13', 'main') as any;
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
      mockAdapter.client.route.list = jest.fn().mockResolvedValue([]) as any;

      const callback = toolCallbacks['list-route'];
      const params = {
        project_id: 'test-project-13',
        environment_name: 'empty-env',
      };

      const result = (await callback(params)) as any;

      expect(mockAdapter.client.route.list).toHaveBeenCalledWith(
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
      mockAdapter.client.route.list = jest.fn().mockResolvedValue(mockRoutesData) as any;

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

  describe('get-console tool', () => {
    it('should get console URL for project', async () => {
      const mockWebData = {
        ui: 'https://console.upsun.com/projects/test-project-13',
      };

      // @ts-ignore
      mockAdapter.client.route.web = jest.fn().mockResolvedValue(mockWebData) as any;

      const callback = toolCallbacks['get-console'];
      const params = {
        project_id: 'test-project-13',
      };

      const result = (await callback(params)) as any;

      // Since the function returns "Not implemented", we don't expect any client calls
      expect(result).toEqual({
        content: [
          {
            type: 'text',
            text: JSON.stringify('Not implemented', null, 2),
          },
        ],
      }) as any;
    }) as any;

    it('should handle different project console URLs', async () => {
      const mockWebData = {
        ui: 'https://console.upsun.com/projects/enterprise-project-456',
      };

      // @ts-ignore
      mockAdapter.client.route.web = jest.fn().mockResolvedValue(mockWebData) as any;

      const callback = toolCallbacks['get-console'];
      const params = {
        project_id: 'enterprise-project-456',
      };

      const result = (await callback(params)) as any;

      // Since the function returns "Not implemented", we don't expect any client calls
      expect(result).toEqual({
        content: [
          {
            type: 'text',
            text: JSON.stringify('Not implemented', null, 2),
          },
        ],
      }) as any;
    }) as any;

    it('should handle console URL with additional metadata', async () => {
      const mockWebData = {
        ui: 'https://console.upsun.com/projects/complex-project',
        api: 'https://api.upsun.com/projects/complex-project',
        ssh: 'ssh://complex-project@ssh.upsun.com',
      };

      // @ts-ignore
      mockAdapter.client.route.web = jest.fn().mockResolvedValue(mockWebData) as any;

      const callback = toolCallbacks['get-console'];
      const params = {
        project_id: 'complex-project',
      };

      const result = (await callback(params)) as any;

      expect(result).toEqual({
        content: [
          {
            type: 'text',
            text: JSON.stringify('Not implemented', null, 2),
          },
        ],
      }) as any;
    }) as any;
  }) as any;

  describe('error handling and edge cases', () => {
    it('should handle API errors for get-route', async () => {
      const error = new Error('Route not found') as any;
      // @ts-ignore
      mockAdapter.client.route.get = jest.fn().mockRejectedValue(error) as any;

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
      mockAdapter.client.route.list = jest.fn().mockRejectedValue(error) as any;

      const callback = toolCallbacks['list-route'];
      const params = {
        project_id: 'test-project-13',
        environment_name: 'nonexistent-env',
      };

      (await expect(callback(params)).rejects.toThrow('Environment not found')) as any;
    }) as any;

    it('should handle API errors for get-console', async () => {
      // Since get-console always returns "Not implemented" and doesn't call the client,
      // it cannot throw errors. This test verifies the current behavior.
      const callback = toolCallbacks['get-console'];
      const params = {
        project_id: 'restricted-project',
      };

      const result = (await callback(params)) as any;
      expect(result).toEqual({
        content: [
          {
            type: 'text',
            text: JSON.stringify('Not implemented', null, 2),
          },
        ],
      }) as any;
    }) as any;

    it('should handle null/undefined responses', async () => {
      // @ts-ignore
      mockAdapter.client.route.get = jest.fn().mockResolvedValue(null) as any;

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
      mockAdapter.client.route.get = jest.fn().mockResolvedValue(complexRoute) as any;

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
