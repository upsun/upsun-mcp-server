/**
 * @fileoverview Certificate management command module for Upsun MCP server.
 *
 * This module provides MCP tools for managing SSL/TLS certificates for Upsun projects.
 * Certificates are used to secure custom domains with HTTPS, allowing for encrypted
 * communication between clients and Upsun-hosted applications.
 */

import { McpAdapter } from '../core/adapter.js';
import { Response, Schema, ToolWrapper } from '../core/helper.js';
import { z } from 'zod';
import { createLogger } from '../core/logger.js';

// Create logger for certificate operations
const log = createLogger('MCP:Tool:certificate-commands');

/**
 * Registers certificate management tools with the MCP server.
 *
 * This function adds four tools for certificate operations:
 * - add-certificate: Adds a custom SSL/TLS certificate
 * - delete-certificate: Deletes an existing certificate
 * - get-certificate: Retrieves information about a specific certificate
 * - list-certificate: Lists all certificates for a project
 *
 * @param adapter - The MCP adapter instance to register tools with
 *
 * @example
 * ```typescript
 * const server = new UpsunMcpServer();
 * registerCertificate(server);
 * ```
 */
export function registerCertificate(adapter: McpAdapter): void {
  log.info('Register Certificate Handlers');

  /**
   * Tool: add-certificate
   * Adds a custom SSL/TLS certificate to a project.
   *
   * Custom certificates can be used instead of the automatically provisioned
   * Let's Encrypt certificates, for cases where wildcard certificates or
   * Extended Validation (EV) certificates are required.
   *
   * @param project_id - The project ID to add the certificate to
   * @param certificate - The public certificate in PEM format
   * @param key - The private key in PEM format
   * @param chain - The certificate chain in PEM format
   */
  if (adapter.isMode()) {
    adapter.server.tool(
      'add-certificate',
      'Add an SSL/TLS certificate of upsun project',
      {
        project_id: Schema.projectId(),
        certificate: z.string(),
        key: z.string(),
        chain: z.any(),
      },
      ToolWrapper.trace(
        'add-certificate',
        async ({ project_id, certificate, key, chain }) => {
          log.debug(`Add Certificate in Project ${project_id}`);
          const result = await adapter.client.certificate.add(project_id, certificate, key, chain);
          return Response.json(result);
        },
        { logParams: false }
      ) // Do not log certificates/keys
    );
  }

  /**
   * Tool: delete-certificate
   * Permanently deletes a certificate from a project.
   *
   * @warning This operation is irreversible and may impact HTTPS access
   * to domains associated with this certificate.
   *
   * @param project_id - The project ID containing the certificate
   * @param certificate_id - The unique identifier of the certificate to delete
   */
  if (adapter.isMode()) {
    adapter.server.tool(
      'delete-certificate',
      'Delete an SSL/TLS certificate of upsun project',
      {
        project_id: Schema.projectId(),
        certificate_id: Schema.certificateId(),
      },
      ToolWrapper.trace('delete-certificate', async ({ project_id, certificate_id }) => {
        log.debug(`Delete Certificate ${certificate_id} in Project ${project_id}`);
        const result = await adapter.client.certificate.delete(project_id, certificate_id);
        return Response.json(result);
      })
    );
  }

  /**
   * Tool: get-certificate
   * Retrieves detailed information about a specific certificate.
   *
   * Returns comprehensive certificate details including validity dates,
   * domains covered, issuer information, and current status.
   *
   * @param project_id - The project ID containing the certificate
   * @param certificate_id - The unique identifier of the certificate
   */
  adapter.server.tool(
    'get-certificate',
    'Get an SSL/TLS certificate of upsun project',
    {
      project_id: Schema.projectId(),
      certificate_id: Schema.certificateId(),
    },
    ToolWrapper.trace('get-certificate', async ({ project_id, certificate_id }) => {
      log.debug(`Get Certificate ${certificate_id} in Project ${project_id}`);
      const result = await adapter.client.certificate.get(project_id, certificate_id);
      return Response.json(result);
    })
  );

  /**
   * Tool: list-certificate
   * Lists all certificates for a specific project.
   *
   * Returns an array of certificates with basic information such as
   * certificate ID, domains covered, validity dates, and status.
   *
   * @param project_id - The project ID to list certificates from
   */
  adapter.server.tool(
    'list-certificate',
    'List all SSL/TLS certificates of upsun project',
    {
      project_id: Schema.projectId(),
    },
    ToolWrapper.trace('list-certificate', async ({ project_id }) => {
      log.debug(`List Certificates in Project ${project_id}`);
      const result = await adapter.client.certificate.list(project_id);
      return Response.json(result);
    })
  );
}
