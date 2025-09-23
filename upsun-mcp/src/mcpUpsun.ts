import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { Transport } from '@modelcontextprotocol/sdk/shared/transport.js';
import { UpsunClient, UpsunConfig } from 'upsun-sdk-node';

import * as pjson from '../package.json' with { type: 'json' };
import { McpAdapter } from './core/adapter.js';
import { createLogger } from './core/logger.js';

// Create logger for MCP operations
const log = createLogger('mcp-server');

import {
  registerActivity,
  registerBackup,
  registerCertificate,
  registerDomain,
  registerEnvironment,
  registerOrganization,
  registerProject,
  registerRoute,
  registerSshKey,
} from './command/index.js';
import { registerConfig } from './task/config.js';

/**
 * Upsun MCP Server implementation.
 *
 * This class implements the McpAdapter interface to provide a Model Context Protocol
 * server for the Upsun platform. It integrates the Upsun SDK with the MCP framework
 * to expose Upsun platform functionality as MCP tools.
 *
 * The server automatically registers all available command modules during construction,
 * providing a comprehensive set of tools for managing Upsun projects, environments,
 * deployments, and other platform resources.
 *
 * @implements {McpAdapter}
 */
export class UpsunMcpServer implements McpAdapter {
  /**
   * The Upsun SDK client instance.
   *
   * This client is initialized during the connect() method and provides
   * access to all Upsun platform APIs. It's used by the registered command
   * modules to perform operations on behalf of MCP clients.
   */
  public client!: UpsunClient;

  /**
   * The current bearer token for the active request.
   * This is set by the gateway for each request and used by tools to create fresh clients.
   */
  public currentBearerToken?: string;

  /**
   * Creates a new UpsunMcpServer instance.
   *
   * Initializes the MCP server with the package name and version, then registers
   * all available command modules. Each command module adds specific tools and
   * capabilities related to different aspects of the Upsun platform.
   *
   * @param server - Optional MCP server instance (creates new one if not provided)
   *
   * @example
   * ```typescript
   * const mcpServer = new UpsunMcpServer();
   * await mcpServer.connect(transport, "your-api-key");
   * ```
   */
  constructor(
    public mode: string | undefined = 'readonly',
    public readonly server: McpServer = new McpServer({
      name: 'upsun-server',
      version: pjson.default.version,
    })
  ) {
    // Register all command modules with their respective tools
    registerActivity(this);
    registerBackup(this);
    registerCertificate(this);
    registerDomain(this);
    registerEnvironment(this);
    registerOrganization(this);
    registerProject(this);
    registerRoute(this);
    registerSshKey(this);

    // Register all tasks with their respective prompts
    registerConfig(this);
  }

  /**
   * Sets the current bearer token for this adapter instance.
   * This is called by the gateway before each tool invocation.
   *
   * @param token - The bearer token to set as current
   *
   * @example
   * ```typescript
   * server.setCurrentBearerToken('your-bearer-token');
   * ```
   */
  setCurrentBearerToken(token: string): void {
    this.currentBearerToken = token;
  }

  /**
   * Establishes connection between the MCP server and transport layer using a Bearer token.
   *
   * This method initializes the Upsun client with the provided Bearer token and
   * connects the MCP server to the specified transport. The transport handles
   * the actual communication protocol (stdio, HTTP, SSE, etc.).
   *
   * @param transport - The transport layer for MCP communication
   * @param bearerToken - The Bearer token for authentication
   * @returns Promise that resolves when connection is established
   *
   * @throws Will throw an error if the Bearer token is invalid or connection fails
   *
   * @example
   * ```typescript
   * const transport = new StdioServerTransport();
   * await server.connectWithBearer(transport, 'bearer-token-123');
   * ```
   */
  connectWithBearer(transport: Transport, bearerToken: string): Promise<void> {
    log.info('Connecting with Bearer token authentication');
    this.client = new UpsunClient();
    this.client.setBearerToken(bearerToken);
    return this.server.connect(transport);
  }

  /**
   * Establishes connection between the MCP server and transport layer using an API key.
   *
   * This method initializes the Upsun client with the provided API key and
   * connects the MCP server to the specified transport. The API key will be
   * processed differently than Bearer tokens within the Upsun client library.
   *
   * @param transport - The transport layer for MCP communication
   * @param apiKey - The API key for authentication
   * @returns Promise that resolves when connection is established
   *
   * @throws Will throw an error if the API key is invalid or connection fails
   *
   * @example
   * ```typescript
   * const transport = new StdioServerTransport();
   * await server.connectWithApiKey(transport, 'api-key-456');
   * ```
   */
  connectWithApiKey(transport: Transport, apiKey: string): Promise<void> {
    log.info('Connecting with API key authentication');
    // TODO: Different processing for API key will be handled in Upsun client library
    this.client = new UpsunClient({ apiKey } as UpsunConfig);
    return this.server.connect(transport);
  }

  isMode(): boolean {
    if (this.mode === undefined) {
      this.mode = 'readonly';
    }
    return this.mode !== 'readonly';
  }
}
