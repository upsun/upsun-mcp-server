import * as core from "express-serve-static-core";
import express from "express";

import { randomUUID } from "crypto";

import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { SSEServerTransport } from "@modelcontextprotocol/sdk/server/sse.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { isInitializeRequest } from "@modelcontextprotocol/sdk/types.js"

import { McpAdapter } from "./adapter.js";

const KEEP_ALIVE_INTERVAL_MS = 25000; // Send keep-alive every 25 seconds
const HTTP_SESSION_ATTR = 'mcp-session-id';
const HTTP_MCP_PATH = '/mcp';
const HTTP_SSE_PATH = '/sse';
const HTTP_MSG_PATH = '/messages';
const HTTP_UPSUN_APIKEY_ATTR = 'upsun-api-token';

export class LocalServer<A extends McpAdapter> {
  public readonly server: A;
  private readonly transport: StdioServerTransport

  constructor(
    private readonly mcpAdapterServerFactory: new () => A,
  ) {
    this.transport = new StdioServerTransport();
    this.server = new this.mcpAdapterServerFactory();
  }

  async listen(): Promise<void> {
    await this.server.connect(this.transport, process.env.UPSUN_API_KEY || '');
  }

}

/**
 * GatewayServer class
 * This class serves as a gateway for handling HTTP requests and managing
 * transport sessions for the Model Context Protocol (MCP).
 * It supports both streamable HTTP and Server-Sent Events (SSE) transports.
 */
export class GatewayServer<A extends McpAdapter> {

  /**
   * Store transports for each session type
   * @description This object stores the transport sessions for streamable HTTP and SSE.
   * T.ssehe `streamable` property contains a record of streamable HTTP server transports,
   * while the `sse` property contains a record of SSE server transports.
   * @type {object}
   * @property {Record<string, StreamableHTTPServerTransport>} streamable - A record of streamable HTTP server transports.
   * @property {Record<string, SSEServerTransport>} sse - A record of SSE server transports.
   */
  readonly transports = {
    //TODO: Review for more horizontal scalability.
    streamable: {} as Record<string, StreamableHTTPServerTransport>,
    sse: {} as Record<string, SSEServerTransport>
  };
  readonly sseConnections = new Map<string, { res: express.Response, intervalId: NodeJS.Timeout }>();

  /**
   * Constructor for the GatewayServer class.
   * @param mcpAdapterServerFactory - The implementation of the McpAdapter to be used.
   * @param app - The Express application instance (optional).
   * @description This constructor initializes the Express application and sets up
   * the necessary routes for handling MCP requests.
   * It also initializes the transport sessions for both streamable HTTP and SSE.
   * @example
    const server = new GatewayServer(MyMcpAdapter);
    server.listen();
   * @returns {void}
   * @memberof GatewayServer
   * @template A - The type of the McpAdapter implementation.
   */
  constructor(
    private readonly mcpAdapterServerFactory: new () => A,
    public readonly app: core.Express = express()
  ) {

    this.app.use(express.json());

    this.setupStreamableTransport();
    this.setupSseTransport();
  }

  /**
   * Creates an instance of the McpAdapter implementation.
   * @returns {McpAdapter}
   * @memberof GatewayServer
   * @description This method creates an instance of the McpAdapter implementation.
   * It is used to establish a connection with the transport session.
   * The instance is created using the `new` operator and is used to handle incoming requests.
   */
  private makeInstanceAdapterMcpServer(): McpAdapter {
    return new this.mcpAdapterServerFactory();
  }

  //=============================================================================
  // STREAMABLE HTTP TRANSPORT (PROTOCOL VERSION 2025-03-26)
  //=============================================================================

