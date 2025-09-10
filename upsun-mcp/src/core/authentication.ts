import express from "express";
import { randomUUID } from "crypto";

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
 * OAuth2 Dynamic Client Registration Request (RFC 7591)
 */
export interface ClientRegistrationRequest {
  redirect_uris?: string[];
  response_types?: string[];
  grant_types?: string[];
  application_type?: 'web' | 'native';
  contacts?: string[];
  client_name?: string;
  logo_uri?: string;
  client_uri?: string;
  policy_uri?: string;
  tos_uri?: string;
  jwks_uri?: string;
  jwks?: object;
  sector_identifier_uri?: string;
  subject_type?: 'public' | 'pairwise';
  id_token_signed_response_alg?: string;
  id_token_encrypted_response_alg?: string;
  id_token_encrypted_response_enc?: string;
  userinfo_signed_response_alg?: string;
  userinfo_encrypted_response_alg?: string;
  userinfo_encrypted_response_enc?: string;
  request_object_signing_alg?: string;
  request_object_encryption_alg?: string;
  request_object_encryption_enc?: string;
  token_endpoint_auth_method?: 'none' | 'client_secret_post' | 'client_secret_basic' | 'client_secret_jwt' | 'private_key_jwt';
  token_endpoint_auth_signing_alg?: string;
  default_max_age?: number;
  require_auth_time?: boolean;
  default_acr_values?: string[];
  initiate_login_uri?: string;
  request_uris?: string[];
  scope?: string;
  software_id?: string;
  software_version?: string;
}

/**
 * OAuth2 Dynamic Client Registration Response (RFC 7591)
 */
export interface ClientRegistrationResponse {
  client_id: string;
  client_secret?: string;
  registration_access_token?: string;
  registration_client_uri?: string;
  client_id_issued_at?: number;
  client_secret_expires_at?: number;
  // Echo back the client metadata
  redirect_uris?: string[];
  response_types?: string[];
  grant_types?: string[];
  application_type?: 'web' | 'native';
  contacts?: string[];
  client_name?: string;
  logo_uri?: string;
  client_uri?: string;
  policy_uri?: string;
  tos_uri?: string;
  jwks_uri?: string;
  jwks?: object;
  sector_identifier_uri?: string;
  subject_type?: 'public' | 'pairwise';
  id_token_signed_response_alg?: string;
  id_token_encrypted_response_alg?: string;
  id_token_encrypted_response_enc?: string;
  userinfo_signed_response_alg?: string;
  userinfo_encrypted_response_alg?: string;
  userinfo_encrypted_response_enc?: string;
  request_object_signing_alg?: string;
  request_object_encryption_alg?: string;
  request_object_encryption_enc?: string;
  token_endpoint_auth_method?: string;
  token_endpoint_auth_signing_alg?: string;
  default_max_age?: number;
  require_auth_time?: boolean;
  default_acr_values?: string[];
  initiate_login_uri?: string;
  request_uris?: string[];
  scope?: string;
  software_id?: string;
  software_version?: string;
}

/**
 * Registered client information for storage
 */
export interface RegisteredClient extends ClientRegistrationResponse {
  created_at: number;
  updated_at: number;
}

/**
 * Simple in-memory client registry (for production, use persistent storage)
 */
const clientRegistry = new Map<string, RegisteredClient>();

/**
 * Validates client registration request according to RFC 7591
 */
function validateClientRegistrationRequest(request: ClientRegistrationRequest): { isValid: boolean; error?: string } {
  // Validate redirect URIs if provided
  if (request.redirect_uris) {
    for (const uri of request.redirect_uris) {
      try {
        const url = new URL(uri);
        // For native applications, allow custom schemes and localhost
        if (request.application_type === 'native') {
          if (url.protocol === 'https:' || url.hostname === 'localhost' || url.hostname === '127.0.0.1' || !url.protocol.startsWith('http')) {
            continue;
          }
        } else {
          // For web applications, require HTTPS except for localhost
          if (url.protocol === 'https:' || url.hostname === 'localhost' || url.hostname === '127.0.0.1') {
            continue;
          }
        }
        return { isValid: false, error: `Invalid redirect URI: ${uri}` };
      } catch {
        return { isValid: false, error: `Malformed redirect URI: ${uri}` };
      }
    }
  }

  // Validate response types
  if (request.response_types) {
    const supportedResponseTypes = ['code'];
    for (const responseType of request.response_types) {
      if (!supportedResponseTypes.includes(responseType)) {
        return { isValid: false, error: `Unsupported response type: ${responseType}` };
      }
    }
  }

  // Validate grant types
  if (request.grant_types) {
    const supportedGrantTypes = ['authorization_code', 'refresh_token'];
    for (const grantType of request.grant_types) {
      if (!supportedGrantTypes.includes(grantType)) {
        return { isValid: false, error: `Unsupported grant type: ${grantType}` };
      }
    }
  }

  // Validate token endpoint auth method
  if (request.token_endpoint_auth_method) {
    const supportedMethods = ['none', 'client_secret_basic', 'client_secret_post'];
    if (!supportedMethods.includes(request.token_endpoint_auth_method)) {
      return { isValid: false, error: `Unsupported token endpoint auth method: ${request.token_endpoint_auth_method}` };
    }
  }

  return { isValid: true };
}

