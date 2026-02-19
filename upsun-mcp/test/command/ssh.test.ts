import { describe, expect, it, jest, beforeEach, afterEach } from '@jest/globals';
import { McpAdapter } from '../../src/core/adapter';
import { registerSshKey } from '../../src/command/ssh';
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

const listSshKeysMessage = 'Not implemented in upsun-sdk-node@0.4.1 (no list SSH keys endpoint)';

// Mock the Upsun client (add methods here if needed)
const mockClient: any = {};

// Mock the adapter (single global declaration)
const mockAdapter: McpAdapter = {
  client: mockClient,
  server: {
    tool: jest.fn(),
  },
  isMode: () => true,
} as any;

describe('SSH Key Command Module', () => {
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

    // Setup mock server.tool to capture callbacks
    (mockAdapter.server.tool as any) = jest.fn().mockImplementation((name: any, ...args: any[]) => {
      const callback = args[args.length - 1];
      toolCallbacks[name] = callback;
      return mockAdapter.server;
    });

    // Add the complete mock for ssh with explicit typing to avoid TS warning
    // Use jest.Mock<any, any> to avoid 'never' type error
    // Explicitly type as any to avoid TS 'never' assignment errors
    // Declare sshMock with jest.fn() only
    const sshMock = {
      add: jest.fn() as jest.Mock,
      delete: jest.fn() as jest.Mock,
      get: jest.fn() as jest.Mock,
      list: jest.fn() as jest.Mock,
    };
    (sshMock.add as any).mockResolvedValue('sshkey-added');
    (sshMock.delete as any).mockResolvedValue('sshkey-deleted');
    (sshMock.get as any).mockResolvedValue({ id: 'sshkey-1', type: 'rsa' });
    (sshMock.list as any).mockResolvedValue([
      { id: 'sshkey-1', type: 'rsa' },
      { id: 'sshkey-2', type: 'ed25519' },
    ]);
    (mockAdapter as any).client.ssh = sshMock;
  });

  afterEach(() => {
    teardownTestEnvironment(originalEnv);
    jest.restoreAllMocks();
  });

  describe('registerSshKey function', () => {
    it('should register all SSH key tools', () => {
      registerSshKey(mockAdapter);

      expect(mockAdapter.server.tool).toHaveBeenCalledTimes(3);

      // Verify all tools are registered
      expect(toolCallbacks['add-sshkey']).toBeDefined();
      expect(toolCallbacks['delete-sshkey']).toBeDefined();
      expect(toolCallbacks['list-sshkey']).toBeDefined();
    });

    it('should register tools with correct names and descriptions', () => {
      registerSshKey(mockAdapter);

      const calls = (mockAdapter.server.tool as unknown as jest.Mock).mock.calls;

      expect(calls[0]).toEqual([
        'add-sshkey',
        'Add a SSH key on upsun account',
        expect.any(Object),
        expect.any(Function),
      ]);

      expect(calls[1]).toEqual([
        'delete-sshkey',
        'Delete a SSH key of upsun account',
        expect.any(Object),
        expect.any(Function),
      ]);

      expect(calls[2]).toEqual([
        'list-sshkey',
        'List all SSH keys of upsun account',
        expect.any(Object),
        expect.any(Function),
      ]);
    });
  });

  describe('add-sshkey tool', () => {
    beforeEach(() => {
      registerSshKey(mockAdapter);
    });

    it('should register and return the added SSH key with RSA key', async () => {
      const callback = toolCallbacks['add-sshkey'];
      const params = {
        user_id: 'user-123',
        ssh_key: 'ssh-rsa AAAAB3NzaC1yc2EAAAADAQABAAABgQC7vbqajDhA... user@example.com',
        key_id: 'laptop-key-1',
      };

      const result = await callback(params);

      expect(result).toEqual({
        content: [{ type: 'text', text: JSON.stringify('sshkey-added', null, 2) }],
      });
    });

    it('should register and return the added SSH key with ED25519 key', async () => {
      const callback = toolCallbacks['add-sshkey'];
      const params = {
        user_id: 'user-456',
        ssh_key: 'ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIGbPhiQgg... user@work.com',
        key_id: 'work-laptop',
      };

      const result = await callback(params);

      expect(result).toEqual({
        content: [{ type: 'text', text: JSON.stringify('sshkey-added', null, 2) }],
      });
    });

    it('should handle different key types and formats', async () => {
      const callback = toolCallbacks['add-sshkey'];
      const testCases = [
        {
          user_id: 'user-789',
          ssh_key: 'ssh-dss AAAAB3NzaC1kc3MAAACBAO8... legacy@key.com',
          key_id: 'legacy-key',
        },
        {
          user_id: 'user-abc',
          ssh_key: 'ecdsa-sha2-nistp256 AAAAE2VjZHNhLXNo... ec@key.com',
          key_id: 'ec-key',
        },
      ];

      for (const params of testCases) {
        const result = await callback(params);
        expect(result).toEqual({
          content: [{ type: 'text', text: JSON.stringify('sshkey-added', null, 2) }],
        });
      }
    });

    it('should handle keys with special characters in identifiers', async () => {
      const callback = toolCallbacks['add-sshkey'];
      const params = {
        user_id: 'user-special-123',
        ssh_key: 'ssh-rsa AAAAB3NzaC1yc2EAAAADAQABAAABgQC7vbqa... test@host',
        key_id: 'deploy-key-production-2024',
      };

      const result = await callback(params);

      expect(result).toEqual({
        content: [{ type: 'text', text: JSON.stringify('sshkey-added', null, 2) }],
      });
    });

    it('should handle corporate user IDs', async () => {
      const callback = toolCallbacks['add-sshkey'];
      const params = {
        user_id: 'corp-user-enterprise-456',
        ssh_key: 'ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIGbPhiQgg... corp@company.com',
        key_id: 'corporate-access-key',
      };

      const result = await callback(params);

      expect(result).toEqual({
        content: [{ type: 'text', text: JSON.stringify('sshkey-added', null, 2) }],
      });
    });
  });

  describe('delete-sshkey tool', () => {
    beforeEach(() => {
      registerSshKey(mockAdapter);
    });

    it('should return TODO for delete SSH key', async () => {
      const callback = toolCallbacks['delete-sshkey'];
      const params = {
        user_id: 'user-123',
        key_id: 'laptop-key-1',
      };

      const result = await callback(params);

      expect(result).toEqual({
        content: [{ type: 'text', text: JSON.stringify('sshkey-deleted', null, 2) }],
      });
    });

    it('should handle deletion of different key types', async () => {
      const callback = toolCallbacks['delete-sshkey'];
      const testCases = [
        { user_id: 'user-456', key_id: 'work-laptop' },
        { user_id: 'user-789', key_id: 'legacy-key' },
        { user_id: 'user-abc', key_id: 'deploy-key' },
      ];

      for (const params of testCases) {
        const result = await callback(params);
        expect(result).toEqual({
          content: [{ type: 'text', text: JSON.stringify('sshkey-deleted', null, 2) }],
        });
      }
    });

    it('should handle deletion of production keys', async () => {
      const callback = toolCallbacks['delete-sshkey'];
      const params = {
        user_id: 'production-user',
        key_id: 'production-deploy-key',
      };

      const result = await callback(params);

      expect(result).toEqual({
        content: [{ type: 'text', text: JSON.stringify('sshkey-deleted', null, 2) }],
      });
    });

    it('should handle deletion with special key identifiers', async () => {
      const callback = toolCallbacks['delete-sshkey'];
      const params = {
        user_id: 'admin-user',
        key_id: 'emergency-access-key-2024-backup',
      };

      const result = await callback(params);

      expect(result).toEqual({
        content: [{ type: 'text', text: JSON.stringify('sshkey-deleted', null, 2) }],
      });
    });
  });

  describe('list-sshkey tool', () => {
    beforeEach(() => {
      registerSshKey(mockAdapter);
    });

    it('should return TODO for list SSH keys', async () => {
      const callback = toolCallbacks['list-sshkey'];
      const params = {
        user_id: 'user-123',
      };

      const result = await callback(params);

      expect(result).toEqual({
        content: [
          {
            type: 'text',
            text: JSON.stringify(listSshKeysMessage, null, 2),
          },
        ],
      });
    });

    it('should handle listing for different user types', async () => {
      const callback = toolCallbacks['list-sshkey'];
      const testCases = [
        { user_id: 'admin-user' },
        { user_id: 'regular-user-456' },
        { user_id: 'service-account-789' },
        { user_id: 'enterprise-user-abc' },
      ];

      for (const params of testCases) {
        const result = await callback(params);
        expect(result).toEqual({
          content: [
            {
              type: 'text',
              text: JSON.stringify(listSshKeysMessage, null, 2),
            },
          ],
        });
      }
    });

    it('should handle corporate user accounts', async () => {
      const callback = toolCallbacks['list-sshkey'];
      const params = {
        user_id: 'corporate-admin-123456',
      };

      const result = await callback(params);

      expect(result).toEqual({
        content: [
          {
            type: 'text',
            text: JSON.stringify(listSshKeysMessage, null, 2),
          },
        ],
      });
    });

    it('should handle API service accounts', async () => {
      const callback = toolCallbacks['list-sshkey'];
      const params = {
        user_id: 'api-service-deployment-bot',
      };

      const result = await callback(params);

      expect(result).toEqual({
        content: [
          {
            type: 'text',
            text: JSON.stringify(listSshKeysMessage, null, 2),
          },
        ],
      });
    });
  });

  describe('parameter validation and edge cases', () => {
    beforeEach(() => {
      registerSshKey(mockAdapter);
    });

    it('should handle all tools with minimal required parameters', async () => {
      const callbacks = [
        {
          name: 'add-sshkey',
          params: {
            user_id: 'u',
            ssh_key: 'ssh-rsa AAAA... test@test.com',
            key_id: 'k',
          },
        },
        {
          name: 'delete-sshkey',
          params: {
            user_id: 'u',
            key_id: 'k',
          },
        },
        {
          name: 'list-sshkey',
          params: {
            user_id: 'u',
          },
        },
      ];

      for (const { name, params } of callbacks) {
        const callback = toolCallbacks[name];
        const result = await callback(params);
        let expected;
        if (name === 'add-sshkey') {
          expected = 'sshkey-added';
        } else if (name === 'delete-sshkey') {
          expected = 'sshkey-deleted';
        } else if (name === 'list-sshkey') {
          expected = listSshKeysMessage;
        }
        expect(result).toEqual({
          content: [{ type: 'text', text: JSON.stringify(expected, null, 2) }],
        });
      }
    });

    it('should handle very long SSH keys', async () => {
      const callback = toolCallbacks['add-sshkey'];
      const longKey = 'ssh-rsa ' + 'A'.repeat(2048) + ' very-long-key@example.com';
      const params = {
        user_id: 'user-long-key',
        ssh_key: longKey,
        key_id: 'ultra-secure-key',
      };

      const result = await callback(params);

      expect(result).toEqual({
        content: [{ type: 'text', text: JSON.stringify('sshkey-added', null, 2) }],
      });
    });

    it('should handle numeric user IDs', async () => {
      const callback = toolCallbacks['list-sshkey'];
      const params = {
        user_id: '123456789',
      };

      const result = await callback(params);

      expect(result).toEqual({
        content: [
          {
            type: 'text',
            text: JSON.stringify(listSshKeysMessage, null, 2),
          },
        ],
      });
    });

    it('should handle UUID-style user IDs', async () => {
      const callback = toolCallbacks['delete-sshkey'];
      const params = {
        user_id: '550e8400-e29b-41d4-a716-446655440000',
        key_id: 'uuid-key-12345',
      };

      const result = await callback(params);

      expect(result).toEqual({
        content: [{ type: 'text', text: JSON.stringify('sshkey-deleted', null, 2) }],
      });
    });

    it('should handle special characters in key content', async () => {
      const callback = toolCallbacks['add-sshkey'];
      const params = {
        user_id: 'special-user',
        ssh_key: 'ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIGbPhiQgg+/=special user@host.domain.co.uk',
        key_id: 'special-chars-key-2024',
      };

      const result = await callback(params);

      expect(result).toEqual({
        content: [{ type: 'text', text: JSON.stringify('sshkey-added', null, 2) }],
      });
    });

    it('should handle international characters in identifiers', async () => {
      const callback = toolCallbacks['add-sshkey'];
      const params = {
        user_id: 'usuario-español-123',
        ssh_key: 'ssh-rsa AAAAB3NzaC1yc2EAAAADAQABAAABgQC7vbqa... usuario@empresa.es',
        key_id: 'clave-acceso-producción',
      };

      const result = await callback(params);

      expect(result).toEqual({
        content: [{ type: 'text', text: JSON.stringify('sshkey-added', null, 2) }],
      });
    });
  });
});
