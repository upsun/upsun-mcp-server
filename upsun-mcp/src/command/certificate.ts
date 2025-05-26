import { McpAdapter } from "../core/adapter.js";
import { Response, Schema } from "../core/helper.js";
import { z } from "zod";


export function registerCertificate(adapter: McpAdapter): void {
  console.log(`Register Certificate Handlers`);

  adapter.server.tool(
    "add-certificate",
    "Add an SSL/TLS certificate of upsun project",
    {
      project_id: Schema.projectId(),
      certificate: z.string(),
      key: z.string(),
      chain: z.string(),
    },
    async ({ project_id, certificate, key, chain }) => {
      const result = "TODO"; //await adapter.client.backup.create(project_id, environment_name);

      return Response.json(result);
    }
  );

  adapter.server.tool(
    "delete-certificate",
    "Delete an SSL/TLS certificate of upsun project",
    {
      project_id: Schema.projectId(),
      certificate_id: Schema.certificateId(),
    },
    async ({ project_id, certificate_id }) => {
      const result = "TODO"; //await adapter.client.backup.create(project_id, environment_name);

      return Response.json(result);
    }
  );

  adapter.server.tool(
    "get-certificate",
    "Get an SSL/TLS certificate of upsun project",
    {
      project_id: Schema.projectId(),
      certificate_id: Schema.certificateId(),
    },
    async ({ project_id, certificate_id }) => {
      const result = "TODO"; //await adapter.client.backup.create(project_id, environment_name);

      return Response.json(result);
    }
  );

  adapter.server.tool(
    "list-certificate",
    "List all SSL/TLS certificates of upsun project",
    {
      project_id: Schema.projectId(),
    },
    async ({ project_id }) => {
      const result = "TODO"; //await adapter.client.backup.create(project_id, environment_name);

      return Response.json(result);
    }
  );

}
