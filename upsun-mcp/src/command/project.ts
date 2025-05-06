import { UpsunClient, UpsunConfig } from "upsun-sdk-node";
import { McpAdapter } from "../core/adapter.js";
import { z } from "zod";


export function registerProject(adapter: McpAdapter): void {  // , cliProvider: Client
  console.log(`Register Project Handlers`);

  adapter.server.tool(
    "create-project",
    "Create a new upsun project",
    {
      organization_id: z.string(),
      region: z.string(),
      name: z.string(),
      default_branch: z.string().default("main").optional()
    },
    async ({ organization_id, region, name, default_branch }) => {
      const client = new UpsunClient({ apiKey: adapter.apikey } as UpsunConfig);
      const result = await client.project.create(organization_id, name); // region, default_branch

      return {
        content: [{
          type: "text",
          text: JSON.stringify(result, null, 2)
        }]
      };
    }
  );

  adapter.server.tool(
    "delete-project",
    "Delete a upsun project",
    {
      project_id: z.string(),
    },
    async ({ project_id }) => {
      const client = new UpsunClient({ apiKey: adapter.apikey } as UpsunConfig);
      //const result = await client.project.delete(project_id);
      const result = "Not implemented (too dangerous)";

      return {
        content: [{
          type: "text",
          text: JSON.stringify(result, null, 2)
        }]
      };
    }
  );

  adapter.server.tool(
    "info-project",
    "Get information of upsun project",
    { project_id: z.string() },
    async ({ project_id }) => {
      const client = new UpsunClient({ apiKey: adapter.apikey } as UpsunConfig);
      const project = await client.project.info(project_id);

      return {
        content: [{
          type: "text",
          text: JSON.stringify(project, null, 2)
        }]
      };
    }
  );

  adapter.server.tool(
    "list-project",                 // Name of tool
    "List of all upsun projects",   // Text to indicate on LLM target and call
    { organization_id: z.string() },          // Parameter of this tool
    async ({ organization_id }) => {          // Main function
      const client = new UpsunClient({ apiKey: adapter.apikey } as UpsunConfig);
      const projects = await client.project.list(`name=${organization_id}`);

      return {
        content: [{
          type: "text",
          text: JSON.stringify(projects, null, 2)
        }]
      };
    }
  );

  
}
