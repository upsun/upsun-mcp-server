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
import { registerConfig } from "./task/config.js";

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
    public readonly server: McpServer = new McpServer({
      name: "upsun-server",
      version: pjson.default.version,
    }),
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
   * Creates a new Upsun client with the provided API key.
   * This method should be called for each tool invocation to ensure fresh authentication.
   * 
   * @param apiKey - The API key for authenticating with Upsun platform
   * @returns A new UpsunClient instance configured with the API key
   * 
   * @example
   * ```typescript
   * const client = server.createClient(bearerToken);
   * const projects = await client.project.list(orgId);
   * ```
   */
  createClient(apiKey: string): UpsunClient {
    return new UpsunClient({ apiKey } as UpsunConfig);
  }

  /**
   * Creates a new Upsun client using the current bearer token.
   * This is a convenience method that uses the currentBearerToken property.
   * 
   * @returns A new UpsunClient instance configured with the current bearer token
   * @throws Error if no current bearer token is set
   * 
   * @example
   * ```typescript
   * const client = server.createCurrentClient();
   * const projects = await client.project.list(orgId);
   * ```
   */
  createCurrentClient(): UpsunClient {
    if (!this.currentBearerToken) {
      throw new Error('No current bearer token set. Call setCurrentBearerToken() first.');
    }
    return this.createClient(this.currentBearerToken);
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
   * Establishes connection between the MCP server and transport layer.
   * 
   * This method initializes the Upsun client with the provided API key and
   * connects the MCP server to the specified transport. The transport handles
   * the actual communication protocol (stdio, HTTP, SSE, etc.).
   * 
   * @param transport - The transport layer for MCP communication
   * @param apiKey - The Upsun API key for authentication
   * @returns Promise that resolves when connection is established
   * 
   * @throws Will throw an error if the API key is invalid or connection fails
   * 
   * @example
   * ```typescript
   * const transport = new StdioServerTransport();
   * await server.connect(transport, process.env.UPSUN_API_KEY);
   * ```
   */
  connect(transport: Transport, apiKey: string): Promise<void> {
    this.client = new UpsunClient({ apiKey } as UpsunConfig);
    return this.server.connect(transport);
  }
}
