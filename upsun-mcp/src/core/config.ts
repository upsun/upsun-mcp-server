/**
 * Application configuration module
 *
 * This module centralizes all configuration values and environment variables
 * used throughout the application, including:
 * - Application settings
 * - API configuration (Upsun API)
 * - OAuth2 configuration
 * - Storage configuration (Redis, tokens)
 * - OpenTelemetry configuration
 */

import dotenv from 'dotenv';
import dotenvExpand from 'dotenv-expand';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { existsSync } from 'fs';
import { WritableMode, LogLevel, McpType } from './types.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Project root is two levels up from this file (src/core/config.ts -> upsun-mcp/)
const projectRoot = join(__dirname, '..', '..');

// Skip loading .env files during tests to allow tests to control environment
// Tests will set SKIP_DOTENV_LOAD=true to prevent .env loading
if (process.env.SKIP_DOTENV_LOAD !== 'true') {
  // Load base .env file first
  const baseEnv = dotenv.config({ path: join(projectRoot, '.env') });
  dotenvExpand.expand(baseEnv);

  // Then try to load environment-specific .env file based on TYPE_ENV
  // Use override: true to allow the specific env file to override base values
  const typeEnv = getNodeEnvironment();
  if (typeEnv) {
    const envPath = join(projectRoot, `.env.${typeEnv}`);
    if (existsSync(envPath)) {
      const specificEnv = dotenv.config({ path: envPath, override: true });
      dotenvExpand.expand(specificEnv);
    }
  }
}

/**
 * Parse a string value to boolean
 */
function parseBoolean(value: string | undefined, defaultValue: boolean): boolean {
  if (!value) return defaultValue;
  return value.toLowerCase() === 'true' || value === '1';
}

/**
 * Parse a string value to number with validation
 */
function parseNumber(
  value: string | undefined,
  defaultValue: number,
  min?: number,
  max?: number
): number {
  if (!value) return defaultValue;
  const parsed = parseFloat(value);
  if (isNaN(parsed)) return defaultValue;
  if (min !== undefined && parsed < min) return min;
  if (max !== undefined && parsed > max) return max;
  return parsed;
}

/**
 * Parse OTLP headers from comma-separated key=value pairs
 */
function parseHeaders(headersString: string | undefined): Record<string, string> {
  if (!headersString) return {};

  const headers: Record<string, string> = {};
  const pairs = headersString.split(',');

  for (const pair of pairs) {
    const [key, value] = pair.split('=').map(s => s.trim());
    if (key && value) {
      headers[key] = value;
    }
  }

  return headers;
}

function parseLogLevel(
  loglevel: string | undefined,
  defaultLevel: LogLevel | undefined
): LogLevel | undefined {
  if (!loglevel) return defaultLevel;

  switch (loglevel.toUpperCase()) {
    case 'DEBUG':
      return LogLevel.DEBUG;
    case 'INFO':
      return LogLevel.INFO;
    case 'WARN':
      return LogLevel.WARN;
    case 'ERROR':
      return LogLevel.ERROR;
    case 'NONE':
      return LogLevel.NONE;
    default:
      throw new Error(`Invalid log level: ${loglevel}`);
  }
}

function parseWritableMode(mode: string | undefined, defaultMode: WritableMode): WritableMode {
  if (!mode) return defaultMode;

  switch (mode.toUpperCase()) {
    case 'READONLY':
      return WritableMode.READONLY;
    case 'NON-DESTRUCTIVE':
    case 'NO-DESTRUCTIVE':
      return WritableMode.NON_DESTRUCTIVE;
    case 'WRITABLE':
      return WritableMode.WRITABLE;
    default:
      throw new Error(`Invalid mode: ${mode}`);
  }
}

function parseMcpType(type: string | undefined, defaultType: McpType): McpType {
  if (!type) return defaultType;

  switch (type.toLowerCase()) {
    case 'local':
      return McpType.LOCAL;
    case 'remote':
      return McpType.REMOTE;
    default:
      throw new Error(`Invalid MCP type: ${type}`);
  }
}

function getOAuth2Base(): string {
  return process.env.OAUTH_URL || 'https://auth.upsun.com';
}

