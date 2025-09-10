import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { Transport } from "@modelcontextprotocol/sdk/shared/transport.js";
import { UpsunClient } from "upsun-sdk-node";

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
   * @deprecated Use createClient() instead to ensure fresh authentication
   */
  readonly client: UpsunClient;

  /**
   * The current bearer token for the active request.
   * This is set by the gateway for each request and used by tools to create fresh clients.
   */
  currentBearerToken?: string;

  /**
   * Creates a new Upsun client with the provided API key.
   * This should be called for each tool invocation to ensure fresh authentication.
   * 
   * @param apiKey - The API key for authenticating with Upsun platform
   * @returns A new UpsunClient instance configured with the API key
   */
  createClient(apiKey: string): UpsunClient;

  /**
   * Creates a new Upsun client using the current bearer token.
   * This is a convenience method that uses the currentBearerToken property.
   * 
   * @returns A new UpsunClient instance configured with the current bearer token
   * @throws Error if no current bearer token is set
   */
  createCurrentClient(): UpsunClient;

  /**
   * Sets the current bearer token for this adapter instance.
   * This is called by the gateway before each tool invocation.
   * 
   * @param token - The bearer token to set as current
   */
  setCurrentBearerToken(token: string): void;

  /**
   * Establishes a connection between the MCP server and transport layer.
   * 
   * This method initializes the MCP server with the provided transport and
   * configures the Upsun client with the API key for authentication.
   * 
   * @param transport - The transport layer for MCP communication (stdio, HTTP, etc.)
   * @param apiKey - The API key for authenticating with Upsun platform
   * @returns A Promise that resolves when the connection is established
   * @throws May throw errors if connection fails or API key is invalid
   */
  connect(transport: Transport, apiKey: string): Promise<void>;
}
