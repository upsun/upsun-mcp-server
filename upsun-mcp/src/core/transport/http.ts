import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
// import { isInitializeRequest } from '@modelcontextprotocol/sdk/types.js';
// Local fallback version if the dependency is missing (for tests)
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const isInitializeRequest = (body: any): boolean => {
  return body && body.jsonrpc === '2.0' && body.method === 'initialize';
};
import { randomUUID } from 'crypto';
import express from 'express';

import { McpAdapter } from '../adapter.js';
import { createLogger } from '../logger.js';
import { extractApiKey, extractBearerToken, extractMode, HeaderKey } from '../authentication.js';
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
   * @param req - Express request object
   * @param res - Express response object
   */
  async postSessionRequest(req: express.Request, res: express.Response): Promise<void> {
    httpLog.info('Received POST request to /mcp (Streamable transport)');

    // Check for existing session ID
    const sessionId = req.headers[HeaderKey.MCP_SESSION_ID] as string | undefined;
    const bearer = extractBearerToken(req);
    const apiKey = extractApiKey(req);
    const mode = extractMode(req);

    if (sessionId && this.streamable[sessionId]) {
      // Reuse existing transport - inject fresh authentication token
      const { transport, server } = this.streamable[sessionId];

      // Extract authentication token (Bearer or API key - exclusive)
      if (!bearer && !apiKey) {
        httpLog.warn('Rejecting request: No bearer token or API key found in existing session');
        res.status(401).json({
          error: 'missing_token',
          hint: 'Bearer token (Authorization header) or API key (upsun-api-token header) required',
        });
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

      if (!bearer && !apiKey) {
        httpLog.warn('Rejecting initialization: No bearer token or API key found');
        res.status(401).json({
          error: 'missing_token',
          hint: 'Bearer token (Authorization header) or API key (upsun-api-token header) required for initialization',
        });
        return;
      }

      // Create the server instance first
      const server = this.gateway.makeInstanceAdapterMcpServer(mode);

      // New initialization request
      const transport = new StreamableHTTPServerTransport({
        sessionIdGenerator: (): string => randomUUID(),
        onsessioninitialized: (sessionId): void => {
          // Store the transport and server by session ID
          this.streamable[sessionId] = { transport, server };
        },
      });

      // Clean up transport when closed
      transport.onclose = (): void => {
        if (transport.sessionId) {
          delete this.streamable[transport.sessionId];
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
