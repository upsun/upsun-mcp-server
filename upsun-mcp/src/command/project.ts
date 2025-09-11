/**
 * @fileoverview Project management command module for Upsun MCP server.
 *
 * This module provides Methods for managing Upsun projects, including creation,
 * deletion, information retrieval, and listing operations. Projects are the
 * top-level containers for applications and environments in the Upsun platform.
 */

import { SubscriptionStatusEnum } from "upsun-sdk-node/dist/apis-gen/models/Subscription.js";
import { McpAdapter } from "../core/adapter.js";
import { Response, Schema } from "../core/helper.js";
import { z } from "zod";


/**
 * Registers project management tools with the MCP server.
 * 
 * This function adds four tools to the MCP server for project operations:
 * - create-project: Creates a new Upsun project within an organization
 * - delete-project: Permanently deletes a project and all its resources
 * - info-project: Retrieves detailed information about a specific project
 * - list-project: Lists all projects within an organization
 * 
 * @param adapter - The MCP adapter instance to register tools with
 * 
 * @example
 * ```typescript
 * const server = new UpsunMcpServer();
 * registerProject(server);
 * ```
 */
export function registerProject(adapter: McpAdapter): void {
  console.log(`[MCP] Register Project Handlers`);

  /**
   * Tool: create-project
   * Creates a new Upsun project within the specified organization.
   * 
   * @param organization_id - The organization ID where the project will be created
   * @param region_host - The cloud region where the project will be deployed
   * @param name - The name of the new project
   * @param default_branch - The default Git branch (optional, defaults to "main")
   */
  adapter.server.tool(
    "create-project",
    "Create a new upsun project",
    {
      organization_id: Schema.organizationId(),
      //region_host: z.string().default("eu-5.platform.sh").optional(),
      name: z.string(),
      default_branch: z.string().default("main").optional()
    },
    async ({ organization_id, name, default_branch }) => {
      const region_host = "eu-5.platform.sh";
      const subCreated = await adapter.client.project.create(organization_id, region_host, name, default_branch); // region, default_branch

      let prjCreated = await adapter.client.project.getSubscription(organization_id, subCreated.id || "");
      while (prjCreated.status !== SubscriptionStatusEnum.Active) {
        console.log("Waiting for project to be active...");
        await delay(10000);
        prjCreated = await adapter.client.project.getSubscription(organization_id, subCreated.id || "");
      }
      
      return Response.json(prjCreated);
    }
  );

  /**
   * Tool: delete-project
   * Permanently deletes a Upsun project and all its associated resources.
   * 
   * @warning This operation is irreversible and will delete all environments,
   * applications, data, and configurations associated with the project.
   * 
   * @param project_id - The unique identifier of the project to delete
   */
  adapter.server.tool(
    "delete-project",
    "Delete a upsun project",
    {
      project_id: Schema.projectId(),
    },
    async ({ project_id }) => {
      const result = await adapter.client.project.delete(project_id);

      return Response.json(result);
    }
  );

  /**
   * Tool: info-project
   * Retrieves detailed information about a specific Upsun project.
   * 
   * Returns comprehensive project details including configuration,
   * environments, applications, and metadata.
   * 
   * @param project_id - The unique identifier of the project
   */
  adapter.server.tool(
    "info-project",
    "Get information of upsun project",
    {
      project_id: Schema.projectId(),
    },
    async ({ project_id }) => {
      const result = await adapter.client.project.info(project_id);

      return Response.json(result);
    }
  );

  /**
   * Tool: list-project
   * Lists all projects within a specific organization.
   * 
   * Returns an array of projects with basic information such as
   * project ID, name, status, and creation date.
   * 
   * @param organization_id - The organization ID to list projects from
   */
  adapter.server.tool(
    "list-project",
    "List all upsun projects",
    {
      organization_id: Schema.organizationId(),
    },
    async ({ organization_id }) => {
      const result = await adapter.client.project.list(organization_id);

      return Response.json(result);
    }
  );

}
function delay(ms: number) {
  return new Promise( resolve => setTimeout(resolve, ms) );
}