  /**
   * Sets up the Streamable HTTP transport for client-to-server communication.
   * @returns {void}
   * @memberof GatewayServer
   * @description This method sets up the Streamable HTTP transport for client-to-server communication.
   * It creates an endpoint for handling POST requests and manages session IDs for transport sessions.
   * 
   * It also handles GET and DELETE requests for server-to-client notifications and session termination.
   * 
   * The Streamable HTTP transport is used for real-time communication between the server and clients.
   * It allows for efficient handling of large data streams and supports multiple concurrent sessions.
   * The transport sessions are stored in the `transports` object, which contains a record of active sessions.
   */
  private setupStreamableTransport(): void {

    // Handle POST requests for client-to-server communication
    this.app.post(HTTP_MCP_PATH, async (req, res) => {
      // Check for existing session ID
      const sessionId = req.headers[HTTP_SESSION_ATTR] as string | undefined;
      console.log('Received POST request to /mcp (Streamable transport)');
      let transport: StreamableHTTPServerTransport;

      if (sessionId && this.transports.streamable[sessionId]) {
        // Reuse existing transport
        transport = this.transports.streamable[sessionId];

      } else if (!sessionId && isInitializeRequest(req.body)) {

        const api_key = this.hasAPIKey(req, res);
        if (!api_key) { return; }

        // New initialization request
        transport = new StreamableHTTPServerTransport({
          sessionIdGenerator: () => randomUUID(),
          onsessioninitialized: (sessionId) => {
            // Store the transport by session ID
            this.transports.streamable[sessionId] = transport;
          }
        });

        // Clean up transport when closed
        transport.onclose = () => {
          if (transport.sessionId) {
            delete this.transports.streamable[transport.sessionId];
          }
        };

        const server = this.makeInstanceAdapterMcpServer();
        await server.connect(transport, api_key);

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

      // Handle the request
      await transport.handleRequest(req, res, req.body);
    });

    // Reusable handler for GET and DELETE requests
    const handleSessionRequest = async (req: express.Request, res: express.Response) => {
      console.log('Received GET/DELETE request to /mcp (Streamable transport)');

      const sessionId = req.headers[HTTP_SESSION_ATTR] as string | undefined;
      if (!sessionId || !this.transports.streamable[sessionId]) {
        res
          .status(400)
          .send('Invalid or missing session ID');
        return;
      }

      const transport = this.transports.streamable[sessionId];
      await transport.handleRequest(req, res);
    };

    // // Handle GET requests for server-to-client notifications via SSE
    this.app.get(HTTP_MCP_PATH, handleSessionRequest);

    // Handle DELETE requests for session termination
    this.app.delete(HTTP_MCP_PATH, handleSessionRequest);
  }

  //=============================================================================
  // DEPRECATED HTTP+SSE TRANSPORT (PROTOCOL VERSION 2024-11-05)
  //=============================================================================

  /**
   * Sets up the Server-Sent Events (SSE) transport for legacy clients.
   * @returns {void}
   * @memberof GatewayServer
   * @description This method sets up the SSE transport for legacy clients.
   * It creates an SSE endpoint and handles incoming messages from legacy clients.
   * The SSE transport is used for server-to-client notifications.
   * It also handles the legacy message endpoint for older clients.
   */
  private setupSseTransport(): void {

    // Legacy SSE endpoint for older clients
    this.app.get(HTTP_SSE_PATH, async (req: express.Request, res: express.Response) => {
      const ip = req.headers['x-forwarded-for'] || req.ip
      console.log(`Received GET request to /sse (deprecated SSE transport) from ${ip}`);

      const api_key = this.hasAPIKey(req, res);
      if (!api_key) { return; }

      // Create SSE transport for legacy clients
      const transport = new SSEServerTransport(HTTP_MSG_PATH, res);
      this.transports.sse[transport.sessionId] = transport;

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

      const server = this.makeInstanceAdapterMcpServer();
      try {
      await server.connect(transport, api_key || '');
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
      const transport = this.transports.sse[sessionId];

      if (transport) {
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

  private hasAPIKey(req: express.Request, res: express.Response): string | undefined {
      let result = undefined;
      const ip = req.headers['x-forwarded-for'] || req.ip

      if (!req.headers[HTTP_UPSUN_APIKEY_ATTR]) {
          res.status(400).send(`Missing API key for ${ip}`);
      } else {
          result = req.headers[HTTP_UPSUN_APIKEY_ATTR] as string;
          console.log(`Authenticate from ${ip} with API key: ${result.substring(0, 5)}xxxxxxx`);
      }
      
      return result;
  }

  /**
   * Starts the server and listens on port 3000.
   * @returns {void}
   * @memberof GatewayServer
   * @description This method starts the Express server and listens for incoming requests on port 3000.
   * It binds the server to all available network interfaces (  
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
          await this.transports.sse[sessionId].close();
          delete this.transports.sse[sessionId];
        } catch (error) {
          console.error(`Error closing transport SSE for session ${sessionId}:`, error);
        }
      }

      for (const sessionId in this.transports.streamable) {
        try {
          console.log(`Closing transport for session ${sessionId}`);
          await this.transports.streamable[sessionId].close();
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