function getNodeEnvironment(): string {
  return process.env.NODE_ENV || 'development';
}

/**
 * API configuration
 */
export const apiConfig = {
  /** Base URL for the Upsun REST API */
  baseUrl: process.env.API_URL || 'https://api.upsun.com',

  /** API token for accessing Upsun API in stdio mode (legacy) */
  apiToken: process.env.UPSUN_API_TOKEN || undefined,
} as const;

/**
 * OAuth2 configuration
 */
export const oauth2Config = {
  /** Enable or disable OAuth2 authentication */
  enabled: parseBoolean(process.env.OAUTH_ENABLED, true),

  /** Base URL for the local OAuth2 proxy server */
  resourceUrl: process.env.OAUTH_BASE_URL || 'http://127.0.0.1:3000/',

  /** Base URL for the Upsun OAuth2 authorization server */
  authUrl: getOAuth2Base(),

  /** OAuth2 authorization endpoint URL */
  authorizationUrl: process.env.OAUTH_AUTH_URL || `${getOAuth2Base()}/oauth2/authorize`,

  /** OAuth2 introspection endpoint URL */
  introspectionUrl: process.env.OAUTH_INTROSPECTION_URL || `${getOAuth2Base()}/oauth2/introspect`,

  /** OAuth2 token endpoint URL */
  tokenUrl: process.env.OAUTH_TOKEN_URL || `${getOAuth2Base()}/oauth2/token`,

  /** OAuth2 dynamic client registration endpoint (optional) */
  registrationUrl: process.env.OAUTH_REGISTRATION_URL || undefined,

  /** OAuth2 token revocation endpoint URL */
  revocationUrl: process.env.OAUTH_REVOCATION_URL || `${getOAuth2Base()}/oauth2/revoke`,

  /** OAuth2 issuer URL used for token validation */
  issuerUrl: process.env.OAUTH_ISSUER_URL || getOAuth2Base(),

  /** OAuth2 scopes requested during authorization */
  scope: process.env.OAUTH_SCOPE || 'offline_access',

  /** URL to OAuth2 documentation */
  documentationUrl: process.env.OAUTH_DOC_URL || 'https://docs.upsun.com/',

  /** OAuth2 client identifier (for future use) */
  clientId: process.env.OAUTH_CLIENT_ID || undefined,

  /** OAuth2 client secret (for future use) */
  clientSecret: process.env.OAUTH_CLIENT_SECRET || undefined,

  /** MCP domain URL (for future use) */
  mcpDomain: process.env.MCP_DOMAIN || undefined,

  /** MCP documentation URL (for future use) */
  mcpDoc: process.env.MCP_DOC || undefined,
} as const;

/**
 * Storage configuration
 */
export const storageConfig = {
  /** Strategy for storing OAuth2 tokens ('memory' or 'redis') */
  tokenStorageStrategy: process.env.TOKEN_STORAGE_STRATEGY || 'memory',

  /** Redis connection string (only used when tokenStorageStrategy='redis') */
  redisDsn: process.env.REDIS_DSN || 'redis://127.0.0.1:6379',

  /** Debug namespace for Express.js logging */
  debug: process.env.DEBUG || undefined,
} as const;

/**
 * OpenTelemetry configuration
 */
export const otelConfig = {
  /** Enable or disable OpenTelemetry distributed tracing */
  enabled: parseBoolean(process.env.OTEL_ENABLED, true),

  /** Sampling rate for traces (0.0 to 1.0) */
  samplingRate: parseNumber(process.env.OTEL_SAMPLING_RATE, 1.0, 0.0, 1.0),

  /** Exporter type: console, otlp, or none */
  exporterType: (process.env.OTEL_EXPORTER_TYPE || 'console') as 'console' | 'otlp' | 'none',

  /** OTLP exporter endpoint URL */
  exporterEndpoint: process.env.OTEL_EXPORTER_ENDPOINT || 'http://localhost:4318/v1/traces',

  /** OTLP exporter headers (for authentication, API keys, etc.) */
  exporterHeaders: parseHeaders(process.env.OTEL_EXPORTER_HEADERS),

  /** OTLP exporter timeout in milliseconds */
  exporterTimeout: parseNumber(process.env.OTEL_EXPORTER_TIMEOUT, 10000, 1000, 60000),

  /** Service name identifier for OpenTelemetry traces */
  serviceName: process.env.OTEL_SERVICE_NAME || 'upsun-mcp-server',

  /** Service namespace for grouping related services */
  serviceNamespace: process.env.OTEL_SERVICE_NAMESPACE || undefined,

  /** Unique instance identifier (auto-generated if not provided) */
  serviceInstanceId:
    process.env.OTEL_SERVICE_INSTANCE_ID || `${process.pid}-${Date.now().toString(36)}`,
} as const;

