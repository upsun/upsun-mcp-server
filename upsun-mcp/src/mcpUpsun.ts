import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { Transport } from "@modelcontextprotocol/sdk/shared/transport.js";
import { UpsunClient, UpsunConfig } from "upsun-sdk-node";

import * as pjson from '../package.json' with { type: 'json' };
import { McpAdapter } from "./core/adapter.js";
import {
  registerActivity,
  registerBackup,
  registerCertificate,
  registerDomain,
  registerEnvironment,
  registerOrganization,
  registerProject,
  registerRoute,
  registerSshKey
} from "./command/index.js";

/**
 * UpsunMcpServer class
 * 
 */
export class UpsunMcpServer implements McpAdapter {

  public client!: UpsunClient;

  constructor(
    public readonly server: McpServer = new McpServer({
      name: "upsun-server",
      version: pjson.default.version
    }),
  ) {

    registerActivity(this);
    registerBackup(this);
    registerCertificate(this);
    registerDomain(this);
    registerEnvironment(this);
    registerOrganization(this);
    registerProject(this);
    registerRoute(this);
    registerSshKey(this);
  }

  connect(transport: Transport, apiKey: string): Promise<void> {
    this.client = new UpsunClient({ apiKey } as UpsunConfig);
    return this.server.connect(transport);
  }
}
