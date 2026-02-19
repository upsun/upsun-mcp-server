import { describe, expect, it, jest, beforeEach, afterEach } from '@jest/globals';
import { McpAdapter } from '../../src/core/adapter';
import { registerActivity } from '../../src/command/activity';
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

// Mock the Upsun client
const mockActivitiesApi = {
  list: jest.fn(),
  get: jest.fn(),
  cancel: jest.fn(),
  log: jest.fn(),
};

const mockClient: { activities: any } = {
  activities: mockActivitiesApi,
};

// Explicit mock added for isMode on mockAdapter, and client: mockClient
const mockAdapter: McpAdapter = {
  client: mockClient,
  server: {
    tool: jest.fn(),
  },
  isMode: () => true,
} as any;

// Mock data for testing
const mockActivity = {
  id: 'test-activity-123',
  type: 'deploy',
  status: 'complete',
  created_at: '2025-05-28T00:00:00Z',
  completed_at: '2025-05-28T00:05:00Z',
  project_id: 'test-project-13',
  environment: 'main',
  description: 'Deploy application',
};

const mockActivityList = [
  mockActivity,
  {
    id: 'test-activity-456',
    type: 'build',
    status: 'running',
    created_at: '2025-05-28T00:10:00Z',
    project_id: 'test-project-13',
    environment: 'staging',
  },
];

const mockActivityLog = `
[2025-05-28T00:00:00Z] Starting deployment...
[2025-05-28T00:01:00Z] Building application...
[2025-05-28T00:03:00Z] Deploying to environment...
[2025-05-28T00:05:00Z] Deployment completed successfully
`;

const mockCancelResult = {
  success: true,
  message: 'Activity cancelled successfully',
};

