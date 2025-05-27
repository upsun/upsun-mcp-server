import { describe, expect, it, jest, beforeEach, afterEach } from '@jest/globals';
import { McpAdapter } from "../../src/core/adapter.js";
import { registerOrganization } from "../../src/command/organization.js";

// Mock data for testing
const mockOrganization = {
  id: '123456789012345678901234567',
  name: 'Test Organization',
  status: 'active',
  created_at: '2025-05-28T00:00:00Z',
  owner: 'user@example.com',
  projects_count: 5,
  members_count: 10
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
    members_count: 3
  }
];

const mockCreateResult = {
  ...mockOrganization,
  message: 'Organization created successfully'
};

const mockDeleteResult = {
  success: true,
  message: 'Organization deleted successfully'
};

// Mock the Upsun client
const mockClient = {
  organization: {
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

describe('Organization Command Module', () => {
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
    mockClient.organization.create.mockResolvedValue(mockCreateResult);
    mockClient.organization.delete.mockResolvedValue(mockDeleteResult);
    mockClient.organization.info.mockResolvedValue(mockOrganization);
    mockClient.organization.list.mockResolvedValue(mockOrganizationList);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('registerOrganization function', () => {
    it('should register all organization tools', () => {
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
      
      registerOrganization(mockAdapter);
      
      expect(consoleSpy).toHaveBeenCalledWith('Register Organization Handlers');
      expect(mockAdapter.server.tool).toHaveBeenCalledTimes(4);
      
      // Verify all tools are registered
      expect(toolCallbacks['create-organization']).toBeDefined();
      expect(toolCallbacks['delete-organization']).toBeDefined();
      expect(toolCallbacks['info-organization']).toBeDefined();
      expect(toolCallbacks['list-organization']).toBeDefined();
      
      consoleSpy.mockRestore();
    });

    it('should register tools with correct names and descriptions', () => {
      registerOrganization(mockAdapter);
      
      const calls = (mockAdapter.server.tool as jest.Mock).mock.calls;
      
      expect(calls[0]).toEqual([
        'create-organization',
        'Create a Organization on upsun',
        expect.any(Object),
        expect.any(Function)
      ]);
      
      expect(calls[1]).toEqual([
        'delete-organization',
        'Delete a Organization on upsun',
        expect.any(Object),
        expect.any(Function)
      ]);
      
      expect(calls[2]).toEqual([
        'info-organization',
        'Get information of organization on upsun',
        expect.any(Object),
        expect.any(Function)
      ]);
      
      expect(calls[3]).toEqual([
        'list-organization',
        'List all my organizations on upsun',
        expect.any(Object),
        expect.any(Function)
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
        organization_name: 'New Test Organization'
      };

      const result = await callback(params);

      expect(mockClient.organization.create).toHaveBeenCalledWith('New Test Organization');
      expect(result).toEqual({
        content: [{
          type: 'text',
          text: JSON.stringify(mockCreateResult, null, 2)
        }]
      });
    });

    it('should handle create organization errors', async () => {
      const callback = toolCallbacks['create-organization'];
      const errorMessage = 'Organization name already exists';
      mockClient.organization.create.mockRejectedValue(new Error(errorMessage));

      const params = {
        organization_name: 'Existing Organization'
      };

      await expect(callback(params)).rejects.toThrow(errorMessage);
      expect(mockClient.organization.create).toHaveBeenCalledWith('Existing Organization');
    });

    it('should handle special characters in organization name', async () => {
      const callback = toolCallbacks['create-organization'];
      const params = {
        organization_name: 'Test Org & Co. (2025)'
      };

      const result = await callback(params);

      expect(mockClient.organization.create).toHaveBeenCalledWith('Test Org & Co. (2025)');
      expect(result).toEqual({
        content: [{
          type: 'text',
          text: JSON.stringify(mockCreateResult, null, 2)
        }]
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
        organization_id: '123456789012345678901234567'
      };

      const result = await callback(params);

      expect(mockClient.organization.delete).toHaveBeenCalledWith('123456789012345678901234567');
      expect(result).toEqual({
        content: [{
          type: 'text',
          text: JSON.stringify(mockDeleteResult, null, 2)
        }]
      });
    });

    it('should handle delete organization errors', async () => {
      const callback = toolCallbacks['delete-organization'];
      const errorMessage = 'Organization not found';
      mockClient.organization.delete.mockRejectedValue(new Error(errorMessage));

      const params = {
        organization_id: 'invalid-org-id'
      };

      await expect(callback(params)).rejects.toThrow(errorMessage);
      expect(mockClient.organization.delete).toHaveBeenCalledWith('invalid-org-id');
    });

    it('should handle deletion of organization with projects', async () => {
      const callback = toolCallbacks['delete-organization'];
      mockClient.organization.delete.mockResolvedValue({ 
        success: false, 
        error: 'Cannot delete organization with active projects' 
      });

      const params = {
        organization_id: '123456789012345678901234567'
      };

      const result = await callback(params);

      expect(mockClient.organization.delete).toHaveBeenCalledWith('123456789012345678901234567');
      expect(result).toEqual({
        content: [{
          type: 'text',
          text: JSON.stringify({ success: false, error: 'Cannot delete organization with active projects' }, null, 2)
        }]
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
        organization_id: '123456789012345678901234567'
      };

      const result = await callback(params);

      expect(mockClient.organization.info).toHaveBeenCalledWith('123456789012345678901234567');
      expect(result).toEqual({
        content: [{
          type: 'text',
          text: JSON.stringify(mockOrganization, null, 2)
        }]
      });
    });

    it('should handle organization info errors', async () => {
      const callback = toolCallbacks['info-organization'];
      const errorMessage = 'Access denied to organization';
      mockClient.organization.info.mockRejectedValue(new Error(errorMessage));

      const params = {
        organization_id: 'restricted-org-id'
      };

      await expect(callback(params)).rejects.toThrow(errorMessage);
      expect(mockClient.organization.info).toHaveBeenCalledWith('restricted-org-id');
    });

    it('should handle detailed organization information', async () => {
      const callback = toolCallbacks['info-organization'];
      const detailedOrganization = {
        ...mockOrganization,
        members: [
          { email: 'user1@example.com', role: 'admin' },
          { email: 'user2@example.com', role: 'member' }
        ],
        projects: [
          { id: 'proj1', name: 'Project 1' },
          { id: 'proj2', name: 'Project 2' }
        ],
        billing: {
          plan: 'enterprise',
          status: 'active'
        }
      };
      mockClient.organization.info.mockResolvedValue(detailedOrganization);

      const params = {
        organization_id: '123456789012345678901234567'
      };

      const result = await callback(params);

      expect(result).toEqual({
        content: [{
          type: 'text',
          text: JSON.stringify(detailedOrganization, null, 2)
        }]
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

      expect(mockClient.organization.list).toHaveBeenCalledWith();
      expect(result).toEqual({
        content: [{
          type: 'text',
          text: JSON.stringify(mockOrganizationList, null, 2)
        }]
      });
    });

    it('should handle empty organization list', async () => {
      const callback = toolCallbacks['list-organization'];
      mockClient.organization.list.mockResolvedValue([]);

      const params = {};

      const result = await callback(params);

      expect(mockClient.organization.list).toHaveBeenCalledWith();
      expect(result).toEqual({
        content: [{
          type: 'text',
          text: JSON.stringify([], null, 2)
        }]
      });
    });

    it('should handle list organizations errors', async () => {
      const callback = toolCallbacks['list-organization'];
      const errorMessage = 'Authentication failed';
      mockClient.organization.list.mockRejectedValue(new Error(errorMessage));

      const params = {};

      await expect(callback(params)).rejects.toThrow(errorMessage);
      expect(mockClient.organization.list).toHaveBeenCalledWith();
    });

    it('should handle large organization lists', async () => {
      const callback = toolCallbacks['list-organization'];
      const largeOrganizationList = Array.from({ length: 25 }, (_, i) => ({
        id: `org-${i.toString().padStart(27, '0')}`,
        name: `Organization ${i}`,
        status: i % 3 === 0 ? 'active' : 'inactive',
        created_at: `2025-05-${(i % 28 + 1).toString().padStart(2, '0')}T00:00:00Z`,
        owner: `owner${i}@example.com`,
        projects_count: i % 10,
        members_count: (i % 5) + 1
      }));
      mockClient.organization.list.mockResolvedValue(largeOrganizationList);

      const params = {};

      const result = await callback(params);

      expect(result).toEqual({
        content: [{
          type: 'text',
          text: JSON.stringify(largeOrganizationList, null, 2)
        }]
      });
    });
  });

  describe('edge cases and error handling', () => {
    beforeEach(() => {
      registerOrganization(mockAdapter);
    });

    it('should handle null responses from client', async () => {
      const callback = toolCallbacks['info-organization'];
      mockClient.organization.info.mockResolvedValue(null);

      const params = {
        organization_id: '123456789012345678901234567'
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
      const callback = toolCallbacks['create-organization'];
      mockClient.organization.create.mockRejectedValue(new Error('Network timeout'));

      const params = {
        organization_name: 'Test Organization'
      };

      await expect(callback(params)).rejects.toThrow('Network timeout');
    });

    it('should handle API rate limiting', async () => {
      const callback = toolCallbacks['list-organization'];
      mockClient.organization.list.mockRejectedValue(new Error('Rate limit exceeded'));

      const params = {};

      await expect(callback(params)).rejects.toThrow('Rate limit exceeded');
    });
  });
});
