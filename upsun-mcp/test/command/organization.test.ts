import { describe, expect, it, jest, beforeEach, afterEach } from '@jest/globals';
import { McpAdapter } from '../../src/core/adapter';
import { registerOrganization } from '../../src/command/organization';
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

// Explicit mock added for isMode on mockAdapter (single global declaration)
const mockOrganizationsApi = {
  create: jest.fn(),
  delete: jest.fn(),
  info: jest.fn(),
  list: jest.fn(),
};

const mockClient: { organizations: any } = {
  organizations: mockOrganizationsApi,
};
const mockAdapter: McpAdapter = {
  client: mockClient,
  server: {
    tool: jest.fn(),
  },
  isMode: () => true,
} as any;

// Mock data for testing
const mockOrganization = {
  id: '123456789012345678901234567',
  name: 'Test Organization',
  status: 'active',
  created_at: '2025-05-28T00:00:00Z',
  owner: 'user@example.com',
  projects_count: 5,
  members_count: 10,
};

const mockOrganizationList = [
  mockOrganization,
  {
    id: '987654321098765432109876543',
    name: 'Another Organization',
    status: 'active',
    created_at: '2025-05-27T00:00:00Z',
    owner: 'admin@example.com',
    projects_count: 2,
    members_count: 3,
  },
];

const mockCreateResult = {
  ...mockOrganization,
  message: 'Organization created successfully',
};

const mockDeleteResult = {
  success: true,
  message: 'Organization deleted successfully',
};

// ...existing code...

// ...existing code...

