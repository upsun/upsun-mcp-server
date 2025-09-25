import { describe, expect, it, jest, beforeEach, afterEach } from '@jest/globals';
import { McpAdapter } from '../../src/core/adapter';
import { registerBackup } from '../../src/command/backup';

// --- GLOBAL MOCKS & CONSTANTS ---
const acceptedResponse = { code: 200, message: 'TODO', status: 'TODO' };
const backup = {
  createdAt: '',
  updatedAt: '',
  id: 'TODO',
  attributes: {},
  environment: '',
  project: '',
  status: 'TODO',
  size: 0,
  type: '',
  isLive: false,
  createdBy: '',
  expiresAt: '',
  meta: {},
  index: 0,
  commitId: '',
  safe: false,
  sizeOfVolumes: 0,
  volumes: [],
  code: '',
  resources: [],
  description: '',
  sizeUsed: 0,
  deployment: '',
  restorable: false,
  automated: false,
};

const mockLogger = Object.fromEntries(
  ['debug', 'info', 'warn', 'error'].map(fn => [fn, jest.fn()])
);
jest.mock('../../src/core/logger', () => ({ createLogger: jest.fn(() => mockLogger) }));

const makeMockBackupTask = () =>
  ({
    create: jest.fn(async () => acceptedResponse),
    delete: jest.fn(async () => acceptedResponse),
    get: jest.fn(async (_projectId: string, _environmentId: string, _backupId: string) => backup),
    list: jest.fn(async (_projectId: string, _environmentId: string) => [backup]),
    restore: jest.fn(
      async (_projectId: string, _environmentId: string, _backupId: string) => 'TODO'
    ),
    client: {},
    bckApi: {},
  }) as any;

const makeMockAdapter = () =>
  ({
    client: { backup: makeMockBackupTask() },
    server: { tool: jest.fn() },
    isMode: () => true,
  }) as unknown as McpAdapter;

