import * as core from 'express-serve-static-core';
import express from 'express';

import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';

import { McpAdapter } from './adapter.js';
import { setupOAuth2Direct, WritableMode } from './authentication.js';
import { createLogger } from './logger.js';
import { HttpTransport } from './transport/http.js';
import { HTTP_MSG_PATH, SseTransport } from './transport/sse.js';
import { withSpanAsync, addSpanAttribute, addSpanEvent } from './telemetry.js';
import { appConfig } from './config.js';

/** HTTP path for MCP streamable transport endpoint */
const HTTP_MCP_PATH = '/mcp';
/** HTTP path for legacy SSE transport endpoint */
const HTTP_SSE_PATH = '/sse';

// Create specialized loggers but use 'log' as variable name for consistency
const coreLog = createLogger('Core');

/**
 * Local server implementation for stdio-based MCP communication.
 *
 * This class provides a simple server that communicates via standard input/output,
 * typically used for local development or command-line integration.
 *
 * @template A - The type of McpAdapter implementation
 */
export class LocalServer<A extends McpAdapter> {
  /** The MCP adapter server instance */
  public readonly server: A;

  /** The stdio transport for local communication */
  private readonly transport: StdioServerTransport;

  /**
   * Creates a new LocalServer instance.
   *
   * @param mcpAdapterServerFactory - Factory function to create MCP adapter instances
   */
  constructor(private readonly mcpAdapterServerFactory: new (mode: WritableMode) => A) {
    coreLog.info('Initializing local server instance...');
    this.transport = new StdioServerTransport();
    this.server = new this.mcpAdapterServerFactory(appConfig.mode as WritableMode);
    coreLog.info('Local server instance initialized!');
  }

  /**
   * Starts listening for stdio-based MCP communication.
   *
   * Uses the UPSUN_API_KEY environment variable for authentication.
   *
   * @returns Promise that resolves when the server is ready
   * @throws Error if connection fails or API key is missing
   */
  async listen(): Promise<void> {
    return withSpanAsync('gateway', 'local-server.listen', async () => {
      addSpanAttribute('server.type', 'local');
      addSpanAttribute('transport', 'stdio');

      const apiKey = appConfig.apiKey;
      if (!apiKey) {
        addSpanEvent('authentication.failed', { reason: 'missing_api_key' });
        throw new Error('UPSUN_API_KEY environment variable is required for LocalServer');
      }

      addSpanEvent('server.connecting');
      await this.server.connectWithApiKey(this.transport, apiKey);
      addSpanEvent('server.connected');
    });
  }
}

/**
 * HTTP gateway server for MCP communication.
 *
 * This class serves as a gateway for handling HTTP requests and managing
 * transport sessions for the Model Context Protocol (MCP). It supports both
 * the newer streamable HTTP transport (protocol version 2025-03-26) and the
 * legacy HTTP+SSE transport (protocol version 2024-11-05) for backwards compatibility.
 *
 * The server manages multiple concurrent sessions and provides proper cleanup
 * of resources when sessions terminate.
 *
 * @template A - The type of McpAdapter implementation
 */
export class GatewayServer<A extends McpAdapter> {
  readonly httpTransport = new HttpTransport(this);
  readonly sseTransport = new SseTransport(this);

  /**
   * Creates a new GatewayServer instance.
   *
   * Initializes the Express application and sets up routes for handling MCP requests
   * via both streamable HTTP and legacy SSE transports.
   *
   * @param mcpAdapterServerFactory - Factory function to create MCP adapter instances
   * @param app - Optional Express application instance (creates new one if not provided)
   *
   * @example
   * ```typescript
   * const server = new GatewayServer(MyMcpAdapter);
   * server.listen(3000);
   * ```
   */
  constructor(
    private readonly mcpAdapterServerFactory: new (mode: WritableMode) => A,
    public readonly app: core.Express = express()
  ) {
    coreLog.info('Initializing gateway server instance...');
    this.app.use(express.json());

    // Load OAuth2 authentication
    setupOAuth2Direct(this.app);

    // Load all transports
    this.setupStreamableTransport();
    this.setupSseTransport();
    coreLog.info('Gateway server instance initialized!');
  }

  /**
   * Creates a new instance of the MCP adapter implementation.
   *
   * This factory method creates fresh instances of the MCP adapter for each
   * transport session, ensuring proper isolation between different client connections.
   *
   * @returns A new MCP adapter instance
   * @private
   */
  public makeInstanceAdapterMcpServer(mode: WritableMode = WritableMode.READONLY): McpAdapter {
    coreLog.debug('Creating new MCP adapter instance...');
    addSpanEvent('mcp-adapter.creating', { mode });
    const adapter = new this.mcpAdapterServerFactory(mode);
    addSpanEvent('mcp-adapter.created', { mode });
    return adapter;
  }

