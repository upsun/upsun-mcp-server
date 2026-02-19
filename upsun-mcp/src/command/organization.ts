/**
 * @fileoverview Organization management command module for Upsun MCP server.
 * 
 * This module provides MCP too    async () => {
      const result = await adapter.client.organizations.list();

      return Response.json(result);
    }r managing Upsun organizations, which are
 * top-level entities that contain projects and manage billing, user access,
 * and resource allocation.
 */

import { McpAdapter } from '../core/adapter.js';
import { Response, Schema, ToolWrapper } from '../core/helper.js';
import { createLogger } from '../core/logger.js';

// Create logger for organization operations
const log = createLogger('MCP:Tool:organization-commands');

/**
 * Registers organization management tools with the MCP server.
 *
 * This function adds four tools for organization operations:
 * - create-organization: Creates a new organization
 * - delete-organization: Permanently deletes an organization
 * - info-organization: Retrieves detailed information about an organization
 * - list-organization: Lists all organizations the user has access to
 *
 * @param adapter - The MCP adapter instance to register tools with
 *
 * @example
 * ```typescript
 * const server = new UpsunMcpServer();
 * registerOrganization(server);
 * ```
 */
export function registerOrganization(adapter: McpAdapter): void {
  log.info('Register Organization Handlers');

  /**
   * Tool: create-organization
   * Creates a new organization in Upsun.
   *
   * Organizations are top-level groupings for projects and users, with
   * their own billing settings and access controls.
   *
   * @param organization_name - The name for the new organization
   */
  if (adapter.isMode()) {
    adapter.server.tool(
      'create-organization',
      'Create a Organization on upsun',
      {
        organization_name: Schema.organizationName(),
      },
      ToolWrapper.trace('create-organization', async ({ organization_name }) => {
        log.debug(`Create Organization: ${organization_name}`);
        const result = await adapter.client.organizations.create(organization_name);

        return Response.json(result);
      })
    );
  }

  /**
   * Tool: delete-organization
   * Permanently deletes an organization and all its projects.
   *
   * @warning This operation is irreversible and will delete all projects,
   * environments, applications, and data associated with the organization.
   * It cannot be undone.
   *
   * @param organization_id - The unique identifier of the organization to delete
   */
  if (adapter.isMode()) {
    adapter.server.tool(
      'delete-organization',
      'Delete a Organization on upsun',
      {
        organization_id: Schema.organizationId(),
      },
      ToolWrapper.trace('delete-organization', async ({ organization_id }) => {
        log.debug(`Delete Organization: ${organization_id}`);
        const result = await adapter.client.organizations.delete(organization_id);

        return Response.json(result);
      })
    );
  }

  /**
   * Tool: info-organization
   * Retrieves detailed information about a specific organization.
   *
   * Returns comprehensive organization details including members, projects,
   * billing information, and configuration settings.
   *
   * @param organization_id - The unique identifier of the organization
   */
  adapter.server.tool(
    'info-organization',
    'Get information of organization on upsun',
    {
      organization_id: Schema.organizationId(),
    },
    ToolWrapper.trace('info-organization', async ({ organization_id }) => {
      log.debug(`Get Information of Organization: ${organization_id}`);
      const result = await adapter.client.organizations.info(organization_id);

      return Response.json(result);
    })
  );

  /**
   * Tool: list-organization
   * Lists all organizations the current user has access to.
   *
   * Returns an array of organizations with basic information such as
   * organization ID, name, owner, and number of projects.
   *
   * This tool doesn't require any parameters as it uses the authenticated
   * user's context to determine which organizations to list.
   */
  adapter.server.tool(
    'list-organization',
    'List all my organizations on upsun',
    {},
    ToolWrapper.trace('list-organization', async () => {
      log.debug(`List all my organizations`);
      const result = await adapter.client.organizations.list();

      return Response.json(result);
    })
  );
}
