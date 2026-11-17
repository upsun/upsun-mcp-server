import { describe, expect, it, jest, beforeEach, afterEach } from '@jest/globals';
import { Configuration } from 'upsun-sdk-node';
import { McpAdapter } from '../../src/core/adapter';
import { registerLog } from '../../src/command/log';
import { setupTestEnvironment, teardownTestEnvironment } from '../helpers/test-env.js';

jest.mock('../../src/core/logger', () => ({
  createLogger: jest.fn(() => ({
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  })),
}));

const BASE_PATH = 'https://api.example.test';

const overviewBody = {
  data: [
    {
      timestamp: 1763370000,
      values: [{ severity: 'ERROR', count: 3 }],
      _links: { self: { href: '/slot' } },
    },
  ],
  filters: { fields: { severities: ['ERROR', 'INFO'] } },
  _total: 3,
  _links: { self: { href: '/overview' }, query: { href: '/query' } },
};

const queryBody = {
  data: [
    {
      cursor: 'c1',
      datetime: '2026-11-17T09:00:00Z',
      severity: 'ERROR',
      content: 'boom',
      service: 'app',
      _links: { self: { href: '/entry' } },
    },
  ],
  _has_more_results: true,
  _cursor: 'next-cursor',
  _links: { self: { href: '/query' }, overview: { href: '/overview' }, next: { href: '/next' } },
};

type FetchMock = jest.Mock<(input: string, init?: RequestInit) => Promise<Response>>;

