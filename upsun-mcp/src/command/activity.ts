/**
 * @fileoverview Activity management command module for Upsun MCP server.
 *
 * This module provides MCP tools for managing Upsun activities, which represent
 * deployment operations, builds, and other asynchronous tasks within the platform.
 * Activities can be monitored, cancelled, and their logs can be retrieved for
 * debugging and monitoring purposes.
 */

import { BaseAPI, Configuration } from 'upsun-sdk-node';
import { McpAdapter } from '../core/adapter.js';
import { createLogger } from '../core/logger.js';

// Create logger for activity operations
const log = createLogger('MCP:Tool:activity-commands');
import { Response, Schema, ToolWrapper } from '../core/helper.js';
import { lean } from '../core/lean.js';

// The log endpoint streams until the activity ends, so a running activity would block the tool.
export const ACTIVITY_LOG_TIMEOUT_MS = 10_000;

export const ACTIVITY_LOG_INCOMPLETE_NOTE =
  `\n[Incomplete log: the log stream did not end within ${ACTIVITY_LOG_TIMEOUT_MS / 1000} s. ` +
  'The activity can still be running, or its log is too long to read in this time. ' +
  'Call this tool again after the activity ends to get the full log.]\n';

type ActivityLogRecord = { _id: number; seal?: true; data?: { message?: string } };

// SDK 0.8.0 has no method for this endpoint, and activities.log() throws.
class ActivityLogApi extends BaseAPI {
  async fetchLog(
    projectId: string,
    activityId: string,
    signal: AbortSignal
  ): Promise<globalThis.Response> {
    const headers: Record<string, string> = {};
    if (this.configuration.accessToken) {
      const token = await this.configuration.accessToken('BearerAuth', []);
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }
    }
    return this.request(
      {
        path: `/projects/${encodeURIComponent(projectId)}/activities/${encodeURIComponent(activityId)}/log`,
        method: 'GET',
        headers,
      },
      { signal }
    );
  }
}

/**
 * Returns the message of a JSON-lines log record, or null for the final seal record.
 */
function parseLogRecord(line: string): string | null {
  const record = JSON.parse(line) as ActivityLogRecord;
  if (record.seal) {
    return null;
  }
  if (typeof record.data?.message !== 'string') {
    throw new Error(`Unexpected activity log record: ${line}`);
  }
  return record.data.message;
}

/**
 * Reads the activity log stream until its seal record. When the body does not end within
 * ACTIVITY_LOG_TIMEOUT_MS after the headers, returns the messages read so far followed by
 * ACTIVITY_LOG_INCOMPLETE_NOTE.
 */
export async function readActivityLog(
  apiConfig: Configuration,
  projectId: string,
  activityId: string
): Promise<string> {
  const controller = new AbortController();
  const response = await new ActivityLogApi(apiConfig).fetchLog(
    projectId,
    activityId,
    controller.signal
  );
  if (!response.body) {
    throw new Error('Activity log response has no body');
  }
  const reader = response.body.getReader();
  // A body that ignores the abort signal must still stop the read loop.
  controller.signal.addEventListener('abort', () => void reader.cancel());
  // The timer starts after the headers: only an open log stream gives an incomplete log.
  const timer = setTimeout(() => controller.abort(), ACTIVITY_LOG_TIMEOUT_MS);
  const messages: string[] = [];

  try {
    const decoder = new TextDecoder();
    let buffer = '';
    for (;;) {
      const { done, value } = await reader.read();
      buffer += done ? decoder.decode() : decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = done ? '' : (lines.pop() ?? '');
      for (const line of lines) {
        if (line.trim() === '') {
          continue;
        }
        const message = parseLogRecord(line);
        if (message === null) {
          return messages.join('');
        }
        messages.push(message);
      }
      if (done) {
        break;
      }
    }

    if (controller.signal.aborted) {
      return messages.join('') + ACTIVITY_LOG_INCOMPLETE_NOTE;
    }
    throw new Error('Activity log stream ended without a seal record');
  } catch (error) {
    if (controller.signal.aborted) {
      return messages.join('') + ACTIVITY_LOG_INCOMPLETE_NOTE;
    }
    throw error;
  } finally {
    clearTimeout(timer);
    // Releases the upstream connection on every path, also when a running activity keeps it open.
    controller.abort();
  }
}

