import { UpsunClient, UpsunConfig } from "upsun-sdk-node";
import { McpAdapter } from "../core/adapter.js";
import { z } from "zod";


export function registerActivity(adapter: McpAdapter): void {
    console.log(`Register Activity Handlers`);

    adapter.server.tool(
        "cancel-activity",
        "Cancel a activity of upsun project",
        { 
            project_id: z.string(),
            activity_id: z.string()
        },
        async ({ project_id, activity_id }) => {
            const client = new UpsunClient({ apiKey: adapter.apikey } as UpsunConfig);
            const result = await client.activity.cancel(project_id, activity_id);

            return {
                content: [{
                    type: "text",
                    text: JSON.stringify(result, null, 2)
                }]
            };
        }
    );

    adapter.server.tool(
        "get-activity",
        "Get detail of activity on upsun project",
        { 
            project_id: z.string(),
            activity_id: z.string()
        },
        async ({ project_id, activity_id }) => {
            const client = new UpsunClient({ apiKey: adapter.apikey } as UpsunConfig);
            const result = await client.activity.get(project_id, activity_id);

            return {
                content: [{
                    type: "text",
                    text: JSON.stringify(result, null, 2)
                }]
            };
        }
    );

    adapter.server.tool(
        "list-activity",
        "List all activities of upsun project",
        { 
            project_id: z.string()
        },
        async ({ project_id }) => {
            const client = new UpsunClient({ apiKey: adapter.apikey } as UpsunConfig);
            const result = await client.activity.list(project_id);

            return {
                content: [{
                    type: "text",
                    text: JSON.stringify(result, null, 2)
                }]
            };
        }
    );

    adapter.server.tool(
        "log-activity",
        "Get log activity of upsun project",
        { 
            project_id: z.string(),
            activity_id: z.string()
        },
        async ({ project_id, activity_id }) => {
            const client = new UpsunClient({ apiKey: adapter.apikey } as UpsunConfig);
            //const result = await client.activity.log(project_id, activity_id);
            const result = "Not implemented";

            return {
                content: [{
                    type: "text",
                    text: JSON.stringify(result, null, 2)
                }]
            };
        }
    );
}