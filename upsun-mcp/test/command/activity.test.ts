import { describe, expect, it, jest, beforeEach, afterEach } from '@jest/globals';
import http from 'node:http';
import { AddressInfo } from 'node:net';
import { Configuration, ResponseError, UpsunClient } from 'upsun-sdk-node';
import { McpAdapter } from '../../src/core/adapter';
import {
  ACTIVITY_LOG_HEADERS_TIMEOUT_MS,
  ACTIVITY_LOG_INCOMPLETE_NOTE,
  ACTIVITY_LOG_TIMEOUT_MS,
  readActivityLog,
  registerActivity,
} from '../../src/command/activity';
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
const mockActivitiesApi = {
  list: jest.fn(),
  get: jest.fn(),
  cancel: jest.fn(),
};

const BASE_PATH = 'https://api.example.test';
const fetchMock = jest.fn<(url: string, init: RequestInit) => Promise<globalThis.Response>>();

const mockClient: { activities: any; apiConfig: Configuration } = {
  activities: mockActivitiesApi,
  apiConfig: new Configuration({
    basePath: BASE_PATH,
    accessToken: async () => 'test-token',
    fetchApi: fetchMock as any,
  }),
};

// Explicit mock added for isMode on mockAdapter, and client: mockClient
const mockAdapter: McpAdapter = {
  client: mockClient,
  server: {
    tool: jest.fn(),
  },
  isMode: () => true,
} as any;

// Mock data for testing
const mockActivity = {
  id: 'test-activity-123',
  type: 'deploy',
  status: 'complete',
  created_at: '2025-05-28T00:00:00Z',
  completed_at: '2025-05-28T00:05:00Z',
  project_id: 'test-project-13',
  environment: 'main',
  description: 'Deploy application',
};

const mockActivityList = [
  mockActivity,
  {
    id: 'test-activity-456',
    type: 'build',
    status: 'running',
    created_at: '2025-05-28T00:10:00Z',
    project_id: 'test-project-13',
    environment: 'staging',
  },
];

/** Builds a streamed HTTP response whose body sends each chunk in order. */
function streamResponse(
  chunks: string[],
  { close = true, onCancel = () => {} } = {}
): globalThis.Response {
  const encoder = new TextEncoder();
  const body = new ReadableStream<Uint8Array>({
    start(controller) {
      chunks.forEach(chunk => controller.enqueue(encoder.encode(chunk)));
      if (close) {
        controller.close();
      }
    },
    cancel: onCancel,
  });
  return new globalThis.Response(body, { status: 200 });
}

function logRecord(id: number, message: string): string {
  return (
    JSON.stringify({ _id: id, data: { timestamp: '2026-11-19T12:43:21+00:00', message } }) + '\n'
  );
}

function sealRecord(id: number): string {
  return JSON.stringify({ _id: id, seal: true }) + '\n';
}

const mockCancelResult = {
  success: true,
  message: 'Activity cancelled successfully',
};

