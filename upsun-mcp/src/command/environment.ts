import { McpAdapter } from "../core/adapter.js";
import { z } from "zod";


export function registerEnvironment(adapter: McpAdapter): void {  // , cliProvider: Client
    console.log(`Register Environment Handlers`);

    adapter.server.tool(
        "activate-environment",
        "Activate a environment of upsun projects",
        { 
            project_id: z.string(),
            environment_name: z.string()
        },
        async ({ project_id, environment_name }) => {
            const result = await adapter.client.environment.activate(project_id, environment_name);

            return {
                content: [{
                    type: "text",
                    text: JSON.stringify(result, null, 2)
                }]
            };
        }
    );

    adapter.server.tool(
        "delete-environment",
        "Delete a environment of upsun projects",
        { 
            project_id: z.string(),
            environment_name: z.string()
        },
        async ({ project_id, environment_name }) => {
            //const result = await adapter.client.environment.delete(project_id, environment_name);
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
        "info-environment",
        "Get information of environment on upsun projects",
        { 
            project_id: z.string(),
            environment_name: z.string()
        },
        async ({ project_id, environment_name }) => {
            const result = await adapter.client.environment.info(project_id, environment_name);

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
        { 
            project_id: z.string()
        },
        async ({ project_id }) => {
            const result = await adapter.client.environment.list(project_id);

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
        "Merge a environment to parent environment of upsun projects",
        { 
            project_id: z.string(),
            environment_name: z.string()
        },
        async ({ project_id, environment_name }) => {
            const result = await adapter.client.environment.merge(project_id, environment_name);

            return {
                content: [{
                    type: "text",
                    text: JSON.stringify(result, null, 2)
                }]
            };
        }
    )

    adapter.server.tool(
        "pause-environment",
        "Pause a environment of upsun projects",
        { 
            project_id: z.string(),
            environment_name: z.string()
        },
        async ({ project_id, environment_name }) => {
            const result = await adapter.client.environment.pause(project_id, environment_name);

            return {
                content: [{
                    type: "text",
                    text: JSON.stringify(result, null, 2)
                }]
            };
        }
    )

    adapter.server.tool(
        "redeploy-environment",
        "Redeploy a environment of upsun projects",
        { 
            project_id: z.string(),
            environment_name: z.string(),
            application_name: z.string()
        },
        async ({ project_id, environment_name }) => {
            const result = await adapter.client.environment.redeploy(project_id, environment_name);

            return {
                content: [{
                    type: "text",
                    text: JSON.stringify(result, null, 2)
                }]
            };
        }
    );

    adapter.server.tool(
        "resume-environment",
        "Resume a environment of upsun projects",
        { 
            project_id: z.string(),
            environment_name: z.string()
        },
        async ({ project_id, environment_name }) => {
            const result = await adapter.client.environment.resume(project_id, environment_name);

            return {
                content: [{
                    type: "text",
                    text: JSON.stringify(result, null, 2)
                }]
            };
        }
    )

    adapter.server.tool(
        "urls-environment",
        "Get URLs of environment on upsun projects",
        { 
            project_id: z.string(),
            environment_name: z.string()
        },
        async ({ project_id, environment_name }) => {
            const result = await adapter.client.environment.url(project_id, environment_name);

            return {
                content: [{
                    type: "text",
                    text: JSON.stringify(result, null, 2)
                }]
            };
        }
    )

}