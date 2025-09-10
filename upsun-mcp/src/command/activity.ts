/**
 * @fileoverview Activity management command module for Upsun MCP server.
 * 
 * This module provides MCP tools for managing Upsun activities, which represent
 * deployment operations, builds, and other asynchronous tasks within the platform.
 * Activities can be monitored, cancelled, and their logs can be retrieved for
 * debugging and monitoring purposes.
 */

import { McpAdapter } from "../core/adapter.js";
import { Response, Schema } from "../core/helper.js";

/**
 * Registers activity management tools with the MCP server.
 * 
 * This function adds four tools for activity operations:
 * - cancel-activity: Cancels a running activity
 * - get-activity: Retrieves detailed information about an activity
 * - list-activity: Lists all activities for a project
 * - log-activity: Retrieves logs for a specific activity
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
  console.log(`Register Activity Handlers`);

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
  adapter.server.tool(
    "cancel-activity",
    "Cancel a activity of upsun project",
    {
      project_id: Schema.projectId(),
      activity_id: Schema.activityId(),
    },
    async ({ project_id, activity_id }) => {
      const client = adapter.createCurrentClient();
      const result = await client.activity.cancel(project_id, activity_id);

      return Response.json(result);
    }
  );

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
  adapter.server.tool(
    "get-activity",
    "Get detail of activity on upsun project",
    {
      project_id: Schema.projectId(),
      activity_id: Schema.activityId(),
    },
    async ({ project_id, activity_id }) => {
      const client = adapter.createCurrentClient();
      const result = await client.activity.get(project_id, activity_id);

      return Response.json(result);
    }
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
  adapter.server.tool(
    "list-activity",
    "List all activities of upsun project",
    {
      project_id: Schema.projectId(),
    },
    async ({ project_id }) => {
      const client = adapter.createCurrentClient();
      const result = await client.activity.list(project_id);

      return Response.json(result);
    }
  );

  /**
   * Tool: log-activity
   * Retrieves logs for a specific activity.
   * 
   * Returns the complete log output for an activity, which is essential
   * for debugging failed deployments, understanding build processes,
   * and monitoring operation progress.
   * 
   * @param project_id - The project ID containing the activity
   * @param activity_id - The unique identifier of the activity
   */
  adapter.server.tool(
    "log-activity",
    "Get log activity of upsun project",
    {
      project_id: Schema.projectId(),
      activity_id: Schema.activityId(),
    },
    async ({ project_id, activity_id }) => {
      const client = adapter.createCurrentClient();
      const result = await client.activity.log(project_id, activity_id);

      return Response.json(result);
    }
  );
}
