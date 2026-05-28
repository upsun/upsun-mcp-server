import { SSEServerTransport } from '@modelcontextprotocol/sdk/server/sse.js';
import { McpAdapter } from '../adapter.js';
import express from 'express';
import { GatewayServer } from '../gateway.js';
import { createLogger } from '../logger.js';
import {
  extractMode,
  isApiKeyAuth,
  sessionOwnerFromAuth,
  authMatchesSessionOwner,
  rejectSessionNotFound,
} from '../authentication.js';
import type { AuthInfo, SessionOwner } from '../authentication.js';

const sseLog = createLogger('Web:SSE');

/** Keep-alive interval for SSE connections (25 seconds) */
const KEEP_ALIVE_INTERVAL_MS = 25000;

/** HTTP path for legacy message endpoint */
export const HTTP_MSG_PATH = '/messages';

// Note: upstream 401 forwarding is not possible over SSE because the transport
// commits HTTP 200 headers as soon as the connection is established.
export class SseTransport {
  /** Active SSE server transports (protocol version 2024-11-05) */
  readonly sse = {} as Record<
    string,
    { transport: SSEServerTransport; server: McpAdapter; owner: SessionOwner }
  >;

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

  /**
   * Authentication is handled by the gateway middleware (requireMcpAuth) which
   * populates req.auth before this handler runs.
   */
  async postSessionRequest(req: express.Request, res: express.Response): Promise<void> {
    const ip = req.headers['x-forwarded-for'] || req.ip;
    sseLog.info(`Received POST request to ${HTTP_MSG_PATH} (deprecated SSE transport) from ${ip}`);

    const auth = req.auth as AuthInfo | undefined;
    if (!auth) {
      res
        .status(500)
        .json({ error: 'server_error', message: 'Authentication middleware did not run' });
      return;
    }
    const sessionId = req.query.sessionId as string;
    const transportSession = this.sse[sessionId];

    // The session is bound to the token that created it. An unknown id and a
    // non-matching token are treated alike, so neither reveals a live session.
    if (!transportSession || !authMatchesSessionOwner(auth, transportSession.owner)) {
      sseLog.warn(`Rejecting message from ${ip}: unknown session id or non-matching token`);
      rejectSessionNotFound(res);
      return;
    }

    const { transport } = transportSession;
    sseLog.info(`Message call from ${ip} with ID: ${transport.sessionId}`);
    await transport.handlePostMessage(req, res, req.body);
  }

  async getSessionRequest(req: express.Request, res: express.Response): Promise<void> {
    const ip = req.headers['x-forwarded-for'] || req.ip;
    sseLog.info(`Received GET request to /sse (deprecated SSE transport) from ${ip}`);

    const auth = req.auth as AuthInfo | undefined;
    if (!auth) {
      res
        .status(500)
        .json({ error: 'server_error', message: 'Authentication middleware did not run' });
      return;
    }
    const mode = extractMode(req);
    const isApiKey = isApiKeyAuth(auth);

    // Create SSE transport for legacy clients.
    const transport = new SSEServerTransport(HTTP_MSG_PATH, res);

    const server = this.gateway.makeInstanceAdapterMcpServer(mode);

    this.sse[transport.sessionId] = { transport, server, owner: sessionOwnerFromAuth(auth) };

    // Start keep-alive ping.
    const intervalId = setInterval(() => {
      if (this.sseConnections.has(transport.sessionId) && !res.writableEnded) {
        res.write(': keepalive\n\n');
      } else {
        clearInterval(intervalId);
        this.sseConnections.delete(transport.sessionId);
      }
    }, KEEP_ALIVE_INTERVAL_MS);
    intervalId.unref?.();

    this.sseConnections.set(transport.sessionId, { res, intervalId });
    sseLog.info(`Client connected: ${transport.sessionId}, starting keep-alive.`);

    res.on('close', () => {
      delete this.sse[transport.sessionId];
      const connection = this.sseConnections.get(transport.sessionId);
      if (connection) {
        clearInterval(connection.intervalId);
        this.sseConnections.delete(transport.sessionId);
      }
    });

    try {
      if (isApiKey) {
        sseLog.info(`New SSE session from ${ip} with API key, ID: ${transport.sessionId}`);
        await server.connectWithApiKey(transport, auth.token);
      } else {
        sseLog.info(`New SSE session from ${ip} with Bearer token, ID: ${transport.sessionId}`);
        await server.connectWithBearer(transport, auth.token);
      }

      sseLog.info(`New session from ${ip} with ID: ${transport.sessionId}`);
    } catch (error) {
      sseLog.error(`Error connecting server to transport for ${transport.sessionId}:`, error);
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
