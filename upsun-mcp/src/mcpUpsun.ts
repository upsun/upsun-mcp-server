import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { Transport } from "@modelcontextprotocol/sdk/shared/transport.js";

import { McpAdapter } from "./core/adapter.js";
import {
  registerActivity,
  registerEnvironment,
  registerOrganization,
  registerProject,
  registerRoute
} from "./command/index.js";

/**
 * UpsunMcpServer class
 * 
 */
export class UpsunMcpServer implements McpAdapter {

  public readonly apikey!: string;

  constructor(
    public readonly server: McpServer = new McpServer({
      name: "upsun-server",
      version: "0.1.0"
    }),
  ) {
    registerActivity(this);
    registerEnvironment(this);
    registerOrganization(this);
    registerProject(this);
    registerRoute(this);
  }

  connect(transport: Transport): Promise<void> {
    return this.server.connect(transport);
  }
}
