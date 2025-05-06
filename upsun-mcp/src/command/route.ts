import { UpsunClient, UpsunConfig } from "upsun-sdk-node";
import { McpAdapter } from "../core/adapter.js";
import { z } from "zod";


export function registerRoute(adapter: McpAdapter): void {  // , cliProvider: Client
  console.log(`Register Route Handlers`);

  adapter.server.tool(
    "get-route",
    "Get route URL of upsun project",
    {
      project_id: z.string(),
      environment_name: z.string(),
      route_id: z.string().optional()
    },
    async ({ project_id,environment_name, route_id }) => {
      const client = new UpsunClient({ apiKey: adapter.apikey } as UpsunConfig);
      const result = (await client.route.get(project_id, environment_name, route_id || ''));

      return {
        content: [{
          type: "text",
          text: JSON.stringify(result, null, 2)
        }]
      };
    }
  );

  adapter.server.tool(
    "list-route",
    "List routes URL of upsun project",
    {
      project_id: z.string(),
      environment_name: z.string()
    },
    async ({ project_id,environment_name }) => {
      const client = new UpsunClient({ apiKey: adapter.apikey } as UpsunConfig);
      const result = (await client.route.list(project_id, environment_name));

      return {
        content: [{
          type: "text",
          text: JSON.stringify(result, null, 2)
        }]
      };
    }
  );

  adapter.server.tool(
    "get-console",
    "Get console URL of upsun project",
    {
      project_id: z.string()
    },
    async ({ project_id }) => {
      const client = new UpsunClient({ apiKey: adapter.apikey } as UpsunConfig);
      const result = (await client.route.web(project_id)).ui;

      return {
        content: [{
          type: "text",
          text: JSON.stringify(result, null, 2)
        }]
      };
    }
  );
}