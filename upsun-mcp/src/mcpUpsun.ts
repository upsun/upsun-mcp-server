import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { Transport } from "@modelcontextprotocol/sdk/shared/transport.js";
import { z } from "zod";

import { McpAdapter } from "./core/adapter.js";
// import Client, { ClientConfiguration } from 'platformsh-client';

/**
 * UpsunMcpServer class
 * 
 */
export class UpsunMcpServer implements McpAdapter {

    constructor(
        public readonly server : McpServer = new McpServer({
          name: "upsun-server",
          version: "0.1.0"
        })
      ) {
        // const upsunClient...

        this.server.tool("get-projects",
            "List of all upsun projects",
            { orgId: z.string() },
            async ({ orgId }) => {
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
      }


    connect(transport: Transport): Promise<void> {
        return this.server.connect(transport);
    }
}
