import express, { RequestHandler } from 'express';
import { requireBearerAuth } from '@modelcontextprotocol/express';
import { OAuthError, OAuthErrorCode } from '@modelcontextprotocol/server';
import type { AuthInfo } from '@modelcontextprotocol/server';
import { createRemoteJWKSet, decodeJwt, errors, jwtVerify } from 'jose';
import type { JWTPayload, JWTVerifyGetKey } from 'jose';
import { createLogger } from './logger.js';
import { oauth2Config as appAuthConfig } from './config.js';
import { WritableMode, HeaderKey, API_KEY_CLIENT_ID } from './types.js';

// Re-export for backward compatibility
export { WritableMode, HeaderKey, API_KEY_CLIENT_ID } from './types.js';

// Re-export SDK types used by consumers.
export type { AuthInfo };

export const AuthType = {
  ApiKey: 'api-key',
  Bearer: 'bearer',
} as const;

export type AuthType = (typeof AuthType)[keyof typeof AuthType];
export type McpAuthInfo = AuthInfo & { authType: AuthType; hasUser?: boolean };

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
  registrationUrl?: string; // Unset when dynamic client registration is disabled.
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

  // Advertise dynamic client registration unless it is disabled.
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

export interface JwtVerifierOptions {
  /** Public keys of the authorization server, e.g. from `createRemoteJWKSet`. */
  keys: JWTVerifyGetKey;
  issuer: string;
  /** The protected resource URL that the token audience must name. */
  resource: string;
  clockSkewSeconds?: number;
}

/** Bearer auth info, with a flag for a token that names no audience. */
export type BearerAuthInfo = AuthInfo & { hasUser: boolean; emptyAudience?: true };

// Same limit as authlib: a token issued more than 5 minutes in the future is refused.
const MAX_IAT_SKEW_SECONDS = 300;

// jose error codes that mean the token is bad. Other errors (JWKS fetch failure,
// timeout) are server faults and propagate, so the client does not drop a valid token.
const INVALID_TOKEN_ERRORS: Record<string, string> = {
  ERR_JWS_INVALID: 'Malformed token',
  ERR_JWT_INVALID: 'Malformed token',
  ERR_JOSE_ALG_NOT_ALLOWED: 'Token signing algorithm not allowed',
  ERR_JWS_SIGNATURE_VERIFICATION_FAILED: 'Invalid token signature',
  ERR_JWKS_NO_MATCHING_KEY: 'Unknown token signing key',
  // A token with no kid, when the JWKS holds more than one ES256 key.
  ERR_JWKS_MULTIPLE_MATCHING_KEYS: 'Unknown token signing key',
  // An unknown crit header. ES256-only algorithms keep JWKS-side causes out of this code.
  ERR_JOSE_NOT_SUPPORTED: 'Malformed token',
  ERR_JWT_EXPIRED: 'Token expired',
  ERR_JWT_CLAIM_VALIDATION_FAILED: 'Invalid token claims',
};

const trimSlash = (url: string): string => url.replace(/\/+$/, '');

/**
 * Verifies Upsun Auth JWT access tokens: ES256 signature, issuer, expiry,
 * issued-at and audience.
 *
 * The audience must be the protected resource URL. A token with an empty
 * audience is also accepted, and flagged with `emptyAudience`: this is
 * temporary, for clients that do not send the RFC 8707 `resource` parameter.
 *
 * A clock-skew buffer (default 30s) is subtracted from the `exp` claim so
 * that tokens close to expiry are rejected early, before the response is
 * committed to 200.
 */
export class JwtTokenVerifier {
  private readonly clockSkewSeconds: number;

  constructor(private readonly options: JwtVerifierOptions) {
    this.clockSkewSeconds = options.clockSkewSeconds ?? 30;
  }

  /** Builds a verifier that fetches the keys from the configured JWKS URL. */
  static fromConfig(resource: string): JwtTokenVerifier {
    return new JwtTokenVerifier({
      keys: createRemoteJWKSet(new URL(appAuthConfig.jwksUrl)),
      issuer: appAuthConfig.issuerUrl,
      resource,
    });
  }

