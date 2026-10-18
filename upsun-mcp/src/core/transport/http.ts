import { toNodeHandler } from '@modelcontextprotocol/node';
import type { NodeMcpRequestHandler } from '@modelcontextprotocol/node';
import {
  createMcpHandler,
  isLegacyRequest,
  WebStandardStreamableHTTPServerTransport,
} from '@modelcontextprotocol/server';
import type {
  McpHandlerRequestOptions,
  McpHttpHandler,
  McpRequestContext,
  McpServer,
} from '@modelcontextprotocol/server';
import express from 'express';

import { createLogger } from '../logger.js';
import { extractMode, isApiKeyAuth } from '../authentication.js';
import { GatewayServer } from '../gateway.js';
import { requestContext } from '../requestContext.js';

const httpLog = createLogger('Web:HTTP');

/**
 * Stateless Streamable HTTP transport: every request gets a fresh MCP server,
 * and no session id is issued or accepted. Serves both 2025-era clients and
 * protocol revision 2026-07-28.
 */
export class HttpTransport {
  readonly handler: McpHttpHandler;
  private readonly nodeHandler: NodeMcpRequestHandler;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  constructor(public readonly gateway: GatewayServer<any>) {
    // JSON responses settle only after the tool completes, so an upstream 401
    // recorded by the tool can still replace them. Legacy requests are served
    // by serveLegacy(), as the SDK's own legacy leg always streams.
    this.handler = createMcpHandler(ctx => this.createServer(ctx), {
      legacy: 'reject',
      responseMode: 'json',
      onerror: error => httpLog.error('MCP handler error:', error),
    });
    this.nodeHandler = toNodeHandler(
      {
        fetch: async (request, options) => {
          const store: { upstream401?: Response } = {};
          const response = await requestContext.run(store, async () =>
            (await isLegacyRequest(request, options?.parsedBody))
              ? this.serveLegacy(request, options)
              : this.handler.fetch(request, options)
          );
          if (store.upstream401) {
            await response.body?.cancel();
            return store.upstream401;
          }
          return response;
        },
      },
      { onerror: error => httpLog.error('MCP request failed:', error) }
    );
  }

  /** Builds the MCP server for one request, authenticated as its caller. */
  private createServer({ authInfo, requestInfo }: McpRequestContext): McpServer {
    if (!authInfo) {
      throw new Error('Authentication middleware did not run');
    }
    const adapter = this.gateway.makeInstanceAdapterMcpServer(
      extractMode(requestInfo?.headers ?? new Headers())
    );
    if (isApiKeyAuth(authInfo)) {
      adapter.useApiKey(authInfo.token);
    } else {
      adapter.useBearerToken(authInfo.token);
    }
    return adapter.server;
  }

  /** Serves a 2025-era request statelessly, with a JSON response. */
  private async serveLegacy(
    request: Request,
    options?: McpHandlerRequestOptions
  ): Promise<Response> {
    if (request.method.toUpperCase() !== 'POST') {
      return Response.json(
        { jsonrpc: '2.0', error: { code: -32000, message: 'Method not allowed.' }, id: null },
        { status: 405, headers: { Allow: 'POST' } }
      );
    }
    const server = this.createServer({
      era: 'legacy',
      authInfo: options?.authInfo,
      requestInfo: request,
    });
    const transport = new WebStandardStreamableHTTPServerTransport({
      sessionIdGenerator: undefined,
      enableJsonResponse: true,
    });
    await server.connect(transport);
    try {
      return await transport.handleRequest(request, options);
    } finally {
      await server.close();
    }
  }

  /**
   * Handler for all requests on the MCP endpoint.
   *
   * Authentication is handled by the gateway middleware (requireMcpAuth) which
   * populates req.auth before this handler runs.
   */
  async handle(req: express.Request, res: express.Response): Promise<void> {
    httpLog.info(`Received ${req.method} request to /mcp`);

    if (!req.auth) {
      res
        .status(500)
        .json({ error: 'server_error', message: 'Authentication middleware did not run' });
      return;
    }

    await this.nodeHandler(req, res, req.body);
  }
}
