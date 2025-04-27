import { Transport } from "@modelcontextprotocol/sdk/shared/transport.js";

/**
 * McpAdapter interface
 * @description This interface defines the methods that an MCP server adapter must implement.
 * It includes a method for connecting to a transport.
 * @interface McpAdapter
 */
export interface McpAdapter {
  
  connect(transport: Transport): Promise<void>;
}
