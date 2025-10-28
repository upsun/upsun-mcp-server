import { describe, expect, it, jest, beforeEach, afterEach } from '@jest/globals';
import { McpAdapter } from '../../src/core/adapter';
import { registerProject } from '../../src/command/project';
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
// Mock adapter and client
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
  server: { tool: jest.fn() },
  isMode: () => true,
} as any;

const mockProject = {
  id: 'test-project-13',
  name: 'Test Project',
  status: 'active',
  created_at: '2025-05-28T00:00:00Z',
  organization_id: 'org-123',
  region: 'eu-west-1',
  default_branch: 'main',
};
const mockProjectList = [
  mockProject,
  { ...mockProject, id: 'test-project-14', name: 'Another Project' },
];
const mockCreateResult = { id: 'sub-123', status: 'active' };
const mockDeleteResult = { success: true, message: 'Project deleted successfully' };

let toolCallbacks: Record<string, any> = {};

describe('Project Command Module', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    setupTestEnvironment(jest, originalEnv);
    jest.clearAllMocks();
    toolCallbacks = {};
    // Setup mock server.tool to capture callbacks
    (mockAdapter.server.tool as any) = jest.fn(
      (name: string, _desc: any, _schema: any, callback: any) => {
        toolCallbacks[name] = callback;
        return mockAdapter.server;
      }
    );
    // Setup default mock responses
    mockClient.project.create.mockResolvedValue(mockCreateResult);
    mockClient.project.delete.mockResolvedValue(mockDeleteResult);
    mockClient.project.info.mockResolvedValue(mockProject);
    mockClient.project.list.mockResolvedValue(mockProjectList);
    mockClient.project.getSubscription.mockResolvedValue({ ...mockProject, status: 'active' });
  });
  afterEach(() => {
    teardownTestEnvironment(originalEnv);
    jest.restoreAllMocks();
  });

  it('registerProject registers all tools', () => {
    registerProject(mockAdapter);
    expect(mockAdapter.server.tool).toHaveBeenCalledTimes(4);
    expect(toolCallbacks['create-project']).toBeDefined();
    expect(toolCallbacks['delete-project']).toBeDefined();
    expect(toolCallbacks['info-project']).toBeDefined();
    expect(toolCallbacks['list-project']).toBeDefined();
  });

  describe('create-project', () => {
    beforeEach(() => {
      registerProject(mockAdapter);
    });
    it('creates a project and waits for active', async () => {
      // Simulate project not active at first
      mockClient.project.create.mockResolvedValue({ id: 'sub-123' });
      mockClient.project.getSubscription
        .mockResolvedValueOnce({ ...mockProject, status: 'pending' })
        .mockResolvedValueOnce({ ...mockProject, status: 'active' });
      // Patch setTimeout to run instantly
      const origSetTimeout = globalThis.setTimeout;
      globalThis.setTimeout = ((cb: any) => {
        cb();
        return 1 as any;
      }) as any;
      const result = await toolCallbacks['create-project']({
        organization_id: 'org-123',
        name: 'Test Project',
        region_host: 'eu-5.platform.sh',
      });
      expect(mockClient.project.create).toHaveBeenCalledWith(
        'org-123',
        'eu-5.platform.sh',
        'Test Project',
        undefined
      );
      expect(mockClient.project.getSubscription).toHaveBeenCalledTimes(2);
      expect(result).toHaveProperty('content');
      globalThis.setTimeout = origSetTimeout;
    });
    it('creates a project with custom default branch', async () => {
      const result = await toolCallbacks['create-project']({
        organization_id: 'org-123',
        name: 'Test Project',
        region_host: 'eu-5.platform.sh',
        default_branch: 'develop',
      });
      expect(mockClient.project.create).toHaveBeenCalledWith(
        'org-123',
        'eu-5.platform.sh',
        'Test Project',
        'develop'
      );
      expect(result).toHaveProperty('content');
    });
    it('throws on project creation error', async () => {
      mockClient.project.create.mockRejectedValueOnce(new Error('fail'));
      await expect(
        toolCallbacks['create-project']({
          organization_id: 'org-123',
          name: 'Test Project',
          region_host: 'eu-5.platform.sh',
        })
      ).rejects.toThrow('fail');
    });
  });

  describe('delete-project', () => {
    beforeEach(() => {
      registerProject(mockAdapter);
    });

    it('deletes a project successfully', async () => {
      const result = await toolCallbacks['delete-project']({ project_id: 'test-project-13' });
      expect(mockClient.project.delete).toHaveBeenCalledWith('test-project-13');
      expect(result).toHaveProperty('content');
    });

    it('handles delete errors', async () => {
      mockClient.project.delete.mockRejectedValueOnce(new Error('Delete failed'));
      await expect(
        toolCallbacks['delete-project']({ project_id: 'test-project-13' })
      ).rejects.toThrow('Delete failed');
    });
  });

  describe('info-project', () => {
    beforeEach(() => {
      registerProject(mockAdapter);
    });

    it('gets project info successfully', async () => {
      const result = await toolCallbacks['info-project']({ project_id: 'test-project-13' });
      expect(mockClient.project.info).toHaveBeenCalledWith('test-project-13');
      expect(result).toHaveProperty('content');
    });

    it('handles info errors', async () => {
      mockClient.project.info.mockRejectedValueOnce(new Error('Info failed'));
      await expect(
        toolCallbacks['info-project']({ project_id: 'test-project-13' })
      ).rejects.toThrow('Info failed');
    });
  });

  describe('list-project', () => {
    beforeEach(() => {
      registerProject(mockAdapter);
    });

    it('lists projects successfully', async () => {
      const result = await toolCallbacks['list-project']({ organization_id: 'org-123' });
      expect(mockClient.project.list).toHaveBeenCalledWith('org-123');
      expect(result).toHaveProperty('content');
    });

    it('handles list errors', async () => {
      mockClient.project.list.mockRejectedValueOnce(new Error('List failed'));
      await expect(toolCallbacks['list-project']({ organization_id: 'org-123' })).rejects.toThrow(
        'List failed'
      );
    });

    it('handles empty project list', async () => {
      mockClient.project.list.mockResolvedValueOnce([]);
      const result = await toolCallbacks['list-project']({ organization_id: 'org-123' });
      expect(result).toHaveProperty('content');
    });
  });

  describe('isMode restrictions', () => {
    it('should not register create-project when isMode is false', () => {
      const readonlyAdapter = {
        ...mockAdapter,
        isMode: () => false,
      } as any;

      const toolCalls: string[] = [];
      (readonlyAdapter.server.tool as jest.Mock) = jest.fn((...args: any[]) => {
        toolCalls.push(args[0] as string);
        return readonlyAdapter.server;
      });

      registerProject(readonlyAdapter);

      expect(toolCalls).not.toContain('create-project');
      expect(toolCalls).not.toContain('delete-project');
      expect(toolCalls).toContain('info-project');
      expect(toolCalls).toContain('list-project');
    });
  });
});
