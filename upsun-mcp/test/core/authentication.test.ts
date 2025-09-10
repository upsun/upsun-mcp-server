import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import express from 'express';
import {
  getOAuth2Config,
  createAuthorizationServerMetadata,
  createProtectedResourceMetadata,
  setupOAuth2Metadata,
  extractBearerToken,
  validateBearerToken,
  requireBearerToken,
  extractApiKey,
  HTTP_UPSUN_APIKEY_ATTR,
  HTTP_SESSION_ATTR
} from '../../src/core/authentication.js';

describe('Authentication Module', () => {
  
  describe('OAuth2 Configuration', () => {
    
    it('should return default OAuth2 configuration', () => {
      const config = getOAuth2Config();
      
      expect(config.authorizationUrl).toBe("https://auth.upsun.com/oauth2/authorize");
      expect(config.tokenUrl).toBe("https://auth.upsun.com/oauth2/token");
      expect(config.revocationUrl).toBe("https://auth.upsun.com/oauth2/revoke");
      expect(config.issuerUrl).toBe("https://auth.upsun.com");
      expect(config.baseUrl).toBe("http://127.0.0.1:3000/");
      expect(config.scope).toBe("offline_access");
      expect(config.documentationUrl).toBe("https://docs.example.com/");
    });

    it('should use environment variables when available', () => {
      const originalEnv = process.env;
      process.env = {
        ...originalEnv,
        OAUTH_AUTH_URL: "https://custom.auth.com/authorize",
        OAUTH_TOKEN_URL: "https://custom.auth.com/token",
        OAUTH_REVOCATION_URL: "https://custom.auth.com/revoke",
        OAUTH_ISSUER_URL: "https://custom.auth.com",
        OAUTH_BASE_URL: "https://custom.server.com/",
        OAUTH_SCOPE: "read write",
        OAUTH_DOC_URL: "https://custom.docs.com/"
      };

      const config = getOAuth2Config();
      
      expect(config.authorizationUrl).toBe("https://custom.auth.com/authorize");
      expect(config.tokenUrl).toBe("https://custom.auth.com/token");
      expect(config.revocationUrl).toBe("https://custom.auth.com/revoke");
      expect(config.issuerUrl).toBe("https://custom.auth.com");
      expect(config.baseUrl).toBe("https://custom.server.com/");
      expect(config.scope).toBe("read write");
      expect(config.documentationUrl).toBe("https://custom.docs.com/");

      process.env = originalEnv;
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
      expect(metadata.grant_types_supported).toEqual(['authorization_code']);
      expect(metadata.token_endpoint_auth_methods_supported).toEqual(['none', 'client_secret_basic']);
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
      
      setupOAuth2Metadata(app);
      
      expect(getSpy).toHaveBeenCalledWith('/.well-known/oauth-authorization-server', expect.any(Function));
      expect(getSpy).toHaveBeenCalledWith('/.well-known/oauth-protected-resource', expect.any(Function));
    });

  });

  describe('Bearer Token Extraction', () => {
    
    let mockReq: Partial<express.Request>;

    beforeEach(() => {
      mockReq = {
        headers: {}
      };
      // Mock console.log to avoid output during tests
      jest.spyOn(console, 'log').mockImplementation(() => {});
    });

    it('should extract bearer token from Authorization header', () => {
      mockReq.headers = {
        'authorization': 'Bearer test-token-123'
      };

      const token = extractBearerToken(mockReq as express.Request);
      expect(token).toBe('test-token-123');
    });

    it('should extract bearer token from Authorization header (capitalized)', () => {
      mockReq.headers = {
        'Authorization': 'Bearer test-token-456'
      };

      const token = extractBearerToken(mockReq as express.Request);
      expect(token).toBe('test-token-456');
    });

    it('should return undefined for missing Authorization header', () => {
      const token = extractBearerToken(mockReq as express.Request);
      expect(token).toBeUndefined();
    });

    it('should return undefined for non-Bearer authorization', () => {
      mockReq.headers = {
        'authorization': 'Basic dXNlcjpwYXNz'
      };

      const token = extractBearerToken(mockReq as express.Request);
      expect(token).toBeUndefined();
    });

    it('should return undefined for empty Bearer token', () => {
      mockReq.headers = {
        'authorization': 'Bearer '
      };

      const token = extractBearerToken(mockReq as express.Request);
      expect(token).toBeUndefined();
    });

  });

  describe('Bearer Token Validation', () => {
    
    let mockReq: Partial<express.Request>;

    beforeEach(() => {
      mockReq = {
        headers: {}
      };
      jest.spyOn(console, 'log').mockImplementation(() => {});
    });

    it('should validate valid bearer token', () => {
      mockReq.headers = {
        'authorization': 'Bearer valid-token'
      };

      const result = validateBearerToken(mockReq as express.Request);
      
      expect(result.isValid).toBe(true);
      expect(result.token).toBe('valid-token');
      expect(result.error).toBeUndefined();
    });

    it('should reject missing bearer token', () => {
      const result = validateBearerToken(mockReq as express.Request);
      
      expect(result.isValid).toBe(false);
      expect(result.token).toBeUndefined();
      expect(result.error).toEqual({
        code: 'missing_token',
        message: 'Bearer token required in Authorization header'
      });
    });

    it('should reject empty bearer token', () => {
      mockReq.headers = {
        'authorization': 'Bearer '
      };

      const result = validateBearerToken(mockReq as express.Request);
      
      expect(result.isValid).toBe(false);
      expect(result.token).toBeUndefined();
      expect(result.error).toEqual({
        code: 'invalid_token',
        message: 'Bearer token cannot be empty'
      });
    });

  });

  describe('Bearer Token Middleware', () => {
    
    let mockReq: Partial<express.Request>;
    let mockRes: Partial<express.Response>;
    let mockNext: jest.Mock;

    beforeEach(() => {
      mockReq = {
        headers: {}
      };
      mockRes = {
        status: jest.fn().mockReturnThis() as any,
        json: jest.fn() as any
      };
      mockNext = jest.fn();
      jest.spyOn(console, 'log').mockImplementation(() => {});
    });

    it('should call next() for valid bearer token', () => {
      mockReq.headers = {
        'authorization': 'Bearer valid-token'
      };

      requireBearerToken(
        mockReq as express.Request, 
        mockRes as express.Response, 
        mockNext
      );

      expect(mockNext).toHaveBeenCalled();
      expect((mockReq as any).bearerToken).toBe('valid-token');
      expect(mockRes.status).not.toHaveBeenCalled();
    });

    it('should return 401 for missing bearer token', () => {
      requireBearerToken(
        mockReq as express.Request, 
        mockRes as express.Response, 
        mockNext
      );

      expect(mockRes.status).toHaveBeenCalledWith(401);
      expect(mockRes.json).toHaveBeenCalledWith({
        error: 'missing_token',
        message: 'Bearer token required in Authorization header'
      });
      expect(mockNext).not.toHaveBeenCalled();
    });

  });

  describe('Legacy API Key Validation', () => {
    
    let mockReq: Partial<express.Request>;
    let mockRes: Partial<express.Response>;

    beforeEach(() => {
      mockReq = {
        headers: {},
        ip: '127.0.0.1'
      };
      mockRes = {
        status: jest.fn().mockReturnThis() as any,
        send: jest.fn() as any
      };
      jest.spyOn(console, 'log').mockImplementation(() => {});
    });

    it('should validate legacy API key', () => {
      mockReq.headers = {
        'upsun-api-token': 'test-api-key-123'
      };

      const apiKey = extractApiKey(
        mockReq as express.Request, 
        mockRes as express.Response
      );

      expect(apiKey).toBe('test-api-key-123');
      expect(mockRes.status).not.toHaveBeenCalled();
    });

    it('should reject missing API key', () => {
      const apiKey = extractApiKey(
        mockReq as express.Request, 
        mockRes as express.Response
      );

      expect(apiKey).toBeUndefined();
      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.send).toHaveBeenCalledWith('Missing API key');
    });

    it('should use custom header name', () => {
      mockReq.headers = {
        'custom-api-key': 'custom-key-456'
      };

      const apiKey = extractApiKey(
        mockReq as express.Request, 
        mockRes as express.Response,
        'custom-api-key'
      );

      expect(apiKey).toBe('custom-key-456');
    });

  });

  describe('Constants', () => {
    
    it('should export correct HTTP header constants', () => {
      expect(HTTP_UPSUN_APIKEY_ATTR).toBe('upsun-api-token');
      expect(HTTP_SESSION_ATTR).toBe('mcp-session-id');
    });

  });

});
