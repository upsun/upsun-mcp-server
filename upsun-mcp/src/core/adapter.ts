import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { Transport } from '@modelcontextprotocol/sdk/shared/transport.js';
import { UpsunClient } from 'upsun-sdk-node';

/**
 * MCP adapter interface for Upsun integration.
 *
 * This interface defines the contract that an MCP server adapter must implement
 * to provide integration with the Upsun platform. It encapsulates both the MCP
 * server instance and the Upsun client, along with the connection logic.
 *
 * @interface McpAdapter
 */
export interface McpAdapter {
  /**
   * The MCP server instance.
   * Handles incoming MCP protocol requests and responses.
   */
  readonly server: McpServer;

  /**
   * The Upsun SDK client instance.
   * Provides access to Upsun platform APIs for managing projects, environments, etc.
   */
  readonly client: UpsunClient;

  /**
   * Establishes a connection between the MCP server and transport layer using a Bearer token.
   *
   * This method initializes the MCP server with the provided transport and
   * configures the Upsun client with the Bearer token for authentication.
   *
   * @param transport - The transport layer for MCP communication (stdio, HTTP, etc.)
   * @param bearerToken - The Bearer token for authenticating with Upsun platform
   * @returns A Promise that resolves when the connection is established
   * @throws May throw errors if connection fails or Bearer token is invalid
   */
  connectWithBearer(transport: Transport, bearerToken: string): Promise<void>;

  /**
   * Establishes a connection between the MCP server and transport layer using an API key.
   *
   * This method initializes the MCP server with the provided transport and
   * configures the Upsun client with the API key for authentication. The API key
   * will be processed differently than Bearer tokens (e.g., exchanged for a token).
   *
   * @param transport - The transport layer for MCP communication (stdio, HTTP, etc.)
   * @param apiKey - The API key for authenticating with Upsun platform
   * @returns A Promise that resolves when the connection is established
   * @throws May throw errors if connection fails or API key is invalid
   */
  connectWithApiKey(transport: Transport, apiKey: string): Promise<void>;

  isMode(): boolean;
}
