import { describe, expect, it, jest, beforeEach, afterEach } from '@jest/globals';
import { McpAdapter } from '../../src/core/adapter';
import { registerRoute } from '../../src/command/route';
import { ResponseError } from 'upsun-sdk-node/dist/core/runtime.js';
import { setupTestEnvironment, teardownTestEnvironment } from '../helpers/test-env.js';

const mockLogger = {
  debug: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
};

jest.mock('../../src/core/logger', () => ({
  createLogger: jest.fn(() => mockLogger),
}));

// Shape of `environments.getDeployment(...).routes`: a map keyed by resolved URL.
const deployedRoutes = {
  'https://www.example.com/': {
    id: null,
    primary: true,
    type: 'upstream',
    upstream: 'app:http',
    productionUrl: 'https://www.example.com/',
  },
  'https://api.example.com/': {
    id: 'api',
    primary: false,
    type: 'upstream',
    upstream: 'api:http',
    productionUrl: 'https://api.example.com/',
  },
  'http://www.example.com/': {
    id: null,
    primary: false,
    type: 'redirect',
    to: 'https://www.example.com/',
  },
};

const mockEnvironmentsApi = {
  getDeployment: jest.fn<(...args: unknown[]) => Promise<unknown>>(),
};

const mockAdapter: McpAdapter = {
  client: {
    environments: mockEnvironmentsApi,
  },
  server: {},
  isMode: () => true,
} as any;

const parse = (result: any) => JSON.parse(result.content[0].text);

describe('Route Command Module', () => {
  let toolCallbacks: Record<string, any> = {};
  let toolConfigs: Record<string, any> = {};
  const originalEnv = process.env;

  beforeEach(() => {
    setupTestEnvironment(jest, originalEnv);
    jest.clearAllMocks();
    toolCallbacks = {};
    toolConfigs = {};

    // @ts-ignore
    mockAdapter.server.registerTool = jest
      .fn()
      .mockImplementation((name: any, config: any, cb: any) => {
        toolConfigs[name] = config;
        toolCallbacks[name] = cb;
        return mockAdapter.server;
      }) as any;

    mockEnvironmentsApi.getDeployment.mockResolvedValue({ routes: deployedRoutes });

    registerRoute(mockAdapter);
  });

  afterEach(() => {
    teardownTestEnvironment(originalEnv);
    jest.restoreAllMocks();
  });

  it('registers get-route and list-route as read-only tools', () => {
    expect(Object.keys(toolCallbacks)).toEqual(['get-route', 'list-route']);
    expect(toolConfigs['get-route'].annotations).toEqual({ readOnlyHint: true });
    expect(toolConfigs['list-route'].annotations).toEqual({ readOnlyHint: true });
  });

  describe('get-route', () => {
    it('accepts a call without route_id', () => {
      const { route_id } = toolConfigs['get-route'].inputSchema;

      expect(route_id.safeParse(undefined).success).toBe(true);
    });

    it('reads the routes of the current deployment', async () => {
      await toolCallbacks['get-route']({ project_id: 'test-project-1', environment_name: 'main' });

      expect(mockEnvironmentsApi.getDeployment).toHaveBeenCalledWith(
        'test-project-1',
        'main',
        'current'
      );
    });

    it('returns the primary route when route_id is omitted', async () => {
      const result = await toolCallbacks['get-route']({
        project_id: 'test-project-1',
        environment_name: 'main',
      });

      expect(parse(result)).toEqual({
        url: 'https://www.example.com/',
        ...deployedRoutes['https://www.example.com/'],
      });
    });

    it('returns the route whose URL equals route_id', async () => {
      const result = await toolCallbacks['get-route']({
        project_id: 'test-project-1',
        environment_name: 'main',
        route_id: 'http://www.example.com/',
      });

      expect(parse(result)).toEqual({
        url: 'http://www.example.com/',
        ...deployedRoutes['http://www.example.com/'],
      });
    });

    it('returns the route whose id equals route_id', async () => {
      const result = await toolCallbacks['get-route']({
        project_id: 'test-project-1',
        environment_name: 'main',
        route_id: 'api',
      });

      expect(parse(result)).toEqual({
        url: 'https://api.example.com/',
        ...deployedRoutes['https://api.example.com/'],
      });
    });

    it('fails when no route matches route_id', async () => {
      await expect(
        toolCallbacks['get-route']({
          project_id: 'test-project-1',
          environment_name: 'main',
          route_id: 'https://{default}/',
        })
      ).rejects.toThrow('Route not found: https://{default}/');
    });

    it('fails when route_id is omitted and no route is primary', async () => {
      mockEnvironmentsApi.getDeployment.mockResolvedValue({
        routes: { 'http://www.example.com/': deployedRoutes['http://www.example.com/'] },
      });

      await expect(
        toolCallbacks['get-route']({ project_id: 'test-project-1', environment_name: 'main' })
      ).rejects.toThrow('No primary route in Environment: main');
    });

    it('propagates deployment errors', async () => {
      mockEnvironmentsApi.getDeployment.mockRejectedValue(new Error('Environment not found'));

      await expect(
        toolCallbacks['get-route']({ project_id: 'test-project-1', environment_name: 'nope' })
      ).rejects.toThrow('Environment not found');
    });
  });

  describe('list-route', () => {
    it('returns the routes of the current deployment keyed by URL', async () => {
      const result = await toolCallbacks['list-route']({
        project_id: 'test-project-1',
        environment_name: 'main',
      });

      expect(mockEnvironmentsApi.getDeployment).toHaveBeenCalledWith(
        'test-project-1',
        'main',
        'current'
      );
      expect(parse(result)).toEqual(deployedRoutes);
    });

    it('propagates deployment errors', async () => {
      mockEnvironmentsApi.getDeployment.mockRejectedValue(new Error('Environment not found'));

      await expect(
        toolCallbacks['list-route']({ project_id: 'test-project-1', environment_name: 'nope' })
      ).rejects.toThrow('Environment not found');
    });

    // The API answers 404 with a generic message when the environment was never deployed.
    it('names the missing current deployment on a 404', async () => {
      mockEnvironmentsApi.getDeployment.mockRejectedValue(
        new ResponseError(new Response('{}', { status: 404 }), 'HTTP 404 Not Found')
      );

      await expect(
        toolCallbacks['list-route']({ project_id: 'test-project-1', environment_name: 'main' })
      ).rejects.toThrow(
        'Environment main of project test-project-1 has no current deployment, or does not exist'
      );
    });

    it('propagates other API errors unchanged', async () => {
      const error = new ResponseError(new Response('{}', { status: 403 }), 'HTTP 403 Forbidden');
      mockEnvironmentsApi.getDeployment.mockRejectedValue(error);

      await expect(
        toolCallbacks['list-route']({ project_id: 'test-project-1', environment_name: 'main' })
      ).rejects.toBe(error);
    });
  });
});
