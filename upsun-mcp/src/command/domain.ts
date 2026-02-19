/**
 * @fileoverview Domain management command module for Upsun MCP server.
 *
 * This module provides MCP tools for managing custom domains for Upsun projects.
 * Custom domains allow projects to be accessed via user-owned domain names instead
 * of the default Upsun-provided domains.
 */

import { McpAdapter } from '../core/adapter.js';
import { Response, Schema, ToolWrapper } from '../core/helper.js';
import { z } from 'zod';
import { createLogger } from '../core/logger.js';

// Create logger for domain operations
const log = createLogger('MCP:Tool:domain-commands');

/**
 * Registers domain management tools with the MCP server.
 *
 * This function adds five tools for domain operations:
 * - add-domain: Adds a new custom domain to a project
 * - delete-domain: Removes a custom domain from a project
 * - get-domain: Retrieves information about a specific domain
 * - list-domain: Lists all domains for a project
 * - update-domain: Updates configuration for an existing domain
 *
 * @param adapter - The MCP adapter instance to register tools with
 *
 * @example
 * ```typescript
 * const server = new UpsunMcpServer();
 * registerDomain(server);
 * ```
 */
export function registerDomain(adapter: McpAdapter): void {
  log.info('Register Domain Handlers');

  /**
   * Tool: add-domain
   * Adds a new custom domain to a project.
   *
   * This will create the necessary DNS validation and certificate provisioning
   * processes to secure the domain with HTTPS. The domain owner must configure
   * the appropriate DNS records to point to Upsun.
   *
   * @param project_id - The project ID to add the domain to
   * @param domain_name - The domain name to add (e.g., example.com)
   */
  if (adapter.isMode()) {
    adapter.server.tool(
      'add-domain',
      'Add Domain on upsun project',
      {
        project_id: Schema.projectId(),
        domain_name: Schema.domainName(),
      },
      ToolWrapper.trace('add-domain', async ({ project_id, domain_name }) => {
        log.debug(`Add Domain ${domain_name} to Project ${project_id}`);
        const result = await adapter.client.domains.add(project_id, domain_name);

        return Response.json(result);
      })
    );
  }

  /**
   * Tool: delete-domain
   * Removes a custom domain from a project.
   *
   * @warning This operation will make the project inaccessible via this domain.
   * Any certificates associated with this domain will also be removed.
   *
   * @param project_id - The project ID containing the domain
   * @param domain_name - The domain name to remove
   */
  if (adapter.isMode()) {
    adapter.server.tool(
      'delete-domain',
      'Delete a Domain on upsun project',
      {
        project_id: Schema.projectId(),
        domain_name: Schema.domainName(),
      },
      ToolWrapper.trace('delete-domain', async ({ project_id, domain_name }) => {
        log.debug(`Delete Domain ${domain_name} from Project ${project_id}`);
        const result = await adapter.client.domains.delete(project_id, domain_name);

        return Response.json(result);
      })
    );
  }

  /**
   * Tool: get-domain
   * Retrieves detailed information about a specific domain.
   *
   * Returns comprehensive domain details including status, SSL configuration,
   * DNS validation status, and associated environments.
   *
   * @param project_id - The project ID containing the domain
   * @param domain_name - The domain name to query
   */
  adapter.server.tool(
    'get-domain',
    'Get a Domain of upsun project',
    {
      project_id: Schema.projectId(),
      domain_name: Schema.domainName(),
    },
    ToolWrapper.trace('get-domain', async ({ project_id, domain_name }) => {
      log.debug(`Get Domain ${domain_name} in Project ${project_id}`);
      const result = await adapter.client.domains.get(project_id, domain_name);

      return Response.json(result);
    })
  );

  /**
   * Tool: list-domain
   * Lists all custom domains for a specific project.
   *
   * Returns an array of domains with basic information such as
   * domain name, status, SSL configuration, and creation date.
   *
   * @param project_id - The project ID to list domains from
   */
  adapter.server.tool(
    'list-domain',
    'List all Domains of upsun project',
    {
      project_id: Schema.projectId(),
    },
    ToolWrapper.trace('list-domain', async ({ project_id }) => {
      log.debug(`List Domains in Project ${project_id}`);
      const result = await adapter.client.domains.list(project_id);

      return Response.json(result);
    })
  );

  /**
   * Tool: update-domain
   * Updates configuration for an existing domain.
   *
   * This can be used to modify SSL settings, routing rules,
   * or other domain-specific configurations.
   *
   * @param project_id - The project ID containing the domain
   * @param domain_name - The domain name to update
   */
  if (adapter.isMode()) {
    adapter.server.tool(
      'update-domain',
      'Update a Domain of upsun project',
      {
        project_id: Schema.projectId(),
        domain_name: Schema.domainName(),
      },
      ToolWrapper.trace('update-domain', async ({ project_id, domain_name }) => {
        log.debug(`Update Domain ${domain_name} in Project ${project_id}`);
        const result = await adapter.client.domains.update(project_id, domain_name);

        return Response.json(result);
      })
    );
  }
}
