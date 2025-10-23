/**
 * @fileoverview Environment management command module for Upsun MCP server.
 *
 * This module provides MCP tools for managing Upsun environments, which are
 * isolated instances of applications within a project. Environments can be
 * activated, paused, merged, and redeployed to support different development
 * workflows and deployment strategies.
 */

import { McpAdapter } from '../core/adapter.js';
import { Response, Schema, ToolWrapper } from '../core/helper.js';
import { createLogger } from '../core/logger.js';

// Create logger for environment operations
const log = createLogger('MCP:Tool:environment-commands');

/**
 * Registers environment management tools with the MCP server.
 *
 * This function adds comprehensive environment management tools including:
 * - activate-environment: Activates a paused environment
 * - delete-environment: Permanently deletes an environment
 * - info-environment: Retrieves environment details and status
 * - list-environment: Lists all environments in a project
 * - logs-environment: Displays application logs (not implemented)
 * - merge-environment: Merges environment changes to parent
 * - pause-environment: Pauses an active environment
 * - redeploy-environment: Triggers a new deployment
 * - resume-environment: Resumes a paused environment
 * - urls-environment: Gets all URLs for an environment
 *
 * @param adapter - The MCP adapter instance to register tools with
 *
 * @example
 * ```typescript
 * const server = new UpsunMcpServer();
 * registerEnvironment(server);
 * ```
 */
