import { McpAdapter } from "../core/adapter.js";
import { Response, Schema } from "../core/helper.js";
import { z } from "zod";


export function registerProject(adapter: McpAdapter): void {  // , cliProvider: Client
  console.log(`Register Project Handlers`);

  adapter.server.tool(
    "create-project",
    "Create a new upsun project",
    {
      organization_id: Schema.organizationId(),
      region: z.string(),
      name: z.string(),
      default_branch: z.string().default("main").optional()
    },
    async ({ organization_id, region, name, default_branch }) => {
      const result = await adapter.client.project.create(organization_id, name); // region, default_branch

      return Response.json(result);
    }
  );

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

  adapter.server.tool(
    "list-project",                           // Name of tool
    "List all upsun projects",                // Text to indicate on LLM target and call
    {                                         // Parameter of this tool
      organization_id: Schema.organizationId(),
    },
    async ({ organization_id }) => {          // Main function
      const result = await adapter.client.project.list(organization_id);

      return Response.json(result);
    }
  );

}
