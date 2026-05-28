import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import express from 'express';
import request from 'supertest';
import {
  getOAuth2Config,
  createAuthorizationServerMetadata,
  createProtectedResourceMetadata,
  setupOAuth2Direct,
  HeaderKey,
  JwtTokenVerifier,
  requireMcpAuth,
  API_KEY_CLIENT_ID,
  AuthType,
  sessionOwnerFromAuth,
  authMatchesSessionOwner,
} from '../../src/core/authentication';
import type { AuthInfo } from '../../src/core/authentication';

/** Builds a minimal unsigned JWT with the given payload. */
function makeJwt(payload: Record<string, unknown>): string {
  const header = Buffer.from(JSON.stringify({ alg: 'none' })).toString('base64url');
  const body = Buffer.from(JSON.stringify(payload)).toString('base64url');
  return `${header}.${body}.sig`;
}

describe('Authentication Module', () => {
  describe('OAuth2 Configuration', () => {
    it('should return OAuth2 configuration from centralized config', () => {
      const config = getOAuth2Config();

      // Test that getOAuth2Config returns values from oauth2Config
      expect(config.authorizationUrl).toBe('https://auth.upsun.com/oauth2/authorize');
      expect(config.tokenUrl).toBe('https://auth.upsun.com/oauth2/token');
      expect(config.revocationUrl).toBe('https://auth.upsun.com/oauth2/revoke');
      expect(config.issuerUrl).toBe('https://auth.upsun.com');
      expect(config.baseUrl).toBe('http://127.0.0.1:3000/');
      expect(config.scope).toBe('offline_access');
      expect(config.documentationUrl).toBe('https://docs.upsun.com/');
    });

    it('should have all required OAuth2 properties', () => {
      const config = getOAuth2Config();

      expect(config.authorizationUrl).toBeDefined();
      expect(config.tokenUrl).toBeDefined();
      expect(config.revocationUrl).toBeDefined();
      expect(config.issuerUrl).toBeDefined();
      expect(config.baseUrl).toBeDefined();
      expect(config.scope).toBeDefined();
      expect(typeof config.authorizationUrl).toBe('string');
      expect(typeof config.tokenUrl).toBe('string');
      expect(typeof config.revocationUrl).toBe('string');
      expect(typeof config.issuerUrl).toBe('string');
      expect(typeof config.baseUrl).toBe('string');
      expect(typeof config.scope).toBe('string');
    });

    it('should create authorization server metadata correctly', () => {
      const config = getOAuth2Config();
      const metadata = createAuthorizationServerMetadata(config);

      expect(metadata.issuer).toBe(config.issuerUrl);
      expect(metadata.authorization_endpoint).toBe(config.authorizationUrl);
      expect(metadata.token_endpoint).toBe(config.tokenUrl);
      expect(metadata.revocation_endpoint).toBe(config.revocationUrl);
      expect(metadata.scopes_supported).toEqual(config.scope.split(' '));
      expect(metadata.response_types_supported).toEqual(['code']);
      expect(metadata.grant_types_supported).toEqual(['authorization_code', 'refresh_token']);
      expect(metadata.token_endpoint_auth_methods_supported).toEqual([
        'none',
        'client_secret_basic',
      ]);
      expect(metadata.code_challenge_methods_supported).toEqual(['S256']);
    });

    it('should create protected resource metadata correctly', () => {
      const config = getOAuth2Config();
      const metadata = createProtectedResourceMetadata(config);

      expect(metadata.resource).toBe(config.baseUrl);
      expect(metadata.authorization_servers).toEqual([config.issuerUrl]);
      expect(metadata.scopes_supported).toEqual(config.scope.split(' '));
      expect(metadata.resource_name).toBe('Upsun MCP Server');
      expect(metadata.resource_documentation).toBe(config.documentationUrl);
    });
  });

  describe('OAuth2 Metadata Setup', () => {
    it('should setup OAuth2 metadata endpoints', () => {
      const app = express();
      const getSpy = jest.spyOn(app, 'get');

      setupOAuth2Direct(app);

      expect(getSpy).toHaveBeenCalledWith(
        '/.well-known/oauth-authorization-server',
        expect.any(Function)
      );
      expect(getSpy).toHaveBeenCalledWith(
        '/.well-known/oauth-protected-resource',
        expect.any(Function)
      );
    });

    it('should serve authorization server metadata endpoint', async () => {
      const app = express();
      const config = getOAuth2Config();
      config.baseUrl = 'http://test.example.com/';
      setupOAuth2Direct(app, config);

      const res = await request(app).get('/.well-known/oauth-authorization-server');
      expect(res.status).toBe(200);
      expect(res.body).toMatchObject({
        issuer: 'https://auth.upsun.com',
        authorization_endpoint: 'https://auth.upsun.com/oauth2/authorize',
      });
    });

    it('should serve protected resource metadata endpoint', async () => {
      const app = express();
      const config = getOAuth2Config();
      config.baseUrl = 'http://test.example.com/';
      setupOAuth2Direct(app, config);

      const res = await request(app).get('/.well-known/oauth-protected-resource');
      expect(res.status).toBe(200);
      expect(res.body).toMatchObject({
        resource: 'http://test.example.com/',
        authorization_servers: ['https://auth.upsun.com'],
      });
    });
  });

  describe('Constants', () => {
    it('should export correct HTTP header constants', () => {
      expect(HeaderKey.API_KEY).toBe('upsun-api-token');
      expect(HeaderKey.MCP_SESSION_ID).toBe('mcp-session-id');
    });
  });

  describe('JwtTokenVerifier', () => {
    const verifier = new JwtTokenVerifier();

    it('should parse a valid JWT and return AuthInfo with clock-skew buffer', async () => {
      const token = makeJwt({ sub: 'user-1', scope: 'read write', exp: 9999999999 });
      const info = await verifier.verifyAccessToken(token);
      expect(info.token).toBe(token);
      expect(info.clientId).toBe('user-1');
      expect(info.scopes).toEqual(['read', 'write']);
      expect(info.expiresAt).toBe(9999999999 - 30);
    });

    it('should allow configuring the clock-skew buffer', async () => {
      const v = new JwtTokenVerifier(60);
      const token = makeJwt({ sub: 'user-1', exp: 9999999999 });
      const info = await v.verifyAccessToken(token);
      expect(info.expiresAt).toBe(9999999999 - 60);
    });

    it('should allow disabling the clock-skew buffer', async () => {
      const v = new JwtTokenVerifier(0);
      const token = makeJwt({ sub: 'user-1', exp: 9999999999 });
      const info = await v.verifyAccessToken(token);
      expect(info.expiresAt).toBe(9999999999);
    });

    it('should default clientId to "unknown" when sub is missing', async () => {
      const token = makeJwt({ exp: 9999999999 });
      const info = await verifier.verifyAccessToken(token);
      expect(info.clientId).toBe('unknown');
    });

    it('should handle missing scope', async () => {
      const token = makeJwt({ sub: 'u', exp: 9999999999 });
      const info = await verifier.verifyAccessToken(token);
      expect(info.scopes).toEqual([]);
    });

    it('should reject a JWT missing the exp claim', async () => {
      const token = makeJwt({ sub: 'u' });
      await expect(verifier.verifyAccessToken(token)).rejects.toThrow('JWT missing exp claim');
    });

    it('should reject a non-JWT string', async () => {
      await expect(verifier.verifyAccessToken('not-a-jwt')).rejects.toThrow('Not a valid JWT');
    });

    it('should reject a JWT with malformed payload', async () => {
      const header = Buffer.from('{}').toString('base64url');
      const token = `${header}.!!!.sig`;
      await expect(verifier.verifyAccessToken(token)).rejects.toThrow('Malformed JWT payload');
    });
  });

  describe('requireMcpAuth', () => {
    let mockNext: jest.Mock;

    beforeEach(() => {
      mockNext = jest.fn();
      jest.spyOn(console, 'log').mockImplementation(() => {});
    });

    it('should pass API key requests through without bearer validation', () => {
      const verifier = new JwtTokenVerifier();
      const middleware = requireMcpAuth(verifier);

      const req = { headers: { 'upsun-api-token': 'my-key' } } as unknown as express.Request;
      const res = {} as express.Response;

      middleware(req, res, mockNext);

      expect(mockNext).toHaveBeenCalled();
      expect(req.auth).toEqual({
        token: 'my-key',
        clientId: API_KEY_CLIENT_ID,
        scopes: [],
        authType: AuthType.ApiKey,
      });
    });

    it('should authenticate valid JWT bearer token and populate req.auth', async () => {
      const verifier = new JwtTokenVerifier();
      const middleware = requireMcpAuth(verifier);

      const token = makeJwt({ sub: 'user-42', scope: 'offline_access', exp: 9999999999 });
      const req = {
        headers: { authorization: `Bearer ${token}` },
      } as unknown as express.Request;
      const res = {
        status: jest.fn().mockReturnThis() as any,
        json: jest.fn() as any,
        set: jest.fn() as any,
        setHeader: jest.fn() as any,
      } as unknown as express.Response;

      await new Promise<void>(resolve => {
        middleware(req, res, () => {
          mockNext();
          resolve();
        });
      });

      expect(mockNext).toHaveBeenCalled();
      expect(req.auth).toEqual({
        token,
        clientId: 'user-42',
        scopes: ['offline_access'],
        expiresAt: 9999999999 - 30,
        authType: AuthType.Bearer,
      });
    });

    it('should delegate to bearer auth when no API key is present', () => {
      const verifier = new JwtTokenVerifier();
      const middleware = requireMcpAuth(verifier);

      const req = { headers: {} } as unknown as express.Request;
      const res = {
        status: jest.fn().mockReturnThis() as any,
        json: jest.fn() as any,
        set: jest.fn() as any,
        setHeader: jest.fn() as any,
      } as unknown as express.Response;

      middleware(req, res, mockNext);

      // Without a bearer token, the SDK middleware returns 401.
      expect(mockNext).not.toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(401);
    });

    it('should ignore an API key header with an unsubstituted placeholder value', () => {
      const verifier = new JwtTokenVerifier();
      const middleware = requireMcpAuth(verifier);

      const req = {
        headers: { 'upsun-api-token': '${UPSUN_API_TOKEN}' },
      } as unknown as express.Request;
      const res = {
        status: jest.fn().mockReturnThis() as any,
        json: jest.fn() as any,
        set: jest.fn() as any,
        setHeader: jest.fn() as any,
      } as unknown as express.Response;

      middleware(req, res, mockNext);

      // Placeholder is ignored; bearer middleware runs and rejects unauthenticated requests.
      expect(mockNext).not.toHaveBeenCalled();
      expect(req.auth).toBeUndefined();
      expect(res.status).toHaveBeenCalledWith(401);
    });
  });

  describe('Path-suffixed well-known routes', () => {
    it('should register path-suffixed routes when mcpPath is provided', () => {
      const app = express();
      const getSpy = jest.spyOn(app, 'get');

      setupOAuth2Direct(app, undefined, '/mcp');

      expect(getSpy).toHaveBeenCalledWith(
        '/.well-known/oauth-authorization-server/mcp',
        expect.any(Function)
      );
      expect(getSpy).toHaveBeenCalledWith(
        '/.well-known/oauth-protected-resource/mcp',
        expect.any(Function)
      );
    });

    it('should serve metadata on the path-suffixed protected resource route', async () => {
      const app = express();
      const config = getOAuth2Config();
      setupOAuth2Direct(app, config, '/mcp');

      const res = await request(app).get('/.well-known/oauth-protected-resource/mcp');
      expect(res.status).toBe(200);
      expect(res.body).toMatchObject({ resource: expect.stringContaining('mcp') });
    });

    it('should not register path-suffixed routes when mcpPath is omitted', () => {
      const app = express();
      const getSpy = jest.spyOn(app, 'get');

      setupOAuth2Direct(app);

      const calls = getSpy.mock.calls.map(c => c[0]);
      expect(calls).not.toContain('/.well-known/oauth-authorization-server/mcp');
      expect(calls).not.toContain('/.well-known/oauth-protected-resource/mcp');
    });
  });

  describe('Session ownership binding', () => {
    const bearer = (token: string): AuthInfo => ({ token, clientId: 'user-1', scopes: [] });
    const apiKey = (token: string): AuthInfo => ({
      token,
      clientId: API_KEY_CLIENT_ID,
      scopes: [],
    });

    it('derives the owner as a hex SHA-256 that does not leak the token', () => {
      const owner = sessionOwnerFromAuth(bearer('secret-token'));
      expect(owner).toMatch(/^[0-9a-f]{64}$/);
      expect(owner).not.toContain('secret-token');
    });

    it('matches when the same token is presented again', () => {
      const owner = sessionOwnerFromAuth(bearer('jwt-abc'));
      expect(authMatchesSessionOwner(bearer('jwt-abc'), owner)).toBe(true);
    });

    it('matches the same key regardless of how clientId is labelled', () => {
      // The binding is to the token bytes, not the authentication type.
      const owner = sessionOwnerFromAuth(apiKey('shared-secret'));
      expect(authMatchesSessionOwner(bearer('shared-secret'), owner)).toBe(true);
    });

    it('rejects a different bearer token (e.g. a refreshed or attacker token)', () => {
      const owner = sessionOwnerFromAuth(bearer('jwt-1'));
      expect(authMatchesSessionOwner(bearer('jwt-2-refreshed'), owner)).toBe(false);
    });

    it('rejects a different api key', () => {
      const owner = sessionOwnerFromAuth(apiKey('victim-key'));
      expect(authMatchesSessionOwner(apiKey('attacker-key'), owner)).toBe(false);
    });
  });
});
