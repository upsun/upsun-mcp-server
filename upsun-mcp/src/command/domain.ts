import { McpAdapter } from "../core/adapter.js";
import { Response, Schema } from "../core/helper.js";


export function registerDomain(adapter: McpAdapter): void {
  console.log(`Register Domain Handlers`);

  adapter.server.tool(
    "add-domain",
    "Add Domain on upsun project",
    {
      project_id: Schema.projectId(),
      domain_name: Schema.domainName(),
    },
    async ({ project_id, domain_name }) => {
      const result = "TODO"; //await adapter.client.backup.create(project_id, environment_name);

      return Response.json(result);
    }
  );

  adapter.server.tool(
    "delete-domain",
    "Delete a Domain on upsun project",
    {
      project_id: Schema.projectId(),
      domain_name: Schema.domainName(),
    },
    async ({ project_id, domain_name }) => {
      const result = "TODO"; //await adapter.client.backup.create(project_id, environment_name);

      return Response.json(result);
    }
  );

  adapter.server.tool(
    "get-domain",
    "Get a Domain of upsun project",
    {
      project_id: Schema.projectId(),
      domain_name: Schema.domainName(),
    },
    async ({ project_id, domain_name }) => {
      const result = "TODO"; //await adapter.client.backup.list(project_id, environment_name);

      return Response.json(result);
    }
  );

  adapter.server.tool(
    "list-domain",
    "List all Domains of upsun project",
    {
      project_id: Schema.projectId(),
    },
    async ({ project_id }) => {
      const result = "TODO"; //await adapter.client.backup.list(project_id, environment_name);

      return Response.json(result);
    }
  );

  adapter.server.tool(
    "update-domain",
    "Update a Domain of upsun project",
    {
      project_id: Schema.projectId(),
      domain_name: Schema.domainName(),
    },
    async ({ project_id, domain_name }) => {
      const result = "TODO"; //await adapter.client.backup.list(project_id, environment_name);

      return Response.json(result);
    }
  );

}
