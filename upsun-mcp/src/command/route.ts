/**
 * @fileoverview Route management command module for Upsun MCP server.
 * 
 * This module provides MCP tools for managing Upsun routes, which define how
 * HTTP requests are handled within a project environment. It also includes
 * utilities for retrieving URLs and console access links.
 */

import { McpAdapter } from "../core/adapter.js";
import { Response, Schema } from "../core/helper.js";
import { z } from "zod";

/**
 * Registers route management tools with the MCP server.
 * 
 * This function adds three tools for route operations:
 * - get-route: Retrieves information about a specific route
 * - list-route: Lists all routes for an environment
 * - get-console: Gets the web console URL for a project
 * 
 * @param adapter - The MCP adapter instance to register tools with
 * 
 * @example
 * ```typescript
 * const server = new UpsunMcpServer();
 * registerRoute(server);
 * ```
 */
export function registerRoute(adapter: McpAdapter): void {
  console.log(`Register Route Handlers`);

  /**
   * Tool: get-route
   * Retrieves information about a specific route in an environment.
   * 
   * Routes define how HTTP requests are handled within a project environment,
   * including URL patterns, upstream services, and caching configurations.
   * 
   * @param project_id - The project ID containing the environment
   * @param environment_name - The name of the environment
   * @param route_id - Optional identifier for a specific route (if omitted, returns the primary route)
   */
  adapter.server.tool(
    "get-route",
    "Get route URL of upsun project",
    {
      project_id: Schema.projectId(),
      environment_name: Schema.environmentName(),
      route_id: z.string().optional(),
    },
    async ({ project_id, environment_name, route_id }) => {
      const result = (await adapter.client.route.get(project_id, environment_name, route_id || ''));

      return Response.json(result);
    }
  );

  /**
   * Tool: list-route
   * Lists all routes defined for a specific environment.
   * 
   * Returns an array of routes with information such as URL patterns,
   * upstream services, caching configurations, and TLS settings.
   * 
   * @param project_id - The project ID containing the environment
   * @param environment_name - The name of the environment to list routes from
   */
  adapter.server.tool(
    "list-route",
    "List routes URL of upsun project",
    {
      project_id: Schema.projectId(),
      environment_name: Schema.environmentName(),
    },
    async ({ project_id, environment_name }) => {
      const result = await adapter.client.route.list(project_id, environment_name);

      return Response.json(result);
    }
  );

  /**
   * Tool: get-console
   * Retrieves the web console URL for a specific project.
   * 
   * The web console URL provides access to the Upsun management interface
   * for the project, where users can view and manage environments, deployments,
   * and other project settings.
   * 
   * @param project_id - The project ID to get the console URL for
   */
  adapter.server.tool(
    "get-console",
    "Get console URL of upsun project",
    {
      project_id: Schema.projectId(),
    },
    async ({ project_id }) => {
      const result = (await adapter.client.route.web(project_id)).ui;

      return Response.json(result);
    }
  );
}
