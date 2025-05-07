import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { Transport } from "@modelcontextprotocol/sdk/shared/transport.js";
import { UpsunClient } from "upsun-sdk-node";

/**
 * McpAdapter interface
 * @description This interface defines the methods that an MCP server adapter must implement.
 * It includes a method for connecting to a transport.
 * @interface McpAdapter
 */
export interface McpAdapter {
  apikey: string;
  readonly server : McpServer;
  readonly client: UpsunClient;
  connect(transport: Transport): Promise<void>;
}
