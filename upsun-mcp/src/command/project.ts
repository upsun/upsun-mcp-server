import Client, { Organization } from "platformsh-client";
import { McpAdapter } from "../core/adapter.js";
import { z } from "zod";

export function registerProject(adapter: McpAdapter): void {  // , cliProvider: Client
    console.debug(`Register Project Handlers`);

    adapter.server.tool(
        "project-list",                 // Name of tool
        "List of all upsun projects",   // Text to indicate on LLM target and call
        { organization_id: z.string() },          // Parameter of this tool
        async ({ organization_id }) => {          // Main function
            const projects = [
                { id: "azertyhex", name: "Project 1" },
                { id: "quertyhex", name: "Project 2" },
                { id: "foobarhex", name: "Project 3" },
            ]

            return {
                content: [{
                    type: "text",
                    text: JSON.stringify(projects.slice(0, 100), null, 2)
                }]
            };
        }
    );

    adapter.server.tool(
        "project-info",
        "Get information of upsun project",
        { project_id: z.string() },
        async ({ project_id }) => {
            const project = { id: "azertyhex", name: "Project 1", state: "enabled" };

            return {
                content: [{
                    type: "text",
                    text: JSON.stringify(project, null, 2)
                }]
            };
        }
    );

    adapter.server.tool(
        "project-create",
        "Create a new upsun project",
        { 
            organization_id: z.string(),
            region: z.string(),
            title: z.string(),
            defaultBranch: z.string().default("main").optional()
        },
        async ({ organization_id, region, title, defaultBranch }) => {
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
        "project-delete",
        "Delete a upsun project",
        { 
            project_id: z.string(),
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