describe('Activity Command Module', () => {
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
        // callback is always the last argument
        const callback = args[args.length - 1];
        toolCallbacks[name] = callback;
        return mockAdapter.server;
      });

    // Setup default mock responses
    mockClient.activities.list.mockResolvedValue(mockActivityList);
    mockClient.activities.get.mockResolvedValue(mockActivity);
    mockClient.activities.cancel.mockResolvedValue(mockCancelResult);
  });

  afterEach(() => {
    teardownTestEnvironment(originalEnv);
    jest.restoreAllMocks();
  });

  describe('registerActivity function', () => {
    it('should register all activity tools', () => {
      registerActivity(mockAdapter);

      expect(mockAdapter.server.registerTool).toHaveBeenCalledTimes(4);

      // Verify all tools are registered
      expect(toolCallbacks['cancel-activity']).toBeDefined();
      expect(toolCallbacks['get-activity']).toBeDefined();
      expect(toolCallbacks['list-activity']).toBeDefined();
      expect(toolCallbacks['get-activity-log']).toBeDefined();
    });

    it('should register tools with correct names and descriptions', () => {
      registerActivity(mockAdapter);

      const calls = (mockAdapter.server.registerTool as unknown as jest.Mock).mock.calls;

      expect(calls[0]).toEqual([
        'cancel-activity',
        {
          annotations: { destructiveHint: false },
          description: 'Cancel a activity of upsun project',
          inputSchema: expect.any(Object),
        },
        expect.any(Function),
      ]);

      expect(calls[1]).toEqual([
        'get-activity',
        {
          annotations: { readOnlyHint: true },
          description: 'Get detail of activity on upsun project',
          inputSchema: expect.any(Object),
        },
        expect.any(Function),
      ]);

      expect(calls[2]).toEqual([
        'list-activity',
        {
          annotations: { readOnlyHint: true },
          description: 'List all activities of upsun project',
          inputSchema: expect.any(Object),
        },
        expect.any(Function),
      ]);

      expect(calls[3]).toEqual([
        'get-activity-log',
        {
          annotations: { readOnlyHint: true },
          description:
            'Get the log of an activity, such as a deployment. Use it to find why an activity failed. ' +
            'For a running activity, the log is incomplete.',
          inputSchema: expect.any(Object),
        },
        expect.any(Function),
      ]);
    });
  });

  describe('cancel-activity tool', () => {
    beforeEach(() => {
      registerActivity(mockAdapter);
    });

    it('should cancel an activity successfully', async () => {
      const callback = toolCallbacks['cancel-activity'];
      const params = {
        project_id: 'test-project-13',
        activity_id: 'test-activity-123',
      };

      const result = await callback(params);

      expect(mockClient.activities.cancel).toHaveBeenCalledWith(
        'test-project-13',
        'test-activity-123'
      );
      expect(result).toEqual({
        content: [
          {
            type: 'text',
            text: JSON.stringify(mockCancelResult, null, 2),
          },
        ],
      });
    });

    it('should handle cancel activity errors', async () => {
      const callback = toolCallbacks['cancel-activity'];
      const errorMessage = 'Activity cannot be cancelled';
      mockClient.activities.cancel.mockRejectedValue(new Error(errorMessage));

      const params = {
        project_id: 'test-project-13',
        activity_id: 'test-activity-123',
      };

      await expect(callback(params)).rejects.toThrow(errorMessage);
      expect(mockClient.activities.cancel).toHaveBeenCalledWith(
        'test-project-13',
        'test-activity-123'
      );
    });
  });

  describe('get-activity tool', () => {
    beforeEach(() => {
      registerActivity(mockAdapter);
    });

    it('should return the full raw activity with full:true', async () => {
      const callback = toolCallbacks['get-activity'];
      const params = {
        project_id: 'test-project-13',
        activity_id: 'test-activity-123',
        full: true,
      };

      const result = await callback(params);

      expect(mockClient.activities.get).toHaveBeenCalledWith(
        'test-project-13',
        'test-activity-123'
      );
      expect(result).toEqual({
        content: [
          {
            type: 'text',
            text: JSON.stringify(mockActivity, null, 2),
          },
        ],
      });
    });

    it('should handle get activity errors', async () => {
      const callback = toolCallbacks['get-activity'];
      const errorMessage = 'Activity not found';
      mockClient.activities.get.mockRejectedValue(new Error(errorMessage));

      const params = {
        project_id: 'test-project-13',
        activity_id: 'invalid-activity',
      };

      await expect(callback(params)).rejects.toThrow(errorMessage);
      expect(mockClient.activities.get).toHaveBeenCalledWith('test-project-13', 'invalid-activity');
    });
  });

  describe('list-activity tool', () => {
    beforeEach(() => {
      registerActivity(mockAdapter);
    });

    it('should return the full raw list with full:true', async () => {
      const callback = toolCallbacks['list-activity'];
      const params = {
        project_id: 'test-project-13',
        full: true,
      };

      const result = await callback(params);

      expect(mockClient.activities.list).toHaveBeenCalledWith('test-project-13');
      expect(result).toEqual({
        content: [
          {
            type: 'text',
            text: JSON.stringify(mockActivityList, null, 2),
          },
        ],
      });
    });

    it('should handle empty activity list', async () => {
      const callback = toolCallbacks['list-activity'];
      mockClient.activities.list.mockResolvedValue([]);

      const params = {
        project_id: 'test-project-13',
      };

      const result = await callback(params);

      expect(mockClient.activities.list).toHaveBeenCalledWith('test-project-13');
      expect(result).toEqual({
        content: [
          {
            type: 'text',
            text: JSON.stringify([], null, 2),
          },
        ],
      });
    });

    it('should handle list activities errors', async () => {
      const callback = toolCallbacks['list-activity'];
      const errorMessage = 'Project not found';
      mockClient.activities.list.mockRejectedValue(new Error(errorMessage));

      const params = {
        project_id: 'invalid-project',
      };

      await expect(callback(params)).rejects.toThrow(errorMessage);
      expect(mockClient.activities.list).toHaveBeenCalledWith('invalid-project');
    });
  });

  describe('get-activity-log tool', () => {
    const params = { project_id: 'test-project-13', activity_id: 'test-activity-123' };

    beforeEach(() => {
      registerActivity(mockAdapter);
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    it('should return the joined messages of the log stream', async () => {
      fetchMock.mockResolvedValue(
        streamResponse([
          logRecord(0, 'Found 2 commits\n'),
          logRecord(1, 'Building application\n'),
          logRecord(2, 'Deployment failed\n'),
          sealRecord(3),
        ])
      );

      const result = await toolCallbacks['get-activity-log'](params);

      expect(result).toEqual({
        content: [
          { type: 'text', text: 'Found 2 commits\nBuilding application\nDeployment failed\n' },
        ],
      });
      const [url, init] = fetchMock.mock.calls[0];
      expect(url).toBe(`${BASE_PATH}/projects/test-project-13/activities/test-activity-123/log`);
      expect((init.headers as Record<string, string>)['Authorization']).toBe('Bearer test-token');
    });

    it('should join a record that the network splits across chunks', async () => {
      const record = logRecord(0, 'Configuring resources\n');
      fetchMock.mockResolvedValue(
        streamResponse([record.slice(0, 20), record.slice(20), sealRecord(1)])
      );

      const result = await toolCallbacks['get-activity-log'](params);

      expect(result.content[0].text).toBe('Configuring resources\n');
    });

    it('should accept a last record that has no trailing newline', async () => {
      fetchMock.mockResolvedValue(
        streamResponse([logRecord(0, 'Done\n'), sealRecord(1).trimEnd()])
      );

      const result = await toolCallbacks['get-activity-log'](params);

      expect(result.content[0].text).toBe('Done\n');
    });

    it('should return an empty log when the stream holds only the seal record', async () => {
      fetchMock.mockResolvedValue(streamResponse([sealRecord(0)]));

      const result = await toolCallbacks['get-activity-log'](params);

      expect(result.content[0].text).toBe('');
    });

    // A running activity keeps the stream open: the tool returns what it read so far.
    it('should return the partial log with a note when the stream does not end in time', async () => {
      jest.useFakeTimers({ doNotFake: ['queueMicrotask', 'nextTick', 'setImmediate'] });
      fetchMock.mockResolvedValue(
        streamResponse([logRecord(0, 'Building application\n')], { close: false })
      );

      const pending = toolCallbacks['get-activity-log'](params);
      await jest.advanceTimersByTimeAsync(ACTIVITY_LOG_TIMEOUT_MS);
      const result = await pending;

      expect(result.content[0].text).toBe('Building application\n' + ACTIVITY_LOG_INCOMPLETE_NOTE);
    });

    // The timer can cut the stream inside a record: the partial record is dropped, not an error.
    it('should return the partial log with a note when the timeout cuts a record', async () => {
      jest.useFakeTimers({ doNotFake: ['queueMicrotask', 'nextTick', 'setImmediate'] });
      fetchMock.mockResolvedValue(
        streamResponse([logRecord(0, 'Building application\n') + '{"_id": 1, "data": {"mess'], {
          close: false,
        })
      );

      const pending = toolCallbacks['get-activity-log'](params);
      await jest.advanceTimersByTimeAsync(ACTIVITY_LOG_TIMEOUT_MS);
      const result = await pending;

      expect(result.content[0].text).toBe('Building application\n' + ACTIVITY_LOG_INCOMPLETE_NOTE);
    });

    // The timeout applies to the body only: a slow token exchange or slow headers is not a running activity.
    it('should return the full log when the headers arrive after the timeout', async () => {
      jest.useFakeTimers({ doNotFake: ['queueMicrotask', 'nextTick', 'setImmediate'] });
      fetchMock.mockImplementation(
        () =>
          new Promise(resolve => {
            setTimeout(
              () => resolve(streamResponse([logRecord(0, 'Done\n'), sealRecord(1)])),
              ACTIVITY_LOG_TIMEOUT_MS + 5_000
            );
          })
      );

      const pending = toolCallbacks['get-activity-log'](params);
      await jest.advanceTimersByTimeAsync(ACTIVITY_LOG_TIMEOUT_MS + 5_000);
      const result = await pending;

      expect(result.content[0].text).toBe('Done\n');
    });

    // A stalled upstream is an error, not a running activity.
    it('should throw when the headers do not arrive within the headers timeout', async () => {
      jest.useFakeTimers({ doNotFake: ['queueMicrotask', 'nextTick', 'setImmediate'] });
      fetchMock.mockImplementation(
        (_url, init) =>
          new Promise((_resolve, reject) => {
            init.signal?.addEventListener('abort', () => reject(init.signal?.reason));
          })
      );

      const pending = toolCallbacks['get-activity-log'](params).catch((e: unknown) => e);
      await jest.advanceTimersByTimeAsync(ACTIVITY_LOG_HEADERS_TIMEOUT_MS);
      const error = await pending;

      expect(error).toBeInstanceOf(Error);
      expect((error as Error).message).toBe(
        `The activity log request got no response within ${ACTIVITY_LOG_HEADERS_TIMEOUT_MS / 1000} s`
      );
    });

    // The headers timer starts after the token: a slow token is not blamed on the log endpoint.
    it('should return the full log when the token arrives after the headers timeout', async () => {
      jest.useFakeTimers({ doNotFake: ['queueMicrotask', 'nextTick', 'setImmediate'] });
      const apiConfig = mockClient.apiConfig;
      mockClient.apiConfig = new Configuration({
        basePath: BASE_PATH,
        accessToken: () =>
          new Promise<string>(resolve =>
            setTimeout(() => resolve('slow-token'), ACTIVITY_LOG_HEADERS_TIMEOUT_MS + 5_000)
          ),
        fetchApi: fetchMock as any,
      });
      // As the real fetch, reject at once on a signal that is already aborted.
      fetchMock.mockImplementation(async (_url, init) => {
        if (init.signal?.aborted) {
          throw init.signal.reason;
        }
        return streamResponse([logRecord(0, 'Done\n'), sealRecord(1)]);
      });

      try {
        const pending = toolCallbacks['get-activity-log'](params);
        await jest.advanceTimersByTimeAsync(ACTIVITY_LOG_HEADERS_TIMEOUT_MS + 5_000);
        const result = await pending;

        expect(result.content[0].text).toBe('Done\n');
      } finally {
        mockClient.apiConfig = apiConfig;
      }
    });

    // A running activity keeps the stream open: a failed call must not keep the connection.
    it('should release the open log stream when a record is malformed', async () => {
      const onCancel = jest.fn();
      fetchMock.mockResolvedValue(
        streamResponse(['{"_id": 0, "data": {}}\n'], { close: false, onCancel })
      );

      await expect(toolCallbacks['get-activity-log'](params)).rejects.toThrow(
        'Unexpected activity log record'
      );
      expect(onCancel).toHaveBeenCalled();
    });

    it('should send no Authorization header when the token is empty', async () => {
      const apiConfig = mockClient.apiConfig;
      mockClient.apiConfig = new Configuration({
        basePath: BASE_PATH,
        accessToken: async () => '',
        fetchApi: fetchMock as any,
      });
      fetchMock.mockResolvedValue(streamResponse([sealRecord(0)]));

      try {
        await toolCallbacks['get-activity-log'](params);
      } finally {
        mockClient.apiConfig = apiConfig;
      }

      const [, init] = fetchMock.mock.calls[0];
      expect(init.headers as Record<string, string>).not.toHaveProperty('Authorization');
    });

    // The HTTP layer forwards an upstream 401 only when it gets a ResponseError.
    it('should throw a ResponseError when the API rejects the token', async () => {
      fetchMock.mockResolvedValue(new globalThis.Response('unauthorized', { status: 401 }));

      const error = await toolCallbacks['get-activity-log'](params).catch((e: unknown) => e);

      expect(error).toBeInstanceOf(ResponseError);
      expect((error as ResponseError).response.status).toBe(401);
    });

    it('should throw when the activity does not exist', async () => {
      fetchMock.mockResolvedValue(new globalThis.Response('not found', { status: 404 }));

      await expect(toolCallbacks['get-activity-log'](params)).rejects.toThrow('HTTP 404');
    });

    it('should throw when the response has no body', async () => {
      fetchMock.mockResolvedValue(new globalThis.Response(null, { status: 200 }));

      await expect(toolCallbacks['get-activity-log'](params)).rejects.toThrow(
        'Activity log response has no body'
      );
    });

    it('should throw when the stream ends without a seal record', async () => {
      fetchMock.mockResolvedValue(streamResponse([logRecord(0, 'Building application\n')]));

      await expect(toolCallbacks['get-activity-log'](params)).rejects.toThrow(
        'Activity log stream ended without a seal record'
      );
    });

    it('should throw on a record that has neither a message nor a seal', async () => {
      fetchMock.mockResolvedValue(streamResponse(['{"_id": 0, "data": {}}\n', sealRecord(1)]));

      await expect(toolCallbacks['get-activity-log'](params)).rejects.toThrow(
        'Unexpected activity log record'
      );
    });

    it('should throw on a line that is not JSON', async () => {
      fetchMock.mockResolvedValue(streamResponse(['<html>\n', sealRecord(1)]));

      await expect(toolCallbacks['get-activity-log'](params)).rejects.toThrow(SyntaxError);
    });
  });

  // The real fetch ties the body to the connection: the mocked responses above cannot show a leak.
  describe('get-activity-log with a real HTTP server', () => {
    let server: http.Server;
    let basePath: string;
    let responseClosed: boolean;
    const unhandled: unknown[] = [];
    const onUnhandled = (reason: unknown) => unhandled.push(reason);

    beforeEach(async () => {
      responseClosed = false;
      server = http.createServer((_req, res) => {
        res.on('close', () => (responseClosed = true));
        res.writeHead(200, { 'content-type': 'application/x-ndjson' });
        // The stream stays open, as for a running activity.
        res.write(logRecord(0, 'Building application\n') + '{"_id": 1, "data": {}}\n');
      });
      await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
      const { port } = server.address() as AddressInfo;
      basePath = `http://127.0.0.1:${port}`;
      unhandled.length = 0;
      process.on('unhandledRejection', onUnhandled);
    });

    afterEach(async () => {
      process.off('unhandledRejection', onUnhandled);
      server.closeAllConnections();
      await new Promise(resolve => server.close(resolve));
    });

    async function expectReleasedAfterMalformedRecord(apiConfig: Configuration): Promise<void> {
      await expect(readActivityLog(apiConfig, 'test-project-13', 'act')).rejects.toThrow(
        'Unexpected activity log record'
      );

      for (let waited = 0; !responseClosed && waited < 2_000; waited += 20) {
        await new Promise(resolve => setTimeout(resolve, 20));
      }
      expect(responseClosed).toBe(true);
      expect(unhandled).toEqual([]);
    }

    it('should close the connection and leave no unhandled rejection when a record is malformed', async () => {
      await expectReleasedAfterMalformedRecord(
        new Configuration({ basePath, accessToken: async () => 'test-token' })
      );
    });

    // The UpsunClient auth middleware makes the SDK return a clone that shares the connection.
    it('should close the connection with the UpsunClient configuration', async () => {
      const client = new UpsunClient({ base_url: basePath, auth_url: basePath, clientId: 'test' });
      client.setBearerToken('test-token');

      await expectReleasedAfterMalformedRecord(client.apiConfig);
    });
  });

  describe('edge cases and error handling', () => {
    beforeEach(() => {
      registerActivity(mockAdapter);
    });

    it('should handle null/undefined responses from client', async () => {
      const callback = toolCallbacks['get-activity'];
      mockClient.activities.get.mockResolvedValue(null);

      const params = {
        project_id: 'test-project-13',
        activity_id: 'test-activity-123',
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

    it('should handle complex activity objects', async () => {
      const callback = toolCallbacks['get-activity'];
      const complexActivity = {
        ...mockActivity,
        metadata: {
          branch: 'feature/new-feature',
          commit: 'abc123def456',
          user: 'developer@example.com',
        },
        variables: {
          DATABASE_URL: 'postgres://...',
          REDIS_URL: 'redis://...',
        },
      };
      mockClient.activities.get.mockResolvedValue(complexActivity);

      const params = {
        project_id: 'test-project-13',
        activity_id: 'test-activity-123',
        full: true,
      };

      const result = await callback(params);

      expect(result).toEqual({
        content: [
          {
            type: 'text',
            text: JSON.stringify(complexActivity, null, 2),
          },
        ],
      });
    });
  });
});
