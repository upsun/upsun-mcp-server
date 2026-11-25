import { describe, it, expect, jest, beforeAll, beforeEach, afterEach } from '@jest/globals';
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
} from '../../src/core/authentication';

import { SignJWT, createLocalJWKSet, createRemoteJWKSet, exportJWK, generateKeyPair } from 'jose';
import type { JWTPayload } from 'jose';
import { createServer } from 'node:http';
import type { AddressInfo } from 'node:net';
import { createLogger } from '../../src/core/logger';
import { TEST_ISSUER, TEST_KID, TEST_RESOURCE, createTestAuth } from '../helpers/jwt';
import type { TestAuth } from '../helpers/jwt';

describe('Authentication Module', () => {
  describe('OAuth2 Configuration', () => {
    it('should return OAuth2 configuration from centralized config', () => {
      const config = getOAuth2Config();

      // Test that getOAuth2Config returns values from oauth2Config
      expect(config.authorizationUrl).toBe('https://auth.upsun.com/oauth2/authorize');
      expect(config.tokenUrl).toBe('https://auth.upsun.com/oauth2/token');
      expect(config.revocationUrl).toBe('https://auth.upsun.com/oauth2/revoke');
      expect(config.registrationUrl).toBe('https://auth.upsun.com/oauth2/register');
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
      expect(metadata.registration_endpoint).toBe('https://auth.upsun.com/oauth2/register');
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
    });
  });

  describe('JwtTokenVerifier', () => {
    let auth: TestAuth;
    let verifier: JwtTokenVerifier;
    const now = () => Math.floor(Date.now() / 1000);

    beforeAll(async () => {
      auth = await createTestAuth();
      verifier = auth.verifier();
    });

    const rejects = (token: string | Promise<string>, reason: string) =>
      expect(Promise.resolve(token).then(t => verifier.verifyAccessToken(t))).rejects.toMatchObject(
        {
          code: 'invalid_token',
          message: reason,
        }
      );

    it('accepts a signed token for this resource and returns its auth info', async () => {
      const exp = now() + 300;
      const token = await auth.sign({ cid: 'claude', sub: 'user-1', scp: ['offline_access'], exp });
      const info = await verifier.verifyAccessToken(token);
      expect(info).toEqual({
        token,
        clientId: 'claude',
        scopes: ['offline_access'],
        expiresAt: exp - 30,
      });
    });

    it('falls back to sub, then "unknown", for the client ID', async () => {
      const withSub = await verifier.verifyAccessToken(await auth.sign({ sub: 'user-1' }));
      expect(withSub.clientId).toBe('user-1');
      const withNone = await verifier.verifyAccessToken(await auth.sign());
      expect(withNone.clientId).toBe('unknown');
    });

    it('reads scopes from a space-separated scope claim when scp is absent', async () => {
      const info = await verifier.verifyAccessToken(await auth.sign({ scope: 'read  write' }));
      expect(info.scopes).toEqual(['read', 'write']);
    });

    it('subtracts the configured clock-skew buffer from exp', async () => {
      const exp = now() + 300;
      const token = await auth.sign({ exp });
      expect((await auth.verifier(60).verifyAccessToken(token)).expiresAt).toBe(exp - 60);
      expect((await auth.verifier(0).verifyAccessToken(token)).expiresAt).toBe(exp);
    });

    describe('audience', () => {
      it.each([
        ['the resource with a trailing slash', `${TEST_RESOURCE}/`],
        ['a list that holds the resource', ['https://other.test', TEST_RESOURCE]],
      ])('accepts %s', async (_name, aud) => {
        const info = await verifier.verifyAccessToken(await auth.sign({ aud }));
        expect(info).not.toHaveProperty('emptyAudience');
      });

      // Temporary: clients that send no RFC 8707 resource get a token with an empty audience.
      it.each([
        ['an empty string', ''],
        ['a list of one empty string', ['']],
        ['an empty list', []],
        ['no aud claim', undefined],
      ])('accepts and flags %s', async (_name, aud) => {
        const info = await verifier.verifyAccessToken(await auth.sign({ aud }));
        expect(info).toMatchObject({ emptyAudience: true });
      });

      it.each([
        ['the API URL', 'https://api.upsun.com'],
        ['another URL', 'https://example.com'],
        ['a path prefix of the resource', 'https://mcp.test'],
        ['an empty audience next to another URL', ['', 'https://other.test']],
      ])('refuses %s', async (_name, aud) => {
        await rejects(auth.sign({ aud }), 'Token audience is not this server');
      });

      // Only Upsun Auth can sign such a token, but it must still get 401, not a 500.
      it.each([
        ['a number', 123],
        ['a list with a number', [123]],
        ['an object', {}],
      ])('refuses a non-string audience: %s', async (_name, aud) => {
        await rejects(auth.sign({ aud } as JWTPayload), 'Invalid token audience');
      });
    });

    describe('signature', () => {
      it('refuses a token signed with another key', async () => {
        const { privateKey } = await generateKeyPair('ES256');
        const token = new SignJWT({ iss: TEST_ISSUER, aud: TEST_RESOURCE, exp: now() + 300 })
          .setProtectedHeader({ alg: 'ES256', kid: TEST_KID })
          .sign(privateKey);
        await rejects(token, 'Invalid token signature');
      });

      it('refuses a token whose payload was changed after signing', async () => {
        const [header, , signature] = (await auth.sign()).split('.');
        const payload = Buffer.from(
          JSON.stringify({ iss: TEST_ISSUER, aud: TEST_RESOURCE, exp: now() + 3600 })
        ).toString('base64url');
        await rejects(`${header}.${payload}.${signature}`, 'Invalid token signature');
      });

      it('refuses a token signed with an unknown key ID', async () => {
        const token = new SignJWT({ iss: TEST_ISSUER, aud: TEST_RESOURCE, exp: now() + 300 })
          .setProtectedHeader({ alg: 'ES256', kid: 'other-key' })
          .sign(auth.privateKey);
        await rejects(token, 'Unknown token signing key');
      });

      // jose does not try each key: with two ES256 keys, a token with no kid matches none.
      it('refuses a token with no key ID when the key set holds two keys', async () => {
        const jwk = async () => ({
          ...(await exportJWK((await generateKeyPair('ES256')).publicKey)),
          alg: 'ES256',
        });
        const twoKeys = new JwtTokenVerifier({
          keys: createLocalJWKSet({ keys: [await jwk(), await jwk()] }),
          issuer: TEST_ISSUER,
          resource: TEST_RESOURCE,
        });
        const token = await new SignJWT({ iss: TEST_ISSUER, aud: TEST_RESOURCE, exp: now() + 300 })
          .setProtectedHeader({ alg: 'ES256' })
          .sign(auth.privateKey);
        await expect(twoKeys.verifyAccessToken(token)).rejects.toMatchObject({
          code: 'invalid_token',
          message: 'Unknown token signing key',
        });
      });

      it('refuses a token with an unknown crit header', async () => {
        const part = (v: object) => Buffer.from(JSON.stringify(v)).toString('base64url');
        const header = { alg: 'ES256', kid: TEST_KID, crit: ['zz'], zz: 1 };
        const claims = { iss: TEST_ISSUER, aud: TEST_RESOURCE, exp: now() + 300 };
        await rejects(`${part(header)}.${part(claims)}.c2ln`, 'Malformed token');
      });

      it('refuses an HS256 token', async () => {
        const token = new SignJWT({ iss: TEST_ISSUER, aud: TEST_RESOURCE, exp: now() + 300 })
          .setProtectedHeader({ alg: 'HS256', kid: TEST_KID })
          .sign(new TextEncoder().encode('a-shared-secret-of-32-bytes-long!'));
        await rejects(token, 'Token signing algorithm not allowed');
      });

      it('refuses an unsigned (alg none) token', async () => {
        const part = (v: object) => Buffer.from(JSON.stringify(v)).toString('base64url');
        const claims = { iss: TEST_ISSUER, aud: TEST_RESOURCE, exp: now() + 300 };
        await rejects(
          `${part({ alg: 'none' })}.${part(claims)}.`,
          'Token signing algorithm not allowed'
        );
      });

      it('refuses a string that is not a JWT', async () => {
        await rejects('not-a-jwt', 'Malformed token');
      });
    });

    describe('claims', () => {
      it('refuses an expired token', async () => {
        await rejects(auth.sign({ exp: now() - 10 }), 'Token expired');
      });

      it('refuses a token without exp', async () => {
        await rejects(auth.sign({ exp: undefined }), 'Invalid token claims');
      });

      it('refuses a token from another issuer', async () => {
        await rejects(auth.sign({ iss: 'https://auth.other.test' }), 'Invalid token claims');
      });

      it('refuses a token issued more than 5 minutes in the future', async () => {
        await rejects(auth.sign({ iat: now() + 600 }), 'Token issued in the future');
      });

      it('accepts a token issued slightly in the future (clock skew)', async () => {
        const token = await auth.sign({ iat: now() + 60 });
        await expect(verifier.verifyAccessToken(token)).resolves.toBeDefined();
      });
    });

    // A JWKS fetch failure is a server fault: it must not tell the client its token is invalid.
    it('propagates a JWKS fetch failure instead of answering invalid_token', async () => {
      const jwksServer = createServer((_req, res) => res.writeHead(503).end());
      await new Promise<void>(resolve => jwksServer.listen(0, '127.0.0.1', resolve));
      try {
        const { port } = jwksServer.address() as AddressInfo;
        const remote = new JwtTokenVerifier({
          keys: createRemoteJWKSet(new URL(`http://127.0.0.1:${port}/jwks.json`)),
          issuer: TEST_ISSUER,
          resource: TEST_RESOURCE,
        });
        const error = await remote.verifyAccessToken(await auth.sign()).catch(e => e);
        expect(error).toBeInstanceOf(Error);
        expect(error).not.toMatchObject({ code: 'invalid_token' });
      } finally {
        jwksServer.close();
      }
    });
  });

  describe('requireMcpAuth', () => {
    let auth: TestAuth;
    let mockNext: jest.Mock;
    let warn: ReturnType<typeof jest.spyOn>;

    const mockRes = () =>
      ({
        status: jest.fn().mockReturnThis() as any,
        json: jest.fn() as any,
        set: jest.fn() as any,
        setHeader: jest.fn() as any,
      }) as unknown as express.Response;

    const runBearer = (token: string, headers: Record<string, string> = {}) => {
      const middleware = requireMcpAuth(auth.verifier());
      const req = {
        headers: { authorization: `Bearer ${token}`, ...headers },
      } as unknown as express.Request;
      return new Promise<express.Request>(resolve => {
        middleware(req, mockRes(), () => {
          mockNext();
          resolve(req);
        });
      });
    };

    beforeAll(async () => {
      auth = await createTestAuth();
    });

    beforeEach(() => {
      mockNext = jest.fn();
      jest.spyOn(console, 'log').mockImplementation(() => {});
      // Logger instances share one prototype, so this also spies on the Auth module's logger.
      warn = jest.spyOn(Object.getPrototypeOf(createLogger('test')), 'warn');
    });

    afterEach(() => {
      warn.mockRestore();
    });

    it('should pass API key requests through without bearer validation', () => {
      const middleware = requireMcpAuth(auth.verifier());
      const req = { headers: { 'upsun-api-token': 'my-key' } } as unknown as express.Request;

      middleware(req, {} as express.Response, mockNext);

      expect(mockNext).toHaveBeenCalled();
      expect(req.auth).toEqual({
        token: 'my-key',
        clientId: API_KEY_CLIENT_ID,
        scopes: [],
        authType: AuthType.ApiKey,
      });
    });

    it('should authenticate a valid bearer token and populate req.auth', async () => {
      const exp = Math.floor(Date.now() / 1000) + 300;
      const token = await auth.sign({ cid: 'claude', scp: ['offline_access'], exp });

      const req = await runBearer(token);

      expect(req.auth).toEqual({
        token,
        clientId: 'claude',
        scopes: ['offline_access'],
        expiresAt: exp - 30,
        authType: AuthType.Bearer,
      });
      expect(warn).not.toHaveBeenCalled();
    });

    it('logs each accepted token with an empty audience, without the token or the subject', async () => {
      const token = await auth.sign({
        aud: '',
        cid: 'some-client',
        grant: 'api_token',
        sub: 'user-secret-id',
      });

      const req = await runBearer(token, { 'user-agent': 'SomeClient/1.0' });

      expect(req.auth).toEqual({
        token,
        clientId: 'some-client',
        scopes: [],
        expiresAt: expect.any(Number),
        authType: AuthType.Bearer,
      });

      expect(warn).toHaveBeenCalledTimes(1);
      expect(warn).toHaveBeenCalledWith(
        'empty_token_audience: token with empty audience accepted ' +
          'cid="some-client" grant="api_token" user_agent="SomeClient/1.0"'
      );
      expect(JSON.stringify(warn.mock.calls)).not.toContain(token);
      expect(JSON.stringify(warn.mock.calls)).not.toContain('user-secret-id');
    });

    // The User-Agent is client-supplied: a newline must not start a fake log line.
    it('escapes a client-supplied user agent in the empty-audience log', async () => {
      const token = await auth.sign({ aud: '' });

      await runBearer(token, { 'user-agent': 'evil\nERROR: fake "line"' });

      expect(warn).toHaveBeenCalledWith(
        expect.stringContaining('user_agent="evil\\nERROR: fake \\"line\\""')
      );
    });

    it('should delegate to bearer auth when no API key is present', async () => {
      const middleware = requireMcpAuth(auth.verifier());
      const req = { headers: {} } as unknown as express.Request;
      const res = mockRes();

      await middleware(req, res, mockNext);

      // Without a bearer token, the SDK middleware returns 401.
      expect(mockNext).not.toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(401);
    });

    it('should ignore an API key header with an unsubstituted placeholder value', async () => {
      const middleware = requireMcpAuth(auth.verifier());
      const req = {
        headers: { 'upsun-api-token': '${UPSUN_API_TOKEN}' },
      } as unknown as express.Request;
      const res = mockRes();

      await middleware(req, res, mockNext);

      // Placeholder is ignored; bearer middleware runs and rejects unauthenticated requests.
      expect(mockNext).not.toHaveBeenCalled();
      expect(req.auth).toBeUndefined();
      expect(res.status).toHaveBeenCalledWith(401);
    });

    it('should answer 401 with the reason for a token the verifier rejects', async () => {
      const middleware = requireMcpAuth(auth.verifier());
      const token = await auth.sign({ aud: 'https://example.com' });
      const req = { headers: { authorization: `Bearer ${token}` } } as unknown as express.Request;
      const res = mockRes();

      await middleware(req, res, mockNext);

      expect(mockNext).not.toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: 'invalid_token',
          error_description: 'Token audience is not this server',
        })
      );
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
});