describe('Organization Command Module', () => {
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

    // Setup mock server.registerTool to capture callbacks
    (mockAdapter.server.registerTool as any) = jest
      .fn()
      .mockImplementation((name: any, ...args: any[]) => {
        const callback = args[args.length - 1];
        toolCallbacks[name] = callback;
        return mockAdapter.server;
      });

    // Setup default mock responses
    mockClient.organizations.create.mockResolvedValue(mockCreateResult);
    mockClient.organizations.delete.mockResolvedValue(mockDeleteResult);
    mockClient.organizations.info.mockResolvedValue(mockOrganization);
    mockClient.organizations.list.mockResolvedValue(mockOrganizationList);
  });

  afterEach(() => {
    teardownTestEnvironment(originalEnv);
    jest.restoreAllMocks();
  });

  describe('registerOrganization function', () => {
    it('should register all organization tools', () => {
      registerOrganization(mockAdapter);

      expect(mockAdapter.server.registerTool).toHaveBeenCalledTimes(4);

      // Verify all tools are registered
      expect(toolCallbacks['create-organization']).toBeDefined();
      expect(toolCallbacks['delete-organization']).toBeDefined();
      expect(toolCallbacks['info-organization']).toBeDefined();
      expect(toolCallbacks['list-organization']).toBeDefined();
    });

    it('should register tools with correct names and descriptions', () => {
      registerOrganization(mockAdapter);

      const calls = (mockAdapter.server.registerTool as unknown as jest.Mock).mock.calls;

      expect(calls[0]).toEqual([
        'create-organization',
        {
          description: 'Create a Organization on upsun',
          inputSchema: expect.any(Object),
        },
        expect.any(Function),
      ]);

      expect(calls[1]).toEqual([
        'delete-organization',
        {
          description: 'Delete a Organization on upsun',
          inputSchema: expect.any(Object),
        },
        expect.any(Function),
      ]);

      expect(calls[2]).toEqual([
        'info-organization',
        {
          description: 'Get information of organization on upsun',
          inputSchema: expect.any(Object),
        },
        expect.any(Function),
      ]);

      expect(calls[3]).toEqual([
        'list-organization',
        {
          description: 'List all my organizations on upsun',
          inputSchema: expect.any(Object),
        },
        expect.any(Function),
      ]);
    });
  });

  describe('create-organization tool', () => {
    beforeEach(() => {
      registerOrganization(mockAdapter);
    });

    it('should create an organization successfully', async () => {
      const callback = toolCallbacks['create-organization'];
      const params = {
        organization_name: 'New Test Organization',
      };

      const result = await callback(params);

      expect(mockClient.organizations.create).toHaveBeenCalledWith('New Test Organization');
      expect(result).toEqual({
        content: [
          {
            type: 'text',
            text: JSON.stringify(mockCreateResult, null, 2),
          },
        ],
      });
    });

    it('should handle create organization errors', async () => {
      const callback = toolCallbacks['create-organization'];
      const errorMessage = 'Organization name already exists';
      mockClient.organizations.create.mockRejectedValue(new Error(errorMessage));

      const params = {
        organization_name: 'Existing Organization',
      };

      await expect(callback(params)).rejects.toThrow(errorMessage);
      expect(mockClient.organizations.create).toHaveBeenCalledWith('Existing Organization');
    });

    it('should handle special characters in organization name', async () => {
      const callback = toolCallbacks['create-organization'];
      const params = {
        organization_name: 'Test Org & Co. (2025)',
      };

      const result = await callback(params);

      expect(mockClient.organizations.create).toHaveBeenCalledWith('Test Org & Co. (2025)');
      expect(result).toEqual({
        content: [
          {
            type: 'text',
            text: JSON.stringify(mockCreateResult, null, 2),
          },
        ],
      });
    });
  });

  describe('delete-organization tool', () => {
    beforeEach(() => {
      registerOrganization(mockAdapter);
    });

    it('should delete an organization successfully', async () => {
      const callback = toolCallbacks['delete-organization'];
      const params = {
        organization_id: '123456789012345678901234567',
      };

      const result = await callback(params);

      expect(mockClient.organizations.delete).toHaveBeenCalledWith('123456789012345678901234567');
      expect(result).toEqual({
        content: [
          {
            type: 'text',
            text: JSON.stringify(mockDeleteResult, null, 2),
          },
        ],
      });
    });

    it('should handle delete organization errors', async () => {
      const callback = toolCallbacks['delete-organization'];
      const errorMessage = 'Organization not found';
      mockClient.organizations.delete.mockRejectedValue(new Error(errorMessage));

      const params = {
        organization_id: 'invalid-org-id',
      };

      await expect(callback(params)).rejects.toThrow(errorMessage);
      expect(mockClient.organizations.delete).toHaveBeenCalledWith('invalid-org-id');
    });

    it('should handle deletion of organization with projects', async () => {
      const callback = toolCallbacks['delete-organization'];
      mockClient.organizations.delete.mockResolvedValue({
        success: false,
        error: 'Cannot delete organization with active projects',
      });

      const params = {
        organization_id: '123456789012345678901234567',
      };

      const result = await callback(params);

      expect(mockClient.organizations.delete).toHaveBeenCalledWith('123456789012345678901234567');
      expect(result).toEqual({
        content: [
          {
            type: 'text',
            text: JSON.stringify(
              { success: false, error: 'Cannot delete organization with active projects' },
              null,
              2
            ),
          },
        ],
      });
    });
  });

  describe('info-organization tool', () => {
    beforeEach(() => {
      registerOrganization(mockAdapter);
    });

    it('should get organization info successfully', async () => {
      const callback = toolCallbacks['info-organization'];
      const params = {
        organization_id: '123456789012345678901234567',
      };

      const result = await callback(params);

      expect(mockClient.organizations.info).toHaveBeenCalledWith('123456789012345678901234567');
      expect(result).toEqual({
        content: [
          {
            type: 'text',
            text: JSON.stringify(mockOrganization, null, 2),
          },
        ],
      });
    });

    it('should handle organization info errors', async () => {
      const callback = toolCallbacks['info-organization'];
      const errorMessage = 'Access denied to organization';
      mockClient.organizations.info.mockRejectedValue(new Error(errorMessage));

      const params = {
        organization_id: 'restricted-org-id',
      };

      await expect(callback(params)).rejects.toThrow(errorMessage);
      expect(mockClient.organizations.info).toHaveBeenCalledWith('restricted-org-id');
    });

    it('should handle detailed organization information', async () => {
      const callback = toolCallbacks['info-organization'];
      const detailedOrganization = {
        ...mockOrganization,
        members: [
          { email: 'user1@example.com', role: 'admin' },
          { email: 'user2@example.com', role: 'member' },
        ],
        projects: [
          { id: 'proj1', name: 'Project 1' },
          { id: 'proj2', name: 'Project 2' },
        ],
        billing: {
          plan: 'enterprise',
          status: 'active',
        },
      };
      mockClient.organizations.info.mockResolvedValue(detailedOrganization);

      const params = {
        organization_id: '123456789012345678901234567',
      };

      const result = await callback(params);

      expect(result).toEqual({
        content: [
          {
            type: 'text',
            text: JSON.stringify(detailedOrganization, null, 2),
          },
        ],
      });
    });
  });

  describe('list-organization tool', () => {
    beforeEach(() => {
      registerOrganization(mockAdapter);
    });

    it('should list organizations successfully', async () => {
      const callback = toolCallbacks['list-organization'];
      const params = {};

      const result = await callback(params);

      expect(mockClient.organizations.list).toHaveBeenCalledWith();
      expect(result).toEqual({
        content: [
          {
            type: 'text',
            text: JSON.stringify(mockOrganizationList, null, 2),
          },
        ],
      });
    });

    it('should handle empty organization list', async () => {
      const callback = toolCallbacks['list-organization'];
      mockClient.organizations.list.mockResolvedValue([]);

      const params = {};

      const result = await callback(params);

      expect(mockClient.organizations.list).toHaveBeenCalledWith();
      expect(result).toEqual({
        content: [
          {
            type: 'text',
            text: JSON.stringify([], null, 2),
          },
        ],
      });
    });

    it('should handle list organizations errors', async () => {
      const callback = toolCallbacks['list-organization'];
      const errorMessage = 'Authentication failed';
      mockClient.organizations.list.mockRejectedValue(new Error(errorMessage));

      const params = {};

      await expect(callback(params)).rejects.toThrow(errorMessage);
      expect(mockClient.organizations.list).toHaveBeenCalledWith();
    });

    it('should handle large organization lists', async () => {
      const callback = toolCallbacks['list-organization'];
      const largeOrganizationList = Array.from({ length: 25 }, (_, i) => ({
        id: `org-${i.toString().padStart(27, '0')}`,
        name: `Organization ${i}`,
        status: i % 3 === 0 ? 'active' : 'inactive',
        created_at: `2025-05-${((i % 28) + 1).toString().padStart(2, '0')}T00:00:00Z`,
        owner: `owner${i}@example.com`,
        projects_count: i % 10,
        members_count: (i % 5) + 1,
      }));
      mockClient.organizations.list.mockResolvedValue(largeOrganizationList);

      const params = {};

      const result = await callback(params);

      expect(result).toEqual({
        content: [
          {
            type: 'text',
            text: JSON.stringify(largeOrganizationList, null, 2),
          },
        ],
      });
    });
  });

  describe('edge cases and error handling', () => {
    beforeEach(() => {
      registerOrganization(mockAdapter);
    });

    it('should handle null responses from client', async () => {
      const callback = toolCallbacks['info-organization'];
      mockClient.organizations.info.mockResolvedValue(null);

      const params = {
        organization_id: '123456789012345678901234567',
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
      const callback = toolCallbacks['create-organization'];
      mockClient.organizations.create.mockRejectedValue(new Error('Network timeout'));

      const params = {
        organization_name: 'Test Organization',
      };

      await expect(callback(params)).rejects.toThrow('Network timeout');
    });

    it('should handle API rate limiting', async () => {
      const callback = toolCallbacks['list-organization'];
      mockClient.organizations.list.mockRejectedValue(new Error('Rate limit exceeded'));

      const params = {};

      await expect(callback(params)).rejects.toThrow('Rate limit exceeded');
    });
  });
});
