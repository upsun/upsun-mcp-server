import * as core from "express-serve-static-core";
import express from "express";

import { randomUUID } from "crypto";

import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { SSEServerTransport } from "@modelcontextprotocol/sdk/server/sse.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { isInitializeRequest } from "@modelcontextprotocol/sdk/types.js"

import { McpAdapter } from "./adapter.js";
import { 
  setupOAuth2Direct, 
  extractBearerToken, 
  extractApiKey,
  HTTP_SESSION_ATTR,
} from "./authentication.js";
import { createLogger } from "./logger.js";


/** Keep-alive interval for SSE connections (25 seconds) */
const KEEP_ALIVE_INTERVAL_MS = 25000;
/** HTTP path for MCP streamable transport endpoint */
const HTTP_MCP_PATH = '/mcp';
/** HTTP path for legacy SSE transport endpoint */
const HTTP_SSE_PATH = '/sse';
/** HTTP path for legacy message endpoint */
const HTTP_MSG_PATH = '/messages';

// Create specialized loggers but use 'log' as variable name for consistency
const log = createLogger('Web');
const httpLog = createLogger('Web:HTTP');
const sseLog = createLogger('Web:SSE');
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
  private readonly transport: StdioServerTransport

  /**
   * Creates a new LocalServer instance.
   * 
   * @param mcpAdapterServerFactory - Factory function to create MCP adapter instances
   */
  constructor(
    private readonly mcpAdapterServerFactory: new () => A,
  ) {
    coreLog.info('Initializing local server instance...');
    this.transport = new StdioServerTransport();
    this.server = new this.mcpAdapterServerFactory();
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
    const apiKey = process.env.UPSUN_API_KEY || '';
    if (!apiKey) {
      throw new Error('UPSUN_API_KEY environment variable is required for LocalServer');
    }
    await this.server.connectWithApiKey(this.transport, apiKey);
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

  /**
   * Storage for active transport sessions by type.
   * 
   * This object stores the transport sessions for both streamable HTTP and SSE.
   * Each transport type maintains its own record of active sessions keyed by session ID.
   * 
   * @remarks
   * TODO: Review for more horizontal scalability - current implementation stores
   * sessions in memory which limits scaling across multiple server instances.
   */
  readonly transports = {
    /** Active streamable HTTP server transports (protocol version 2025-03-26) */
    streamable: {} as Record<string, { transport: StreamableHTTPServerTransport, server: McpAdapter }>,
    /** Active SSE server transports (protocol version 2024-11-05) */
    sse: {} as Record<string, { transport: SSEServerTransport, server: McpAdapter }>
  };

  /** 
   * Active SSE connections with their keep-alive intervals.
   * Maps session IDs to connection details including the Express response object
   * and the keep-alive interval timer.
   */
  readonly sseConnections = new Map<string, { res: express.Response, intervalId: NodeJS.Timeout }>();

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
    private readonly mcpAdapterServerFactory: new () => A,
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
  private makeInstanceAdapterMcpServer(): McpAdapter {
    coreLog.debug('Creating new MCP adapter instance...');
    return new this.mcpAdapterServerFactory();
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
    this.app.post(HTTP_MCP_PATH, async (req, res) => {
      // Check for existing session ID
      const sessionId = req.headers[HTTP_SESSION_ATTR] as string | undefined;
      httpLog.info('Received POST request to /mcp (Streamable transport)');

      if (sessionId && this.transports.streamable[sessionId]) {
        // Reuse existing transport - inject fresh authentication token
        const { transport, server } = this.transports.streamable[sessionId];
        
        // Extract authentication token (Bearer or API key - exclusive)
        const bearer = extractBearerToken(req);
        const apiKey = extractApiKey(req);
        
        if (!bearer && !apiKey) {
          httpLog.warn('Rejecting request: No bearer token or API key found in existing session');
          res.status(401).json({ error: 'missing_token', hint: 'Bearer token (Authorization header) or API key (upsun-api-token header) required' });
          return;
        }
        
        // Use appropriate authentication token and update server
        if (bearer) {
          httpLog.debug('Bearer token found for existing session, updating server');
          server.setCurrentBearerToken(bearer);
        }
        
        await transport.handleRequest(req, res, req.body);

      } else if (!sessionId && isInitializeRequest(req.body)) {
        // New session initialization request - check for authentication token
        httpLog.info('New session initialization request');
        const bearer = extractBearerToken(req);
        const apiKey = extractApiKey(req);
        
        if (!bearer && !apiKey) {
          httpLog.warn('Rejecting initialization: No bearer token or API key found');
          res.status(401).json({ error: 'missing_token', hint: 'Bearer token (Authorization header) or API key (upsun-api-token header) required for initialization' });
          return;
        }

        // Create the server instance first
        const server = this.makeInstanceAdapterMcpServer();

        // New initialization request
        const transport = new StreamableHTTPServerTransport({
          sessionIdGenerator: (): string => randomUUID(),
          onsessioninitialized: (sessionId): void => {
            // Store the transport and server by session ID
            this.transports.streamable[sessionId] = { transport, server };
          }
        });

        // Clean up transport when closed
        transport.onclose = (): void => {
          if (transport.sessionId) {
            delete this.transports.streamable[transport.sessionId];
          }
        };

        // Connect server using appropriate authentication method
        if (bearer) {
          httpLog.info('Bearer token found for initialization, creating new session');
          await server.connectWithBearer(transport, bearer);
        } else if (apiKey) {
          httpLog.info('API key found for initialization, creating new session');
          await server.connectWithApiKey(transport, apiKey);
          // API key is fixed for the lifecycle, no need to set current token
        }
        
        // Handle the initialization request
        await transport.handleRequest(req, res, req.body);

      } else {
        // Invalid request
        res.status(400).json({
          jsonrpc: '2.0',
          error: {
            code: -32000,
            message: 'Bad Request: No valid session ID provided',
          },
          id: null,
        });
        return;
      }
    });

    /**
     * Reusable handler for GET and DELETE requests on the MCP endpoint.
     * 
     * @param req - Express request object
     * @param res - Express response object
     */
    const handleSessionRequest = async (req: express.Request, res: express.Response): Promise<void> => {
      httpLog.info('Received GET/DELETE request to /mcp (Streamable transport)');

      const sessionId = req.headers[HTTP_SESSION_ATTR] as string | undefined;
      if (!sessionId || !this.transports.streamable[sessionId]) {
        res
          .status(400)
          .send('Invalid or missing session ID');
        return;
      }

      const { transport } = this.transports.streamable[sessionId];
      await transport.handleRequest(req, res);
    };

    // Handle GET requests for server-to-client notifications via streaming
    this.app.get(HTTP_MCP_PATH, handleSessionRequest);

    // Handle DELETE requests for session termination
    this.app.delete(HTTP_MCP_PATH, handleSessionRequest);
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
    this.app.get(HTTP_SSE_PATH, async (req: express.Request, res: express.Response) => {
      const ip = req.headers['x-forwarded-for'] || req.ip
      sseLog.info(`Received GET request to /sse (deprecated SSE transport) from ${ip}`);

      // Extract authentication token (Bearer or API key - exclusive)
      const bearer = extractBearerToken(req);
      const apiKey = extractApiKey(req);
      
      if (!bearer && !apiKey) { 
        res.status(401).end('Missing authentication token (Bearer token in Authorization header or API key in upsun-api-token header)'); 
        return; 
      }

      // Create SSE transport for legacy clients
      const transport = new SSEServerTransport(HTTP_MSG_PATH, res);
      
      // Create the server instance first
      const server = this.makeInstanceAdapterMcpServer();
      
      this.transports.sse[transport.sessionId] = { transport, server };

      // Start keep-alive ping
      const intervalId = setInterval(() => {
        if (this.sseConnections.has(transport.sessionId) && !res.writableEnded) {
          res.write(': keepalive\n\n');
        } else {
          // Should not happen if close handler is working, but clear just in case
          clearInterval(intervalId);
          this.sseConnections.delete(transport.sessionId);
        }
      }, KEEP_ALIVE_INTERVAL_MS);

      // Store connection details
      this.sseConnections.set(transport.sessionId, { res, intervalId });
      sseLog.info(`Client connected: ${transport.sessionId}, starting keep-alive.`);

      res.on("close", () => {
        delete this.transports.sse[transport.sessionId];
        // Clean up keep-alive interval
        const connection = this.sseConnections.get(transport.sessionId);
        if (connection) {
          clearInterval(connection.intervalId);
          this.sseConnections.delete(transport.sessionId);
        }
      });

      try {
        // Connect server using appropriate authentication method
        if (bearer) {
          sseLog.info(`New SSE session from ${ip} with Bearer token, ID: ${transport.sessionId}`);
          await server.connectWithBearer(transport, bearer);
        } else if (apiKey) {
          sseLog.info(`New SSE session from ${ip} with API key, ID: ${transport.sessionId}`);
          await server.connectWithApiKey(transport, apiKey);
          // API key is fixed for the lifecycle, no need to set current token
        }

        sseLog.info(`New session from ${ip} with ID: ${transport.sessionId}`);
      } catch (error) {
        sseLog.error(`Error connecting server to transport for ${transport.sessionId}:`, error);
        // Ensure cleanup happens even if connect fails
        clearInterval(intervalId);
        this.sseConnections.delete(transport.sessionId);
        delete this.transports.sse[transport.sessionId];
        if (!res.writableEnded) {
          res.status(500).end('Failed to connect MCP server to transport');
        }
      }
    });

    // Legacy message endpoint for older clients
    this.app.post(HTTP_MSG_PATH, async (req: express.Request, res: express.Response) => {
      const ip = req.headers['x-forwarded-for'] || req.ip
      sseLog.info(`Received POST request to /message (deprecated SSE transport) from ${ip}`);

      const sessionId = req.query.sessionId as string;
      const transportSession = this.transports.sse[sessionId];

      if (transportSession) {
        const { transport, server } = transportSession;
        
        // Extract and inject fresh bearer token for each request
        const bearer = extractBearerToken(req);
        const apiKey = extractApiKey(req);
        if (!bearer && !apiKey) {
          res.status(401).json({ error: 'missing_token', hint: 'Bearer token required in Authorization header' });
          return;
        }
        
        // Update the server with fresh bearer token
        if (bearer) {
          server.setCurrentBearerToken(bearer);
        }
        
        sseLog.info(`Message call from ${ip} with ID: ${transport.sessionId}`);
        await transport.handlePostMessage(req, res, req.body);
      } else {
        res
          .status(400)
          .send('No transport found for sessionId');
      }
    });

    this.app.get("/health", (_: express.Request, res: express.Response) => {
      res.status(200).json({ status: 'healthy' });
    });

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
  listen(port: number=3000): void {
    coreLog.debug('Starting Server listen process...');

    this.app.listen(port, "0.0.0.0", () => {
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
      for (const sessionId in this.transports.sse) {
        try {
          log.info(`Closing transport for session ${sessionId}`);
          await this.transports.sse[sessionId].transport.close();
          delete this.transports.sse[sessionId];
        } catch (error) {
          log.error(`Error closing transport SSE for session ${sessionId}:`, error);
        }
      }

      for (const sessionId in this.transports.streamable) {
        try {
          log.info(`Closing transport for session ${sessionId}`);
          await this.transports.streamable[sessionId].transport.close();
          delete this.transports.streamable[sessionId];
        } catch (error) {
          log.error(`Error closing transport streamable for session ${sessionId}:`, error);
        }
      }
      coreLog.info('Server shutdown complete');
      process.exit(0);
    });

    process.on('uncaughtException', (error) => {
        coreLog.error('Uncaught Exception:', error);
    });
    
    process.on('unhandledRejection', (reason, promise) => {
        coreLog.error('Unhandled Rejection at:', promise, 'reason:', reason);
    });
    
  }
}
