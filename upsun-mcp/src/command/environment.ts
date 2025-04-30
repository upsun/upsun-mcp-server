import Client from "platformsh-client";
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
        "deactivate-environment",
        "Deactivate a environment of upsun projects",
        { 
            project_id: z.string(),
            environment_name: z.string()
        },
        async ({ project_id, environment_name }) => {
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
        "list-environment",
        "List all environments of upsun projects",
        { project_id: z.string() },
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
        "redeploy-environment",
        "Redeploy a environment of upsun projects",
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

}