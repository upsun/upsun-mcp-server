import { McpAdapter } from "../core/adapter.js";
import { Response, Schema } from "../core/helper.js";


export function registerOrganization(adapter: McpAdapter): void {
  console.log(`Register Organization Handlers`);

  adapter.server.tool(
    "create-organization",
    "Create a Organization on upsun",
    {
      organization_name: Schema.organizationName(),
    },
    async ({ organization_name }) => {
      const result = await adapter.client.organization.create(organization_name);

      return Response.json(result);
    }
  );

  adapter.server.tool(
    "delete-organization",
    "Delete a Organization on upsun",
    {
      organization_id: Schema.organizationId(),
    },
    async ({ organization_id }) => {
      const result = await adapter.client.organization.delete(organization_id);

      return Response.json(result);
    }
  );

  adapter.server.tool(
    "info-organization",
    "Get information of organization on upsun",
    {
      organization_id: Schema.organizationId(),
    },
    async ({ organization_id }) => {
      const result = await adapter.client.organization.info(organization_id);

      return Response.json(result);
    }
  );

  adapter.server.tool(
    "list-organization",
    "List all my organizations on upsun",
    {

    },
    async ({ }) => {
      const result = await adapter.client.organization.list();

      return Response.json(result);
    }
  );
}