export function registerEnvironment(adapter: McpAdapter): void {
  log.info('Register Environment Handlers');

  /**
   * Tool: activate-environment
   * Activates a previously paused environment, making it available for use.
   *
   * @param project_id - The project ID containing the environment
   * @param environment_name - The name of the environment to activate
   */
  if (adapter.isMode()) {
    adapter.server.tool(
      'activate-environment',
      'Activate a environment of upsun project',
      {
        project_id: Schema.projectId(),
        environment_name: Schema.environmentName(),
      },
      ToolWrapper.trace('activate-environment', async ({ project_id, environment_name }) => {
        log.debug(`Activate Environment ${environment_name} in Project ${project_id}`);
        const result = await adapter.client.environment.activate(project_id, environment_name);

        return Response.json(result);
      })
    );
  }

  /**
   * Tool: delete-environment
   * Permanently deletes an environment and all its associated data.
   *
   * @warning This operation is irreversible and will destroy all data,
   * configurations, and deployments associated with the environment.
   *
   * @param project_id - The project ID containing the environment
   * @param environment_name - The name of the environment to delete
   */
  if (adapter.isMode()) {
    adapter.server.tool(
      'delete-environment',
      'Delete a environment of upsun project',
      {
        project_id: Schema.projectId(),
        environment_name: Schema.environmentName(),
      },
      ToolWrapper.trace('delete-environment', async ({ project_id, environment_name }) => {
        log.debug(`Delete Environment ${environment_name} from Project ${project_id}`);
        const result = await adapter.client.environment.delete(project_id, environment_name);

        return Response.json(result);
      })
    );
  }

  /**
   * Tool: info-environment
   * Retrieves detailed information about a specific environment.
   *
   * Returns comprehensive environment details including status, configuration,
   * deployment information, and resource usage.
   *
   * @param project_id - The project ID containing the environment
   * @param environment_name - The name of the environment to query
   */
  adapter.server.tool(
    'info-environment',
    'Get information of environment on upsun project',
    {
      project_id: Schema.projectId(),
      environment_name: Schema.environmentName(),
    },
    ToolWrapper.trace('info-environment', async ({ project_id, environment_name }) => {
      log.debug(`Get Info of Environment ${environment_name} in Project ${project_id}`);
      const result = await adapter.client.environment.info(project_id, environment_name);

      return Response.json(result);
    })
  );

  /**
   * Tool: list-environment
   * Lists all environments within a project.
   *
   * Returns an array of environments with basic information such as
   * name, status, type, and last deployment date.
   *
   * @param project_id - The project ID to list environments from
   */
  adapter.server.tool(
    'list-environment',
    'List all environments of upsun project',
    {
      project_id: Schema.projectId(),
    },
    ToolWrapper.trace('list-environment', async ({ project_id }) => {
      log.debug(`List Environments in Project ${project_id}`);
      const result = await adapter.client.environment.list(project_id);

      return Response.json(result);
    })
  );

  /**
   * Tool: logs-environment
   * Displays application logs for a specific environment.
   *
   * @param project_id - The project ID containing the environment
   * @param environment_name - The name of the environment
   * @param application_name - The name of the application to get logs from
   */
  adapter.server.tool(
    'logs-environment',
    'Display logs of app of upsun project',
    {
      project_id: Schema.projectId(),
      environment_name: Schema.environmentName(),
      application_name: Schema.applicationName(),
    },
    ToolWrapper.trace(
      'logs-environment',
      async ({ project_id, environment_name, application_name }) => {
        log.debug(
          `Get Logs of Application ${application_name} in Environment ${environment_name}, Project ${project_id}`
        );
        const result = await adapter.client.environment.logs(
          project_id,
          environment_name,
          application_name
        );

        return Response.json(result);
      }
    )
  );

  /**
   * Tool: merge-environment
   * Merges an environment's changes back to its parent environment.
   *
   * This is typically used to merge feature branch environments back
   * to the main/production environment.
   *
   * @param project_id - The project ID containing the environment
   * @param environment_name - The name of the environment to merge
   */
  if (adapter.isMode()) {
    adapter.server.tool(
      'merge-environment',
      'Merge a environment to parent environment of upsun project',
      {
        project_id: Schema.projectId(),
        environment_name: Schema.environmentName(),
      },
      ToolWrapper.trace('merge-environment', async ({ project_id, environment_name }) => {
        log.debug(`Merge Environment ${environment_name} in Project ${project_id}`);
        const result = await adapter.client.environment.merge(project_id, environment_name);

        return Response.json(result);
      })
    );
  }

  /**
   * Tool: pause-environment
   * Pauses an active environment to save resources.
   *
   * Paused environments are not accessible but their data is preserved.
   * They can be resumed later with the resume-environment tool.
   *
   * @param project_id - The project ID containing the environment
   * @param environment_name - The name of the environment to pause
   */
  if (adapter.isMode()) {
    adapter.server.tool(
      'pause-environment',
      'Pause a environment of upsun project',
      {
        project_id: Schema.projectId(),
        environment_name: Schema.environmentName(),
      },
      ToolWrapper.trace('pause-environment', async ({ project_id, environment_name }) => {
        log.debug(`Pause Environment ${environment_name} in Project ${project_id}`);
        const result = await adapter.client.environment.pause(project_id, environment_name);

        return Response.json(result);
      })
    );
  }

  /**
   * Tool: redeploy-environment
   * Triggers a new deployment of an environment.
   *
   * This will rebuild and redeploy all applications in the environment
   * using the latest code and configuration.
   *
   * @param project_id - The project ID containing the environment
   * @param environment_name - The name of the environment to redeploy
   * @param application_name - The specific application to redeploy (optional)
   */
  if (adapter.isMode()) {
    adapter.server.tool(
      'redeploy-environment',
      'Redeploy a environment of upsun project',
      {
        project_id: Schema.projectId(),
        environment_name: Schema.environmentName(),
        application_name: Schema.applicationName().optional(),
      },
      ToolWrapper.trace('redeploy-environment', async ({ project_id, environment_name }) => {
        log.debug(`Redeploy Environment ${environment_name} in Project ${project_id}`);
        const result = await adapter.client.environment.redeploy(project_id, environment_name);

        return Response.json(result);
      })
    );
  }

  /**
   * Tool: resume-environment
   * Resumes a previously paused environment.
   *
   * This will restart all services and make the environment accessible again.
   *
   * @param project_id - The project ID containing the environment
   * @param environment_name - The name of the environment to resume
   */
  if (adapter.isMode()) {
    adapter.server.tool(
      'resume-environment',
      'Resume a environment of upsun project',
      {
        project_id: Schema.projectId(),
        environment_name: Schema.environmentName(),
      },
      ToolWrapper.trace('resume-environment', async ({ project_id, environment_name }) => {
        log.debug(`Resume Environment ${environment_name} in Project ${project_id}`);
        const result = await adapter.client.environment.resume(project_id, environment_name);

        return Response.json(result);
      })
    );
  }

  /**
   * Tool: urls-environment
   * Retrieves all URLs associated with an environment.
   *
   * Returns a list of URLs where the environment's applications can be accessed,
   * including both default and custom domain URLs.
   *
   * @param project_id - The project ID containing the environment
   * @param environment_name - The name of the environment to get URLs for
   */
  adapter.server.tool(
    'urls-environment',
    'Get URLs of environment on upsun project',
    {
      project_id: Schema.projectId(),
      environment_name: Schema.environmentName(),
    },
    ToolWrapper.trace('urls-environment', async ({ project_id, environment_name }) => {
      log.debug(`Get URLs of Environment ${environment_name} in Project ${project_id}`);
      const result = await adapter.client.environment.urls(project_id, environment_name);

      return Response.json(result);
    })
  );
}
