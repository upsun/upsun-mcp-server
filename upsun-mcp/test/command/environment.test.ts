import { describe, expect, it, jest, beforeEach, afterEach } from '@jest/globals';
import { McpAdapter } from '../../src/core/adapter.js';
import { registerEnvironment } from '../../src/command/environment.js';

// Mock the logger module
const mockLogger = {
  debug: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
};

jest.mock('../../src/core/logger.js', () => ({
  createLogger: jest.fn(() => mockLogger),
}));

// Ajout du mock explicite pour isMode sur mockAdapter (single global declaration)
const mockClient: { environment: any } = {
  environment: {
    activate: jest.fn(),
    delete: jest.fn(),
    info: jest.fn(),
    list: jest.fn(),
    merge: jest.fn(),
    pause: jest.fn(),
    redeploy: jest.fn(),
    resume: jest.fn(),
    url: jest.fn(),
    urls: jest.fn(),
  },
};
const mockAdapter: McpAdapter = {
  client: mockClient,
  server: {
    tool: jest.fn(),
  },
  isMode: () => true,
} as any;

// Mock data for testing
const mockEnvironment = {
  id: 'env-main',
  name: 'main',
  type: 'production',
  status: 'active',
  parent: null,
  machine_name: 'main-abc123',
  project_id: 'test-project-13',
  created_at: '2025-05-28T00:00:00Z',
  updated_at: '2025-05-28T12:00:00Z',
};

const mockEnvironmentList = [
  mockEnvironment,
  {
    id: 'env-staging',
    name: 'staging',
    type: 'development',
    status: 'active',
    parent: 'main',
    machine_name: 'staging-def456',
    project_id: 'test-project-13',
    created_at: '2025-05-27T00:00:00Z',
    updated_at: '2025-05-28T10:00:00Z',
  },
];

const mockOperationResult = {
  success: true,
  message: 'Operation completed successfully',
  activity_id: 'activity-123',
};

const mockUrls = ['https://main-abc123.upsun.app', 'https://www.example.com'];

// ...existing code...

// ...existing code...

