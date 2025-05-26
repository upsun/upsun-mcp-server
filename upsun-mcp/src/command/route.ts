import { McpAdapter } from "../core/adapter.js";
import { Response, Schema } from "../core/helper.js";
import { z } from "zod";


export function registerRoute(adapter: McpAdapter): void {
  console.log(`Register Route Handlers`);

  adapter.server.tool(
    "get-route",
    "Get route URL of upsun project",
    {
      project_id: Schema.projectId(),
      environment_name: Schema.environmentName(),
      route_id: z.string().optional(),
    },
    async ({ project_id, environment_name, route_id }) => {
      const result = (await adapter.client.route.get(project_id, environment_name, route_id || ''));

      return Response.json(result);
    }
  );

  adapter.server.tool(
    "list-route",
    "List routes URL of upsun project",
    {
      project_id: Schema.projectId(),
      environment_name: Schema.environmentName(),
    },
    async ({ project_id, environment_name }) => {
      const result = await adapter.client.route.list(project_id, environment_name);

      return Response.json(result);
    }
  );

  adapter.server.tool(
    "get-console",
    "Get console URL of upsun project",
    {
      project_id: Schema.projectId(),
    },
    async ({ project_id }) => {
      const result = (await adapter.client.route.web(project_id)).ui;

      return Response.json(result);
    }
  );
}
