import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
// The SDK does not export isInitializeRequest, so we define it locally.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const isInitializeRequest = (body: any): boolean => {
  return body && body.jsonrpc === '2.0' && body.method === 'initialize';
};
import { randomUUID } from 'crypto';
import express from 'express';

import { McpAdapter } from '../adapter.js';
import { createLogger } from '../logger.js';
import {
  extractMode,
  HeaderKey,
  API_KEY_CLIENT_ID,
  sessionOwnerFromAuth,
  authMatchesSessionOwner,
  rejectSessionNotFound,
} from '../authentication.js';
import type { AuthInfo, SessionOwner } from '../authentication.js';
import { GatewayServer } from '../gateway.js';
import { requestContext } from '../requestContext.js';

const httpLog = createLogger('Web:HTTP');

export class HttpTransport {
  /** Active streamable HTTP server transports (protocol version 2025-03-26) */
  readonly streamable = {} as Record<
    string,
    {
      transport: StreamableHTTPServerTransport;
      server: McpAdapter;
      owner: SessionOwner;
      expiryTimer?: NodeJS.Timeout;
    }
  >;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  constructor(public readonly gateway: GatewayServer<any>) {}

  /**
   * Handler for POST requests on the MCP endpoint.
   *
   * Authentication is handled by the gateway middleware (requireMcpAuth) which
   * populates req.auth before this handler runs.
   */
  async postSessionRequest(req: express.Request, res: express.Response): Promise<void> {
    httpLog.info('Received POST request to /mcp (Streamable transport)');

    const auth = req.auth as AuthInfo | undefined;
    if (!auth) {
      res
        .status(500)
        .json({ error: 'server_error', message: 'Authentication middleware did not run' });
      return;
    }
    const sessionId = req.headers[HeaderKey.MCP_SESSION_ID] as string | undefined;
    const mode = extractMode(req);
    const isApiKey = auth.clientId === API_KEY_CLIENT_ID;

    if (sessionId) {
      // The session is bound to the token that created it. A request that does
      // not present that token is treated as if the session does not exist, so
      // an unknown id and a wrong token are indistinguishable to the caller.
      const session = this.streamable[sessionId];
      if (!session || !authMatchesSessionOwner(auth, session.owner)) {
        httpLog.warn('Rejecting session reuse: unknown session id or non-matching token');
        rejectSessionNotFound(res);
        return;
      }

      // No credential rebind is needed: reuse only succeeds for the same token,
      // which the session's client is already bound to.
      await requestContext.run({ res }, () => session.transport.handleRequest(req, res, req.body));
      return;
    }

    if (isInitializeRequest(req.body)) {
      httpLog.info('New session initialization request');

      const server = this.gateway.makeInstanceAdapterMcpServer(mode);

      // enableJsonResponse defers writing HTTP headers until the handler completes,
      // allowing upstream 401 errors to be forwarded to the client. No current tools
      // use streaming; future streaming tools would need the SSE transport path.
      const transport = new StreamableHTTPServerTransport({
        sessionIdGenerator: (): string => randomUUID(),
        enableJsonResponse: true,
        onsessioninitialized: (sessionId): void => {
          this.streamable[sessionId] = { transport, server, owner: sessionOwnerFromAuth(auth) };
          // Bound to the creating token, the session cannot outlive it; evict at
          // the token's expiry so refreshed-out sessions do not accumulate.
          this.scheduleExpiry(sessionId, auth.expiresAt);
        },
      });

      transport.onclose = (): void => {
        if (transport.sessionId) {
          this.deleteSession(transport.sessionId);
        }
      };

      // Connect server using appropriate authentication method.
      if (isApiKey) {
        httpLog.info('API key found for initialization, creating new session');
        await server.connectWithApiKey(transport, auth.token);
      } else {
        httpLog.info('Bearer token found for initialization, creating new session');
        await server.connectWithBearer(transport, auth.token);
      }

      await requestContext.run({ res }, () => transport.handleRequest(req, res, req.body));
      return;
    }

    res.status(400).json({
      jsonrpc: '2.0',
      error: {
        code: -32000,
        message: 'Bad Request: No valid session ID provided',
      },
      id: null,
    });
  }

  /**
   * Schedules eviction of a session when its credential token expires. API-key
   * tokens carry no expiry, so those sessions live until the transport closes.
   */
  private scheduleExpiry(sessionId: string, expiresAt?: number): void {
    if (expiresAt === undefined) {
      return;
    }
    const session = this.streamable[sessionId];
    if (!session) {
      return;
    }
    const delayMs = Math.max(0, expiresAt * 1000 - Date.now());
    const timer = setTimeout(() => {
      httpLog.info(`Session ${sessionId} reached token expiry; closing`);
      void this.closeSession(sessionId);
    }, delayMs);
    // Do not keep the process alive solely to fire this timer.
    timer.unref?.();
    session.expiryTimer = timer;
  }

  /** Removes a session from the map and clears its expiry timer. */
  private deleteSession(sessionId: string): void {
    const session = this.streamable[sessionId];
    if (session?.expiryTimer) {
      clearTimeout(session.expiryTimer);
    }
    delete this.streamable[sessionId];
  }

  /** Closes a session's transport, which triggers cleanup via onclose. */
  private async closeSession(sessionId: string): Promise<void> {
    const session = this.streamable[sessionId];
    if (!session) {
      return;
    }
    try {
      await session.transport.close();
    } catch (error) {
      httpLog.error(`Error closing transport streamable for session ${sessionId}:`, error);
      this.deleteSession(sessionId);
    }
  }

  /**
   * Reusable handler for GET and DELETE requests on the MCP endpoint.
   *
   * @param req - Express request object
   * @param res - Express response object
   */
  async handleSessionRequest(req: express.Request, res: express.Response): Promise<void> {
    httpLog.info('Received GET/DELETE request to /mcp (Streamable transport)');

    const auth = req.auth as AuthInfo | undefined;
    if (!auth) {
      res
        .status(500)
        .json({ error: 'server_error', message: 'Authentication middleware did not run' });
      return;
    }
    const sessionId = req.headers[HeaderKey.MCP_SESSION_ID] as string | undefined;
    if (!sessionId) {
      res.status(400).send('Invalid or missing session ID');
      return;
    }

    // Unknown id and non-matching token are treated alike (see postSessionRequest).
    const session = this.streamable[sessionId];
    if (!session || !authMatchesSessionOwner(auth, session.owner)) {
      httpLog.warn('Rejecting session request: unknown session id or non-matching token');
      rejectSessionNotFound(res);
      return;
    }

    await session.transport.handleRequest(req, res);
  }

  async closeAllSessions(): Promise<void> {
    for (const sessionId in this.streamable) {
      try {
        httpLog.info(`Closing transport for session ${sessionId}`);
        const session = this.streamable[sessionId];
        this.deleteSession(sessionId);
        await session.transport.close();
      } catch (error) {
        httpLog.error(`Error closing transport streamable for session ${sessionId}:`, error);
      }
    }
  }
}
