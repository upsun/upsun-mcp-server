import express from "express";

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
  issuerUrl: string;
  baseUrl: string;
  scope: string;
  documentationUrl?: string;
}

/**
 * Default OAuth2 configuration from environment variables or defaults
 */
export const getOAuth2Config = (): OAuth2Config => ({
  authorizationUrl: process.env.OAUTH_AUTH_URL || "https://auth.upsun.com/oauth2/authorize",
  tokenUrl: process.env.OAUTH_TOKEN_URL || "https://auth.upsun.com/oauth2/token",
  revocationUrl: process.env.OAUTH_REVOCATION_URL || "https://auth.upsun.com/oauth2/revoke",
  issuerUrl: process.env.OAUTH_ISSUER_URL || "https://auth.upsun.com",
  baseUrl: process.env.OAUTH_BASE_URL || "http://127.0.0.1:3000/",
  scope: process.env.OAUTH_SCOPE || "offline_access",
  documentationUrl: process.env.OAUTH_DOC_URL || "https://docs.example.com/"
});

/**
 * OAuth2 Authorization Server metadata structure
 */
export interface OAuth2AuthorizationServerMetadata {
  issuer: string;
  authorization_endpoint: string;
  token_endpoint: string;
  revocation_endpoint: string;
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
 */
export function createAuthorizationServerMetadata(config: OAuth2Config): OAuth2AuthorizationServerMetadata {
  return ({
    issuer: config.issuerUrl,
    authorization_endpoint: config.authorizationUrl,
    token_endpoint: config.tokenUrl,
    revocation_endpoint: config.revocationUrl,
    scopes_supported: config.scope.split(' '),
    response_types_supported: ['code'],
    grant_types_supported: ['authorization_code'],
    token_endpoint_auth_methods_supported: ['none', 'client_secret_basic'],
    code_challenge_methods_supported: ['S256']
  });
}

/**
 * Creates OAuth2 Protected Resource metadata from configuration
 */
export function createProtectedResourceMetadata(config: OAuth2Config): OAuth2ProtectedResourceMetadata {
  return ({
    resource: config.baseUrl,
    authorization_servers: [config.issuerUrl],
    scopes_supported: config.scope.split(' '),
    resource_name: 'Upsun MCP Server',
    resource_documentation: config.documentationUrl || 'https://docs.example.com/'
  });
}

/**
 * Sets up OAuth2 metadata endpoints on an Express application
 * 
 * @param app - Express application instance
 * @param config - Optional OAuth2 configuration (uses default if not provided)
 */
export function setupOAuth2Direct(app: express.Application, config?: OAuth2Config): void {
  console.debug('[Auth] OAuth2 metadata setup initiated...');
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

  app.get('/register', (_req, res) => {
    res.json({
      client_id: "mcp",
      client_name: "Claude Code (test)",
      redirect_uris: ["http://localhost:64236/callback"],
      grant_types: ["authorization_code", "refresh_token"],
      response_types: ["code"],
      token_endpoint_auth_method: ["none", 'client_secret_basic'],
      application_type: "native",
      scope: "offline_access"
    });
  });

  console.log(` OAuth2 metadata configured automatically`);
  console.log(`  - Authorization Server: ${oauth2Config.issuerUrl}`);
  console.log(`  - Resource Server: ${oauth2Config.baseUrl}`);
}

/**
 * Extracts Bearer token from Authorization header
 * 
 * @param req - Express request object
 * @returns Bearer token string if found, undefined otherwise
 */
export function extractBearerToken(req: express.Request): string | undefined {
  // console.log('=== DEBUG extractBearerToken ===');
  // console.log('Headers:', JSON.stringify(req.headers, null, 2));

  const authHeader = req.headers['authorization'] || req.headers['Authorization'];
  // console.log('Authorization header:', authHeader);

  if (typeof authHeader === 'string' && authHeader.startsWith('Bearer ')) {
    const token = authHeader.substring('Bearer '.length).trim();
    console.log('[Auth] Extracted token:', token ? `${token.substring(0, 10)}...` : 'empty');
    if (token) return token;
  }

  console.info('[Auth] No valid Bearer token found');
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
        message: 'Bearer token required in Authorization header'
      }
    };
  }

  const token = authHeader.substring('Bearer '.length).trim();

  // Check if token is empty after extraction
  if (token.length === 0) {
    return {
      isValid: false,
      error: {
        code: 'invalid_token',
        message: 'Bearer token cannot be empty'
      }
    };
  }

  return {
    isValid: true,
    token
  };
}

/**
 * Express middleware for Bearer token authentication
 * 
 * @param req - Express request object
 * @param res - Express response object
 * @param next - Express next function
 */
export function requireBearerToken(req: express.Request, res: express.Response, next: express.NextFunction): void {
  const validation = validateBearerToken(req);

  if (!validation.isValid) {
    res.status(401).json({
      error: validation.error?.code || 'unauthorized',
      message: validation.error?.message || 'Authentication required'
    });
    return;
  }

  // Attach token to request for later use
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
export function extractApiKey(req: express.Request,
  headerName: string = 'upsun-api-token'): string | undefined {
  const ip = req.headers['x-forwarded-for'] || req.ip || 'unknown';

  if (!req.headers[headerName]) {
    return undefined;
  }

  const apiKey = req.headers[headerName] as string;
  console.log(`[Auth] Authenticate from ${ip} with API key: ${apiKey.substring(0, 5)}xxxxxxx`);
  return apiKey;
}

/**
 * HTTP header name for Upsun API key (legacy)
 */
export const HTTP_UPSUN_APIKEY_ATTR = 'upsun-api-token';

/**
 * HTTP header name for MCP session ID
 */
export const HTTP_SESSION_ATTR = 'mcp-session-id';
