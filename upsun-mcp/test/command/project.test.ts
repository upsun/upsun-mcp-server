import { describe, expect, it, jest, beforeEach, afterEach } from '@jest/globals';
import { McpAdapter } from "../../src/core/adapter.js";
import { registerProject } from "../../src/command/project.js";

// Mock data for testing
const mockProject = {
  id: 'test-project-13',
  name: 'Test Project',
  status: 'active',
  created_at: '2025-05-28T00:00:00Z',
  organization_id: '123456789012345678901234567',
  region: 'eu-west-1',
  default_branch: 'main'
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
    default_branch: 'main'
  }
];

const mockCreateResult = {
  ...mockProject,
  message: 'Project created successfully'
};

const mockDeleteResult = {
  success: true,
  message: 'Project deleted successfully'
};

// Mock the Upsun client
const mockClient = {
  project: {
    create: jest.fn(),
    delete: jest.fn(),
    info: jest.fn(),
    list: jest.fn()
  }
};

// Mock the adapter
const mockAdapter: McpAdapter = {
  client: mockClient,
  server: {
    tool: jest.fn()
  }
} as any;

describe('Project Command Module', () => {
  let toolCallbacks: Record<string, any> = {};

  beforeEach(() => {
    jest.clearAllMocks();
    toolCallbacks = {};
    
    // Setup mock server.tool to capture callbacks
    mockAdapter.server.tool = jest.fn().mockImplementation((name: string, description: string, schema: any, callback: any) => {
      toolCallbacks[name] = callback;
      return mockAdapter.server;
    });

    // Setup default mock responses
    mockClient.project.create.mockResolvedValue(mockCreateResult);
    mockClient.project.delete.mockResolvedValue(mockDeleteResult);
    mockClient.project.info.mockResolvedValue(mockProject);
    mockClient.project.list.mockResolvedValue(mockProjectList);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('registerProject function', () => {
    it('should register all project tools', () => {
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
      
      registerProject(mockAdapter);
      
      expect(consoleSpy).toHaveBeenCalledWith('Register Project Handlers');
      expect(mockAdapter.server.tool).toHaveBeenCalledTimes(4);
      
      // Verify all tools are registered
      expect(toolCallbacks['create-project']).toBeDefined();
      expect(toolCallbacks['delete-project']).toBeDefined();
      expect(toolCallbacks['info-project']).toBeDefined();
      expect(toolCallbacks['list-project']).toBeDefined();
      
      consoleSpy.mockRestore();
    });

    it('should register tools with correct names and descriptions', () => {
      registerProject(mockAdapter);
      
      const calls = (mockAdapter.server.tool as jest.Mock).mock.calls;
      
      expect(calls[0]).toEqual([
        'create-project',
        'Create a new upsun project',
        expect.any(Object),
        expect.any(Function)
      ]);
      
      expect(calls[1]).toEqual([
        'delete-project',
        'Delete a upsun project',
        expect.any(Object),
        expect.any(Function)
      ]);
      
      expect(calls[2]).toEqual([
        'info-project',
        'Get information of upsun project',
        expect.any(Object),
        expect.any(Function)
      ]);
      
      expect(calls[3]).toEqual([
        'list-project',
        'List all upsun projects',
        expect.any(Object),
        expect.any(Function)
      ]);
    });
  });

  describe('create-project tool', () => {
    beforeEach(() => {
      registerProject(mockAdapter);
    });

    it('should create a project successfully', async () => {
      const callback = toolCallbacks['create-project'];
      const params = {
        organization_id: '123456789012345678901234567',
        region: 'eu-west-1',
        name: 'New Test Project',
        default_branch: 'main'
      };

      const result = await callback(params);

      expect(mockClient.project.create).toHaveBeenCalledWith(
        '123456789012345678901234567',
        'New Test Project'
      );
      expect(result).toEqual({
        content: [{
          type: 'text',
          text: JSON.stringify(mockCreateResult, null, 2)
        }]
      });
    });

    it('should create a project without optional parameters', async () => {
      const callback = toolCallbacks['create-project'];
      const params = {
        organization_id: '123456789012345678901234567',
        region: 'eu-west-1',
        name: 'New Test Project'
      };

      const result = await callback(params);

      expect(mockClient.project.create).toHaveBeenCalledWith(
        '123456789012345678901234567',
        'New Test Project'
      );
      expect(result).toEqual({
        content: [{
          type: 'text',
          text: JSON.stringify(mockCreateResult, null, 2)
        }]
      });
    });

    it('should handle create project errors', async () => {
      const callback = toolCallbacks['create-project'];
      const errorMessage = 'Organization not found';
      mockClient.project.create.mockRejectedValue(new Error(errorMessage));

      const params = {
        organization_id: 'invalid-org-id',
        region: 'eu-west-1',
        name: 'New Test Project'
      };

      await expect(callback(params)).rejects.toThrow(errorMessage);
      expect(mockClient.project.create).toHaveBeenCalledWith(
        'invalid-org-id',
        'New Test Project'
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
        project_id: 'test-project-13'
      };

      const result = await callback(params);

      expect(mockClient.project.delete).toHaveBeenCalledWith('test-project-13');
      expect(result).toEqual({
        content: [{
          type: 'text',
          text: JSON.stringify(mockDeleteResult, null, 2)
        }]
      });
    });

    it('should handle delete project errors', async () => {
      const callback = toolCallbacks['delete-project'];
      const errorMessage = 'Project not found';
      mockClient.project.delete.mockRejectedValue(new Error(errorMessage));

      const params = {
        project_id: 'invalid-project'
      };

      await expect(callback(params)).rejects.toThrow(errorMessage);
      expect(mockClient.project.delete).toHaveBeenCalledWith('invalid-project');
    });

    it('should handle deletion of non-existent project', async () => {
      const callback = toolCallbacks['delete-project'];
      mockClient.project.delete.mockResolvedValue({ success: false, error: 'Project not found' });

      const params = {
        project_id: 'non-existent-proj'
      };

      const result = await callback(params);

      expect(mockClient.project.delete).toHaveBeenCalledWith('non-existent-proj');
      expect(result).toEqual({
        content: [{
          type: 'text',
          text: JSON.stringify({ success: false, error: 'Project not found' }, null, 2)
        }]
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
        project_id: 'test-project-13'
      };

      const result = await callback(params);

      expect(mockClient.project.info).toHaveBeenCalledWith('test-project-13');
      expect(result).toEqual({
        content: [{
          type: 'text',
          text: JSON.stringify(mockProject, null, 2)
        }]
      });
    });

    it('should handle project info errors', async () => {
      const callback = toolCallbacks['info-project'];
      const errorMessage = 'Access denied';
      mockClient.project.info.mockRejectedValue(new Error(errorMessage));

      const params = {
        project_id: 'restricted-proj'
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
          { name: 'staging', status: 'active' }
        ],
        applications: [
          { name: 'web', type: 'php' },
          { name: 'worker', type: 'nodejs' }
        ],
        git: {
          url: 'git@github.com:example/repo.git',
          head: 'abc123'
        }
      };
      mockClient.project.info.mockResolvedValue(detailedProject);

      const params = {
        project_id: 'test-project-13'
      };

      const result = await callback(params);

      expect(result).toEqual({
        content: [{
          type: 'text',
          text: JSON.stringify(detailedProject, null, 2)
        }]
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
        organization_id: '123456789012345678901234567'
      };

      const result = await callback(params);

      expect(mockClient.project.list).toHaveBeenCalledWith('123456789012345678901234567');
      expect(result).toEqual({
        content: [{
          type: 'text',
          text: JSON.stringify(mockProjectList, null, 2)
        }]
      });
    });

    it('should handle empty project list', async () => {
      const callback = toolCallbacks['list-project'];
      mockClient.project.list.mockResolvedValue([]);

      const params = {
        organization_id: '123456789012345678901234567'
      };

      const result = await callback(params);

      expect(mockClient.project.list).toHaveBeenCalledWith('123456789012345678901234567');
      expect(result).toEqual({
        content: [{
          type: 'text',
          text: JSON.stringify([], null, 2)
        }]
      });
    });

    it('should handle list projects errors', async () => {
      const callback = toolCallbacks['list-project'];
      const errorMessage = 'Organization access denied';
      mockClient.project.list.mockRejectedValue(new Error(errorMessage));

      const params = {
        organization_id: 'unauthorized-org'
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
        created_at: `2025-05-${(i % 28 + 1).toString().padStart(2, '0')}T00:00:00Z`,
        organization_id: '123456789012345678901234567'
      }));
      mockClient.project.list.mockResolvedValue(largeProjectList);

      const params = {
        organization_id: '123456789012345678901234567'
      };

      const result = await callback(params);

      expect(result).toEqual({
        content: [{
          type: 'text',
          text: JSON.stringify(largeProjectList, null, 2)
        }]
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
        project_id: 'test-project-13'
      };

      const result = await callback(params);

      expect(result).toEqual({
        content: [{
          type: 'text',
          text: JSON.stringify(null, null, 2)
        }]
      });
    });

    it('should handle network timeouts', async () => {
      const callback = toolCallbacks['create-project'];
      mockClient.project.create.mockRejectedValue(new Error('Request timeout'));

      const params = {
        organization_id: '123456789012345678901234567',
        region: 'eu-west-1',
        name: 'Test Project'
      };

      await expect(callback(params)).rejects.toThrow('Request timeout');
    });

    it('should handle API rate limiting', async () => {
      const callback = toolCallbacks['list-project'];
      mockClient.project.list.mockRejectedValue(new Error('Rate limit exceeded'));

      const params = {
        organization_id: '123456789012345678901234567'
      };

      await expect(callback(params)).rejects.toThrow('Rate limit exceeded');
    });
  });
});
