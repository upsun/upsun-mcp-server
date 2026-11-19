/**
 * @fileoverview Route command module for Upsun MCP server.
 *
 * Provides MCP tools that read the routes of an environment.
 */

import { McpAdapter } from '../core/adapter.js';
import { Response, Schema, ToolWrapper } from '../core/helper.js';
import { z } from 'zod';
import { Deployment } from 'upsun-sdk-node';
import { createLogger } from '../core/logger.js';

const log = createLogger('MCP:Tool:route-commands');

// The environment routes endpoint returns default routes for projects configured in
// `.upsun/config.yaml` (GIT-1834); the current deployment holds the real routes.
async function deployedRoutes(
  adapter: McpAdapter,
  projectId: string,
  environmentName: string
): Promise<Deployment['routes']> {
  const deployment = await adapter.client.environments.getDeployment(
    projectId,
    environmentName,
    'current'
  );
  return deployment.routes;
}

/**
 * Registers the route tools with the MCP server:
 * - get-route: one route of an environment (the primary route by default)
 * - list-route: all routes of an environment
 *
 * @param adapter - The MCP adapter instance to register tools with
 */
export function registerRoute(adapter: McpAdapter): void {
  log.info('Register Route Handlers');

  adapter.server.registerTool(
    'get-route',
    {
      annotations: { readOnlyHint: true },
      description:
        'Get a route of the current deployment of an environment on upsun project. ' +
        'Without route_id, get the primary route.',
      inputSchema: {
        project_id: Schema.projectId(),
        environment_name: Schema.environmentName(),
        route_id: z
          .string()
          .optional()
          .describe(
            'Route URL as returned by list-route, or the route id. Omit it to get the primary route.'
          ),
      },
    },
    ToolWrapper.trace('get-route', async ({ project_id, environment_name, route_id }) => {
      log.debug(
        `Get Route: ${route_id || 'primary'} in Environment: ${environment_name} of Project: ${project_id}`
      );
      const routes = await deployedRoutes(adapter, project_id, environment_name);

      const match = Object.entries(routes).find(([url, route]) =>
        route_id ? url === route_id || route.id === route_id : route.primary === true
      );
      if (!match) {
        throw new Error(
          route_id
            ? `Route not found: ${route_id}. Use list-route to get the route URLs.`
            : `No primary route in Environment: ${environment_name}`
        );
      }

      const [url, route] = match;
      return Response.json({ url, ...route });
    })
  );

  adapter.server.registerTool(
    'list-route',
    {
      annotations: { readOnlyHint: true },
      description:
        'List the routes of the current deployment of an environment on upsun project, keyed by route URL',
      inputSchema: {
        project_id: Schema.projectId(),
        environment_name: Schema.environmentName(),
      },
    },
    ToolWrapper.trace('list-route', async ({ project_id, environment_name }) => {
      log.debug(`List Routes in Environment: ${environment_name} of Project: ${project_id}`);
      const routes = await deployedRoutes(adapter, project_id, environment_name);

      return Response.json(routes);
    })
  );
}