describe('Activity Command Module', () => {
  let toolCallbacks: Record<string, any> = {};
  const originalEnv = process.env;

  beforeEach(() => {
    setupTestEnvironment(jest, originalEnv);
    jest.clearAllMocks();

    // Reset logger mocks
    mockLogger.debug.mockClear();
    mockLogger.info.mockClear();
    mockLogger.warn.mockClear();
    mockLogger.error.mockClear();
    toolCallbacks = {};

    // Setup mock server.tool to capture callbacks
    (mockAdapter.server.tool as any) = jest.fn().mockImplementation((name: any, ...args: any[]) => {
      // callback is always the last argument
      const callback = args[args.length - 1];
      toolCallbacks[name] = callback;
      return mockAdapter.server;
    });

    // Setup default mock responses
    mockClient.activities.list.mockResolvedValue(mockActivityList);
    mockClient.activities.get.mockResolvedValue(mockActivity);
    mockClient.activities.cancel.mockResolvedValue(mockCancelResult);
    mockClient.activities.log.mockResolvedValue(mockActivityLog);
  });

  afterEach(() => {
    teardownTestEnvironment(originalEnv);
    jest.restoreAllMocks();
  });

  describe('registerActivity function', () => {
    it('should register all activity tools', () => {
      registerActivity(mockAdapter);

      expect(mockAdapter.server.tool).toHaveBeenCalledTimes(4);

      // Verify all tools are registered
      expect(toolCallbacks['cancel-activity']).toBeDefined();
      expect(toolCallbacks['get-activity']).toBeDefined();
      expect(toolCallbacks['list-activity']).toBeDefined();
      expect(toolCallbacks['log-activity']).toBeDefined();
    });

    it('should register tools with correct names and descriptions', () => {
      registerActivity(mockAdapter);

      const calls = (mockAdapter.server.tool as unknown as jest.Mock).mock.calls;

      expect(calls[0]).toEqual([
        'cancel-activity',
        'Cancel a activity of upsun project',
        expect.any(Object),
        expect.any(Function),
      ]);

      expect(calls[1]).toEqual([
        'get-activity',
        'Get detail of activity on upsun project',
        expect.any(Object),
        expect.any(Function),
      ]);

      expect(calls[2]).toEqual([
        'list-activity',
        'List all activities of upsun project',
        expect.any(Object),
        expect.any(Function),
      ]);

      expect(calls[3]).toEqual([
        'log-activity',
        'Get log activity of upsun project',
        expect.any(Object),
        expect.any(Function),
      ]);
    });
  });

  describe('cancel-activity tool', () => {
    beforeEach(() => {
      registerActivity(mockAdapter);
    });

    it('should cancel an activity successfully', async () => {
      const callback = toolCallbacks['cancel-activity'];
      const params = {
        project_id: 'test-project-13',
        activity_id: 'test-activity-123',
      };

      const result = await callback(params);

      expect(mockClient.activities.cancel).toHaveBeenCalledWith(
        'test-project-13',
        'test-activity-123'
      );
      expect(result).toEqual({
        content: [
          {
            type: 'text',
            text: JSON.stringify(mockCancelResult, null, 2),
          },
        ],
      });
    });

    it('should handle cancel activity errors', async () => {
      const callback = toolCallbacks['cancel-activity'];
      const errorMessage = 'Activity cannot be cancelled';
      mockClient.activities.cancel.mockRejectedValue(new Error(errorMessage));

      const params = {
        project_id: 'test-project-13',
        activity_id: 'test-activity-123',
      };

      await expect(callback(params)).rejects.toThrow(errorMessage);
      expect(mockClient.activities.cancel).toHaveBeenCalledWith(
        'test-project-13',
        'test-activity-123'
      );
    });
  });

  describe('get-activity tool', () => {
    beforeEach(() => {
      registerActivity(mockAdapter);
    });

    it('should get activity details successfully', async () => {
      const callback = toolCallbacks['get-activity'];
      const params = {
        project_id: 'test-project-13',
        activity_id: 'test-activity-123',
      };

      const result = await callback(params);

      expect(mockClient.activities.get).toHaveBeenCalledWith('test-project-13', 'test-activity-123');
      expect(result).toEqual({
        content: [
          {
            type: 'text',
            text: JSON.stringify(mockActivity, null, 2),
          },
        ],
      });
    });

    it('should handle get activity errors', async () => {
      const callback = toolCallbacks['get-activity'];
      const errorMessage = 'Activity not found';
      mockClient.activities.get.mockRejectedValue(new Error(errorMessage));

      const params = {
        project_id: 'test-project-13',
        activity_id: 'invalid-activity',
      };

      await expect(callback(params)).rejects.toThrow(errorMessage);
      expect(mockClient.activities.get).toHaveBeenCalledWith('test-project-13', 'invalid-activity');
    });
  });

  describe('list-activity tool', () => {
    beforeEach(() => {
      registerActivity(mockAdapter);
    });

    it('should list activities successfully', async () => {
      const callback = toolCallbacks['list-activity'];
      const params = {
        project_id: 'test-project-13',
      };

      const result = await callback(params);

      expect(mockClient.activities.list).toHaveBeenCalledWith('test-project-13');
      expect(result).toEqual({
        content: [
          {
            type: 'text',
            text: JSON.stringify(mockActivityList, null, 2),
          },
        ],
      });
    });

    it('should handle empty activity list', async () => {
      const callback = toolCallbacks['list-activity'];
      mockClient.activities.list.mockResolvedValue([]);

      const params = {
        project_id: 'test-project-13',
      };

      const result = await callback(params);

      expect(mockClient.activities.list).toHaveBeenCalledWith('test-project-13');
      expect(result).toEqual({
        content: [
          {
            type: 'text',
            text: JSON.stringify([], null, 2),
          },
        ],
      });
    });

    it('should handle list activities errors', async () => {
      const callback = toolCallbacks['list-activity'];
      const errorMessage = 'Project not found';
      mockClient.activities.list.mockRejectedValue(new Error(errorMessage));

      const params = {
        project_id: 'invalid-project',
      };

      await expect(callback(params)).rejects.toThrow(errorMessage);
      expect(mockClient.activities.list).toHaveBeenCalledWith('invalid-project');
    });
  });

  describe('log-activity tool', () => {
    beforeEach(() => {
      registerActivity(mockAdapter);
    });

    it('should get activity logs successfully', async () => {
      const callback = toolCallbacks['log-activity'];
      const params = {
        project_id: 'test-project-13',
        activity_id: 'test-activity-123',
      };

      const result = await callback(params);

      expect(mockClient.activities.log).toHaveBeenCalledWith('test-project-13', 'test-activity-123');
      expect(result).toEqual({
        content: [
          {
            type: 'text',
            text: JSON.stringify(mockActivityLog, null, 2),
          },
        ],
      });
    });

    it('should handle empty logs', async () => {
      const callback = toolCallbacks['log-activity'];
      mockClient.activities.log.mockResolvedValue('');

      const params = {
        project_id: 'test-project-13',
        activity_id: 'test-activity-123',
      };

      const result = await callback(params);

      expect(mockClient.activities.log).toHaveBeenCalledWith('test-project-13', 'test-activity-123');
      expect(result).toEqual({
        content: [
          {
            type: 'text',
            text: JSON.stringify('', null, 2),
          },
        ],
      });
    });

    it('should handle log activity errors', async () => {
      const callback = toolCallbacks['log-activity'];
      const errorMessage = 'Activity logs not available';
      mockClient.activities.log.mockRejectedValue(new Error(errorMessage));

      const params = {
        project_id: 'test-project-13',
        activity_id: 'test-activity-123',
      };

      await expect(callback(params)).rejects.toThrow(errorMessage);
      expect(mockClient.activities.log).toHaveBeenCalledWith('test-project-13', 'test-activity-123');
    });
  });

  describe('edge cases and error handling', () => {
    beforeEach(() => {
      registerActivity(mockAdapter);
    });

    it('should handle null/undefined responses from client', async () => {
      const callback = toolCallbacks['get-activity'];
      mockClient.activities.get.mockResolvedValue(null);

      const params = {
        project_id: 'test-project-13',
        activity_id: 'test-activity-123',
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

    it('should handle complex activity objects', async () => {
      const callback = toolCallbacks['get-activity'];
      const complexActivity = {
        ...mockActivity,
        metadata: {
          branch: 'feature/new-feature',
          commit: 'abc123def456',
          user: 'developer@example.com',
        },
        variables: {
          DATABASE_URL: 'postgres://...',
          REDIS_URL: 'redis://...',
        },
      };
      mockClient.activities.get.mockResolvedValue(complexActivity);

      const params = {
        project_id: 'test-project-13',
        activity_id: 'test-activity-123',
      };

      const result = await callback(params);

      expect(result).toEqual({
        content: [
          {
            type: 'text',
            text: JSON.stringify(complexActivity, null, 2),
          },
        ],
      });
    });
  });
});
