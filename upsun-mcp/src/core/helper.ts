import { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import { z } from 'zod';

/**
 * Schema validation utilities for Upsun MCP server.
 * Provides Zod schema definitions for various Upsun platform entities.
 */
export class Schema {
  /**
   * Creates a Zod string schema for activity IDs.
   * @returns A Zod string schema for validating activity IDs
   */
  static activityId(): z.ZodString {
    return z.string();
  }

  /**
   * Creates a Zod string schema for project IDs.
   * Project IDs must be exactly 13 characters long.
   * @returns A Zod string schema for validating project IDs
   */
  static projectId(): z.ZodString {
    return z.string().length(13, 'Project ID must be 13 characters long');
  }

  /**
   * Creates a Zod string schema for environment names.
   * @returns A Zod string schema for validating environment names
   */
  static environmentName(): z.ZodString {
    return z.string();
  }

  /**
   * Creates a Zod string schema for application names.
   * @returns A Zod string schema for validating application names
   */
  static applicationName(): z.ZodString {
    return z.string();
  }

  /**
   * Creates a Zod string schema for organization IDs.
   * Organization IDs must be exactly 27 characters long.
   * @returns A Zod string schema for validating organization IDs
   */
  static organizationId(): z.ZodString {
    return z.string().length(27, 'Organization ID must be 27 characters long');
  }

  /**
   * Creates a Zod string schema for organization names.
   * @returns A Zod string schema for validating organization names
   */
  static organizationName(): z.ZodString {
    return z.string();
  }

  /**
   * Creates a Zod string schema for backup IDs.
   * Backup IDs must be exactly 27 characters long.
   * @returns A Zod string schema for validating backup IDs
   */
  static backupId(): z.ZodString {
    return z.string().length(27, 'Backup ID must be 27 characters long');
  }

  /**
   * Creates a Zod string schema for certificate IDs.
   * Certificate IDs must be exactly 65 characters long.
   * @returns A Zod string schema for validating certificate IDs
   */
  static certificateId(): z.ZodString {
    return z.string().length(65, 'Certificate ID must be 65 characters long');
  }

  /**
   * Creates a Zod string schema for domain names.
   * Domain names must be less than 255 characters.
   * @returns A Zod string schema for validating domain names
   */
  static domainName(): z.ZodString {
    return z.string().max(255, 'Domain name must be less than 255 characters');
  }
}

/**
 * Assertion utilities for runtime validation of Upsun platform entities.
 * Provides simple boolean validation methods for various entity types.
 */
export class Assert {
  /**
   * Validates a project ID.
   * @param id - The project ID to validate
   * @returns True if the project ID is valid, false otherwise
   * @todo Implement actual validation logic
   */
  static projectId(id: string): boolean {
    return true;
  }

  /**
   * Validates an environment name.
   * @param name - The environment name to validate
   * @returns True if the environment name is valid, false otherwise
   * @todo Implement actual validation logic
   */
  static environmentName(name: string): boolean {
    return true;
  }
}

/**
 * Response formatting utilities for MCP tool results.
 * Provides standardized methods for creating CallToolResult objects.
 */
export class Response {
  /**
   * Creates a text response for MCP tool results.
   * @param text - The text content to include in the response
   * @returns A CallToolResult object containing the text content
   */
  static text(text: string): CallToolResult {
    return {
      content: [
        {
          type: 'text',
          text,
        },
      ],
    };
  }

  /**
   * Creates a JSON response for MCP tool results.
   * Serializes the provided object to formatted JSON string.
   * @param json - The object to serialize as JSON
   * @returns A CallToolResult object containing the JSON string
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  static json(json: any): CallToolResult {
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(json, null, 2),
        },
      ],
    };
  }
}
