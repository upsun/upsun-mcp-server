import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { Transport } from "@modelcontextprotocol/sdk/shared/transport.js";


import { McpAdapter } from "./core/adapter.js";
import Client, { ClientConfiguration } from 'platformsh-client';
import { registerProject } from "./command/project.js";
import { registerEnvironment } from "./command/environment.js";

/**
 * UpsunMcpServer class
 * 
 */
export class UpsunMcpServer implements McpAdapter {

    constructor(
        public readonly server : McpServer = new McpServer({
          name: "upsun-server",
          version: "0.1.0"
        }),
        // public readonly upsunClient: Client = new Client({
        //   api_token: "",
        //   redirect_uri: ""
        // } as ClientConfiguration)
      ) {

        registerProject(this);
        registerEnvironment(this);
        
      }


    connect(transport: Transport): Promise<void> {
        return this.server.connect(transport);
    }
}
