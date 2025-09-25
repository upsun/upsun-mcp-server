import { SSEServerTransport } from '@modelcontextprotocol/sdk/server/sse.js';
import { McpAdapter } from '../adapter.js';
import express from 'express';
import { GatewayServer } from '../gateway.js';
import { createLogger } from '../logger.js';
import { extractApiKey, extractBearerToken, extractMode } from '../authentication.js';

const sseLog = createLogger('Web:SSE');

/** Keep-alive interval for SSE connections (25 seconds) */
const KEEP_ALIVE_INTERVAL_MS = 25000;

/** HTTP path for legacy message endpoint */
export const HTTP_MSG_PATH = '/messages';

export class SseTransport {
  /** Active SSE server transports (protocol version 2024-11-05) */
  readonly sse = {} as Record<string, { transport: SSEServerTransport; server: McpAdapter }>;

  /**
   * Active SSE connections with their keep-alive intervals.
   * Maps session IDs to connection details including the Express response object
   * and the keep-alive interval timer.
   */
  readonly sseConnections = new Map<
    string,
    { res: express.Response; intervalId: NodeJS.Timeout }
  >();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  constructor(public readonly gateway: GatewayServer<any>) {}

  async postSessionRequest(req: express.Request, res: express.Response): Promise<void> {
    const ip = req.headers['x-forwarded-for'] || req.ip;
    sseLog.info(`Received POST request to /message (deprecated SSE transport) from ${ip}`);

    const sessionId = req.query.sessionId as string;
    const transportSession = this.sse[sessionId];

    if (transportSession) {
      const { transport, server } = transportSession;

      // Extract and inject fresh bearer token for each request
      const bearer = extractBearerToken(req);
      const apiKey = extractApiKey(req);

      if (!bearer && !apiKey) {
        res.status(401).json({
          error: 'missing_token',
          hint: 'Bearer token required in Authorization header',
        });
        return;
      }

      // Update the server with fresh bearer token
      if (bearer) {
        server.setCurrentBearerToken(bearer);
      }

      sseLog.info(`Message call from ${ip} with ID: ${transport.sessionId}`);
      await transport.handlePostMessage(req, res, req.body);
    } else {
      res.status(400).send('No transport found for sessionId');
    }
  }

  async getSessionRequest(req: express.Request, res: express.Response): Promise<void> {
    const ip = req.headers['x-forwarded-for'] || req.ip;
    sseLog.info(`Received GET request to /sse (deprecated SSE transport) from ${ip}`);

    // Extract authentication token (Bearer or API key - exclusive)
    const bearer = extractBearerToken(req);
    const apiKey = extractApiKey(req);
    const mode = extractMode(req);

    if (!bearer && !apiKey) {
      res
        .status(401)
        .end(
          'Missing authentication token (Bearer token in Authorization header or API key in upsun-api-token header)'
        );
      return;
    }

    // Create SSE transport for legacy clients
    const transport = new SSEServerTransport(HTTP_MSG_PATH, res);

    // Create the server instance first
    const server = this.gateway.makeInstanceAdapterMcpServer(mode);

    this.sse[transport.sessionId] = { transport, server };

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

    res.on('close', () => {
      delete this.sse[transport.sessionId];
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
      delete this.sse[transport.sessionId];
      if (!res.writableEnded) {
        res.status(500).end('Failed to connect MCP server to transport');
      }
    }
  }

  async healthSessionRequest(req: express.Request, res: express.Response): Promise<void> {
    res.status(200).json({ status: 'healthy' });
  }

  async closeAllSessions(): Promise<void> {
    for (const sessionId in this.sse) {
      try {
        sseLog.info(`Closing transport for session ${sessionId}`);
        const session = this.sse[sessionId];
        delete this.sse[sessionId];
        await session.transport.close();
      } catch (error) {
        sseLog.error(`Error closing transport SSE for session ${sessionId}:`, error);
      }
    }
  }
}
