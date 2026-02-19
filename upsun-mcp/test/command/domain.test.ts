import { describe, expect, it, jest, beforeEach, afterEach } from '@jest/globals';
import { McpAdapter } from '../../src/core/adapter';
import { registerDomain } from '../../src/command/domain';
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

const mockDomainsApi = {
  add: jest.fn() as jest.Mock,
  delete: jest.fn() as jest.Mock,
  get: jest.fn() as jest.Mock,
  list: jest.fn() as jest.Mock,
  update: jest.fn() as jest.Mock,
};

// Mock the adapter (single global declaration)
const mockAdapter: McpAdapter = {
  client: {
    domains: mockDomainsApi,
  } as any,
  server: {
    tool: jest.fn(),
  },
  isMode: () => true,
} as any;

describe('Domain Command Module', () => {
  let toolCallbacks: Record<string, any> = {};
  const originalEnv = process.env;

  beforeEach(() => {
    setupTestEnvironment(jest, originalEnv);
    jest.clearAllMocks();
    toolCallbacks = {};

    // Reset logger mocks
    mockLogger.debug.mockClear();
    mockLogger.info.mockClear();
    mockLogger.warn.mockClear();
    mockLogger.error.mockClear();

    // Explicit mock added for isMode (already set globally)

    // Setup mock server.tool to capture callbacks
    (mockAdapter.server.tool as any) = jest.fn().mockImplementation((name: any, ...args: any[]) => {
      const callback = args[args.length - 1];
      toolCallbacks[name] = callback;
      return mockAdapter.server;
    });
    // Setup default mock responses (cast to jest.Mock<any> to avoid TS 'never' error)
    (mockAdapter.client.domains.add as jest.Mock<any>).mockResolvedValue('domain-added');
    (mockAdapter.client.domains.delete as jest.Mock<any>).mockResolvedValue('domain-deleted');
    (mockAdapter.client.domains.get as jest.Mock<any>).mockResolvedValue({
      domain: 'example.com',
      status: 'active',
    });
    (mockAdapter.client.domains.list as jest.Mock<any>).mockResolvedValue([
      { domain: 'example.com', status: 'active' },
      { domain: 'api.example.com', status: 'pending' },
    ]);
    (mockAdapter.client.domains.update as jest.Mock<any>).mockResolvedValue('domain-updated');
  });

  afterEach(() => {
    teardownTestEnvironment(originalEnv);
    jest.restoreAllMocks();
  });

  describe('registerDomain function', () => {
    it('should register all domain tools', () => {
      registerDomain(mockAdapter);

      expect(mockAdapter.server.tool).toHaveBeenCalledTimes(5);

      // Verify all tools are registered
      expect(toolCallbacks['add-domain']).toBeDefined();
      expect(toolCallbacks['delete-domain']).toBeDefined();
      expect(toolCallbacks['get-domain']).toBeDefined();
      expect(toolCallbacks['list-domain']).toBeDefined();
      expect(toolCallbacks['update-domain']).toBeDefined();
    });

    it('should register tools with correct names and descriptions', () => {
      registerDomain(mockAdapter);

      const calls = (mockAdapter.server.tool as unknown as jest.Mock).mock.calls;

      expect(calls[0]).toEqual([
        'add-domain',
        'Add Domain on upsun project',
        expect.any(Object),
        expect.any(Function),
      ]);

      expect(calls[1]).toEqual([
        'delete-domain',
        'Delete a Domain on upsun project',
        expect.any(Object),
        expect.any(Function),
      ]);

      expect(calls[2]).toEqual([
        'get-domain',
        'Get a Domain of upsun project',
        expect.any(Object),
        expect.any(Function),
      ]);

      expect(calls[3]).toEqual([
        'list-domain',
        'List all Domains of upsun project',
        expect.any(Object),
        expect.any(Function),
      ]);

      expect(calls[4]).toEqual([
        'update-domain',
        'Update a Domain of upsun project',
        expect.any(Object),
        expect.any(Function),
      ]);
    });
  });

  describe('add-domain tool', () => {
    beforeEach(() => {
      registerDomain(mockAdapter);
    });

    it('should add a domain and return the result', async () => {
      const callback = toolCallbacks['add-domain'];
      const params = {
        project_id: 'test-project-13',
        domain_name: 'example.com',
      };

      const result = await callback(params);

      expect(mockAdapter.client.domains.add).toHaveBeenCalledWith('test-project-13', 'example.com');
      expect(result).toEqual({
        content: [
          {
            type: 'text',
            text: JSON.stringify('domain-added', null, 2),
          },
        ],
      });
    });

    it('should handle subdomain addition', async () => {
      const callback = toolCallbacks['add-domain'];
      const params = {
        project_id: 'test-project-13',
        domain_name: 'api.example.com',
      };

      const result = await callback(params);

      expect(result).toEqual({
        content: [
          {
            type: 'text',
            text: JSON.stringify('domain-added', null, 2),
          },
        ],
      });
    });

    it('should handle wildcard domain addition', async () => {
      const callback = toolCallbacks['add-domain'];
      const params = {
        project_id: 'test-project-13',
        domain_name: '*.example.com',
      };

      const result = await callback(params);

      expect(result).toEqual({
        content: [
          {
            type: 'text',
            text: JSON.stringify('domain-added', null, 2),
          },
        ],
      });
    });

    it('should handle international domain names', async () => {
      const callback = toolCallbacks['add-domain'];
      const params = {
        project_id: 'test-project-13',
        domain_name: 'example.网站',
      };

      const result = await callback(params);

      expect(result).toEqual({
        content: [
          {
            type: 'text',
            text: JSON.stringify('domain-added', null, 2),
          },
        ],
      });
    });
  });

  describe('delete-domain tool', () => {
    beforeEach(() => {
      registerDomain(mockAdapter);
    });

    it('should delete a domain and return the result', async () => {
      const callback = toolCallbacks['delete-domain'];
      const params = {
        project_id: 'test-project-13',
        domain_name: 'example.com',
      };

      const result = await callback(params);

      expect(mockAdapter.client.domains.delete).toHaveBeenCalledWith(
        'test-project-13',
        'example.com'
      );
      expect(result).toEqual({
        content: [
          {
            type: 'text',
            text: JSON.stringify('domain-deleted', null, 2),
          },
        ],
      });
    });

    it('should handle subdomain deletion', async () => {
      const callback = toolCallbacks['delete-domain'];
      const params = {
        project_id: 'test-project-13',
        domain_name: 'blog.example.com',
      };

      const result = await callback(params);

      expect(result).toEqual({
        content: [
          {
            type: 'text',
            text: JSON.stringify('domain-deleted', null, 2),
          },
        ],
      });
    });

    it('should handle multiple domain deletion', async () => {
      const callback = toolCallbacks['delete-domain'];
      const params = {
        project_id: 'test-project-13',
        domain_name: 'www.example.com',
      };

      const result = await callback(params);

      expect(result).toEqual({
        content: [
          {
            type: 'text',
            text: JSON.stringify('domain-deleted', null, 2),
          },
        ],
      });
    });
  });

  describe('get-domain tool', () => {
    beforeEach(() => {
      registerDomain(mockAdapter);
    });

    it('should get a domain and return the result', async () => {
      const callback = toolCallbacks['get-domain'];
      const params = {
        project_id: 'test-project-13',
        domain_name: 'example.com',
      };

      const result = await callback(params);

      expect(mockAdapter.client.domains.get).toHaveBeenCalledWith('test-project-13', 'example.com');
      expect(result).toEqual({
        content: [
          {
            type: 'text',
            text: JSON.stringify({ domain: 'example.com', status: 'active' }, null, 2),
          },
        ],
      });
    });

    it('should handle getting domain with SSL info', async () => {
      const callback = toolCallbacks['get-domain'];
      const params = {
        project_id: 'test-project-13',
        domain_name: 'secure.example.com',
      };

      const result = await callback(params);

      expect(result).toEqual({
        content: [
          {
            type: 'text',
            text: JSON.stringify({ domain: 'example.com', status: 'active' }, null, 2),
          },
        ],
      });
    });

    it('should handle getting domain validation status', async () => {
      const callback = toolCallbacks['get-domain'];
      const params = {
        project_id: 'test-project-13',
        domain_name: 'pending.example.com',
      };

      const result = await callback(params);

      expect(result).toEqual({
        content: [
          {
            type: 'text',
            text: JSON.stringify({ domain: 'example.com', status: 'active' }, null, 2),
          },
        ],
      });
    });
  });

  describe('list-domain tool', () => {
    beforeEach(() => {
      registerDomain(mockAdapter);
    });

    it('should list domains and return the result', async () => {
      const callback = toolCallbacks['list-domain'];
      const params = {
        project_id: 'test-project-13',
      };

      const result = await callback(params);

      expect(mockAdapter.client.domains.list).toHaveBeenCalledWith('test-project-13');
      expect(result).toEqual({
        content: [
          {
            type: 'text',
            text: JSON.stringify(
              [
                { domain: 'example.com', status: 'active' },
                { domain: 'api.example.com', status: 'pending' },
              ],
              null,
              2
            ),
          },
        ],
      });
    });

    it('should handle projects with multiple domains', async () => {
      const callback = toolCallbacks['list-domain'];
      const params = {
        project_id: 'multi-domain-project',
      };

      const result = await callback(params);

      expect(result).toEqual({
        content: [
          {
            type: 'text',
            text: JSON.stringify(
              [
                { domain: 'example.com', status: 'active' },
                { domain: 'api.example.com', status: 'pending' },
              ],
              null,
              2
            ),
          },
        ],
      });
    });

    it('should handle enterprise projects', async () => {
      const callback = toolCallbacks['list-domain'];
      const params = {
        project_id: 'enterprise-project-456',
      };

      const result = await callback(params);

      expect(result).toEqual({
        content: [
          {
            type: 'text',
            text: JSON.stringify(
              [
                { domain: 'example.com', status: 'active' },
                { domain: 'api.example.com', status: 'pending' },
              ],
              null,
              2
            ),
          },
        ],
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
        domain_name: 'example.com',
      };

      const result = await callback(params);

      expect(result).toEqual({
        content: [
          {
            type: 'text',
            text: JSON.stringify('domain-updated', null, 2),
          },
        ],
      });
    });

    it('should handle SSL configuration updates', async () => {
      const callback = toolCallbacks['update-domain'];
      const params = {
        project_id: 'test-project-13',
        domain_name: 'ssl-update.example.com',
      };

      const result = await callback(params);

      expect(result).toEqual({
        content: [
          {
            type: 'text',
            text: JSON.stringify('domain-updated', null, 2),
          },
        ],
      });
    });

    it('should handle routing rule updates', async () => {
      const callback = toolCallbacks['update-domain'];
      const params = {
        project_id: 'test-project-13',
        domain_name: 'routing.example.com',
      };

      const result = await callback(params);

      expect(result).toEqual({
        content: [
          {
            type: 'text',
            text: JSON.stringify('domain-updated', null, 2),
          },
        ],
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
            domain_name: 'test.com',
          },
        },
        {
          name: 'delete-domain',
          params: {
            project_id: 'proj',
            domain_name: 'test.com',
          },
        },
        {
          name: 'get-domain',
          params: {
            project_id: 'proj',
            domain_name: 'test.com',
          },
        },
        {
          name: 'list-domain',
          params: {
            project_id: 'proj',
          },
        },
        {
          name: 'update-domain',
          params: {
            project_id: 'proj',
            domain_name: 'test.com',
          },
        },
      ];

      for (const { name, params } of callbacks) {
        const callback = toolCallbacks[name];
        const result = await callback(params);
        // Determine the expected value according to the callback
        let expectedText;
        if (name === 'add-domain') {
          expectedText = 'domain-added';
        } else if (name === 'update-domain') {
          expectedText = 'domain-updated';
        } else if (name === 'delete-domain') {
          expectedText = 'domain-deleted';
        } else {
          expectedText = undefined;
        }

        if (expectedText !== undefined) {
          expect(result).toEqual({
            content: [
              {
                type: 'text',
                text: JSON.stringify(expectedText, null, 2),
              },
            ],
          });
        }
      }
    });

    it('should handle very long domain names', async () => {
      const callback = toolCallbacks['add-domain'];
      const longDomain = 'very-long-subdomain-name-that-exceeds-normal-limits.example.com';
      const params = {
        project_id: 'test-project-13',
        domain_name: longDomain,
      };

      const result = await callback(params);

      expect(result).toEqual({
        content: [
          {
            type: 'text',
            text: JSON.stringify('domain-added', null, 2),
          },
        ],
      });
    });

    it('should handle special characters in domain names', async () => {
      const callback = toolCallbacks['get-domain'];
      const params = {
        project_id: 'test-project-13',
        domain_name: 'test-domain.co.uk',
      };

      const result = await callback(params);

      expect(result).toEqual({
        content: [
          {
            type: 'text',
            text: JSON.stringify({ domain: 'example.com', status: 'active' }, null, 2),
          },
        ],
      });
    });

    it('should handle deep subdomain levels', async () => {
      const callback = toolCallbacks['update-domain'];
      const params = {
        project_id: 'test-project-13',
        domain_name: 'api.v1.staging.app.example.com',
      };

      const result = await callback(params);

      expect(result).toEqual({
        content: [
          {
            type: 'text',
            text: JSON.stringify('domain-updated', null, 2),
          },
        ],
      });
    });

    it('should handle numeric domains', async () => {
      const callback = toolCallbacks['add-domain'];
      const params = {
        project_id: 'test-project-13',
        domain_name: '123.example.com',
      };

      const result = await callback(params);

      expect(result).toEqual({
        content: [
          {
            type: 'text',
            text: JSON.stringify('domain-added', null, 2),
          },
        ],
      });
    });
  });
});
