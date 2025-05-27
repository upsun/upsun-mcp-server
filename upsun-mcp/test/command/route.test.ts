import { describe, expect, it, jest, beforeEach, afterEach } from '@jest/globals';
import { McpAdapter } from "../../src/core/adapter.js";
import { registerRoute } from "../../src/command/route.js";

// Mock the adapter
const mockAdapter: McpAdapter = {
  client: {
    route: {
      get: jest.fn(),
      list: jest.fn(),
      web: jest.fn()
    }
  },
  server: {
    tool: jest.fn()
  }
} as any;

describe('Route Command Module', () => {
  let toolCallbacks: Record<string, any> = {};

  beforeEach(() => {
    jest.clearAllMocks();
    toolCallbacks = {};
    
    // Setup mock server.tool to capture callbacks
    mockAdapter.server.tool = jest.fn().mockImplementation((name: string, description: string, schema: any, callback: any) => {
      toolCallbacks[name] = callback;
      return mockAdapter.server;
    });
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('registerRoute function', () => {
    it('should register all route tools', () => {
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
      
      registerRoute(mockAdapter);
      
      expect(consoleSpy).toHaveBeenCalledWith('Register Route Handlers');
      expect(mockAdapter.server.tool).toHaveBeenCalledTimes(3);
      
      // Verify all tools are registered
      expect(toolCallbacks['get-route']).toBeDefined();
      expect(toolCallbacks['list-route']).toBeDefined();
      expect(toolCallbacks['get-console']).toBeDefined();
      
      consoleSpy.mockRestore();
    });

    it('should register tools with correct names and descriptions', () => {
      registerRoute(mockAdapter);
      
      const calls = (mockAdapter.server.tool as jest.Mock).mock.calls;
      
      expect(calls[0]).toEqual([
        'get-route',
        'Get route URL of upsun project',
        expect.any(Object),
        expect.any(Function)
      ]);
      
      expect(calls[1]).toEqual([
        'list-route',
        'List routes URL of upsun project',
        expect.any(Object),
        expect.any(Function)
      ]);
      
      expect(calls[2]).toEqual([
        'get-console',
        'Get console URL of upsun project',
        expect.any(Object),
        expect.any(Function)
      ]);
    });
  });

  describe('get-route tool', () => {
    beforeEach(() => {
      registerRoute(mockAdapter);
    });

    it('should get route with route_id', async () => {
      const mockRouteData = {
        id: 'route-123',
        url: 'https://example.com',
        upstream: 'app',
        cache: { enabled: true }
      };
      
      mockAdapter.client.route.get = jest.fn().mockResolvedValue(mockRouteData);
      
      const callback = toolCallbacks['get-route'];
      const params = {
        project_id: 'test-project-13',
        environment_name: 'main',
        route_id: 'route-123'
      };

      const result = await callback(params);

      expect(mockAdapter.client.route.get).toHaveBeenCalledWith('test-project-13', 'main', 'route-123');
      expect(result).toEqual({
        content: [{
          type: 'text',
          text: JSON.stringify(mockRouteData, null, 2)
        }]
      });
    });

    it('should get route without route_id (primary route)', async () => {
      const mockRouteData = {
        id: 'primary-route',
        url: 'https://main-abcdef.example.com',
        upstream: 'app'
      };
      
      mockAdapter.client.route.get = jest.fn().mockResolvedValue(mockRouteData);
      
      const callback = toolCallbacks['get-route'];
      const params = {
        project_id: 'test-project-13',
        environment_name: 'main'
      };

      const result = await callback(params);

      expect(mockAdapter.client.route.get).toHaveBeenCalledWith('test-project-13', 'main', '');
      expect(result).toEqual({
        content: [{
          type: 'text',
          text: JSON.stringify(mockRouteData, null, 2)
        }]
      });
    });

    it('should handle different environments', async () => {
      const mockRouteData = {
        id: 'staging-route',
        url: 'https://staging-abcdef.example.com',
        upstream: 'app'
      };
      
      mockAdapter.client.route.get = jest.fn().mockResolvedValue(mockRouteData);
      
      const callback = toolCallbacks['get-route'];
      const params = {
        project_id: 'test-project-13',
        environment_name: 'staging',
        route_id: 'staging-route'
      };

      const result = await callback(params);

      expect(mockAdapter.client.route.get).toHaveBeenCalledWith('test-project-13', 'staging', 'staging-route');
      expect(result).toEqual({
        content: [{
          type: 'text',
          text: JSON.stringify(mockRouteData, null, 2)
        }]
      });
    });

    it('should handle route with caching configuration', async () => {
      const mockRouteData = {
        id: 'cached-route',
        url: 'https://cached.example.com',
        upstream: 'app',
        cache: {
          enabled: true,
          ttl: 3600,
          cookies: ['session_id']
        }
      };
      
      mockAdapter.client.route.get = jest.fn().mockResolvedValue(mockRouteData);
      
      const callback = toolCallbacks['get-route'];
      const params = {
        project_id: 'test-project-13',
        environment_name: 'main',
        route_id: 'cached-route'
      };

      const result = await callback(params);

      expect(result).toEqual({
        content: [{
          type: 'text',
          text: JSON.stringify(mockRouteData, null, 2)
        }]
      });
    });
  });

  describe('list-route tool', () => {
    beforeEach(() => {
      registerRoute(mockAdapter);
    });

    it('should list all routes for environment', async () => {
      const mockRoutesData = [
        {
          id: 'route-1',
          url: 'https://main.example.com',
          upstream: 'app'
        },
        {
          id: 'route-2',
          url: 'https://api.example.com',
          upstream: 'api'
        }
      ];
      
      mockAdapter.client.route.list = jest.fn().mockResolvedValue(mockRoutesData);
      
      const callback = toolCallbacks['list-route'];
      const params = {
        project_id: 'test-project-13',
        environment_name: 'main'
      };

      const result = await callback(params);

      expect(mockAdapter.client.route.list).toHaveBeenCalledWith('test-project-13', 'main');
      expect(result).toEqual({
        content: [{
          type: 'text',
          text: JSON.stringify(mockRoutesData, null, 2)
        }]
      });
    });

    it('should handle empty routes list', async () => {
      mockAdapter.client.route.list = jest.fn().mockResolvedValue([]);
      
      const callback = toolCallbacks['list-route'];
      const params = {
        project_id: 'test-project-13',
        environment_name: 'empty-env'
      };

      const result = await callback(params);

      expect(mockAdapter.client.route.list).toHaveBeenCalledWith('test-project-13', 'empty-env');
      expect(result).toEqual({
        content: [{
          type: 'text',
          text: JSON.stringify([], null, 2)
        }]
      });
    });

    it('should handle production environment routes', async () => {
      const mockRoutesData = [
        {
          id: 'prod-route-1',
          url: 'https://www.example.com',
          upstream: 'app',
          tls: { enabled: true }
        },
        {
          id: 'prod-route-2',
          url: 'https://api.example.com',
          upstream: 'api',
          tls: { enabled: true }
        }
      ];
      
      mockAdapter.client.route.list = jest.fn().mockResolvedValue(mockRoutesData);
      
      const callback = toolCallbacks['list-route'];
      const params = {
        project_id: 'prod-project',
        environment_name: 'production'
      };

      const result = await callback(params);

      expect(result).toEqual({
        content: [{
          type: 'text',
          text: JSON.stringify(mockRoutesData, null, 2)
        }]
      });
    });
  });

  describe('get-console tool', () => {
    beforeEach(() => {
      registerRoute(mockAdapter);
    });

    it('should get console URL for project', async () => {
      const mockWebData = {
        ui: 'https://console.upsun.com/projects/test-project-13'
      };
      
      mockAdapter.client.route.web = jest.fn().mockResolvedValue(mockWebData);
      
      const callback = toolCallbacks['get-console'];
      const params = {
        project_id: 'test-project-13'
      };

      const result = await callback(params);

      expect(mockAdapter.client.route.web).toHaveBeenCalledWith('test-project-13');
      expect(result).toEqual({
        content: [{
          type: 'text',
          text: JSON.stringify('https://console.upsun.com/projects/test-project-13', null, 2)
        }]
      });
    });

    it('should handle different project console URLs', async () => {
      const mockWebData = {
        ui: 'https://console.upsun.com/projects/enterprise-project-456'
      };
      
      mockAdapter.client.route.web = jest.fn().mockResolvedValue(mockWebData);
      
      const callback = toolCallbacks['get-console'];
      const params = {
        project_id: 'enterprise-project-456'
      };

      const result = await callback(params);

      expect(mockAdapter.client.route.web).toHaveBeenCalledWith('enterprise-project-456');
      expect(result).toEqual({
        content: [{
          type: 'text',
          text: JSON.stringify('https://console.upsun.com/projects/enterprise-project-456', null, 2)
        }]
      });
    });

    it('should handle console URL with additional metadata', async () => {
      const mockWebData = {
        ui: 'https://console.upsun.com/projects/complex-project',
        api: 'https://api.upsun.com/projects/complex-project',
        ssh: 'ssh://complex-project@ssh.upsun.com'
      };
      
      mockAdapter.client.route.web = jest.fn().mockResolvedValue(mockWebData);
      
      const callback = toolCallbacks['get-console'];
      const params = {
        project_id: 'complex-project'
      };

      const result = await callback(params);

      expect(result).toEqual({
        content: [{
          type: 'text',
          text: JSON.stringify('https://console.upsun.com/projects/complex-project', null, 2)
        }]
      });
    });
  });

  describe('error handling and edge cases', () => {
    beforeEach(() => {
      registerRoute(mockAdapter);
    });

    it('should handle API errors for get-route', async () => {
      const error = new Error('Route not found');
      mockAdapter.client.route.get = jest.fn().mockRejectedValue(error);
      
      const callback = toolCallbacks['get-route'];
      const params = {
        project_id: 'test-project-13',
        environment_name: 'main',
        route_id: 'nonexistent-route'
      };

      await expect(callback(params)).rejects.toThrow('Route not found');
    });

    it('should handle API errors for list-route', async () => {
      const error = new Error('Environment not found');
      mockAdapter.client.route.list = jest.fn().mockRejectedValue(error);
      
      const callback = toolCallbacks['list-route'];
      const params = {
        project_id: 'test-project-13',
        environment_name: 'nonexistent-env'
      };

      await expect(callback(params)).rejects.toThrow('Environment not found');
    });

    it('should handle API errors for get-console', async () => {
      const error = new Error('Project access denied');
      mockAdapter.client.route.web = jest.fn().mockRejectedValue(error);
      
      const callback = toolCallbacks['get-console'];
      const params = {
        project_id: 'restricted-project'
      };

      await expect(callback(params)).rejects.toThrow('Project access denied');
    });

    it('should handle null/undefined responses', async () => {
      mockAdapter.client.route.get = jest.fn().mockResolvedValue(null);
      
      const callback = toolCallbacks['get-route'];
      const params = {
        project_id: 'test-project-13',
        environment_name: 'main'
      };

      const result = await callback(params);

      expect(result).toEqual({
        content: [{
          type: 'text',
          text: JSON.stringify(null, null, 2)
        }]
      });
    });

    it('should handle complex route configurations', async () => {
      const complexRoute = {
        id: 'complex-route',
        url: 'https://{all}.example.com',
        upstream: 'app:http',
        cache: {
          enabled: true,
          default_ttl: 3600,
          cookies: ['*'],
          headers: ['Accept', 'Accept-Language']
        },
        redirects: {
          expires: '1d',
          paths: {
            '/old-path': '/new-path'
          }
        },
        tls: {
          strict_transport_security: {
            enabled: true,
            include_subdomains: true,
            preload: true
          }
        }
      };
      
      mockAdapter.client.route.get = jest.fn().mockResolvedValue(complexRoute);
      
      const callback = toolCallbacks['get-route'];
      const params = {
        project_id: 'test-project-13',
        environment_name: 'main',
        route_id: 'complex-route'
      };

      const result = await callback(params);

      expect(result).toEqual({
        content: [{
          type: 'text',
          text: JSON.stringify(complexRoute, null, 2)
        }]
      });
    });
  });
});
