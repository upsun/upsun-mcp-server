import * as core from 'express-serve-static-core';
import express from 'express';

import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';

import { McpAdapter } from './adapter.js';
import {
  setupOAuth2Direct,
  JwtTokenVerifier,
  requireMcpAuth,
  WritableMode,
} from './authentication.js';
import { oauth2Config, appConfig } from './config.js';
import { createLogger } from './logger.js';
import { HttpTransport } from './transport/http.js';
import { withSpanAsync, addSpanAttribute, addSpanEvent } from './telemetry.js';

/** HTTP path for MCP streamable transport endpoint */
const HTTP_MCP_PATH = '/mcp';

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
 * Serves the Model Context Protocol (MCP) over stateless Streamable HTTP:
 * each POST is handled by a fresh MCP server instance, with no sessions.
 *
 * @template A - The type of McpAdapter implementation
 */
export class GatewayServer<A extends McpAdapter> {
  readonly httpTransport = new HttpTransport(this);

  /**
   * Creates a new GatewayServer instance.
   *
   * Initializes the Express application and sets up routes for handling MCP requests
   * via the Streamable HTTP transport.
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

    // Load OAuth2 metadata (including path-suffixed well-known routes).
    setupOAuth2Direct(this.app, undefined, HTTP_MCP_PATH);

    // Build auth middleware using the SDK's requireBearerAuth for bearer
    // tokens and a fallback for API keys.
    const verifier = new JwtTokenVerifier();
    const resourceMetadataUrl = new URL(
      '/.well-known/oauth-protected-resource',
      oauth2Config.resourceUrl
    ).href;
    const authMiddleware = requireMcpAuth(verifier, resourceMetadataUrl);

    this.setupStreamableTransport(authMiddleware);
    this.app.get('/health', (_req, res) => {
      res.status(200).json({ status: 'healthy' });
    });
    coreLog.info('Gateway server instance initialized!');
  }

  /**
   * Creates a new instance of the MCP adapter implementation.
   *
   * A fresh instance is created for each request, so no state is shared
   * between requests.
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

  /**
   * Sets up the stateless Streamable HTTP transport.
   *
   * Endpoints configured:
   * - POST /mcp: All client-to-server messages
   * - GET, DELETE /mcp: 405, as there is no session to stream from or terminate
   *
   * @private
   */
  private setupStreamableTransport(authMiddleware: express.RequestHandler): void {
    coreLog.debug('Setting up Streamable HTTP transport...');

    this.app.post(
      HTTP_MCP_PATH,
      authMiddleware,
      this.httpTransport.handlePost.bind(this.httpTransport)
    );

    const methodNotAllowed = this.httpTransport.handleMethodNotAllowed.bind(this.httpTransport);
    this.app.get(HTTP_MCP_PATH, authMiddleware, methodNotAllowed);
    this.app.delete(HTTP_MCP_PATH, authMiddleware, methodNotAllowed);
  }

  /**
   * Starts the HTTP server and begins listening for connections.
   *
   * Binds the server to all available network interfaces (0.0.0.0) and displays
   * the endpoint.
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
      coreLog.info(`MCP server listening on port ${port}`);
      coreLog.info(`  - Configure with http://localhost:${port}${HTTP_MCP_PATH}`);
    });

    process.on('uncaughtException', error => {
      coreLog.error('Uncaught Exception:', error);
    });

    process.on('unhandledRejection', (reason, promise) => {
      coreLog.error('Unhandled Rejection at:', promise, 'reason:', reason);
    });
  }
}
