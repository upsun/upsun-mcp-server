/**
 * @fileoverview SSH key manageexport function registerSSH(adapter: McpAdapter): void {
  log.info('Register SSH keys Handlers');nt command module for Upsun MCP server.
 * 
 * This module provides MCP tools for managing SSH keys for Upsun accounts.
 * SSH keys allow secure access to project environments for Git operations,
 * shell access, and other remote operations.
 */

import { McpAdapter } from '../core/adapter.js';
import { Response, Schema, ToolWrapper } from '../core/helper.js';
import { z } from 'zod';
import { createLogger } from '../core/logger.js';

// Create logger for SSH operations
const log = createLogger('MCP:Tool:ssh-commands');

/**
 * Registers SSH key management tools with the MCP server.
 *
 * This function adds two tools for SSH key operations:
 * - add-sshkey: Adds a new SSH key to a user account
 * - delete-sshkey: Removes an existing SSH key from a user account
 *
 *
 * @param adapter - The MCP adapter instance to register tools with
 *
 * @example
 * ```typescript
 * const server = new UpsunMcpServer();
 * registerSshKey(server);
 * ```
 */
export function registerSshKey(adapter: McpAdapter): void {
  log.info('Register SSH keys Handlers');

  /**
   * Tool: add-sshkey
   * Adds a new SSH public key to a user's account.
   *
   * SSH keys allow secure access to project environments for Git operations,
   * shell access, and other remote operations without password authentication.
   *
   * @param user_id - The ID of the user to add the SSH key to
   * @param ssh_key - The SSH public key content (starting with 'ssh-rsa', 'ssh-ed25519', etc.)
   * @param key_id - A unique identifier or label for the SSH key
   */
  if (adapter.isMode()) {
    adapter.server.registerTool(
      'add-sshkey',
      {
        annotations: { destructiveHint: false },
        description: 'Add a SSH key on upsun account',
        inputSchema: {
          user_id: z.string(),
          ssh_key: z.string(),
          key_id: z.string(),
        },
      },
      ToolWrapper.trace(
        'add-sshkey',
        async ({ user_id, ssh_key, key_id }) => {
          log.debug(`Add SSH Key for User: ${user_id}, Key ID: ${key_id}`);
          const result = await adapter.client.ssh.add(ssh_key, user_id, key_id);

          return Response.json(result);
        },
        { logParams: false }
      )
    );
  }

  /**
   * Tool: delete-sshkey
   * Removes an SSH key from a user's account.
   *
   * @warning This operation will revoke access for any systems using this key
   * for authentication. Make sure alternative access methods are available
   * before removing keys.
   *
   * @param user_id - The ID of the user who owns the SSH key
   * @param key_id - The unique identifier of the SSH key to delete
   */
  if (adapter.isMode()) {
    adapter.server.registerTool(
      'delete-sshkey',
      {
        annotations: { destructiveHint: true },
        description: 'Delete a SSH key of upsun account',
        inputSchema: {
          user_id: z.string(),
          key_id: z.string(),
        },
      },
      ToolWrapper.trace('delete-sshkey', async ({ user_id, key_id }) => {
        log.debug(`Delete SSH Key for User: ${user_id}, Key ID: ${key_id}`);
        const numericKeyId = Number(key_id);
        const result = await adapter.client.ssh.delete(numericKeyId);

        return Response.json(result);
      })
    );
  }

}