describe('Environment Command Module', () => {
  let toolCallbacks: Record<string, any> = {};

  beforeEach(() => {
    jest.clearAllMocks();
    toolCallbacks = {};

    // Reset logger mocks
    mockLogger.debug.mockClear();
    mockLogger.info.mockClear();
    mockLogger.warn.mockClear();
    mockLogger.error.mockClear();

    // Setup mock server.tool to capture callbacks
    (mockAdapter.server.tool as any) = jest.fn().mockImplementation((name: any, ...args: any[]) => {
      const callback = args[args.length - 1];
      toolCallbacks[name] = callback;
      return mockAdapter.server;
    });

    // Setup default mock responses
    mockClient.environment.activate.mockResolvedValue(mockOperationResult);
    mockClient.environment.delete.mockResolvedValue(mockOperationResult);
    mockClient.environment.info.mockResolvedValue(mockEnvironment);
    mockClient.environment.list.mockResolvedValue(mockEnvironmentList);
    mockClient.environment.merge.mockResolvedValue(mockOperationResult);
    mockClient.environment.pause.mockResolvedValue(mockOperationResult);
    mockClient.environment.redeploy.mockResolvedValue(mockOperationResult);
    mockClient.environment.resume.mockResolvedValue(mockOperationResult);
    mockClient.environment.url.mockResolvedValue(mockUrls);
    mockClient.environment.urls.mockResolvedValue(mockUrls);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('registerEnvironment function', () => {
    it('should register all environment tools', () => {
      registerEnvironment(mockAdapter);

      expect(mockAdapter.server.tool).toHaveBeenCalledTimes(10);

      // Verify all tools are registered
      expect(toolCallbacks['activate-environment']).toBeDefined();
      expect(toolCallbacks['delete-environment']).toBeDefined();
      expect(toolCallbacks['info-environment']).toBeDefined();
      expect(toolCallbacks['list-environment']).toBeDefined();
      expect(toolCallbacks['logs-environment']).toBeDefined();
      expect(toolCallbacks['merge-environment']).toBeDefined();
      expect(toolCallbacks['pause-environment']).toBeDefined();
      expect(toolCallbacks['redeploy-environment']).toBeDefined();
      expect(toolCallbacks['resume-environment']).toBeDefined();
      expect(toolCallbacks['urls-environment']).toBeDefined();
    });

    it('should register tools with correct names and descriptions', () => {
      registerEnvironment(mockAdapter);

      const calls = (mockAdapter.server.tool as unknown as jest.Mock).mock.calls;

      expect(calls[0][0]).toBe('activate-environment');
      expect(calls[1][0]).toBe('delete-environment');
      expect(calls[2][0]).toBe('info-environment');
      expect(calls[3][0]).toBe('list-environment');
      expect(calls[4][0]).toBe('logs-environment');
      expect(calls[5][0]).toBe('merge-environment');
      expect(calls[6][0]).toBe('pause-environment');
      expect(calls[7][0]).toBe('redeploy-environment');
      expect(calls[8][0]).toBe('resume-environment');
      expect(calls[9][0]).toBe('urls-environment');
    });
  });

  describe('activate-environment tool', () => {
    beforeEach(() => {
      registerEnvironment(mockAdapter);
    });

    it('should activate an environment successfully', async () => {
      const callback = toolCallbacks['activate-environment'];
      const params = {
        project_id: 'test-project-13',
        environment_name: 'staging',
      };

      const result = await callback(params);

      expect(mockClient.environment.activate).toHaveBeenCalledWith('test-project-13', 'staging');
      expect(result).toEqual({
        content: [
          {
            type: 'text',
            text: JSON.stringify(mockOperationResult, null, 2),
          },
        ],
      });
    });

    it('should handle activate environment errors', async () => {
      const callback = toolCallbacks['activate-environment'];
      const errorMessage = 'Environment cannot be activated';
      mockClient.environment.activate.mockRejectedValue(new Error(errorMessage));

      const params = {
        project_id: 'test-project-13',
        environment_name: 'invalid-env',
      };

      await expect(callback(params)).rejects.toThrow(errorMessage);
    });
  });

  describe('delete-environment tool', () => {
    beforeEach(() => {
      registerEnvironment(mockAdapter);
    });

    it('should delete an environment successfully', async () => {
      const callback = toolCallbacks['delete-environment'];
      const params = {
        project_id: 'test-project-13',
        environment_name: 'staging',
      };

      const result = await callback(params);

      expect(mockClient.environment.delete).toHaveBeenCalledWith('test-project-13', 'staging');
      expect(result).toEqual({
        content: [
          {
            type: 'text',
            text: JSON.stringify(mockOperationResult, null, 2),
          },
        ],
      });
    });

    it('should handle delete environment errors', async () => {
      const callback = toolCallbacks['delete-environment'];
      const errorMessage = 'Cannot delete production environment';
      mockClient.environment.delete.mockRejectedValue(new Error(errorMessage));

      const params = {
        project_id: 'test-project-13',
        environment_name: 'main',
      };

      await expect(callback(params)).rejects.toThrow(errorMessage);
    });
  });

  describe('info-environment tool', () => {
    beforeEach(() => {
      registerEnvironment(mockAdapter);
    });

    it('should get environment info successfully', async () => {
      const callback = toolCallbacks['info-environment'];
      const params = {
        project_id: 'test-project-13',
        environment_name: 'main',
      };

      const result = await callback(params);

      expect(mockClient.environment.info).toHaveBeenCalledWith('test-project-13', 'main');
      expect(result).toEqual({
        content: [
          {
            type: 'text',
            text: JSON.stringify(mockEnvironment, null, 2),
          },
        ],
      });
    });

    it('should handle environment info errors', async () => {
      const callback = toolCallbacks['info-environment'];
      const errorMessage = 'Environment not found';
      mockClient.environment.info.mockRejectedValue(new Error(errorMessage));

      const params = {
        project_id: 'test-project-13',
        environment_name: 'non-existent',
      };

      await expect(callback(params)).rejects.toThrow(errorMessage);
    });
  });

  describe('list-environment tool', () => {
    beforeEach(() => {
      registerEnvironment(mockAdapter);
    });

    it('should list environments successfully', async () => {
      const callback = toolCallbacks['list-environment'];
      const params = {
        project_id: 'test-project-13',
      };

      const result = await callback(params);

      expect(mockClient.environment.list).toHaveBeenCalledWith('test-project-13');
      expect(result).toEqual({
        content: [
          {
            type: 'text',
            text: JSON.stringify(mockEnvironmentList, null, 2),
          },
        ],
      });
    });

    it('should handle empty environment list', async () => {
      const callback = toolCallbacks['list-environment'];
      mockClient.environment.list.mockResolvedValue([]);

      const params = {
        project_id: 'test-project-13',
      };

      const result = await callback(params);

      expect(result).toEqual({
        content: [
          {
            type: 'text',
            text: JSON.stringify([], null, 2),
          },
        ],
      });
    });
  });

  describe('logs-environment tool', () => {
    beforeEach(() => {
      registerEnvironment(mockAdapter);
    });

    it('should return not implemented message', async () => {
      const callback = toolCallbacks['logs-environment'];
      const params = {
        project_id: 'test-project-13',
        environment_name: 'main',
        application_name: 'web',
      };

      const result = await callback(params);

      expect(result).toEqual({
        content: [
          {
            type: 'text',
            text: JSON.stringify({ throw: 'Not implemented !' }, null, 2),
          },
        ],
      });
    });
  });

  describe('merge-environment tool', () => {
    beforeEach(() => {
      registerEnvironment(mockAdapter);
    });

    it('should merge an environment successfully', async () => {
      const callback = toolCallbacks['merge-environment'];
      const params = {
        project_id: 'test-project-13',
        environment_name: 'feature-branch',
      };

      const result = await callback(params);

      expect(mockClient.environment.merge).toHaveBeenCalledWith(
        'test-project-13',
        'feature-branch'
      );
      expect(result).toEqual({
        content: [
          {
            type: 'text',
            text: JSON.stringify(mockOperationResult, null, 2),
          },
        ],
      });
    });

    it('should handle merge environment errors', async () => {
      const callback = toolCallbacks['merge-environment'];
      const errorMessage = 'Cannot merge to production environment';
      mockClient.environment.merge.mockRejectedValue(new Error(errorMessage));

      const params = {
        project_id: 'test-project-13',
        environment_name: 'main',
      };

      await expect(callback(params)).rejects.toThrow(errorMessage);
    });
  });

  describe('pause-environment tool', () => {
    beforeEach(() => {
      registerEnvironment(mockAdapter);
    });

    it('should pause an environment successfully', async () => {
      const callback = toolCallbacks['pause-environment'];
      const params = {
        project_id: 'test-project-13',
        environment_name: 'staging',
      };

      const result = await callback(params);

      expect(mockClient.environment.pause).toHaveBeenCalledWith('test-project-13', 'staging');
      expect(result).toEqual({
        content: [
          {
            type: 'text',
            text: JSON.stringify(mockOperationResult, null, 2),
          },
        ],
      });
    });

    it('should handle pause environment errors', async () => {
      const callback = toolCallbacks['pause-environment'];
      const errorMessage = 'Cannot pause production environment';
      mockClient.environment.pause.mockRejectedValue(new Error(errorMessage));

      const params = {
        project_id: 'test-project-13',
        environment_name: 'main',
      };

      await expect(callback(params)).rejects.toThrow(errorMessage);
    });
  });

  describe('redeploy-environment tool', () => {
    beforeEach(() => {
      registerEnvironment(mockAdapter);
    });

    it('should redeploy an environment successfully', async () => {
      const callback = toolCallbacks['redeploy-environment'];
      const params = {
        project_id: 'test-project-13',
        environment_name: 'main',
        application_name: 'web',
      };

      const result = await callback(params);

      expect(mockClient.environment.redeploy).toHaveBeenCalledWith('test-project-13', 'main');
      expect(result).toEqual({
        content: [
          {
            type: 'text',
            text: JSON.stringify(mockOperationResult, null, 2),
          },
        ],
      });
    });

    it('should handle redeploy environment errors', async () => {
      const callback = toolCallbacks['redeploy-environment'];
      const errorMessage = 'Deployment already in progress';
      mockClient.environment.redeploy.mockRejectedValue(new Error(errorMessage));

      const params = {
        project_id: 'test-project-13',
        environment_name: 'main',
        application_name: 'web',
      };

      await expect(callback(params)).rejects.toThrow(errorMessage);
    });
  });

  describe('resume-environment tool', () => {
    beforeEach(() => {
      registerEnvironment(mockAdapter);
    });

    it('should resume an environment successfully', async () => {
      const callback = toolCallbacks['resume-environment'];
      const params = {
        project_id: 'test-project-13',
        environment_name: 'staging',
      };

      const result = await callback(params);

      expect(mockClient.environment.resume).toHaveBeenCalledWith('test-project-13', 'staging');
      expect(result).toEqual({
        content: [
          {
            type: 'text',
            text: JSON.stringify(mockOperationResult, null, 2),
          },
        ],
      });
    });

    it('should handle resume environment errors', async () => {
      const callback = toolCallbacks['resume-environment'];
      const errorMessage = 'Environment is already active';
      mockClient.environment.resume.mockRejectedValue(new Error(errorMessage));

      const params = {
        project_id: 'test-project-13',
        environment_name: 'main',
      };

      await expect(callback(params)).rejects.toThrow(errorMessage);
    });
  });

  describe('urls-environment tool', () => {
    beforeEach(() => {
      registerEnvironment(mockAdapter);
    });

    it('should get environment URLs successfully', async () => {
      const callback = toolCallbacks['urls-environment'];
      const params = {
        project_id: 'test-project-13',
        environment_name: 'main',
      };

      const result = await callback(params);

      expect(mockClient.environment.urls).toHaveBeenCalledWith('test-project-13', 'main');
      expect(result).toEqual({
        content: [
          {
            type: 'text',
            text: JSON.stringify(mockUrls, null, 2),
          },
        ],
      });
    });

    it('should handle get URLs errors', async () => {
      const callback = toolCallbacks['urls-environment'];
      const errorMessage = 'Environment URLs not available';
      mockClient.environment.urls.mockRejectedValue(new Error(errorMessage));

      const params = {
        project_id: 'test-project-13',
        environment_name: 'inactive-env',
      };

      await expect(callback(params)).rejects.toThrow(errorMessage);
    });

    it('should handle empty URLs list', async () => {
      const callback = toolCallbacks['urls-environment'];
      mockClient.environment.urls.mockResolvedValue([]);

      const params = {
        project_id: 'test-project-13',
        environment_name: 'staging',
      };

      const result = await callback(params);

      expect(result).toEqual({
        content: [
          {
            type: 'text',
            text: JSON.stringify([], null, 2),
          },
        ],
      });
    });
  });

  describe('edge cases and error handling', () => {
    beforeEach(() => {
      registerEnvironment(mockAdapter);
    });

    it('should handle null responses from client', async () => {
      const callback = toolCallbacks['info-environment'];
      mockClient.environment.info.mockResolvedValue(null);

      const params = {
        project_id: 'test-project-13',
        environment_name: 'main',
      };

      const result = await callback(params);

      expect(result).toEqual({
        content: [
          {
            type: 'text',
            text: JSON.stringify(null, null, 2),
          },
        ],
      });
    });

    it('should handle network timeouts', async () => {
      const callback = toolCallbacks['activate-environment'];
      mockClient.environment.activate.mockRejectedValue(new Error('Network timeout'));

      const params = {
        project_id: 'test-project-13',
        environment_name: 'staging',
      };

      await expect(callback(params)).rejects.toThrow('Network timeout');
    });
  });
});
