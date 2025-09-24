import { describe, expect, it, jest, beforeEach, afterEach } from '@jest/globals';
import { McpAdapter } from '../../src/core/adapter.js';
import { registerProject } from '../../src/command/project.js';

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
const mockClient: any = {
  project: {
    create: jest.fn(),
    delete: jest.fn(),
    info: jest.fn(),
    list: jest.fn(),
    getSubscription: jest.fn(),
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
const mockProject = {
  id: 'test-project-13',
  name: 'Test Project',
  status: 'active',
  created_at: '2025-05-28T00:00:00Z',
  organization_id: '123456789012345678901234567',
  region: 'eu-west-1',
  default_branch: 'main',
};

const mockProjectList = [
  mockProject,
  {
    id: 'test-project-14',
    name: 'Another Project',
    status: 'provisioning',
    created_at: '2025-05-28T01:00:00Z',
    organization_id: '123456789012345678901234567',
    region: 'us-east-1',
    default_branch: 'main',
  },
];

const mockCreateResult = {
  ...mockProject,
  message: 'Project created successfully',
};

const mockDeleteResult = {
  success: true,
  message: 'Project deleted successfully',
};

// ...existing code...

// ...existing code...

// Global toolCallbacks for all tests
let toolCallbacks: Record<string, any> = {};

describe('Project Command Module', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    toolCallbacks = {};

    // Reset logger mocks
    mockLogger.debug.mockClear();
    mockLogger.info.mockClear();
    mockLogger.warn.mockClear();
    mockLogger.error.mockClear();

    // Setup mock server.tool to capture callbacks
    (mockAdapter.server.tool as unknown as jest.Mock) = jest
      .fn()
      .mockImplementation((...args: any[]) => {
        const [name, , , callback] = args;
        toolCallbacks[name] = callback;
        return mockAdapter.server;
      });

    // Setup default mock responses
    mockClient.project.create.mockResolvedValue(mockCreateResult);
    mockClient.project.delete.mockResolvedValue(mockDeleteResult);
    mockClient.project.info.mockResolvedValue(mockProject);
    mockClient.project.list.mockResolvedValue(mockProjectList);
    mockClient.project.getSubscription.mockResolvedValue({
      ...mockProject,
      status: 'active', // This should match SubscriptionStatusEnum.Active
    });
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('registerProject function', () => {
    it('should register all project tools', () => {
      // Reset mock call count before testing
      jest.clearAllMocks();
      (mockAdapter.server.tool as unknown as jest.Mock) = jest
        .fn()
        .mockImplementation((...args: any[]) => {
          const [name, , , callback] = args;
          toolCallbacks[name] = callback;
          return mockAdapter.server;
        });

      registerProject(mockAdapter);

      expect(mockAdapter.server.tool).toHaveBeenCalledTimes(4);

      // Verify all tools are registered
      expect(toolCallbacks['create-project']).toBeDefined();
      expect(toolCallbacks['delete-project']).toBeDefined();
      expect(toolCallbacks['info-project']).toBeDefined();
      expect(toolCallbacks['list-project']).toBeDefined();
    });

    it('should register tools with correct names and descriptions', () => {
      registerProject(mockAdapter);

      const calls = (mockAdapter.server.tool as unknown as jest.Mock).mock.calls;

      expect(calls[0]).toEqual([
        'create-project',
        'Create a new upsun project',
        expect.any(Object),
        expect.any(Function),
      ]);

      expect(calls[1]).toEqual([
        'delete-project',
        'Delete a upsun project',
        expect.any(Object),
        expect.any(Function),
      ]);

      expect(calls[2]).toEqual([
        'info-project',
        'Get information of upsun project',
        expect.any(Object),
        expect.any(Function),
      ]);

      expect(calls[3]).toEqual([
        'list-project',
        'List all upsun projects',
        expect.any(Object),
        expect.any(Function),
      ]);
    });
  });

  describe('create-project tool', () => {
    beforeEach(() => {
      // Ensure tools are registered before running tests
      registerProject(mockAdapter);
    });

    it('should create project with default branch', async () => {
      const mockSub = { id: 'sub-123', status: 'active' };
      const mockProject = { id: 'project-123', name: 'Test Project', status: 'active' };

      mockClient.project.create.mockResolvedValue(mockSub);
      mockClient.project.getSubscription.mockResolvedValue(mockProject);

      const result = await toolCallbacks['create-project']({
        organization_id: 'org-123',
        name: 'Test Project',
      });

      expect(mockClient.project.create).toHaveBeenCalledWith(
        'org-123',
        'eu-5.platform.sh',
        'Test Project',
        undefined
      );
      expect(result).toEqual({
        content: [
          {
            type: 'text',
            text: JSON.stringify(
              {
                id: 'project-123',
                name: 'Test Project',
                status: 'active',
              },
              null,
              2
            ),
          },
        ],
      });
    });

    it('should create project with custom default branch', async () => {
      const mockSub = { id: 'sub-123', status: 'active' };

      mockClient.project.create.mockResolvedValue(mockSub);
      mockClient.project.getSubscription.mockResolvedValue(mockProject);

      const result = await toolCallbacks['create-project']({
        organization_id: 'org-123',
        name: 'Test Project',
        default_branch: 'develop',
      });

      expect(mockClient.project.create).toHaveBeenCalledWith(
        'org-123',
        'eu-5.platform.sh',
        'Test Project',
        'develop'
      );
      expect(result).toEqual({
        content: [
          {
            type: 'text',
            text: JSON.stringify(mockProject, null, 2),
          },
        ],
      });
    });

    it('should wait for project to become active', async () => {
      const mockSub = { id: 'sub-123' };
      const mockInactiveProject = { id: 'project-123', status: 'pending' };
      const mockActiveProject = { id: 'project-123', status: 'active' };

      mockClient.project.create.mockResolvedValue(mockSub);
      mockClient.project.getSubscription
        .mockResolvedValueOnce(mockInactiveProject) // First call - not active
        .mockResolvedValueOnce(mockActiveProject); // Second call - active

      // Mock delay function by mocking setTimeout
      const originalSetTimeout = globalThis.setTimeout;
      globalThis.setTimeout = jest.fn((callback: Function) => {
        callback(); // Execute immediately for testing
        return 123 as any;
      }) as any;

      const result = await toolCallbacks['create-project']({
        organization_id: 'org-123',
        name: 'Test Project',
      });

      expect(mockClient.project.getSubscription).toHaveBeenCalledTimes(2);
      expect(result).toEqual({
        content: [
          {
            type: 'text',
            text: JSON.stringify(
              {
                id: 'project-123',
                status: 'active',
              },
              null,
              2
            ),
          },
        ],
      });

      globalThis.setTimeout = originalSetTimeout;
    });

    it('should handle project creation errors', async () => {
      mockClient.project.create.mockRejectedValue(new Error('Creation failed'));

      await expect(
        toolCallbacks['create-project']({
          organization_id: 'org-123',
          name: 'Test Project',
        })
      ).rejects.toThrow('Creation failed');
    });
  });

  describe('create-project tool - additional tests', () => {
    beforeEach(() => {
      registerProject(mockAdapter);
    });

    it('should create a project successfully', async () => {
      const callback = toolCallbacks['create-project'];
      const params = {
        organization_id: '123456789012345678901234567',
        region: 'eu-west-1',
        name: 'New Test Project',
        default_branch: 'main',
      };

      const result = await callback(params);

      expect(mockClient.project.create).toHaveBeenCalledWith(
        '123456789012345678901234567',
        'eu-5.platform.sh',
        'New Test Project',
        'main'
      );
      expect(result).toEqual({
        content: [
          {
            type: 'text',
            text: JSON.stringify({ ...mockProject, status: 'active' }, null, 2),
          },
        ],
      });
    });

    it('should create a project without optional parameters', async () => {
      const callback = toolCallbacks['create-project'];
      const params = {
        organization_id: '123456789012345678901234567',
        region: 'eu-west-1',
        name: 'New Test Project',
      };

      const result = await callback(params);

      expect(mockClient.project.create).toHaveBeenCalledWith(
        '123456789012345678901234567',
        'eu-5.platform.sh',
        'New Test Project',
        undefined
      );
      expect(result).toEqual({
        content: [
          {
            type: 'text',
            text: JSON.stringify({ ...mockProject, status: 'active' }, null, 2),
          },
        ],
      });
    });

    it('should handle create project errors', async () => {
      const callback = toolCallbacks['create-project'];
      const errorMessage = 'Organization not found';
      mockClient.project.create.mockRejectedValue(new Error(errorMessage));

      const params = {
        organization_id: 'invalid-org-id',
        region: 'eu-west-1',
        name: 'New Test Project',
      };

      await expect(callback(params)).rejects.toThrow(errorMessage);
      expect(mockClient.project.create).toHaveBeenCalledWith(
        'invalid-org-id',
        'eu-5.platform.sh',
        'New Test Project',
        undefined
      );
    });
  });

  describe('delete-project tool', () => {
    beforeEach(() => {
      registerProject(mockAdapter);
    });

    it('should delete a project successfully', async () => {
      const callback = toolCallbacks['delete-project'];
      const params = {
        project_id: 'test-project-13',
      };

      const result = await callback(params);

      expect(mockClient.project.delete).toHaveBeenCalledWith('test-project-13');
      expect(result).toEqual({
        content: [
          {
            type: 'text',
            text: JSON.stringify(mockDeleteResult, null, 2),
          },
        ],
      });
    });

    it('should handle delete project errors', async () => {
      const callback = toolCallbacks['delete-project'];
      const errorMessage = 'Project not found';
      mockClient.project.delete.mockRejectedValue(new Error(errorMessage));

      const params = {
        project_id: 'invalid-project',
      };

      await expect(callback(params)).rejects.toThrow(errorMessage);
      expect(mockClient.project.delete).toHaveBeenCalledWith('invalid-project');
    });

    it('should handle deletion of non-existent project', async () => {
      const callback = toolCallbacks['delete-project'];
      mockClient.project.delete.mockResolvedValue({ success: false, error: 'Project not found' });

      const params = {
        project_id: 'non-existent-proj',
      };

      const result = await callback(params);

      expect(mockClient.project.delete).toHaveBeenCalledWith('non-existent-proj');
      expect(result).toEqual({
        content: [
          {
            type: 'text',
            text: JSON.stringify({ success: false, error: 'Project not found' }, null, 2),
          },
        ],
      });
    });
  });

  describe('info-project tool', () => {
    beforeEach(() => {
      registerProject(mockAdapter);
    });

    it('should get project info successfully', async () => {
      const callback = toolCallbacks['info-project'];
      const params = {
        project_id: 'test-project-13',
      };

      const result = await callback(params);

      expect(mockClient.project.info).toHaveBeenCalledWith('test-project-13');
      expect(result).toEqual({
        content: [
          {
            type: 'text',
            text: JSON.stringify(mockProject, null, 2),
          },
        ],
      });
    });

    it('should handle project info errors', async () => {
      const callback = toolCallbacks['info-project'];
      const errorMessage = 'Access denied';
      mockClient.project.info.mockRejectedValue(new Error(errorMessage));

      const params = {
        project_id: 'restricted-proj',
      };

      await expect(callback(params)).rejects.toThrow(errorMessage);
      expect(mockClient.project.info).toHaveBeenCalledWith('restricted-proj');
    });

    it('should handle detailed project information', async () => {
      const callback = toolCallbacks['info-project'];
      const detailedProject = {
        ...mockProject,
        environments: [
          { name: 'main', status: 'active' },
          { name: 'staging', status: 'active' },
        ],
        applications: [
          { name: 'web', type: 'php' },
          { name: 'worker', type: 'nodejs' },
        ],
        git: {
          url: 'git@github.com:example/repo.git',
          head: 'abc123',
        },
      };
      mockClient.project.info.mockResolvedValue(detailedProject);

      const params = {
        project_id: 'test-project-13',
      };

      const result = await callback(params);

      expect(result).toEqual({
        content: [
          {
            type: 'text',
            text: JSON.stringify(detailedProject, null, 2),
          },
        ],
      });
    });
  });

  describe('list-project tool', () => {
    beforeEach(() => {
      registerProject(mockAdapter);
    });

    it('should list projects successfully', async () => {
      const callback = toolCallbacks['list-project'];
      const params = {
        organization_id: '123456789012345678901234567',
      };

      const result = await callback(params);

      expect(mockClient.project.list).toHaveBeenCalledWith('123456789012345678901234567');
      expect(result).toEqual({
        content: [
          {
            type: 'text',
            text: JSON.stringify(mockProjectList, null, 2),
          },
        ],
      });
    });

    it('should handle empty project list', async () => {
      const callback = toolCallbacks['list-project'];
      mockClient.project.list.mockResolvedValue([]);

      const params = {
        organization_id: '123456789012345678901234567',
      };

      const result = await callback(params);

      expect(mockClient.project.list).toHaveBeenCalledWith('123456789012345678901234567');
      expect(result).toEqual({
        content: [
          {
            type: 'text',
            text: JSON.stringify([], null, 2),
          },
        ],
      });
    });

    it('should handle list projects errors', async () => {
      const callback = toolCallbacks['list-project'];
      const errorMessage = 'Organization access denied';
      mockClient.project.list.mockRejectedValue(new Error(errorMessage));

      const params = {
        organization_id: 'unauthorized-org',
      };

      await expect(callback(params)).rejects.toThrow(errorMessage);
      expect(mockClient.project.list).toHaveBeenCalledWith('unauthorized-org');
    });

    it('should handle large project lists', async () => {
      const callback = toolCallbacks['list-project'];
      const largeProjectList = Array.from({ length: 50 }, (_, i) => ({
        id: `project-${i.toString().padStart(13, '0')}`,
        name: `Project ${i}`,
        status: i % 2 === 0 ? 'active' : 'provisioning',
        created_at: `2025-05-${((i % 28) + 1).toString().padStart(2, '0')}T00:00:00Z`,
        organization_id: '123456789012345678901234567',
      }));
      mockClient.project.list.mockResolvedValue(largeProjectList);

      const params = {
        organization_id: '123456789012345678901234567',
      };

      const result = await callback(params);

      expect(result).toEqual({
        content: [
          {
            type: 'text',
            text: JSON.stringify(largeProjectList, null, 2),
          },
        ],
      });
    });
  });

  describe('edge cases and error handling', () => {
    beforeEach(() => {
      registerProject(mockAdapter);
    });

    it('should handle null responses from client', async () => {
      const callback = toolCallbacks['info-project'];
      mockClient.project.info.mockResolvedValue(null);

      const params = {
        project_id: 'test-project-13',
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
      const callback = toolCallbacks['create-project'];
      mockClient.project.create.mockRejectedValue(new Error('Request timeout'));

      const params = {
        organization_id: '123456789012345678901234567',
        region: 'eu-west-1',
        name: 'Test Project',
      };

      await expect(callback(params)).rejects.toThrow('Request timeout');
    });

    it('should handle API rate limiting', async () => {
      const callback = toolCallbacks['list-project'];
      mockClient.project.list.mockRejectedValue(new Error('Rate limit exceeded'));

      const params = {
        organization_id: '123456789012345678901234567',
      };

      await expect(callback(params)).rejects.toThrow('Rate limit exceeded');
    });
  });
});
