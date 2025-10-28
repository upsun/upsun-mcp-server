import express from 'express';
import { createLogger } from './logger.js';
import { oauth2Config as appAuthConfig } from './config.js';
import { WritableMode, HeaderKey } from './types.js';

// Re-export for backward compatibility
export { WritableMode, HeaderKey } from './types.js';

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
  config: OAuth2Config
): OAuth2ProtectedResourceMetadata {
  return {
    resource: config.baseUrl,
    authorization_servers: [config.issuerUrl],
    scopes_supported: config.scope.split(' '),
    resource_name: 'Upsun MCP Server',
    resource_documentation: config.documentationUrl || 'https://docs.example.com/',
  };
}

/**
 * Sets up OAuth2 metadata endpoints on an Express application
 *
 * @param app - Express application instance
 * @param config - Optional OAuth2 configuration (uses default if not provided)
 */
export function setupOAuth2Direct(app: express.Application, config?: OAuth2Config): void {
  // Check if OAuth2 is enabled
  if (!appAuthConfig.enabled) {
    log.info('OAuth2 authentication is disabled (OAUTH_ENABLED=false)');
    return;
  } else {
    log.debug('OAuth2 metadata setup initiated...');
  }

  const oauth2Config = config || getOAuth2Config();

  const authServerMetadata = createAuthorizationServerMetadata(oauth2Config);
  const protectedResourceMetadata = createProtectedResourceMetadata(oauth2Config);

  // OAuth2 Authorization Server metadata endpoint
  app.get('/.well-known/oauth-authorization-server', (_req, res) => {
    res.json(authServerMetadata);
  });

  // OAuth2 Protected Resource metadata endpoint
  app.get('/.well-known/oauth-protected-resource', (_req, res) => {
    res.json(protectedResourceMetadata);
  });

  log.info('OAuth2 - Metadata configured automatically');
  log.info(`OAuth2 - Authorization Server: ${oauth2Config.issuerUrl}`);
  log.info(`OAuth2 - Resource Server: ${oauth2Config.baseUrl}`);

  if (oauth2Config.registrationUrl) {
    log.info(`OAuth2 - Dynamic Client Registration: ${oauth2Config.registrationUrl}`);
  } else {
    log.warn('OAuth2 - Dynamic Client Registration: Not configured (set OAUTH_REGISTRATION_URL)');
  }
}

/**
 * Extracts Bearer token from Authorization header
 *
 * @param req - Express request object
 * @returns Bearer token string if found, undefined otherwise
 */
export function extractBearerToken(req: express.Request): string | undefined {
  const authHeader = req.headers['authorization'] || req.headers['Authorization'];
  log.debug('Authorization header:', authHeader);

  if (typeof authHeader === 'string' && authHeader.startsWith('Bearer ')) {
    const token = authHeader.substring('Bearer '.length).trim();
    log.debug('Extracted token:', token ? `${token.substring(0, 10)}...` : 'empty');
    if (token) return token;
  }

  log.warn('No valid Bearer token found');
  return undefined;
}

/**
 * Bearer token validation result
 */
export interface BearerTokenValidationResult {
  isValid: boolean;
  token?: string;
  error?: {
    code: string;
    message: string;
  };
}

/**
 * Validates Bearer token from request
 *
 * @param req - Express request object
 * @returns Validation result with token or error information
 */
export function validateBearerToken(req: express.Request): BearerTokenValidationResult {
  const authHeader = req.headers['authorization'] || req.headers['Authorization'];

  if (!authHeader || typeof authHeader !== 'string' || !authHeader.startsWith('Bearer ')) {
    return {
      isValid: false,
      error: {
        code: 'missing_token',
        message: 'Bearer token required in Authorization header',
      },
    };
  }

  const token = authHeader.substring('Bearer '.length).trim();

  // Check if token is empty after extraction
  if (token.length === 0) {
    return {
      isValid: false,
      error: {
        code: 'invalid_token',
        message: 'Bearer token cannot be empty',
      },
    };
  }

  return {
    isValid: true,
    token,
  };
}

/**
 * Express middleware for Bearer token authentication
 *
 * @param req - Express request object
 * @param res - Express response object
 * @param next - Express next function
 */
export function requireBearerToken(
  req: express.Request,
  res: express.Response,
  next: express.NextFunction
): void {
  const validation = validateBearerToken(req);

  if (!validation.isValid) {
    res.status(401).json({
      error: validation.error?.code || 'unauthorized',
      message: validation.error?.message || 'Authentication required',
    });
    return;
  }

  // Attach token to request for later use
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (req as any).bearerToken = validation.token;
  next();
}

/**
 * Extracts API key validation for backwards compatibility
 *
 * @param req - Express request object
 * @param headerName - Name of the header containing the API key
 * @returns API key string if present, undefined otherwise
 */
export function extractApiKey(
  req: express.Request,
  headerName: string = HeaderKey.API_KEY
): string | undefined {
  const authHeader = req.headers[headerName];
  const ip = req.headers['x-forwarded-for'] || req.ip || 'unknown';
  log.debug('Authorization header:', authHeader);

  if (!authHeader) {
    log.warn('No valid API key found');
    return undefined;
  }

  const apiKey = authHeader as string;
  log.debug(`Authenticate from ${ip} with API key: ${apiKey.substring(0, 5)}xxxxxxx`);
  return apiKey;
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
