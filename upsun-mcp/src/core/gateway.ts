import * as core from "express-serve-static-core";
import express from "express";

import { randomUUID } from "crypto";

import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { SSEServerTransport } from "@modelcontextprotocol/sdk/server/sse.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { isInitializeRequest } from "@modelcontextprotocol/sdk/types.js"

import { McpAdapter } from "./adapter.js";

/** Keep-alive interval for SSE connections (25 seconds) */
const KEEP_ALIVE_INTERVAL_MS = 25000;
/** HTTP header name for MCP session ID */
const HTTP_SESSION_ATTR = 'mcp-session-id';
/** HTTP path for MCP streamable transport endpoint */
const HTTP_MCP_PATH = '/mcp';
/** HTTP path for legacy SSE transport endpoint */
const HTTP_SSE_PATH = '/sse';
/** HTTP path for legacy message endpoint */
const HTTP_MSG_PATH = '/messages';
/** HTTP header name for Upsun API key */
const HTTP_UPSUN_APIKEY_ATTR = 'upsun-api-token';

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
    this.transport = new StdioServerTransport();
    this.server = new this.mcpAdapterServerFactory();
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
    await this.server.connect(this.transport, process.env.UPSUN_API_KEY || '');
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

    this.app.use(express.json());

    // ====================== OAuth2 (metadata pour resource server) ======================
    const authorizationUrl = process.env.OAUTH_AUTH_URL || "https://auth.upsun.com/oauth2/authorize";
    const tokenUrl = process.env.OAUTH_TOKEN_URL || "https://auth.upsun.com/oauth2/token";
    const revocationUrl = process.env.OAUTH_REVOCATION_URL || "https://auth.upsun.com/oauth2/revoke";
    const issuerUrl = process.env.OAUTH_ISSUER_URL || "https://auth.upsun.com";
    const baseUrl = process.env.OAUTH_BASE_URL || "http://127.0.0.1:3000/";
    const scope = process.env.OAUTH_SCOPE || "offline_access";

    // Routes de métadonnées OAuth2 MANUELLES pour éviter que le SDK recalcule les URLs
    
    // Métadonnées de l'Authorization Server (Upsun)
    const oauthMetadata = {
      issuer: issuerUrl,                      // https://auth.upsun.com
      authorization_endpoint: authorizationUrl, // https://auth.upsun.com/oauth2/authorize
      token_endpoint: tokenUrl,               // https://auth.upsun.com/oauth2/token
      revocation_endpoint: revocationUrl,     // https://auth.upsun.com/oauth2/revoke
      scopes_supported: scope.split(' '),
      response_types_supported: ['code'],
      grant_types_supported: ['authorization_code'],
      token_endpoint_auth_methods_supported: ['none', 'client_secret_basic'],
      code_challenge_methods_supported: ['S256']
    };

    // Métadonnées du Resource Server (votre serveur MCP)
    const protectedResourceMetadata = {
      resource: baseUrl,                      // http://127.0.0.1:3000/
      authorization_servers: [issuerUrl],     // [https://auth.upsun.com]
      scopes_supported: scope.split(' '),
      resource_name: 'Upsun MCP Server',
      resource_documentation: process.env.OAUTH_DOC_URL || 'https://docs.example.com/'
    };

    // Routes manuelles pour les métadonnées (sans SDK qui recalcule)
    this.app.get('/.well-known/oauth-authorization-server', (_req, res) => {
      res.json(oauthMetadata);
    });

    this.app.get('/.well-known/oauth-protected-resource', (_req, res) => {
      res.json(protectedResourceMetadata);
    });

    console.log(`[OAuth2] Métadonnées OAuth2 configurées manuellement`);
    console.log(`  - Authorization Server: ${issuerUrl}`);
    console.log(`  - Resource Server: ${baseUrl}`);

    // Debug route
    this.app.get('/_routes', (_req, res) => {
      // @ts-ignore
      const stack = this.app._router?.stack || [];
      const routes = stack.filter((l:any)=>l.route).map((l:any)=>({ path:l.route.path, methods:Object.keys(l.route.methods) }));
      res.json(routes);
    });

    this.setupStreamableTransport();
    this.setupSseTransport();
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

    // Handle POST requests for client-to-server communication
    this.app.post(HTTP_MCP_PATH, async (req, res) => {
      // Check for existing session ID
      const sessionId = req.headers[HTTP_SESSION_ATTR] as string | undefined;
      console.log('Received POST request to /mcp (Streamable transport)');

      if (sessionId && this.transports.streamable[sessionId]) {
        // Reuse existing transport - inject fresh bearer token
        const { transport, server } = this.transports.streamable[sessionId];
        
        // Extract and inject fresh bearer token for each request
        const bearer = this.extractBearer(req);
        if (!bearer) {
          console.log('❌ Rejecting request: No bearer token found in existing session');
          res.status(401).json({ error: 'missing_token', hint: 'Bearer token required in Authorization header' });
          return;
        }
        
        console.log('✅ Bearer token found for existing session, updating server');
        // Update the server with fresh bearer token
        server.setCurrentBearerToken(bearer);
        
        await transport.handleRequest(req, res, req.body);

      } else if (!sessionId && isInitializeRequest(req.body)) {
        // Cherche un Bearer token pour alimenter server.connect
        console.log('🚀 New session initialization request');
        const bearer = this.extractBearer(req);
        if (!bearer) {
          console.log('❌ Rejecting initialization: No bearer token found');
          res.status(401).json({ error: 'missing_token', hint: 'GET /auth pour obtenir un token' });
          return;
        }

        console.log('✅ Bearer token found for initialization, creating new session');
        // Create the server instance first
        const server = this.makeInstanceAdapterMcpServer();

        // New initialization request
        const transport = new StreamableHTTPServerTransport({
          sessionIdGenerator: () => randomUUID(),
          onsessioninitialized: (sessionId) => {
            // Store the transport and server by session ID
            this.transports.streamable[sessionId] = { transport, server };
          }
        });

        // Clean up transport when closed
        transport.onclose = () => {
          if (transport.sessionId) {
            delete this.transports.streamable[transport.sessionId];
          }
        };

        // Connect the server to the transport
        await server.connect(transport, bearer);
        
        // Set initial bearer token
        server.setCurrentBearerToken(bearer);
        
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
    const handleSessionRequest = async (req: express.Request, res: express.Response) => {
      console.log('Received GET/DELETE request to /mcp (Streamable transport)');

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

    // Legacy SSE endpoint for older clients
    this.app.get(HTTP_SSE_PATH, async (req: express.Request, res: express.Response) => {
      const ip = req.headers['x-forwarded-for'] || req.ip
      console.log(`Received GET request to /sse (deprecated SSE transport) from ${ip}`);

      // TODO
      // const api_key = this.hasAPIKey(req, res);
      // if (!api_key) { return; }
  const bearer = this.extractBearer(req);
  if (!bearer) { res.status(401).end('Missing bearer token (utiliser /auth)'); return; }

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
      console.log(`[SSE Connection] Client connected: ${transport.sessionId}, starting keep-alive.`);

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
        await server.connect(transport, bearer || '');
        
        // Set initial bearer token
        server.setCurrentBearerToken(bearer);
        
        console.log(`New session from ${ip} with ID: ${transport.sessionId}`);
      } catch (error) {
        console.error(`[SSE Connection] Error connecting server to transport for ${transport.sessionId}:`, error);
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
      console.log(`Received POST request to /message (deprecated SSE transport) from ${ip}`);

      const sessionId = req.query.sessionId as string;
      const transportSession = this.transports.sse[sessionId];

      if (transportSession) {
        const { transport, server } = transportSession;
        
        // Extract and inject fresh bearer token for each request
        const bearer = this.extractBearer(req);
        if (!bearer) {
          res.status(401).json({ error: 'missing_token', hint: 'Bearer token required in Authorization header' });
          return;
        }
        
        // Update the server with fresh bearer token
        server.setCurrentBearerToken(bearer);
        
        console.log(`Message call from ${ip} with ID: ${transport.sessionId}`);
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
   * Validates the presence of Upsun API key in request headers.
   * 
   * Checks for the 'upsun-api-token' header and returns it if present.
   * Sends a 400 Bad Request response if the API key is missing.
   * 
   * @param req - Express request object
   * @param res - Express response object  
   * @returns The API key string if present, undefined otherwise
   * @private
   */
  private hasAPIKey(req: express.Request, res: express.Response): string | undefined {
      // const ip: string = req.headers['x-forwarded-for'] || req.ip;
      const ip:string = "ND";

      // if (net.isIPv4(ip) || net.isIPv6(ip)) {
      //     res.status(400).send(`Bad x-forwarded-for on header (TY Tomas)`);
      //     return undefined;
      // }

      if (!req.headers[HTTP_UPSUN_APIKEY_ATTR]) {
          res.status(400).send(`Missing API key`);
      } else {
          const apiKey = req.headers[HTTP_UPSUN_APIKEY_ATTR] as string;
          console.log(`Authenticate from ${ip} with API key: ${apiKey.substring(0, 5)}xxxxxxx`);
          return apiKey;
      }

      return undefined;
  }

  /**
   * Extrait le token Bearer de l'en-tête Authorization.
   */
  private extractBearer(req: express.Request): string | undefined {
    console.log('=== DEBUG extractBearer ===');
    console.log('Headers:', JSON.stringify(req.headers, null, 2));
    
    const h = req.headers['authorization'] || req.headers['Authorization'];
    console.log('Authorization header:', h);
    
    if (typeof h === 'string' && h.startsWith('Bearer ')) {
      const token = h.substring('Bearer '.length).trim();
      console.log('Extracted token:', token ? `${token.substring(0, 10)}...` : 'empty');
      if (token) return token;
    }
    
    console.log('No valid Bearer token found');
    return undefined;
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
    this.app.listen(port, "0.0.0.0", () => {
      console.log(`Backwards compatible MCP server listening on port ${port}`);
      console.log(`Configure with http://localhost:${port}/sse`);
      console.log(`
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
      console.log('Shutting down server...');

      // Close all active transports to properly clean up resources
      for (const sessionId in this.transports.sse) {
        try {
          console.log(`Closing transport for session ${sessionId}`);
          await this.transports.sse[sessionId].transport.close();
          delete this.transports.sse[sessionId];
        } catch (error) {
          console.error(`Error closing transport SSE for session ${sessionId}:`, error);
        }
      }

      for (const sessionId in this.transports.streamable) {
        try {
          console.log(`Closing transport for session ${sessionId}`);
          await this.transports.streamable[sessionId].transport.close();
          delete this.transports.streamable[sessionId];
        } catch (error) {
          console.error(`Error closing transport streamable for session ${sessionId}:`, error);
        }
      }
      console.log('Server shutdown complete');
      process.exit(0);
    });

    process.on('uncaughtException', (error) => {
        console.error('Uncaught Exception:', error);
    });
    
    process.on('unhandledRejection', (reason, promise) => {
        console.error('Unhandled Rejection at:', promise, 'reason:', reason);
    });
    
  }
}
