import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { Transport } from "@modelcontextprotocol/sdk/shared/transport.js";
import { UpsunClient, UpsunConfig } from "upsun-sdk-node";

import * as pjson from '../package.json' with { type: 'json' };
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
  public readonly client!: UpsunClient;

  constructor(
    public readonly server: McpServer = new McpServer({
      name: "upsun-server",
      version: pjson.default.version
    }),
  ) {
    this.client = new UpsunClient({ apiKey: this.apikey } as UpsunConfig);

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
