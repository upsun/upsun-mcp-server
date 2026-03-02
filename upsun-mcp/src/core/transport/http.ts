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
import { extractMode, HeaderKey, API_KEY_CLIENT_ID } from '../authentication.js';
import type { AuthInfo } from '../authentication.js';
import { GatewayServer } from '../gateway.js';

const httpLog = createLogger('Web:HTTP');

export class HttpTransport {
  /** Active streamable HTTP server transports (protocol version 2025-03-26) */
  readonly streamable = {} as Record<
    string,
    { transport: StreamableHTTPServerTransport; server: McpAdapter }
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

    if (sessionId && this.streamable[sessionId]) {
      // Reuse existing transport - inject fresh authentication token.
      const { transport, server } = this.streamable[sessionId];

      if (!isApiKey) {
        httpLog.debug('Bearer token found for existing session, updating server');
        server.setCurrentBearerToken(auth.token);
      }

      await transport.handleRequest(req, res, req.body);
    } else if (!sessionId && isInitializeRequest(req.body)) {
      httpLog.info('New session initialization request');

      const server = this.gateway.makeInstanceAdapterMcpServer(mode);

      const transport = new StreamableHTTPServerTransport({
        sessionIdGenerator: (): string => randomUUID(),
        onsessioninitialized: (sessionId): void => {
          this.streamable[sessionId] = { transport, server };
        },
      });

      transport.onclose = (): void => {
        if (transport.sessionId) {
          delete this.streamable[transport.sessionId];
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

      await transport.handleRequest(req, res, req.body);
    } else {
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
  }

  /**
   * Reusable handler for GET and DELETE requests on the MCP endpoint.
   *
   * @param req - Express request object
   * @param res - Express response object
   */
  async handleSessionRequest(req: express.Request, res: express.Response): Promise<void> {
    httpLog.info('Received GET/DELETE request to /mcp (Streamable transport)');

    const sessionId = req.headers[HeaderKey.MCP_SESSION_ID] as string | undefined;
    if (!sessionId || !this.streamable[sessionId]) {
      res.status(400).send('Invalid or missing session ID');
      return;
    }

    const { transport } = this.streamable[sessionId];
    await transport.handleRequest(req, res);
  }

  async closeAllSessions(): Promise<void> {
    for (const sessionId in this.streamable) {
      try {
        httpLog.info(`Closing transport for session ${sessionId}`);
        const session = this.streamable[sessionId];
        delete this.streamable[sessionId];
        await session.transport.close();
      } catch (error) {
        httpLog.error(`Error closing transport streamable for session ${sessionId}:`, error);
      }
    }
  }
}