  //=============================================================================
  // STREAMABLE HTTP TRANSPORT (PROTOCOL VERSION 2025-03-26)
  //=============================================================================

  /**
   * Sets up the Streamable HTTP transport for modern MCP clients.
   *
   * This transport supports the latest MCP protocol version (2025-03-26) and provides
   * efficient bidirectional communication using HTTP with streaming capabilities.
   *
   * Endpoints configured:
   * - POST /mcp: Client-to-server communication and session initialization
   * - GET /mcp: Server-to-client notifications via streaming
   * - DELETE /mcp: Session termination
   *
   * Sessions are managed via the 'mcp-session-id' header, with automatic cleanup
   * when connections are closed.
   *
   * @private
   */
  private setupStreamableTransport(): void {
    coreLog.debug('Setting up Streamable HTTP transport...');

    // Handle POST requests for client-to-server communication
    this.app.post(HTTP_MCP_PATH, this.httpTransport.postSessionRequest.bind(this.httpTransport));

    // Handle GET requests for server-to-client notifications via streaming
    this.app.get(HTTP_MCP_PATH, this.httpTransport.handleSessionRequest.bind(this.httpTransport));

    // Handle DELETE requests for session termination
    this.app.delete(
      HTTP_MCP_PATH,
      this.httpTransport.handleSessionRequest.bind(this.httpTransport)
    );
  }

  //=============================================================================
  // DEPRECATED HTTP+SSE TRANSPORT (PROTOCOL VERSION 2024-11-05)
  //=============================================================================

  /**
   * Sets up the legacy Server-Sent Events (SSE) transport for backwards compatibility.
   *
   * This transport supports the older MCP protocol version (2024-11-05) using
   * Server-Sent Events for server-to-client communication and regular HTTP POST
   * for client-to-server messages.
   *
   * Endpoints configured:
   * - GET /sse: Establishes SSE connection for server-to-client notifications
   * - POST /messages: Client-to-server communication with session ID query parameter
   * - GET /health: Health check endpoint
   *
   * Includes keep-alive mechanism to maintain SSE connections and proper cleanup
   * when clients disconnect.
   *
   * @private
   */
  private setupSseTransport(): void {
    coreLog.debug('Setting up legacy SSE transport...');

    // Legacy SSE endpoint for older clients
    this.app.get(HTTP_SSE_PATH, this.sseTransport.getSessionRequest.bind(this.sseTransport));

    // Legacy message endpoint for older clients
    this.app.post(HTTP_MSG_PATH, this.sseTransport.postSessionRequest.bind(this.sseTransport));

    this.app.get('/health', this.sseTransport.healthSessionRequest.bind(this.sseTransport));
  }

  /**
   * Starts the HTTP server and begins listening for connections.
   *
   * Binds the server to all available network interfaces (0.0.0.0) and displays
   * configuration information for both transport types. Sets up proper shutdown
   * handling to clean up active transport sessions.
   *
   * @param port - Port number to listen on (default: 3000)
   *
   * @example
   * ```typescript
   * const server = new GatewayServer(MyMcpAdapter);
   * server.listen(8080); // Listen on port 8080
   * ```
   */
  public listen(port: number = 3000): void {
    coreLog.debug('Starting Server listen process...');

    this.app.listen(port, '0.0.0.0', () => {
      coreLog.info(`Backwards compatible MCP server listening on port ${port}`);
      coreLog.info(`  - Configure with http://localhost:${port}/sse`);
      coreLog.info(`  - Configure with http://localhost:${port}/mcp`);
      coreLog.info(`
==============================================
SUPPORTED TRANSPORT OPTIONS:

1. Streamable Http(Protocol version: 2025-03-26)
   Endpoint: /mcp
   Methods: GET, POST, DELETE
   Usage: 
     - Initialize with POST to /mcp
     - Establish SSE stream with GET to /mcp
     - Send requests with POST to /mcp
     - Terminate session with DELETE to /mcp

2. Http + SSE (Protocol version: 2024-11-05)
   Endpoints: /sse (GET) and /messages (POST)
   Usage:
     - Establish SSE stream with GET to /sse
     - Send requests with POST to /messages?sessionId=<id>
==============================================
`);
    });

    // Handle server shutdown
    process.on('SIGINT', async () => {
      coreLog.info('Shutting down server...');

      // Close all active transports to properly clean up resources
      await this.sseTransport.closeAllSessions();
      await this.httpTransport.closeAllSessions();

      coreLog.info('Server shutdown complete');
      process.exit(0);
    });

    process.on('uncaughtException', error => {
      coreLog.error('Uncaught Exception:', error);
    });

    process.on('unhandledRejection', (reason, promise) => {
      coreLog.error('Unhandled Rejection at:', promise, 'reason:', reason);
    });
  }
}