describe('Log Command Module', () => {
  const originalEnv = process.env;
  let toolCallbacks: Record<string, any>;
  let toolConfigs: Record<string, any>;
  let fetchMock: FetchMock;

  function respondWith(status: number, body: unknown, statusText = 'OK'): void {
    fetchMock.mockResolvedValue(
      new Response(typeof body === 'string' ? body : JSON.stringify(body), {
        status,
        statusText,
        headers: { 'Content-Type': 'application/json' },
      })
    );
  }

  function requestedUrl(): URL {
    return new URL(fetchMock.mock.calls[0][0]);
  }

  function parsedText(result: any): any {
    return JSON.parse(result.content[0].text);
  }

  beforeEach(() => {
    setupTestEnvironment(jest, originalEnv);
    toolCallbacks = {};
    toolConfigs = {};
    fetchMock = jest.fn() as FetchMock;

    const adapter = {
      client: {
        apiConfig: new Configuration({ basePath: BASE_PATH, fetchApi: fetchMock as any }),
      },
      server: {
        registerTool: jest.fn((name: string, config: any, callback: any) => {
          toolConfigs[name] = config;
          toolCallbacks[name] = callback;
        }),
      },
      isMode: () => true,
    } as unknown as McpAdapter;

    registerLog(adapter);
  });

  afterEach(() => {
    teardownTestEnvironment(originalEnv);
    jest.restoreAllMocks();
  });

  it('registers get-environment-log-overview and query-environment-log as read-only tools', () => {
    expect(Object.keys(toolCallbacks)).toEqual([
      'get-environment-log-overview',
      'query-environment-log',
    ]);
    expect(toolConfigs['get-environment-log-overview'].annotations).toEqual({ readOnlyHint: true });
    expect(toolConfigs['query-environment-log'].annotations).toEqual({ readOnlyHint: true });
  });

  it('tells the agent that filter modes default to exclude and that query-environment-log pages hold 100 entries', () => {
    expect(toolConfigs['get-environment-log-overview'].description).toContain(
      'The default is "-1" (exclude)'
    );
    expect(toolConfigs['query-environment-log'].description).toContain(
      'The default is "-1" (exclude)'
    );
    expect(toolConfigs['query-environment-log'].description).toContain('100 entries');
  });

  describe('get-environment-log-overview', () => {
    it('maps the tool inputs to the overview route and its query parameters', async () => {
      respondWith(200, overviewBody);

      await toolCallbacks['get-environment-log-overview']({
        project_id: 'abcdefghijklm',
        environment_name: 'main',
        from: 1763366400,
        to: 1763370000,
        severities: ['ERROR', 'CRITICAL'],
        severities_mode: '1',
        container_ids: ['c-1'],
        container_ids_mode: '-1',
        log_kinds: ['deployment'],
      });

      const url = requestedUrl();
      expect(url.pathname).toBe(
        '/projects/abcdefghijklm/environments/main/observability/logs/overview'
      );
      expect(url.searchParams.get('from')).toBe('1763366400');
      expect(url.searchParams.get('to')).toBe('1763370000');
      expect(url.searchParams.getAll('severities[]')).toEqual(['ERROR', 'CRITICAL']);
      expect(url.searchParams.get('severities_mode')).toBe('1');
      expect(url.searchParams.getAll('container_ids[]')).toEqual(['c-1']);
      expect(url.searchParams.get('container_ids_mode')).toBe('-1');
      expect(url.searchParams.getAll('log_kinds[]')).toEqual(['deployment']);
      expect(url.searchParams.has('services[]')).toBe(false);
    });

    it('returns the API keys and strips _links from each time slot by default', async () => {
      respondWith(200, overviewBody);

      const result = await toolCallbacks['get-environment-log-overview']({
        project_id: 'abcdefghijklm',
        environment_name: 'main',
        from: 1,
        to: 2,
      });

      expect(parsedText(result)).toEqual({
        data: [{ timestamp: 1763370000, values: [{ severity: 'ERROR', count: 3 }] }],
        filters: overviewBody.filters,
        _total: 3,
        _links: overviewBody._links,
      });
    });

    it('returns the raw API body when full is true', async () => {
      respondWith(200, overviewBody);

      const result = await toolCallbacks['get-environment-log-overview']({
        project_id: 'abcdefghijklm',
        environment_name: 'main',
        from: 1,
        to: 2,
        full: true,
      });

      expect(parsedText(result)).toEqual(overviewBody);
    });
  });

  describe('query-environment-log', () => {
    it('maps cursor and order in addition to the shared filters', async () => {
      respondWith(200, queryBody);

      await toolCallbacks['query-environment-log']({
        project_id: 'abcdefghijklm',
        environment_name: 'staging',
        from: 10,
        to: 20,
        services: ['app'],
        services_mode: '1',
        cursor: 'prev-cursor',
        order: 'ASC',
      });

      const url = requestedUrl();
      expect(url.pathname).toBe(
        '/projects/abcdefghijklm/environments/staging/observability/logs/query'
      );
      expect(url.searchParams.getAll('services[]')).toEqual(['app']);
      expect(url.searchParams.get('services_mode')).toBe('1');
      expect(url.searchParams.get('cursor')).toBe('prev-cursor');
      expect(url.searchParams.get('order')).toBe('ASC');
    });

    it('keeps the pagination keys and strips _links from each entry by default', async () => {
      respondWith(200, queryBody);

      const result = await toolCallbacks['query-environment-log']({
        project_id: 'abcdefghijklm',
        environment_name: 'main',
        from: 1,
        to: 2,
      });

      expect(parsedText(result)).toEqual({
        data: [
          {
            cursor: 'c1',
            datetime: '2026-11-17T09:00:00Z',
            severity: 'ERROR',
            content: 'boom',
            service: 'app',
          },
        ],
        _has_more_results: true,
        _cursor: 'next-cursor',
        _links: queryBody._links,
      });
    });

    it('returns the raw API body when full is true', async () => {
      respondWith(200, queryBody);

      const result = await toolCallbacks['query-environment-log']({
        project_id: 'abcdefghijklm',
        environment_name: 'main',
        from: 1,
        to: 2,
        full: true,
      });

      expect(parsedText(result)).toEqual(queryBody);
    });

    // 499 is the API answer when the range holds too much data.
    it('lets an API error reach the caller with its status', async () => {
      respondWith(499, '{"error":"too much data"}', 'Client Closed Request');

      await expect(
        toolCallbacks['query-environment-log']({
          project_id: 'abcdefghijklm',
          environment_name: 'main',
          from: 1,
          to: 2,
        })
      ).rejects.toMatchObject({ name: 'ResponseError', message: expect.stringContaining('499') });
    });
  });
});
