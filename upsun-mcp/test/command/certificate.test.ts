import { describe, expect, it, jest, beforeEach, afterEach } from '@jest/globals';
import { z } from 'zod';
import { McpAdapter } from '../../src/core/adapter';
import { registerCertificate } from '../../src/command/certificate';
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
const mockCertificatesApi = {
  add: jest.fn(),
  delete: jest.fn(),
  get: jest.fn(),
  list: jest.fn(),
};

const mockClient: any = {
  certificates: mockCertificatesApi,
};

const mockAdapter: McpAdapter = {
  client: mockClient,
  server: {
    tool: jest.fn(),
  },
  isMode: () => true,
} as any;

describe('Certificate Command Module', () => {
  let toolCallbacks: Record<string, any> = {};
  let toolConfigs: Record<string, any> = {};
  const originalEnv = process.env;
  // Real certificate IDs are 64 lower-case hex characters.
  const realCertificateId = 'a3f9'.repeat(16);

  async function callThroughInputSchema(tool: string, params: Record<string, unknown>) {
    return toolCallbacks[tool](z.object(toolConfigs[tool].inputSchema).parse(params));
  }

  beforeEach(() => {
    setupTestEnvironment(jest, originalEnv);
    jest.clearAllMocks();
    mockLogger.debug.mockClear();
    mockLogger.info.mockClear();
    mockLogger.warn.mockClear();
    mockLogger.error.mockClear();
    toolCallbacks = {};
    toolConfigs = {};
    (mockAdapter.server.registerTool as any) = jest
      .fn()
      .mockImplementation((name: any, ...args: any[]) => {
        const callback = args[args.length - 1];
        toolCallbacks[name] = callback;
        toolConfigs[name] = args[0];
        return mockAdapter.server;
      });
    mockClient.certificates.add.mockResolvedValue('certificate-added');
    mockClient.certificates.delete.mockResolvedValue('certificate-deleted');
    mockClient.certificates.get.mockResolvedValue({ id: 'cert-1', status: 'active' });
    mockClient.certificates.list.mockResolvedValue([
      { id: 'cert-1', status: 'active' },
      { id: 'cert-2', status: 'expired' },
    ]);
  });

  afterEach(() => {
    teardownTestEnvironment(originalEnv);
    jest.restoreAllMocks();
  });

  describe('registerCertificate function', () => {
    it('should register all certificate tools', () => {
      registerCertificate(mockAdapter);
      expect(mockAdapter.server.registerTool).toHaveBeenCalledTimes(4);
      expect(toolCallbacks['add-certificate']).toBeDefined();
      expect(toolCallbacks['delete-certificate']).toBeDefined();
      expect(toolCallbacks['get-certificate']).toBeDefined();
      expect(toolCallbacks['list-certificate']).toBeDefined();
    });
  });

  describe('add-certificate tool', () => {
    beforeEach(() => {
      registerCertificate(mockAdapter);
    });
    it('should add a certificate and return the result', async () => {
      const callback = toolCallbacks['add-certificate'];
      const params = {
        project_id: 'test-project-13',
        certificate: 'CERT_DATA',
        key: 'KEY_DATA',
        chain: 'CHAIN_DATA',
      };
      const result = await callback(params);
      expect(result).toEqual({
        content: [{ type: 'text', text: JSON.stringify('certificate-added', null, 2) }],
      });
    });
    it('should handle multiline certificate content', async () => {
      const callback = toolCallbacks['add-certificate'];
      const params = {
        project_id: 'test-project-13',
        certificate: [
          '-----BEGIN CERTIFICATE-----',
          'MIIDXTCCAkWgAwIBAgIJAKlS9kKN7mGPMA0GCSqGSIb3DQEBCwUAMEUxCzAJBgNV',
          'BAYTAkFVMRMwEQYDVQQIDApTb21lLVN0YXRlMSEwHwYDVQQKDBhJbnRlcm5ldCBX',
          'aWRnaXRzIFB0eSBMdGQwHhcNMjMwMTAxMDAwMDAwWhcNMjQwMTAxMDAwMDAwWjBF',
          '-----END CERTIFICATE-----',
        ].join('\n'),
        key: [
          '-----BEGIN PRIVATE KEY-----',
          'MIIEvQIBADANBgkqhkiG9w0BAQEFAASCBKcwggSjAgEAAoIBAQDDwJFjL8bN5qVt',
          'X5lWZh4B2C3D4E5F6G7H8I9J0K1L2M3N4O5P6Q7R8S9T0U1V2W3X4Y5Z6A7B8C9D',
          '-----END PRIVATE KEY-----',
        ].join('\n'),
        chain: [
          '-----BEGIN CERTIFICATE-----',
          'MIIDXTCCAkWgAwIBAgIJAKlS9kKN7mGPMA0GCSqGSIb3DQEBCwUAMEUxCzAJBgNV',
          'BAYTAkFVMRMwEQYDVQQIDApTb21lLVN0YXRlMSEwHwYDVQQKDBhJbnRlcm5ldCBX',
          '-----END CERTIFICATE-----',
        ].join('\n'),
      };
      const result = await callback(params);
      expect(result).toEqual({
        content: [{ type: 'text', text: JSON.stringify('certificate-added', null, 2) }],
      });
    });
  });

  describe('delete-certificate tool', () => {
    beforeEach(() => {
      registerCertificate(mockAdapter);
    });
    it('accepts a real certificate ID through the input schema and deletes that certificate', async () => {
      await callThroughInputSchema('delete-certificate', {
        project_id: 'abcdefghijklm',
        certificate_id: realCertificateId,
      });

      expect(mockClient.certificates.delete).toHaveBeenCalledWith(
        'abcdefghijklm',
        realCertificateId
      );
    });
    it('should delete a certificate and return the result', async () => {
      const callback = toolCallbacks['delete-certificate'];
      const params = {
        project_id: 'test-project-13',
        certificate_id: 'cert-1',
      };
      const result = await callback(params);
      expect(result).toEqual({
        content: [{ type: 'text', text: JSON.stringify('certificate-deleted', null, 2) }],
      });
    });
  });

  describe('get-certificate tool', () => {
    beforeEach(() => {
      registerCertificate(mockAdapter);
    });
    it('accepts a real certificate ID through the input schema and gets that certificate', async () => {
      await callThroughInputSchema('get-certificate', {
        project_id: 'abcdefghijklm',
        certificate_id: realCertificateId,
      });

      expect(mockClient.certificates.get).toHaveBeenCalledWith('abcdefghijklm', realCertificateId);
    });
    it('should get a certificate and return the result', async () => {
      const callback = toolCallbacks['get-certificate'];
      const params = {
        project_id: 'test-project-13',
        certificate_id: 'cert-1',
      };
      const result = await callback(params);
      expect(result).toEqual({
        content: [
          { type: 'text', text: JSON.stringify({ id: 'cert-1', status: 'active' }, null, 2) },
        ],
      });
    });
  });

  describe('list-certificate tool', () => {
    beforeEach(() => {
      registerCertificate(mockAdapter);
    });
    it('should list certificates and return the result', async () => {
      const callback = toolCallbacks['list-certificate'];
      const params = {
        project_id: 'test-project-13',
      };
      const result = await callback(params);
      expect(result).toEqual({
        content: [
          {
            type: 'text',
            text: JSON.stringify(
              [
                { id: 'cert-1', status: 'active' },
                { id: 'cert-2', status: 'expired' },
              ],
              null,
              2
            ),
          },
        ],
      });
    });
  });

  describe('parameter validation and edge cases', () => {
    beforeEach(() => {
      registerCertificate(mockAdapter);
    });
    it('should handle all tools with minimal required parameters', async () => {
      const callbacks = [
        {
          name: 'add-certificate',
          params: {
            project_id: 'proj',
            certificate: 'cert',
            key: 'key',
            chain: 'chain',
          },
        },
        {
          name: 'delete-certificate',
          params: {
            project_id: 'proj',
            certificate_id: 'cert',
          },
        },
        {
          name: 'get-certificate',
          params: {
            project_id: 'proj',
            certificate_id: 'cert',
          },
        },
        {
          name: 'list-certificate',
          params: {
            project_id: 'proj',
          },
        },
      ];
      for (const { name, params } of callbacks) {
        const callback = toolCallbacks[name];
        let expected;
        if (name === 'add-certificate') {
          expected = 'certificate-added';
        } else if (name === 'delete-certificate') {
          expected = 'certificate-deleted';
        } else if (name === 'get-certificate') {
          expected = { id: 'cert-1', status: 'active' };
        } else if (name === 'list-certificate') {
          expected = [
            { id: 'cert-1', status: 'active' },
            { id: 'cert-2', status: 'expired' },
          ];
        }
        const result = await callback(params);
        expect(result).toEqual({
          content: [{ type: 'text', text: JSON.stringify(expected, null, 2) }],
        });
      }
    });
  });
});
