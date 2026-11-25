import type { McpServer } from '@modelcontextprotocol/server';
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
   * Whether the caller's token has a user (not a `client_credentials` token).
   * False for machine tokens such as client_credentials, and before auth is set.
   */
  readonly hasUser: boolean;

  /** Sets the Upsun client to authenticate with a Bearer token. */
  useBearerToken(bearerToken: string, hasUser: boolean): void;

  /** Sets the Upsun client to authenticate with an API key. */
  useApiKey(apiKey: string): void;

  isMode(): boolean;
}
