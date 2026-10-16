import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import express from 'express';

import { createLogger } from '../logger.js';
import { extractMode, isApiKeyAuth } from '../authentication.js';
import type { AuthInfo } from '../authentication.js';
import { GatewayServer } from '../gateway.js';
import { requestContext } from '../requestContext.js';

const httpLog = createLogger('Web:HTTP');

/**
 * Stateless Streamable HTTP transport: every POST gets a fresh MCP server and
 * transport, and no session id is issued or accepted.
 */
export class HttpTransport {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  constructor(public readonly gateway: GatewayServer<any>) {}

  /**
   * Handler for POST requests on the MCP endpoint.
   *
   * Authentication is handled by the gateway middleware (requireMcpAuth) which
   * populates req.auth before this handler runs.
   */
  async handlePost(req: express.Request, res: express.Response): Promise<void> {
    httpLog.info('Received POST request to /mcp (Streamable transport)');

    const auth = req.auth as AuthInfo | undefined;
    if (!auth) {
      res
        .status(500)
        .json({ error: 'server_error', message: 'Authentication middleware did not run' });
      return;
    }

    const server = this.gateway.makeInstanceAdapterMcpServer(extractMode(req));
    // enableJsonResponse defers writing HTTP headers until the handler completes,
    // allowing upstream 401 errors to be forwarded to the client.
    const transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: undefined,
      enableJsonResponse: true,
    });

    try {
      if (isApiKeyAuth(auth)) {
        await server.connectWithApiKey(transport, auth.token);
      } else {
        await server.connectWithBearer(transport, auth.token);
      }
      await requestContext.run({ res }, () => transport.handleRequest(req, res, req.body));
    } finally {
      try {
        await transport.close();
      } catch (error) {
        httpLog.error('Error closing stateless transport:', error);
      }
    }
  }

  /**
   * Handler for GET and DELETE requests on the MCP endpoint: there is no
   * session to stream from or terminate.
   */
  async handleMethodNotAllowed(_req: express.Request, res: express.Response): Promise<void> {
    res
      .status(405)
      .set('Allow', 'POST')
      .json({
        jsonrpc: '2.0',
        error: { code: -32000, message: 'Method not allowed.' },
        id: null,
      });
  }
}