/**
 * Application configuration
 */
export const appConfig = {
  /** Node.js environment mode (development, production, test) */
  nodeEnv: getNodeEnvironment(),

  /** Logging level (DEBUG, INFO, WARN, ERROR, NONE) */
  logLevel: parseLogLevel(process.env.LOG_LEVEL, undefined) as LogLevel | undefined,

  /** Upsun MCP type (remote, local) */
  typeEnv: parseMcpType(process.env.TYPE_ENV, McpType.REMOTE),

  /** HTTP server port */
  port: parseNumber(process.env.PORT, 3000),

  /** API operation mode (READONLY, NON_DESTRUCTIVE, WRITABLE) */
  mode: parseWritableMode(process.env.MODE, WritableMode.READONLY),

  /** Upsun API key for platform authentication */
  apiKey: process.env.UPSUN_API_KEY || '',
} as const;

/**
 * Get a human-readable configuration summary
 */
export function getConfigSummary(): string {
  const headerCount = Object.keys(otelConfig.exporterHeaders).length;
  const headersInfo = headerCount > 0 ? ` (${headerCount} headers configured)` : '';

  return `
Configuration:
  API:
    - API URL: ${apiConfig.baseUrl}
    - API Token: ${apiConfig.apiToken ? 'configured' : 'not set'}
  
  OAuth2:
    - Enabled: ${oauth2Config.enabled}
    - Resource URL: ${oauth2Config.resourceUrl}
    - Auth URL: ${oauth2Config.authUrl}
    - Authorization Endpoint: ${oauth2Config.authorizationUrl}
    - Token Endpoint: ${oauth2Config.tokenUrl}
    - Revocation Endpoint: ${oauth2Config.revocationUrl}
    - Registration Endpoint: ${oauth2Config.registrationUrl || 'not configured'}
    - Issuer URL: ${oauth2Config.issuerUrl}
    - Scope: ${oauth2Config.scope}
    - Documentation URL: ${oauth2Config.documentationUrl}
    - Client ID: ${oauth2Config.clientId || 'not set'}
    - MCP Domain: ${oauth2Config.mcpDomain || 'not set'}
    - MCP Doc: ${oauth2Config.mcpDoc || 'not set'}
  
  Storage:
    - Token Storage Strategy: ${storageConfig.tokenStorageStrategy}
    - Redis DSN: ${storageConfig.redisDsn}
    - Debug: ${storageConfig.debug || 'not set'}
  
  OpenTelemetry:
    - Enabled: ${otelConfig.enabled}
    - Sampling Rate: ${(otelConfig.samplingRate * 100).toFixed(0)}%
    - Exporter: ${otelConfig.exporterType}${otelConfig.exporterType === 'otlp' ? headersInfo : ''}
    - Endpoint: ${otelConfig.exporterType === 'otlp' ? otelConfig.exporterEndpoint : 'N/A'}
    - Timeout: ${otelConfig.exporterTimeout}ms
    - Service: ${otelConfig.serviceName}
    - Namespace: ${otelConfig.serviceNamespace || 'N/A'}
    - Instance: ${otelConfig.serviceInstanceId}
  
  Application:
    - Environment: ${appConfig.nodeEnv}
    - Type: ${appConfig.typeEnv}
    - Port: ${appConfig.port}
    - Mode: ${appConfig.mode}
    - API Key: ${appConfig.apiKey ? 'configured' : 'not set'}
  `.trim();
}