/**
 * Creates a registered client from a registration request
 */
function createRegisteredClient(request: ClientRegistrationRequest, config: OAuth2Config): RegisteredClient {
  const now = Math.floor(Date.now() / 1000);
  const clientId = randomUUID();
  const registrationAccessToken = randomUUID();
  
  // Generate client secret for confidential clients
  const needsClientSecret = request.token_endpoint_auth_method && 
    ['client_secret_basic', 'client_secret_post', 'client_secret_jwt'].includes(request.token_endpoint_auth_method);
  
  const clientSecret = needsClientSecret ? randomUUID() : undefined;

  return {
    client_id: clientId,
    client_secret: clientSecret,
    registration_access_token: registrationAccessToken,
    registration_client_uri: `${config.baseUrl}register/${clientId}`,
    client_id_issued_at: now,
    client_secret_expires_at: clientSecret ? 0 : undefined, // 0 means never expires
    created_at: now,
    updated_at: now,
    
    // Echo back client metadata with defaults
    redirect_uris: request.redirect_uris || [],
    response_types: request.response_types || ['code'],
    grant_types: request.grant_types || ['authorization_code'],
    application_type: request.application_type || 'native',
    contacts: request.contacts,
    client_name: request.client_name,
    logo_uri: request.logo_uri,
    client_uri: request.client_uri,
    policy_uri: request.policy_uri,
    tos_uri: request.tos_uri,
    jwks_uri: request.jwks_uri,
    jwks: request.jwks,
    sector_identifier_uri: request.sector_identifier_uri,
    subject_type: request.subject_type || 'public',
    id_token_signed_response_alg: request.id_token_signed_response_alg,
    id_token_encrypted_response_alg: request.id_token_encrypted_response_alg,
    id_token_encrypted_response_enc: request.id_token_encrypted_response_enc,
    userinfo_signed_response_alg: request.userinfo_signed_response_alg,
    userinfo_encrypted_response_alg: request.userinfo_encrypted_response_alg,
    userinfo_encrypted_response_enc: request.userinfo_encrypted_response_enc,
    request_object_signing_alg: request.request_object_signing_alg,
    request_object_encryption_alg: request.request_object_encryption_alg,
    request_object_encryption_enc: request.request_object_encryption_enc,
    token_endpoint_auth_method: request.token_endpoint_auth_method || 'none',
    token_endpoint_auth_signing_alg: request.token_endpoint_auth_signing_alg,
    default_max_age: request.default_max_age,
    require_auth_time: request.require_auth_time,
    default_acr_values: request.default_acr_values,
    initiate_login_uri: request.initiate_login_uri,
    request_uris: request.request_uris,
    scope: request.scope || config.scope,
    software_id: request.software_id,
    software_version: request.software_version
  };
}

/**
 * Stores a registered client in the registry
 */
function storeRegisteredClient(client: RegisteredClient): void {
  clientRegistry.set(client.client_id, client);
}

/**
 * Retrieves a registered client from the registry
 */
function getRegisteredClient(clientId: string): RegisteredClient | undefined {
  return clientRegistry.get(clientId);
}

/**
 * Removes a registered client from the registry
 */
function deleteRegisteredClient(clientId: string): boolean {
  return clientRegistry.delete(clientId);
}

/**
 * Gets all registered clients (for administrative purposes)
 */
export function getAllRegisteredClients(): RegisteredClient[] {
  return Array.from(clientRegistry.values());
}

