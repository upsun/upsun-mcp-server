import { McpAdapter } from "../core/adapter.js";
import { z } from "zod";


export function registerOrganization(adapter: McpAdapter): void {
  console.log(`Register Organization Handlers`);

  adapter.server.tool(
    "create-organization",
    "Create a Organization on upsun",
    {
      organization_name: z.string()
    },
    async ({ organization_name }) => {
      const result = await adapter.client.organization.create(organization_name);

      return {
        content: [{
          type: "text",
          text: JSON.stringify(result, null, 2)
        }]
      };
    }
  );

  adapter.server.tool(
    "delete-organization",
    "Delete a Organization on upsun",
    {
      organization_id: z.string()
    },
    async ({ organization_id }) => {
      //const result = await adapter.client.organization.delete(organization_id);
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
    "info-organization",
    "Get information of organization on upsun",
    {
      organization_id: z.string()
    },
    async ({ organization_id }) => {
      const result = await adapter.client.organization.info(organization_id);

      return {
        content: [{
          type: "text",
          text: JSON.stringify(result, null, 2)
        }]
      };
    }
  );

  adapter.server.tool(
    "list-organization",
    "List all my organizations on upsun",
    {
      
    },
    async ({ }) => {
      const result = await adapter.client.organization.list();

      return {
        content: [{
          type: "text",
          text: JSON.stringify(result, null, 2)
        }]
      };
    }
  );
}