import { createHash } from 'crypto';
import { McpServer } from '@modelcontextprotocol/server';
import { DEFAULT_UPSUN_CONFIG, UpsunClient, UpsunConfig } from 'upsun-sdk-node';

import * as pjson from '../package.json' with { type: 'json' };
import { McpAdapter } from './core/adapter.js';
import { createLogger } from './core/logger.js';
import { withSpan, addSpanAttribute } from './core/telemetry.js';
import { apiConfig, oauth2Config } from './core/config.js';
import { LruCache } from './core/lruCache.js';

// Create logger for MCP operations
const log = createLogger('mcp-server');

// HTTP requests are stateless, so API-key clients are cached to reuse their
// exchanged access tokens. Keyed by a SHA-256 of the API key.
const apiKeyClients = new LruCache<UpsunClient>(1000, 60 * 60 * 1000);

import {
  registerActivity,
  registerBackup,
  registerCertificate,
  registerDomain,
  registerEnvironment,
  registerOrganization,
  registerProject,
  registerRoute,
  registerSshKey,
} from './command/index.js';
import { registerConfig } from './task/config.js';
import { WritableMode } from './core/authentication.js';

/**
 * Upsun MCP Server implementation.
 *
 * This class implements the McpAdapter interface to provide a Model Context Protocol
 * server for the Upsun platform. It integrates the Upsun SDK with the MCP framework
 * to expose Upsun platform functionality as MCP tools.
 *
 * The server automatically registers all available command modules during construction,
 * providing a comprehensive set of tools for managing Upsun projects, environments,
 * deployments, and other platform resources.
 *
 * @implements {McpAdapter}
 */
export class UpsunMcpServer implements McpAdapter {
  /**
   * The Upsun SDK client instance.
   *
   * This client is set by useBearerToken() or useApiKey() and provides
   * access to all Upsun platform APIs. It's used by the registered command
   * modules to perform operations on behalf of MCP clients.
   */
  public client!: UpsunClient;

  /**
   * Creates a new UpsunMcpServer instance.
   *
   * Initializes the MCP server with the package name and version, then registers
   * all available command modules. Each command module adds specific tools and
   * capabilities related to different aspects of the Upsun platform.
   *
   * @param server - Optional MCP server instance (creates new one if not provided)
   *
   * @example
   * ```typescript
   * const mcpServer = new UpsunMcpServer();
   * mcpServer.useApiKey("your-api-key");
   * ```
   */
  constructor(
    public mode: WritableMode = WritableMode.READONLY,
    public readonly server: McpServer = new McpServer({
      name: 'upsun-server',
      version: pjson.default.version,
    })
  ) {
    // Register all command modules with their respective tools
    registerActivity(this);
    registerBackup(this);
    registerCertificate(this);
    registerDomain(this);
    registerEnvironment(this);
    registerOrganization(this);
    registerProject(this);
    registerRoute(this);
    registerSshKey(this);

    // Register all tasks with their respective prompts
    registerConfig(this);
  }

  /** Sets the Upsun client to authenticate with a Bearer token. */
  useBearerToken(bearerToken: string): void {
    withSpan('mcp-server', 'auth.bearer', () => {
      addSpanAttribute('auth.type', 'bearer');
      this.client = new UpsunClient(this.createConfig());
      this.client.setBearerToken(bearerToken);
    });
  }

  /** Sets the Upsun client to authenticate with an API key, reusing a cached client. */
  useApiKey(apiKey: string): void {
    withSpan('mcp-server', 'auth.apikey', () => {
      addSpanAttribute('auth.type', 'apikey');
      const cacheKey = createHash('sha256').update(apiKey).digest('hex');
      let client = apiKeyClients.get(cacheKey);
      if (!client) {
        client = new UpsunClient({ apiKey, ...this.createConfig() } as UpsunConfig);
        apiKeyClients.set(cacheKey, client);
      }
      this.client = client;
    });
  }

  private createConfig(): UpsunConfig {
    const config: UpsunConfig = { ...DEFAULT_UPSUN_CONFIG };

    config.base_url = apiConfig.baseUrl;
    config.auth_url = oauth2Config.authUrl;

    return config;
  }

  isMode(): boolean {
    if (this.mode === undefined) {
      this.mode = WritableMode.READONLY;
    }
    return this.mode !== WritableMode.READONLY;
  }
}