/**
 * Clears all registered clients (for testing purposes)
 */
export function clearAllRegisteredClients(): void {
  clientRegistry.clear();
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
  registration_endpoint?: string;
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
    registration_endpoint: `${config.baseUrl}register`,
    scopes_supported: config.scope.split(' '),
    response_types_supported: ['code'],
    grant_types_supported: ['authorization_code', 'refresh_token'],
    token_endpoint_auth_methods_supported: ['none', 'client_secret_basic', 'client_secret_post'],
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

  // OAuth2 Dynamic Client Registration endpoint (RFC 7591)
  app.post('/register', (req, res) => {
    console.log('[Auth] Dynamic client registration request received');
    
    // Validate content type
    if (req.headers['content-type'] !== 'application/json') {
      res.status(400).json({
        error: 'invalid_client_metadata',
        error_description: 'Content-Type must be application/json'
      });
      return;
    }

    // TODO: Implement initial access token validation for managed registration
    // For now, we'll use open registration (no initial access token required)
    
    const registrationRequest: ClientRegistrationRequest = req.body;
    
    // Validate the registration request
    const validation = validateClientRegistrationRequest(registrationRequest);
    if (!validation.isValid) {
      res.status(400).json({
        error: 'invalid_client_metadata',
        error_description: validation.error
      });
      return;
    }

    try {
      // Create and store the registered client
      const registeredClient = createRegisteredClient(registrationRequest, oauth2Config);
      storeRegisteredClient(registeredClient);

      // Return client registration response (RFC 7591)
      const response: ClientRegistrationResponse = {
        client_id: registeredClient.client_id,
        client_secret: registeredClient.client_secret,
        registration_access_token: registeredClient.registration_access_token,
        registration_client_uri: registeredClient.registration_client_uri,
        client_id_issued_at: registeredClient.client_id_issued_at,
        client_secret_expires_at: registeredClient.client_secret_expires_at,
        
        // Echo back the client metadata
        redirect_uris: registeredClient.redirect_uris,
        response_types: registeredClient.response_types,
        grant_types: registeredClient.grant_types,
        application_type: registeredClient.application_type,
        contacts: registeredClient.contacts,
        client_name: registeredClient.client_name,
        logo_uri: registeredClient.logo_uri,
        client_uri: registeredClient.client_uri,
        policy_uri: registeredClient.policy_uri,
        tos_uri: registeredClient.tos_uri,
        jwks_uri: registeredClient.jwks_uri,
        jwks: registeredClient.jwks,
        sector_identifier_uri: registeredClient.sector_identifier_uri,
        subject_type: registeredClient.subject_type,
        id_token_signed_response_alg: registeredClient.id_token_signed_response_alg,
        id_token_encrypted_response_alg: registeredClient.id_token_encrypted_response_alg,
        id_token_encrypted_response_enc: registeredClient.id_token_encrypted_response_enc,
        userinfo_signed_response_alg: registeredClient.userinfo_signed_response_alg,
        userinfo_encrypted_response_alg: registeredClient.userinfo_encrypted_response_alg,
        userinfo_encrypted_response_enc: registeredClient.userinfo_encrypted_response_enc,
        request_object_signing_alg: registeredClient.request_object_signing_alg,
        request_object_encryption_alg: registeredClient.request_object_encryption_alg,
        request_object_encryption_enc: registeredClient.request_object_encryption_enc,
        token_endpoint_auth_method: registeredClient.token_endpoint_auth_method,
        token_endpoint_auth_signing_alg: registeredClient.token_endpoint_auth_signing_alg,
        default_max_age: registeredClient.default_max_age,
        require_auth_time: registeredClient.require_auth_time,
        default_acr_values: registeredClient.default_acr_values,
        initiate_login_uri: registeredClient.initiate_login_uri,
        request_uris: registeredClient.request_uris,
        scope: registeredClient.scope,
        software_id: registeredClient.software_id,
        software_version: registeredClient.software_version
      };

      console.log(`[Auth] Client registered successfully: ${registeredClient.client_id}`);
      res.status(201).json(response);
    } catch (error) {
      console.error('[Auth] Error during client registration:', error);
      res.status(500).json({
        error: 'server_error',
        error_description: 'Internal server error during client registration'
      });
    }
  });

  // Client Configuration Management endpoints (RFC 7592)
  
  // GET /register/:client_id - Read client configuration
  app.get('/register/:client_id', (req, res) => {
    const clientId = req.params.client_id;
    const authHeader = req.headers['authorization'];
    
    console.log(`[Auth] Client configuration read request for: ${clientId}`);
    
    // Validate registration access token
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      res.status(401).json({
        error: 'invalid_token',
        error_description: 'Registration access token required'
      });
      return;
    }
    
    const registrationAccessToken = authHeader.substring('Bearer '.length).trim();
    const client = getRegisteredClient(clientId);
    
    if (!client) {
      res.status(404).json({
        error: 'invalid_client_id',
        error_description: 'Client not found'
      });
      return;
    }
    
    if (client.registration_access_token !== registrationAccessToken) {
      res.status(401).json({
        error: 'invalid_token',
        error_description: 'Invalid registration access token'
      });
      return;
    }
    
    // Return client configuration (exclude internal fields)
    const response: ClientRegistrationResponse = {
      client_id: client.client_id,
      client_secret: client.client_secret,
      registration_access_token: client.registration_access_token,
      registration_client_uri: client.registration_client_uri,
      client_id_issued_at: client.client_id_issued_at,
      client_secret_expires_at: client.client_secret_expires_at,
      redirect_uris: client.redirect_uris,
      response_types: client.response_types,
      grant_types: client.grant_types,
      application_type: client.application_type,
      contacts: client.contacts,
      client_name: client.client_name,
      logo_uri: client.logo_uri,
      client_uri: client.client_uri,
      policy_uri: client.policy_uri,
      tos_uri: client.tos_uri,
      jwks_uri: client.jwks_uri,
      jwks: client.jwks,
      sector_identifier_uri: client.sector_identifier_uri,
      subject_type: client.subject_type,
      token_endpoint_auth_method: client.token_endpoint_auth_method,
      scope: client.scope,
      software_id: client.software_id,
      software_version: client.software_version
    };
    
    res.json(response);
  });
  
  // PUT /register/:client_id - Update client configuration
  app.put('/register/:client_id', (req, res) => {
    const clientId = req.params.client_id;
    const authHeader = req.headers['authorization'];
    
    console.log(`[Auth] Client configuration update request for: ${clientId}`);
    
    // Validate content type
    if (req.headers['content-type'] !== 'application/json') {
      res.status(400).json({
        error: 'invalid_client_metadata',
        error_description: 'Content-Type must be application/json'
      });
      return;
    }
    
    // Validate registration access token
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      res.status(401).json({
        error: 'invalid_token',
        error_description: 'Registration access token required'
      });
      return;
    }
    
    const registrationAccessToken = authHeader.substring('Bearer '.length).trim();
    const existingClient = getRegisteredClient(clientId);
    
    if (!existingClient) {
      res.status(404).json({
        error: 'invalid_client_id',
        error_description: 'Client not found'
      });
      return;
    }
    
    if (existingClient.registration_access_token !== registrationAccessToken) {
      res.status(401).json({
        error: 'invalid_token',
        error_description: 'Invalid registration access token'
      });
      return;
    }
    
    const updateRequest: ClientRegistrationRequest = req.body;
    
    // Validate the update request
    const validation = validateClientRegistrationRequest(updateRequest);
    if (!validation.isValid) {
      res.status(400).json({
        error: 'invalid_client_metadata',
        error_description: validation.error
      });
      return;
    }
    
    try {
      // Update the client (preserve client_id, client_secret, registration tokens, and timestamps)
      const updatedClient: RegisteredClient = {
        ...existingClient,
        updated_at: Math.floor(Date.now() / 1000),
        
        // Update the metadata
        redirect_uris: updateRequest.redirect_uris || existingClient.redirect_uris,
        response_types: updateRequest.response_types || existingClient.response_types,
        grant_types: updateRequest.grant_types || existingClient.grant_types,
        application_type: updateRequest.application_type || existingClient.application_type,
        contacts: updateRequest.contacts !== undefined ? updateRequest.contacts : existingClient.contacts,
        client_name: updateRequest.client_name !== undefined ? updateRequest.client_name : existingClient.client_name,
        logo_uri: updateRequest.logo_uri !== undefined ? updateRequest.logo_uri : existingClient.logo_uri,
        client_uri: updateRequest.client_uri !== undefined ? updateRequest.client_uri : existingClient.client_uri,
        policy_uri: updateRequest.policy_uri !== undefined ? updateRequest.policy_uri : existingClient.policy_uri,
        tos_uri: updateRequest.tos_uri !== undefined ? updateRequest.tos_uri : existingClient.tos_uri,
        jwks_uri: updateRequest.jwks_uri !== undefined ? updateRequest.jwks_uri : existingClient.jwks_uri,
        jwks: updateRequest.jwks !== undefined ? updateRequest.jwks : existingClient.jwks,
        sector_identifier_uri: updateRequest.sector_identifier_uri !== undefined ? updateRequest.sector_identifier_uri : existingClient.sector_identifier_uri,
        subject_type: updateRequest.subject_type || existingClient.subject_type,
        token_endpoint_auth_method: updateRequest.token_endpoint_auth_method || existingClient.token_endpoint_auth_method,
        scope: updateRequest.scope !== undefined ? updateRequest.scope : existingClient.scope,
        software_id: updateRequest.software_id !== undefined ? updateRequest.software_id : existingClient.software_id,
        software_version: updateRequest.software_version !== undefined ? updateRequest.software_version : existingClient.software_version
      };
      
      storeRegisteredClient(updatedClient);
      
      // Return updated client configuration
      const response: ClientRegistrationResponse = {
        client_id: updatedClient.client_id,
        client_secret: updatedClient.client_secret,
        registration_access_token: updatedClient.registration_access_token,
        registration_client_uri: updatedClient.registration_client_uri,
        client_id_issued_at: updatedClient.client_id_issued_at,
        client_secret_expires_at: updatedClient.client_secret_expires_at,
        redirect_uris: updatedClient.redirect_uris,
        response_types: updatedClient.response_types,
        grant_types: updatedClient.grant_types,
        application_type: updatedClient.application_type,
        contacts: updatedClient.contacts,
        client_name: updatedClient.client_name,
        logo_uri: updatedClient.logo_uri,
        client_uri: updatedClient.client_uri,
        policy_uri: updatedClient.policy_uri,
        tos_uri: updatedClient.tos_uri,
        jwks_uri: updatedClient.jwks_uri,
        jwks: updatedClient.jwks,
        sector_identifier_uri: updatedClient.sector_identifier_uri,
        subject_type: updatedClient.subject_type,
        token_endpoint_auth_method: updatedClient.token_endpoint_auth_method,
        scope: updatedClient.scope,
        software_id: updatedClient.software_id,
        software_version: updatedClient.software_version
      };
      
      console.log(`[Auth] Client updated successfully: ${clientId}`);
      res.json(response);
    } catch (error) {
      console.error('[Auth] Error during client update:', error);
      res.status(500).json({
        error: 'server_error',
        error_description: 'Internal server error during client update'
      });
    }
  });
  
  // DELETE /register/:client_id - Delete client configuration
  app.delete('/register/:client_id', (req, res) => {
    const clientId = req.params.client_id;
    const authHeader = req.headers['authorization'];
    
    console.log(`[Auth] Client deletion request for: ${clientId}`);
    
    // Validate registration access token
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      res.status(401).json({
        error: 'invalid_token',
        error_description: 'Registration access token required'
      });
      return;
    }
    
    const registrationAccessToken = authHeader.substring('Bearer '.length).trim();
    const client = getRegisteredClient(clientId);
    
    if (!client) {
      res.status(404).json({
        error: 'invalid_client_id',
        error_description: 'Client not found'
      });
      return;
    }
    
    if (client.registration_access_token !== registrationAccessToken) {
      res.status(401).json({
        error: 'invalid_token',
        error_description: 'Invalid registration access token'
      });
      return;
    }
    
    // Delete the client
    const deleted = deleteRegisteredClient(clientId);
    
    if (deleted) {
      console.log(`[Auth] Client deleted successfully: ${clientId}`);
      res.status(204).send(); // No Content
    } else {
      res.status(500).json({
        error: 'server_error',
        error_description: 'Failed to delete client'
      });
    }
  });

  console.log(` OAuth2 metadata configured automatically`);
  console.log(`  - Authorization Server: ${oauth2Config.issuerUrl}`);
  console.log(`  - Resource Server: ${oauth2Config.baseUrl}`);
  console.log(`  - Client Registration: ${oauth2Config.baseUrl}register`);
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