  async verifyAccessToken(token: string): Promise<BearerAuthInfo> {
    let payload: JWTPayload;
    try {
      ({ payload } = await jwtVerify(token, this.options.keys, {
        algorithms: ['ES256'],
        issuer: this.options.issuer,
        requiredClaims: ['exp'],
      }));
    } catch (error) {
      const reason = error instanceof errors.JOSEError && INVALID_TOKEN_ERRORS[error.code];
      if (reason) {
        throw new OAuthError(OAuthErrorCode.InvalidToken, reason);
      }
      throw error;
    }

    if (payload.iat !== undefined && payload.iat > Date.now() / 1000 + MAX_IAT_SKEW_SECONDS) {
      throw new OAuthError(OAuthErrorCode.InvalidToken, 'Token issued in the future');
    }

    const audiences = payload.aud === undefined ? [] : [payload.aud].flat();
    // jose checks the aud type only when an audience option is given, and this verifier gives none.
    if (audiences.some(aud => typeof aud !== 'string')) {
      throw new OAuthError(OAuthErrorCode.InvalidToken, 'Invalid token audience');
    }
    const emptyAudience = audiences.every(aud => aud === '');
    const resource = trimSlash(this.options.resource);
    if (!emptyAudience && !audiences.some(aud => trimSlash(aud) === resource)) {
      throw new OAuthError(OAuthErrorCode.InvalidToken, 'Token audience is not this server');
    }

    const clientId = [payload.cid, payload.sub].find(v => typeof v === 'string') as
      string | undefined;
    const scopes = Array.isArray(payload.scp)
      ? payload.scp.filter((s): s is string => typeof s === 'string')
      : typeof payload.scope === 'string'
        ? payload.scope.split(/\s+/).filter(Boolean)
        : [];

    return {
      token,
      clientId: clientId ?? 'unknown',
      scopes,
      // Subtract the clock-skew buffer so the SDK middleware rejects tokens
      // that are about to expire, before the transport writes 200 headers.
      expiresAt: (payload.exp as number) - this.clockSkewSeconds,
      // A client_credentials token has no `sub`, so it has no user.
      hasUser: typeof payload.sub === 'string' && payload.sub.length > 0,
      ...(emptyAudience && { emptyAudience: true as const }),
    };
  }
}

/**
 * Detects unsubstituted shell-style placeholders (e.g. `${UPSUN_API_TOKEN}`)
 * that can reach the server when a client forwards a templated config header
 * verbatim because the referenced environment variable is unset.
 */
function isUnsubstitutedPlaceholder(value: string): boolean {
  return /^\$\{[^}]*\}$/.test(value);
}

/**
 * Combined authentication middleware that supports both bearer tokens (via the
 * SDK's requireBearerAuth) and legacy API keys. API key requests bypass bearer
 * validation entirely.
 *
 * An API key header whose value is an unsubstituted placeholder is ignored so
 * the bearer flow can still run.
 */
export function requireMcpAuth(
  verifier: JwtTokenVerifier,
  resourceMetadataUrl?: string
): RequestHandler {
  const bearerAuth = requireBearerAuth({ verifier, resourceMetadataUrl });

  return (req, res, next) => {
    const raw = req.headers[HeaderKey.API_KEY];
    const apiKey = typeof raw === 'string' ? raw : undefined;
    if (apiKey && !isUnsubstitutedPlaceholder(apiKey)) {
      req.auth = {
        token: apiKey,
        clientId: API_KEY_CLIENT_ID,
        scopes: [],
        authType: AuthType.ApiKey,
      } as McpAuthInfo;
      return next();
    }
    if (apiKey && isUnsubstitutedPlaceholder(apiKey)) {
      log.warn(
        `Ignoring ${HeaderKey.API_KEY} header with unsubstituted placeholder value; falling back to bearer auth`
      );
    }
    return bearerAuth(req, res, (error?: unknown) => {
      if (error) {
        return next(error);
      }
      if (req.auth) {
        const { emptyAudience, ...auth } = req.auth as BearerAuthInfo;
        if (emptyAudience) {
          // Fields go in the message: the development log format drops extra arguments.
          // JSON.stringify quotes the client-supplied values, so they cannot forge log text.
          const { cid, grant } = decodeJwt(auth.token);
          const userAgent = req.headers['user-agent'];
          log.warn(
            `empty_token_audience: token with empty audience accepted ` +
              `cid=${JSON.stringify(cid)} grant=${JSON.stringify(grant)} user_agent=${JSON.stringify(userAgent)}`
          );
        }
        req.auth = { ...auth, authType: AuthType.Bearer } as McpAuthInfo;
      }
      return next();
    });
  };
}

export function isApiKeyAuth(auth: AuthInfo): auth is McpAuthInfo {
  return (auth as Partial<McpAuthInfo>).authType === AuthType.ApiKey;
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
    log.info('OAuth2 - Dynamic Client Registration: disabled (OAUTH_REGISTRATION_URL is empty)');
  }
}

/**
 * Extracts writable mode from request headers
 *
 * @param headers - Request headers
 * @param headerName - Name of the header containing the mode
 * @returns WritableMode enum value
 */
export function extractMode(
  headers: Headers,
  headerName: string = HeaderKey.ENABLE_WRITE
): WritableMode {
  const mode = headers.get(headerName);
  log.debug(`Extracted mode from ${headerName}:`, mode);

  if (mode === 'true' || mode === WritableMode.WRITABLE) {
    return WritableMode.WRITABLE;
  }
  return WritableMode.READONLY;
}
