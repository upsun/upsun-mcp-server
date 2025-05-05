import { UpsunClient, UpsunConfig } from "upsun-sdk-node";
import { McpAdapter } from "../core/adapter.js";
import { z } from "zod";

export function registerEnvironment(adapter: McpAdapter): void {  // , cliProvider: Client
    console.debug(`Register Environment Handlers`);

    adapter.server.tool(
        "activate-environment",
        "Activate a environment of upsun projects",
        { 
            project_id: z.string(),
            environment_name: z.string()
        },
        async ({ project_id, environment_name }) => {
            const client = new UpsunClient({ apiKey: adapter.apikey } as UpsunConfig);
            const result = await client.environment.activate(project_id, environment_name);

            return {
                content: [{
                    type: "text",
                    text: JSON.stringify(result, null, 2)
                }]
            };
        }
    );

    adapter.server.tool(
        "deactivate-environment",
        "Deactivate a environment of upsun projects",
        { 
            project_id: z.string(),
            environment_name: z.string()
        },
        async ({ project_id, environment_name }) => {
            const client = new UpsunClient({ apiKey: adapter.apikey } as UpsunConfig);
            const result = await client.environment.pause(project_id, environment_name);

            return {
                content: [{
                    type: "text",
                    text: JSON.stringify(result, null, 2)
                }]
            };
        }
    );

    adapter.server.tool(
        "list-environment",
        "List all environments of upsun projects",
        { project_id: z.string() },
        async ({ project_id }) => {
            const client = new UpsunClient({ apiKey: adapter.apikey } as UpsunConfig);
            const result = await client.environment.list(project_id);

            return {
                content: [{
                    type: "text",
                    text: JSON.stringify(result, null, 2)
                }]
            };
        }
    );

    adapter.server.tool(
        "logs-environment",
        "Display logs of app of upsun projects",
        { 
            project_id: z.string(),
            environment_name: z.string(),
            application_name: z.string()
        },
        async ({ project_id }) => {
            const result = { throw: "Not implemented !" };

            return {
                content: [{
                    type: "text",
                    text: JSON.stringify(result, null, 2)
                }]
            };
        }
    );

    adapter.server.tool(
        "merge-environment",
        "Merge a environment of upsun projects into parent",
        { 
            project_id: z.string(),
            environment_name: z.string(),
        },
        async ({ project_id, environment_name }) => {
            const client = new UpsunClient({ apiKey: adapter.apikey } as UpsunConfig);
            const result = await client.environment.merge(project_id, environment_name);

            return {
                content: [{
                    type: "text",
                    text: JSON.stringify(result, null, 2)
                }]
            };
        }
    );

    adapter.server.tool(
        "redeploy-environment",
        "Redeploy a environment of upsun projects",
        { 
            project_id: z.string(),
            environment_name: z.string(),
            application_name: z.string()
        },
        async ({ project_id, environment_name }) => {
            const client = new UpsunClient({ apiKey: adapter.apikey } as UpsunConfig);
            const result = await client.environment.redeploy(project_id, environment_name);

            return {
                content: [{
                    type: "text",
                    text: JSON.stringify(result, null, 2)
                }]
            };
        }
    );

}