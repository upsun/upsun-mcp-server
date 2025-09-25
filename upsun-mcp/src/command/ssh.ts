/**
 * @fileoverview SSH key manageexport function registerSSH(adapter: McpAdapter): void {
  log.info('Register SSH keys Handlers');nt command module for Upsun MCP server.
 * 
 * This module provides MCP tools for managing SSH keys for Upsun accounts.
 * SSH keys allow secure access to project environments for Git operations,
 * shell access, and other remote operations.
 */

import { McpAdapter } from '../core/adapter.js';
import { Response, Schema } from '../core/helper.js';
import { z } from 'zod';
import { createLogger } from '../core/logger.js';

// Create logger for SSH operations
const log = createLogger('MCP:Tool:ssh-commands');

/**
 * Registers SSH key management tools with the MCP server.
 *
 * This function adds three tools for SSH key operations:
 * - add-sshkey: Adds a new SSH key to a user account
 * - delete-sshkey: Removes an existing SSH key from a user account
 * - list-sshkey: Lists all SSH keys for a user account
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
    adapter.server.tool(
      'add-sshkey',
      'Add a SSH key on upsun account',
      {
        user_id: z.string(),
        ssh_key: z.string(),
        key_id: z.string(),
      },
      async ({ user_id, ssh_key, key_id }) => {
        log.debug(`Add SSH Key for User: ${user_id}, Key ID: ${key_id}`);
        const result = await adapter.client.ssh.add(user_id, ssh_key, key_id);

        return Response.json(result);
      }
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
    adapter.server.tool(
      'delete-sshkey',
      'Delete a SSH key of upsun account',
      {
        user_id: z.string(),
        key_id: z.string(),
      },
      async ({ user_id, key_id }) => {
        log.debug(`Delete SSH Key for User: ${user_id}, Key ID: ${key_id}`);
        const result = await adapter.client.ssh.delete(user_id, key_id);

        return Response.json(result);
      }
    );
  }

  /**
   * Tool: list-sshkey
   * Lists all SSH keys for a specific user account.
   *
   * Returns an array of SSH keys with information such as key ID,
   * fingerprint, type, and creation date.
   *
   * @param user_id - The ID of the user to list SSH keys for
   */
  adapter.server.tool(
    'list-sshkey',
    'List all SSH keys of upsun account',
    {
      user_id: z.string(),
    },
    async ({ user_id }) => {
      log.debug(`List SSH Keys for User: ${user_id}`);
      const result = await adapter.client.ssh.list(user_id);

      return Response.json(result);
    }
  );
}
