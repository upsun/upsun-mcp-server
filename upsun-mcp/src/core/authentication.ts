import express, { RequestHandler } from 'express';
import { requireBearerAuth } from '@modelcontextprotocol/sdk/server/auth/middleware/bearerAuth.js';
import { InvalidTokenError } from '@modelcontextprotocol/sdk/server/auth/errors.js';
import { createLogger } from './logger.js';
import { oauth2Config as appAuthConfig } from './config.js';
import { WritableMode, HeaderKey, API_KEY_CLIENT_ID } from './types.js';

// Re-export for backward compatibility
export { WritableMode, HeaderKey, API_KEY_CLIENT_ID } from './types.js';

// Re-export SDK types used by consumers.
import type { AuthInfo } from '@modelcontextprotocol/sdk/server/auth/types.js';
export type { AuthInfo };

// Create logger instance
const log = createLogger('Auth');

/**
 * Centralized authentication utilities for OAuth2 and Bearer token management.
 *
 * This module provides:
 * - OAuth2 metadata configuration for both Authorization Server and Resource Server
 * - Bearer token extraction and validation
 * - Authentication middleware setup
 */

/**
 * OAuth2 configuration interface
 */
export interface OAuth2Config {
  authorizationUrl: string;
  tokenUrl: string;
  revocationUrl: string;
  registrationUrl?: string; // Optional: for external OAuth2 servers supporting dynamic registration
  issuerUrl: string;
  baseUrl: string;
  scope: string;
  documentationUrl?: string;
}

/**
 * Default OAuth2 configuration from environment variables or defaults
 */
export const getOAuth2Config = (): OAuth2Config => ({
  authorizationUrl: appAuthConfig.authorizationUrl,
  tokenUrl: appAuthConfig.tokenUrl,
  revocationUrl: appAuthConfig.revocationUrl,
  registrationUrl: appAuthConfig.registrationUrl,
  issuerUrl: appAuthConfig.issuerUrl,
  baseUrl: appAuthConfig.resourceUrl,
  scope: appAuthConfig.scope,
  documentationUrl: appAuthConfig.documentationUrl,
});

/**
 * OAuth2 Authorization Server metadata structure
 */
export interface OAuth2AuthorizationServerMetadata {
  issuer: string;
  authorization_endpoint: string;
  token_endpoint: string;
  revocation_endpoint: string;
  registration_endpoint?: string; // Optional: for Dynamic Client Registration support
  scopes_supported: string[];
  response_types_supported: string[];
  grant_types_supported: string[];
  token_endpoint_auth_methods_supported: string[];
  code_challenge_methods_supported: string[];
}

/**
 * OAuth2 Protected Resource metadata structure
 */
export interface OAuth2ProtectedResourceMetadata {
  resource: string;
  authorization_servers: string[];
  scopes_supported: string[];
  resource_name: string;
  resource_documentation: string;
}

/**
 * Creates OAuth2 Authorization Server metadata from configuration
 *
 * Note: This creates metadata pointing to the EXTERNAL OAuth2 server.
 * Your MCP server is just a Protected Resource, not an Authorization Server.
 */
export function createAuthorizationServerMetadata(
  config: OAuth2Config
): OAuth2AuthorizationServerMetadata {
  const metadata: OAuth2AuthorizationServerMetadata = {
    issuer: config.issuerUrl,
    authorization_endpoint: config.authorizationUrl,
    token_endpoint: config.tokenUrl,
    revocation_endpoint: config.revocationUrl,
    scopes_supported: config.scope.split(' '),
    response_types_supported: ['code'],
    grant_types_supported: ['authorization_code', 'refresh_token'],
    token_endpoint_auth_methods_supported: ['none', 'client_secret_basic'],
    code_challenge_methods_supported: ['S256'],
  };

  // Only add registration_endpoint if configured (external OAuth2 server support)
  if (config.registrationUrl) {
    metadata.registration_endpoint = config.registrationUrl;
  }

  return metadata;
}

/**
 * Creates OAuth2 Protected Resource metadata from configuration
 */
export function createProtectedResourceMetadata(
  config: OAuth2Config,
  mcpPath?: string
): OAuth2ProtectedResourceMetadata {
  const resource = mcpPath ? new URL(mcpPath, config.baseUrl).href : config.baseUrl;
  return {
    resource,
    authorization_servers: [config.issuerUrl],
    scopes_supported: config.scope.split(' '),
    resource_name: 'Upsun MCP Server',
    resource_documentation: config.documentationUrl || 'https://docs.example.com/',
  };
}

/**
 * Verifies JWT access tokens by parsing the payload without cryptographic
 * validation. The MCP server delegates actual validation to the Upsun API.
 * This extracts `exp` so the SDK middleware can reject expired tokens with
 * HTTP 401 before the transport writes 200 headers.
 *
 * A clock-skew buffer (default 30s) is subtracted from the `exp` claim so
 * that tokens close to expiry are rejected early, before the response is
 * committed to 200.
 */