describe('Backup Command Module', () => {
  let toolCallbacks: Record<string, any> = {};
  let mockAdapter: McpAdapter;

  beforeEach(() => {
    jest.clearAllMocks();
    Object.values(mockLogger).forEach(fn => fn.mockClear());
    toolCallbacks = {};
    mockAdapter = makeMockAdapter();
    // Setup mock server.tool to capture callbacks
    (mockAdapter.server.tool as any) = jest.fn().mockImplementation((name: any, ...args: any[]) => {
      const callback = args[args.length - 1];
      toolCallbacks[name] = callback;
      return mockAdapter.server;
    });
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('registerBackup function', () => {
    it('should register all backup tools', () => {
      registerBackup(mockAdapter);

      expect(mockAdapter.server.tool).toHaveBeenCalledTimes(5);

      // Verify all tools are registered
      expect(toolCallbacks['create-backup']).toBeDefined();
      expect(toolCallbacks['delete-backup']).toBeDefined();
      expect(toolCallbacks['get-backup']).toBeDefined();
      expect(toolCallbacks['list-backup']).toBeDefined();
      expect(toolCallbacks['restore-backup']).toBeDefined();
    });

    it('should register tools with correct names and descriptions', () => {
      registerBackup(mockAdapter);

      const calls = (mockAdapter.server.tool as unknown as jest.Mock).mock.calls;

      expect(calls[0]).toEqual([
        'create-backup',
        'Create a backup on upsun project',
        expect.any(Object),
        expect.any(Function),
      ]);

      expect(calls[1]).toEqual([
        'delete-backup',
        'Delete a backup of upsun project',
        expect.any(Object),
        expect.any(Function),
      ]);

      expect(calls[2]).toEqual([
        'get-backup',
        'Get a backup of upsun project',
        expect.any(Object),
        expect.any(Function),
      ]);

      expect(calls[3]).toEqual([
        'list-backup',
        'List all backups of upsun project',
        expect.any(Object),
        expect.any(Function),
      ]);

      expect(calls[4]).toEqual([
        'restore-backup',
        'Restore a backups of upsun project',
        expect.any(Object),
        expect.any(Function),
      ]);
    });
  });

  describe('create-backup tool', () => {
    beforeEach(() => {
      registerBackup(mockAdapter);
    });

    it('should return TODO for create backup', async () => {
      const callback = toolCallbacks['create-backup'];
      const params = {
        project_id: 'test-project-13',
        environment_name: 'main',
        is_live: true,
      };

      const result = await callback(params);

      expect(result).toEqual({
        content: [
          {
            type: 'text',
            text: JSON.stringify(acceptedResponse, null, 2),
          },
        ],
      });
    });

    it('should handle create backup with default parameters', async () => {
      const callback = toolCallbacks['create-backup'];
      const params = {
        project_id: 'test-project-13',
        environment_name: 'main',
      };

      const result = await callback(params);

      expect(result).toEqual({
        content: [
          {
            type: 'text',
            text: JSON.stringify(acceptedResponse, null, 2),
          },
        ],
      });
    });

    it('should handle create backup with is_live false', async () => {
      const callback = toolCallbacks['create-backup'];
      const params = {
        project_id: 'test-project-13',
        environment_name: 'staging',
        is_live: false,
      };

      const result = await callback(params);

      expect(result).toEqual({
        content: [
          {
            type: 'text',
            text: JSON.stringify(acceptedResponse, null, 2),
          },
        ],
      });
    });
  });

  describe('delete-backup tool', () => {
    beforeEach(() => {
      registerBackup(mockAdapter);
    });

    it('should return TODO for delete backup', async () => {
      const callback = toolCallbacks['delete-backup'];
      const params = {
        project_id: 'test-project-13',
        environment_name: 'main',
        backup_id: 'backup-123',
      };

      const result = await callback(params);

      expect(result).toEqual({
        content: [
          {
            type: 'text',
            text: JSON.stringify(acceptedResponse, null, 2),
          },
        ],
      });
    });

    it('should handle different backup IDs', async () => {
      const callback = toolCallbacks['delete-backup'];
      const params = {
        project_id: 'test-project-13',
        environment_name: 'staging',
        backup_id: 'backup-456-auto',
      };

      const result = await callback(params);

      expect(result).toEqual({
        content: [
          {
            type: 'text',
            text: JSON.stringify(acceptedResponse, null, 2),
          },
        ],
      });
    });
  });

  describe('get-backup tool', () => {
    beforeEach(() => {
      registerBackup(mockAdapter);
    });

    it('should return the mocked backup object for get-backup', async () => {
      const callback = toolCallbacks['get-backup'];
      const params = {
        project_id: 'test-project-13',
        environment_name: 'main',
        backup_id: 'backup-123',
      };

      const result = await callback(params);

      // Use toMatchObject to ignore extra properties in backup
      expect(result.content[0].type).toBe('text');
      const parsed = JSON.parse(result.content[0].text);
      expect(parsed).toMatchObject({
        createdAt: '',
        updatedAt: '',
        id: 'TODO',
        attributes: {},
        environment: '',
        project: '',
        status: 'TODO',
        size: 0,
        type: '',
        isLive: false,
        createdBy: '',
        expiresAt: '',
        meta: {},
        index: 0,
        commitId: '',
        safe: false,
        sizeOfVolumes: 0,
        volumes: [],
        code: '',
        resources: [],
        description: '',
      });
    });

    it('should return the mocked backup object for get-backup with different environments', async () => {
      const callback = toolCallbacks['get-backup'];
      const params = {
        project_id: 'test-project-13',
        environment_name: 'production',
        backup_id: 'backup-daily-001',
      };

      const result = await callback(params);

      expect(result.content[0].type).toBe('text');
      const parsed = JSON.parse(result.content[0].text);
      expect(parsed).toMatchObject({
        createdAt: '',
        updatedAt: '',
        id: 'TODO',
        attributes: {},
        environment: '',
        project: '',
        status: 'TODO',
        size: 0,
        type: '',
        isLive: false,
        createdBy: '',
        expiresAt: '',
        meta: {},
        index: 0,
        commitId: '',
        safe: false,
        sizeOfVolumes: 0,
        volumes: [],
        code: '',
        resources: [],
        description: '',
      });
    });
  });

  describe('list-backup tool', () => {
    beforeEach(() => {
      registerBackup(mockAdapter);
    });

    it('should return TODO for list backups', async () => {
      const callback = toolCallbacks['list-backup'];
      const params = {
        project_id: 'test-project-13',
        environment_name: 'main',
      };

      const result = await callback(params);

      expect(result.content[0].type).toBe('text');
      const parsed = JSON.parse(result.content[0].text);
      expect(Array.isArray(parsed)).toBe(true);
      expect(parsed[0]).toMatchObject({
        createdAt: '',
        updatedAt: '',
        id: 'TODO',
        attributes: {},
        environment: '',
        project: '',
        status: 'TODO',
        size: 0,
        type: '',
        isLive: false,
        createdBy: '',
        expiresAt: '',
        meta: {},
        index: 0,
        commitId: '',
        safe: false,
        sizeOfVolumes: 0,
        volumes: [],
        code: '',
        resources: [],
        description: '',
      });
    });

    it('should handle different environments for listing', async () => {
      const callback = toolCallbacks['list-backup'];
      const params = {
        project_id: 'test-project-13',
        environment_name: 'staging',
      };

      const result = await callback(params);

      expect(result.content[0].type).toBe('text');
      const parsed = JSON.parse(result.content[0].text);
      expect(Array.isArray(parsed)).toBe(true);
      expect(parsed[0]).toMatchObject({
        createdAt: '',
        updatedAt: '',
        id: 'TODO',
        attributes: {},
        environment: '',
        project: '',
        status: 'TODO',
        size: 0,
        type: '',
        isLive: false,
        createdBy: '',
        expiresAt: '',
        meta: {},
        index: 0,
        commitId: '',
        safe: false,
        sizeOfVolumes: 0,
        volumes: [],
        code: '',
        resources: [],
        description: '',
      });
    });
  });

  describe('restore-backup tool', () => {
    beforeEach(() => {
      registerBackup(mockAdapter);
    });

    it('should return TODO for restore backup with all parameters', async () => {
      const callback = toolCallbacks['restore-backup'];
      const params = {
        project_id: 'test-project-13',
        environment_name: 'main',
        target_environment_name: 'staging',
        no_code: false,
        no_resources: false,
        resources_init: 'backup',
      };

      const result = await callback(params);

      expect(result).toEqual({
        content: [
          {
            type: 'text',
            text: JSON.stringify('TODO', null, 2),
          },
        ],
      });
    });

    it('should handle restore backup with default parameters', async () => {
      const callback = toolCallbacks['restore-backup'];
      const params = {
        project_id: 'test-project-13',
        environment_name: 'main',
        target_environment_name: 'new-env',
      };

      const result = await callback(params);

      expect(result).toEqual({
        content: [
          {
            type: 'text',
            text: JSON.stringify('TODO', null, 2),
          },
        ],
      });
    });

    it('should handle restore backup with no_code option', async () => {
      const callback = toolCallbacks['restore-backup'];
      const params = {
        project_id: 'test-project-13',
        environment_name: 'production',
        target_environment_name: 'disaster-recovery',
        no_code: true,
        no_resources: false,
      };

      const result = await callback(params);

      expect(result).toEqual({
        content: [
          {
            type: 'text',
            text: JSON.stringify('TODO', null, 2),
          },
        ],
      });
    });

    it('should handle restore backup with no_resources option', async () => {
      const callback = toolCallbacks['restore-backup'];
      const params = {
        project_id: 'test-project-13',
        environment_name: 'main',
        target_environment_name: 'code-only-env',
        no_code: false,
        no_resources: true,
      };

      const result = await callback(params);

      expect(result).toEqual({
        content: [
          {
            type: 'text',
            text: JSON.stringify('TODO', null, 2),
          },
        ],
      });
    });

    it('should handle restore backup with custom resources_init', async () => {
      const callback = toolCallbacks['restore-backup'];
      const params = {
        project_id: 'test-project-13',
        environment_name: 'main',
        target_environment_name: 'custom-restore',
        resources_init: 'environment',
      };

      const result = await callback(params);

      expect(result).toEqual({
        content: [
          {
            type: 'text',
            text: JSON.stringify('TODO', null, 2),
          },
        ],
      });
    });
  });

  describe('parameter validation and edge cases', () => {
    beforeEach(() => {
      registerBackup(mockAdapter);
    });

    it('should handle all tools with minimal required parameters', async () => {
      const callbacks = [
        { name: 'create-backup', params: { project_id: 'proj', environment_name: 'env' } },
        {
          name: 'delete-backup',
          params: { project_id: 'proj', environment_name: 'env', backup_id: 'backup' },
        },
        {
          name: 'get-backup',
          params: { project_id: 'proj', environment_name: 'env', backup_id: 'backup' },
        },
        { name: 'list-backup', params: { project_id: 'proj', environment_name: 'env' } },
        {
          name: 'restore-backup',
          params: {
            project_id: 'proj',
            environment_name: 'env',
            target_environment_name: 'target',
          },
        },
      ];

      for (const { name, params } of callbacks) {
        const callback = toolCallbacks[name];
        const result = await callback(params);
        let expected;
        if (name === 'get-backup') {
          expect(result.content[0].type).toBe('text');
          const parsed = JSON.parse(result.content[0].text);
          expect(parsed).toMatchObject({
            createdAt: '',
            updatedAt: '',
            id: 'TODO',
            attributes: {},
            environment: '',
            project: '',
            status: 'TODO',
            size: 0,
            type: '',
            isLive: false,
            createdBy: '',
            expiresAt: '',
            meta: {},
            index: 0,
            commitId: '',
            safe: false,
            sizeOfVolumes: 0,
            volumes: [],
            code: '',
            resources: [],
            description: '',
          });
        } else if (name === 'list-backup') {
          expect(result.content[0].type).toBe('text');
          const parsed = JSON.parse(result.content[0].text);
          expect(Array.isArray(parsed)).toBe(true);
          expect(parsed[0]).toMatchObject({
            createdAt: '',
            updatedAt: '',
            id: 'TODO',
            attributes: {},
            environment: '',
            project: '',
            status: 'TODO',
            size: 0,
            type: '',
            isLive: false,
            createdBy: '',
            expiresAt: '',
            meta: {},
            index: 0,
            commitId: '',
            safe: false,
            sizeOfVolumes: 0,
            volumes: [],
            code: '',
            resources: [],
            description: '',
          });
        } else if (name === 'restore-backup') {
          expect(result).toEqual({
            content: [
              {
                type: 'text',
                text: JSON.stringify('TODO', null, 2),
              },
            ],
          });
        } else {
          expect(result).toEqual({
            content: [
              {
                type: 'text',
                text: JSON.stringify(acceptedResponse, null, 2),
              },
            ],
          });
        }
      }
    });

    it('should handle special characters in parameters', async () => {
      const callback = toolCallbacks['create-backup'];
      const params = {
        project_id: 'test-project-with-dashes',
        environment_name: 'env_with_underscores',
        is_live: true,
      };

      const result = await callback(params);

      expect(result).toEqual({
        content: [
          {
            type: 'text',
            text: JSON.stringify(acceptedResponse, null, 2),
          },
        ],
      });
    });
  });
});