/**
 * Registers activity management tools with the MCP server.
 *
 * This function adds four tools for activity operations:
 * - cancel-activity: Cancels a running activity
 * - get-activity: Retrieves detailed information about an activity
 * - get-activity-log: Retrieves logs for a specific activity
 * - list-activity: Lists all activities for a project
 *
 * @param adapter - The MCP adapter instance to register tools with
 *
 * @example
 * ```typescript
 * const server = new UpsunMcpServer();
 * registerActivity(server);
 * ```
 */
export function registerActivity(adapter: McpAdapter): void {
  log.info('Register Activity Handlers');

  /**
   * Tool: cancel-activity
   * Cancels a running or pending activity.
   *
   * This can be used to stop deployments, builds, or other operations
   * that are currently in progress. Only activities in cancellable states
   * can be successfully cancelled.
   *
   * @param project_id - The project ID containing the activity
   * @param activity_id - The unique identifier of the activity to cancel
   */
  if (adapter.isMode()) {
    adapter.server.registerTool(
      'cancel-activity',
      {
        annotations: { destructiveHint: false },
        description: 'Cancel a activity of upsun project',
        inputSchema: {
          project_id: Schema.projectId(),
          activity_id: Schema.activityId(),
        },
      },
      ToolWrapper.trace('cancel-activity', async ({ project_id, activity_id }) => {
        log.debug(`Cancel Activity ${activity_id} in Project ${project_id}`);
        const result = await adapter.client.activities.cancel(project_id, activity_id);
        return Response.json(result);
      })
    );
  }

  /**
   * Tool: get-activity
   * Retrieves detailed information about a specific activity.
   *
   * Returns comprehensive activity details including status, type,
   * start/end times, parameters, and results.
   *
   * @param project_id - The project ID containing the activity
   * @param activity_id - The unique identifier of the activity
   */
  adapter.server.registerTool(
    'get-activity',
    {
      annotations: { readOnlyHint: true },
      description: 'Get detail of activity on upsun project',
      inputSchema: {
        project_id: Schema.projectId(),
        activity_id: Schema.activityId(),
        full: Schema.full(),
      },
    },
    ToolWrapper.trace('get-activity', async ({ project_id, activity_id, full }) => {
      log.debug(`Get Activity ${activity_id} in Project ${project_id}`);
      const result = await adapter.client.activities.get(project_id, activity_id);
      return Response.json(full ? result : lean(result));
    })
  );

  /**
   * Tool: list-activity
   * Lists all activities for a project.
   *
   * Returns an array of activities with basic information such as
   * activity ID, type, status, and timestamps. Useful for monitoring
   * project operations and deployment history.
   *
   * @param project_id - The project ID to list activities from
   */
  adapter.server.registerTool(
    'list-activity',
    {
      annotations: { readOnlyHint: true },
      description: 'List all activities of upsun project',
      inputSchema: {
        project_id: Schema.projectId(),
        full: Schema.full(),
      },
    },
    ToolWrapper.trace('list-activity', async ({ project_id, full }) => {
      log.debug(`List Activities in Project ${project_id}`);
      const result = await adapter.client.activities.list(project_id);
      return Response.json(full ? result : lean(result));
    })
  );

  /**
   * Tool: get-activity-log
   * Retrieves logs for a specific activity.
   *
   * Returns the log text from the activity log stream. For a running activity,
   * returns the part written before the timeout, followed by a note.
   *
   * @param project_id - The project ID containing the activity
   * @param activity_id - The unique identifier of the activity
   */
  adapter.server.registerTool(
    'get-activity-log',
    {
      annotations: { readOnlyHint: true },
      description:
        'Get the log of an activity, such as a deployment. Use it to find why an activity failed. ' +
        'For a running activity, the log is incomplete.',
      inputSchema: {
        project_id: Schema.projectId(),
        activity_id: Schema.activityId(),
      },
    },
    ToolWrapper.trace('get-activity-log', async ({ project_id, activity_id }) => {
      log.debug(`Get Logs for Activity ${activity_id} in Project ${project_id}`);
      const result = await readActivityLog(adapter.client.apiConfig, project_id, activity_id);
      return Response.text(result);
    })
  );
}
