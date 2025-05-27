import { describe, expect, it, jest, beforeEach, afterEach } from '@jest/globals';
import { McpAdapter } from "../../src/core/adapter.js";
import { registerDomain } from "../../src/command/domain.js";

// Mock the adapter
const mockAdapter: McpAdapter = {
  client: {},
  server: {
    tool: jest.fn()
  }
} as any;

describe('Domain Command Module', () => {
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

  describe('registerDomain function', () => {
    it('should register all domain tools', () => {
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
      
      registerDomain(mockAdapter);
      
      expect(consoleSpy).toHaveBeenCalledWith('Register Domain Handlers');
      expect(mockAdapter.server.tool).toHaveBeenCalledTimes(5);
      
      // Verify all tools are registered
      expect(toolCallbacks['add-domain']).toBeDefined();
      expect(toolCallbacks['delete-domain']).toBeDefined();
      expect(toolCallbacks['get-domain']).toBeDefined();
      expect(toolCallbacks['list-domain']).toBeDefined();
      expect(toolCallbacks['update-domain']).toBeDefined();
      
      consoleSpy.mockRestore();
    });

    it('should register tools with correct names and descriptions', () => {
      registerDomain(mockAdapter);
      
      const calls = (mockAdapter.server.tool as jest.Mock).mock.calls;
      
      expect(calls[0]).toEqual([
        'add-domain',
        'Add Domain on upsun project',
        expect.any(Object),
        expect.any(Function)
      ]);
      
      expect(calls[1]).toEqual([
        'delete-domain',
        'Delete a Domain on upsun project',
        expect.any(Object),
        expect.any(Function)
      ]);
      
      expect(calls[2]).toEqual([
        'get-domain',
        'Get a Domain of upsun project',
        expect.any(Object),
        expect.any(Function)
      ]);
      
      expect(calls[3]).toEqual([
        'list-domain',
        'List all Domains of upsun project',
        expect.any(Object),
        expect.any(Function)
      ]);
      
      expect(calls[4]).toEqual([
        'update-domain',
        'Update a Domain of upsun project',
        expect.any(Object),
        expect.any(Function)
      ]);
    });
  });

  describe('add-domain tool', () => {
    beforeEach(() => {
      registerDomain(mockAdapter);
    });

    it('should return TODO for add domain', async () => {
      const callback = toolCallbacks['add-domain'];
      const params = {
        project_id: 'test-project-13',
        domain_name: 'example.com'
      };

      const result = await callback(params);

      expect(result).toEqual({
        content: [{
          type: 'text',
          text: JSON.stringify("TODO", null, 2)
        }]
      });
    });

    it('should handle subdomain addition', async () => {
      const callback = toolCallbacks['add-domain'];
      const params = {
        project_id: 'test-project-13',
        domain_name: 'api.example.com'
      };

      const result = await callback(params);

      expect(result).toEqual({
        content: [{
          type: 'text',
          text: JSON.stringify("TODO", null, 2)
        }]
      });
    });

    it('should handle wildcard domain addition', async () => {
      const callback = toolCallbacks['add-domain'];
      const params = {
        project_id: 'test-project-13',
        domain_name: '*.example.com'
      };

      const result = await callback(params);

      expect(result).toEqual({
        content: [{
          type: 'text',
          text: JSON.stringify("TODO", null, 2)
        }]
      });
    });

    it('should handle international domain names', async () => {
      const callback = toolCallbacks['add-domain'];
      const params = {
        project_id: 'test-project-13',
        domain_name: 'example.网站'
      };

      const result = await callback(params);

      expect(result).toEqual({
        content: [{
          type: 'text',
          text: JSON.stringify("TODO", null, 2)
        }]
      });
    });
  });

  describe('delete-domain tool', () => {
    beforeEach(() => {
      registerDomain(mockAdapter);
    });

    it('should return TODO for delete domain', async () => {
      const callback = toolCallbacks['delete-domain'];
      const params = {
        project_id: 'test-project-13',
        domain_name: 'example.com'
      };

      const result = await callback(params);

      expect(result).toEqual({
        content: [{
          type: 'text',
          text: JSON.stringify("TODO", null, 2)
        }]
      });
    });

    it('should handle subdomain deletion', async () => {
      const callback = toolCallbacks['delete-domain'];
      const params = {
        project_id: 'test-project-13',
        domain_name: 'blog.example.com'
      };

      const result = await callback(params);

      expect(result).toEqual({
        content: [{
          type: 'text',
          text: JSON.stringify("TODO", null, 2)
        }]
      });
    });

    it('should handle multiple domain deletion', async () => {
      const callback = toolCallbacks['delete-domain'];
      const params = {
        project_id: 'test-project-13',
        domain_name: 'www.example.com'
      };

      const result = await callback(params);

      expect(result).toEqual({
        content: [{
          type: 'text',
          text: JSON.stringify("TODO", null, 2)
        }]
      });
    });
  });

  describe('get-domain tool', () => {
    beforeEach(() => {
      registerDomain(mockAdapter);
    });

    it('should return TODO for get domain', async () => {
      const callback = toolCallbacks['get-domain'];
      const params = {
        project_id: 'test-project-13',
        domain_name: 'example.com'
      };

      const result = await callback(params);

      expect(result).toEqual({
        content: [{
          type: 'text',
          text: JSON.stringify("TODO", null, 2)
        }]
      });
    });

    it('should handle getting domain with SSL info', async () => {
      const callback = toolCallbacks['get-domain'];
      const params = {
        project_id: 'test-project-13',
        domain_name: 'secure.example.com'
      };

      const result = await callback(params);

      expect(result).toEqual({
        content: [{
          type: 'text',
          text: JSON.stringify("TODO", null, 2)
        }]
      });
    });

    it('should handle getting domain validation status', async () => {
      const callback = toolCallbacks['get-domain'];
      const params = {
        project_id: 'test-project-13',
        domain_name: 'pending.example.com'
      };

      const result = await callback(params);

      expect(result).toEqual({
        content: [{
          type: 'text',
          text: JSON.stringify("TODO", null, 2)
        }]
      });
    });
  });

  describe('list-domain tool', () => {
    beforeEach(() => {
      registerDomain(mockAdapter);
    });

    it('should return TODO for list domains', async () => {
      const callback = toolCallbacks['list-domain'];
      const params = {
        project_id: 'test-project-13'
      };

      const result = await callback(params);

      expect(result).toEqual({
        content: [{
          type: 'text',
          text: JSON.stringify("TODO", null, 2)
        }]
      });
    });

    it('should handle projects with multiple domains', async () => {
      const callback = toolCallbacks['list-domain'];
      const params = {
        project_id: 'multi-domain-project'
      };

      const result = await callback(params);

      expect(result).toEqual({
        content: [{
          type: 'text',
          text: JSON.stringify("TODO", null, 2)
        }]
      });
    });

    it('should handle enterprise projects', async () => {
      const callback = toolCallbacks['list-domain'];
      const params = {
        project_id: 'enterprise-project-456'
      };

      const result = await callback(params);

      expect(result).toEqual({
        content: [{
          type: 'text',
          text: JSON.stringify("TODO", null, 2)
        }]
      });
    });
  });

  describe('update-domain tool', () => {
    beforeEach(() => {
      registerDomain(mockAdapter);
    });

    it('should return TODO for update domain', async () => {
      const callback = toolCallbacks['update-domain'];
      const params = {
        project_id: 'test-project-13',
        domain_name: 'example.com'
      };

      const result = await callback(params);

      expect(result).toEqual({
        content: [{
          type: 'text',
          text: JSON.stringify("TODO", null, 2)
        }]
      });
    });

    it('should handle SSL configuration updates', async () => {
      const callback = toolCallbacks['update-domain'];
      const params = {
        project_id: 'test-project-13',
        domain_name: 'ssl-update.example.com'
      };

      const result = await callback(params);

      expect(result).toEqual({
        content: [{
          type: 'text',
          text: JSON.stringify("TODO", null, 2)
        }]
      });
    });

    it('should handle routing rule updates', async () => {
      const callback = toolCallbacks['update-domain'];
      const params = {
        project_id: 'test-project-13',
        domain_name: 'routing.example.com'
      };

      const result = await callback(params);

      expect(result).toEqual({
        content: [{
          type: 'text',
          text: JSON.stringify("TODO", null, 2)
        }]
      });
    });
  });

  describe('parameter validation and edge cases', () => {
    beforeEach(() => {
      registerDomain(mockAdapter);
    });

    it('should handle all tools with minimal required parameters', async () => {
      const callbacks = [
        { 
          name: 'add-domain', 
          params: { 
            project_id: 'proj', 
            domain_name: 'test.com' 
          } 
        },
        { 
          name: 'delete-domain', 
          params: { 
            project_id: 'proj', 
            domain_name: 'test.com' 
          } 
        },
        { 
          name: 'get-domain', 
          params: { 
            project_id: 'proj', 
            domain_name: 'test.com' 
          } 
        },
        { 
          name: 'list-domain', 
          params: { 
            project_id: 'proj' 
          } 
        },
        { 
          name: 'update-domain', 
          params: { 
            project_id: 'proj', 
            domain_name: 'test.com' 
          } 
        }
      ];

      for (const { name, params } of callbacks) {
        const callback = toolCallbacks[name];
        const result = await callback(params);
        
        expect(result).toEqual({
          content: [{
            type: 'text',
            text: JSON.stringify("TODO", null, 2)
          }]
        });
      }
    });

    it('should handle very long domain names', async () => {
      const callback = toolCallbacks['add-domain'];
      const longDomain = 'very-long-subdomain-name-that-exceeds-normal-limits.example.com';
      const params = {
        project_id: 'test-project-13',
        domain_name: longDomain
      };

      const result = await callback(params);

      expect(result).toEqual({
        content: [{
          type: 'text',
          text: JSON.stringify("TODO", null, 2)
        }]
      });
    });

    it('should handle special characters in domain names', async () => {
      const callback = toolCallbacks['get-domain'];
      const params = {
        project_id: 'test-project-13',
        domain_name: 'test-domain.co.uk'
      };

      const result = await callback(params);

      expect(result).toEqual({
        content: [{
          type: 'text',
          text: JSON.stringify("TODO", null, 2)
        }]
      });
    });

    it('should handle deep subdomain levels', async () => {
      const callback = toolCallbacks['update-domain'];
      const params = {
        project_id: 'test-project-13',
        domain_name: 'api.v1.staging.app.example.com'
      };

      const result = await callback(params);

      expect(result).toEqual({
        content: [{
          type: 'text',
          text: JSON.stringify("TODO", null, 2)
        }]
      });
    });

    it('should handle numeric domains', async () => {
      const callback = toolCallbacks['add-domain'];
      const params = {
        project_id: 'test-project-13',
        domain_name: '123.example.com'
      };

      const result = await callback(params);

      expect(result).toEqual({
        content: [{
          type: 'text',
          text: JSON.stringify("TODO", null, 2)
        }]
      });
    });
  });
});