export class JwtTokenVerifier {
  constructor(private readonly clockSkewSeconds: number = 30) {}

  async verifyAccessToken(token: string): Promise<AuthInfo> {
    const parts = token.split('.');
    if (parts.length !== 3) {
      throw new InvalidTokenError('Not a valid JWT');
    }
    let payload: Record<string, unknown>;
    try {
      payload = JSON.parse(Buffer.from(parts[1], 'base64url').toString());
    } catch {
      throw new InvalidTokenError('Malformed JWT payload');
    }
    const rawExp = typeof payload.exp === 'number' ? payload.exp : undefined;
    if (rawExp === undefined) {
      log.warn('JWT missing exp claim; token will be rejected');
    }
    // Subtract the clock-skew buffer so the SDK middleware rejects tokens
    // that are about to expire, before the transport writes 200 headers.
    const expiresAt = rawExp !== undefined ? rawExp - this.clockSkewSeconds : undefined;
    return {
      token,
      clientId: (payload.sub as string) || 'unknown',
      scopes: typeof payload.scope === 'string' ? payload.scope.split(/\s+/).filter(Boolean) : [],
      expiresAt,
    };
  }
}

/**
 * Combined authentication middleware that supports both bearer tokens (via the
 * SDK's requireBearerAuth) and legacy API keys. API key requests bypass bearer
 * validation entirely.
 */
export function requireMcpAuth(
  verifier: JwtTokenVerifier,
  resourceMetadataUrl?: string
): RequestHandler {
  const bearerAuth = requireBearerAuth({ verifier, resourceMetadataUrl });

  return (req, res, next) => {
    const raw = req.headers[HeaderKey.API_KEY];
    const apiKey = typeof raw === 'string' ? raw : undefined;
    if (apiKey) {
      req.auth = { token: apiKey, clientId: API_KEY_CLIENT_ID, scopes: [] };
      return next();
    }
    bearerAuth(req, res, next);
  };
}

/**
 * Sets up OAuth2 metadata endpoints on an Express application.
 *
 * @param app - Express application instance
 * @param config - Optional OAuth2 configuration (uses default if not provided)
 * @param mcpPath - Optional MCP endpoint path for RFC 9728 path-suffixed routes
 */
export function setupOAuth2Direct(
  app: express.Application,
  config?: OAuth2Config,
  mcpPath?: string
): void {
  // Check if OAuth2 is enabled
  if (!appAuthConfig.enabled) {
    log.info('OAuth2 authentication is disabled (OAUTH_ENABLED=false)');
    return;
  }
  log.debug('OAuth2 metadata setup initiated...');

  const oauth2Config = config || getOAuth2Config();

  const authServerMetadata = createAuthorizationServerMetadata(oauth2Config);
  const protectedResourceMetadata = createProtectedResourceMetadata(oauth2Config, mcpPath);

  // OAuth2 Authorization Server metadata endpoint
  app.get('/.well-known/oauth-authorization-server', (_req, res) => {
    res.json(authServerMetadata);
  });

  // OAuth2 Protected Resource metadata endpoint
  app.get('/.well-known/oauth-protected-resource', (_req, res) => {
    res.json(protectedResourceMetadata);
  });

  // RFC 9728 Section 3.1: path-suffixed routes for clients that construct
  // well-known URLs from the MCP endpoint path (e.g. Claude Desktop).
  if (mcpPath) {
    app.get(`/.well-known/oauth-authorization-server${mcpPath}`, (_req, res) => {
      res.json(authServerMetadata);
    });
    app.get(`/.well-known/oauth-protected-resource${mcpPath}`, (_req, res) => {
      res.json(protectedResourceMetadata);
    });
  }

  log.info('OAuth2 - Metadata configured automatically');
  log.info(`OAuth2 - Authorization Server: ${oauth2Config.issuerUrl}`);
  log.info(`OAuth2 - Resource: ${protectedResourceMetadata.resource}`);

  if (oauth2Config.registrationUrl) {
    log.info(`OAuth2 - Dynamic Client Registration: ${oauth2Config.registrationUrl}`);
  } else {
    log.warn('OAuth2 - Dynamic Client Registration: Not configured (set OAUTH_REGISTRATION_URL)');
  }
}

/**
 * Extracts writable mode from request headers
 *
 * @param req - Express request object
 * @param headerName - Name of the header containing the mode
 * @returns WritableMode enum value
 */
export function extractMode(
  req: express.Request,
  headerName: string = HeaderKey.ENABLE_WRITE
): WritableMode {
  const mode = req.headers[headerName];
  log.debug(`Extracted mode from ${headerName}:`, mode);

  if (typeof mode === 'string') {
    if (mode === 'true' || mode === WritableMode.WRITABLE) {
      return WritableMode.WRITABLE;
    }
  }
  return WritableMode.READONLY;
}
