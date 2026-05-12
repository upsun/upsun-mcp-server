import { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import { z } from 'zod';
import { withSpanAsync, addSpanAttribute, addSpanEvent } from './telemetry.js';
import { ResponseError } from 'upsun-sdk-node/dist/core/runtime.js';
import { requestContext } from './requestContext.js';
import { createLogger } from './logger.js';

const log = createLogger('MCP:ToolWrapper');

/**
 * List of sensitive parameter names that should be excluded from telemetry logs.
 * These parameters may contain credentials, secrets, or other sensitive data.
 */
export const SENSITIVE_PARAM_KEYWORDS = [
  'token',
  'password',
  'secret',
  'key',
  'apikey',
  'api_key',
  'auth',
  'credential',
] as const;

/**
 * Checks if a parameter name contains sensitive keywords.
 * Used to filter out sensitive data from telemetry logs.
 *
 * @param paramName - The parameter name to check
 * @returns True if the parameter name contains sensitive keywords, false otherwise
 */
export function isSensitiveParam(paramName: string): boolean {
  const lowerName = paramName.toLowerCase();
  return SENSITIVE_PARAM_KEYWORDS.some(keyword => lowerName.includes(keyword));
}

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
    return z
      .string()
      .length(13, 'Project ID must be 13 characters long')
      .describe('Find it in file .upsun/local/project.yaml if exist.');
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
   * Organization IDs must be exactly 25 characters long.
   * @returns A Zod string schema for validating organization IDs
   */
  static organizationId(): z.ZodString {
    return z.string(); //.length(25, 'Organization ID must be 25 characters long');
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

  /**
   * Returns the Zod schema fields for pagination parameters supported by the
   * Upsun API. To follow a next/previous page, pass `links.next.href` or
   * `links.previous.href` from the previous response as `page_link`.
   *
   * @returns Zod input-schema fields for link-based pagination.
   */
  static pagination(): {
    page_size: z.ZodOptional<z.ZodNumber>;
    page_link: z.ZodOptional<z.ZodString>;
  } {
    return {
      page_size: z
        .number()
        .int()
        .min(1)
        .max(100)
        .optional()
        .describe(
          'Number of items for the first page (1-100). Defaults to the API default (typically 50). Ignored when `page_link` is set; the page size embedded in the link is used.'
        ),
      page_link: z
        .string()
        .optional()
        .describe(
          'Opaque pagination link. Use `links.next.href` or `links.previous.href` from the previous response.'
        ),
    };
  }
}

/**
 * Pagination parameters accepted by paginatable list tools.
 */
export interface PaginationParams {
  page_size?: number;
  page_link?: string;
}

/**
 * Translates MCP-style snake_case pagination params into the camelCase filter
 * shape expected by the Upsun SDK. The `page_link` value is treated as an
 * opaque continuation link from the API response; this boundary parses only the
 * SDK fields needed to follow that link.
 */
export function toSdkPagination(params: PaginationParams): {
  pageSize?: number;
  pageBefore?: string;
  pageAfter?: string;
} {
  if (!params.page_link) {
    return {
      pageSize: params.page_size,
      pageBefore: undefined,
      pageAfter: undefined,
    };
  }

  return extractPaginationLink(params.page_link);
}

function extractPaginationLink(value: string): {
  pageSize?: number;
  pageBefore?: string;
  pageAfter?: string;
} {
  let url: URL;
  try {
    url = new URL(value, 'https://placeholder.invalid');
  } catch {
    log.warn('Failed to parse page_link as a URL; forwarding the raw value as pageAfter');
    return { pageSize: undefined, pageBefore: undefined, pageAfter: value };
  }

  const pageAfter = url.searchParams.get('page[after]') ?? url.searchParams.get('pageAfter');
  const pageBefore = url.searchParams.get('page[before]') ?? url.searchParams.get('pageBefore');
  const pageSize = extractPageSize(url);

  if (!pageAfter && !pageBefore) {
    // The link is parseable but carries no recognized cursor (e.g. a bare cursor string or a
    // URL that has been stripped of query params). Forward the raw value to the API as
    // pageAfter so it gets a chance to honour or reject it explicitly, instead of silently
    // re-requesting the first page.
    log.warn('page_link has no recognized cursor parameter; forwarding the raw value as pageAfter');
    return { pageSize, pageBefore: undefined, pageAfter: value };
  }

  return {
    pageSize,
    pageBefore: pageBefore ?? undefined,
    pageAfter: pageAfter ?? undefined,
  };
}

function extractPageSize(url: URL): number | undefined {
  const rawPageSize = url.searchParams.get('page[size]') ?? url.searchParams.get('pageSize');
  if (!rawPageSize) {
    return undefined;
  }
  const pageSize = Number(rawPageSize);
  if (!Number.isInteger(pageSize) || pageSize < 1 || pageSize > 100) {
    return undefined;
  }
  return pageSize;
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

/**
 * If the error is a ResponseError with status 401 and an Express response is
 * available via AsyncLocalStorage, forward the upstream 401 (body + headers)
 * directly to the MCP client and return a dummy CallToolResult. Otherwise
 * return null so the caller can throw normally.
 */
export async function forwardUpstream401<TResult>(error: unknown): Promise<TResult | null> {
  if (!(error instanceof ResponseError) || error.response?.status !== 401) {
    return null;
  }

  const store = requestContext.getStore();
  if (!store || store.res.headersSent) {
    return null;
  }

  const { res } = store;
  log.info('Forwarding upstream 401 to MCP client');

  let body: string;
  try {
    body = await error.response.text();
  } catch {
    // Body may already have been consumed or be unreadable.
    body = '';
  }

  // Re-check after the async read (another handler could have written meanwhile).
  if (res.headersSent) {
    return null;
  }

  res.status(401);

  // Copy relevant headers from the upstream response.
  const wwwAuth = error.response.headers.get('www-authenticate');
  if (wwwAuth) {
    res.setHeader('WWW-Authenticate', wwwAuth);
  }
  const contentType = error.response.headers.get('content-type');
  if (contentType) {
    res.setHeader('Content-Type', contentType);
  }

  res.end(body);

  // Return a dummy result so the MCP SDK does not invoke createToolError.
  return { content: [], isError: true } as TResult;
}

/**
 * Tool execution wrapper with automatic OpenTelemetry tracing.
 *
 * This utility wraps tool handler functions with distributed tracing,
 * automatically capturing tool name, parameters, execution time, and results.
 *
 * @example
 * ```typescript
 * adapter.server.tool(
 *   'my-tool',
 *   'Description',
 *   { param: z.string() },
 *   ToolWrapper.trace('my-tool', async ({ param }) => {
 *     const result = await doSomething(param);
 *     return Response.json(result);
 *   })
 * );
 * ```
 */
export class ToolWrapper {
  /**
   * Wraps a tool handler function with OpenTelemetry tracing.
   *
   * Automatically:
   * - Creates a span for the tool execution
   * - Records tool name and parameters as attributes
   * - Logs start and completion events
   * - Captures errors with stack traces
   * - Measures execution time
   *
   * @param toolName - The name of the tool being executed
   * @param handler - The async function that implements the tool logic
   * @param options - Optional configuration for tracing behavior
   * @returns A wrapped handler function with tracing
   *
   * @example
   * ```typescript
   * ToolWrapper.trace('info-project', async ({ project_id }) => {
   *   const result = await client.project.info(project_id);
   *   return Response.json(result);
   * })
   * ```
   */
  static trace<TParams extends Record<string, unknown>, TResult>(
    toolName: string,
    handler: (params: TParams) => Promise<TResult>,
    options?: {
      /** Additional attributes to add to the span */
      attributes?: Record<string, string | number | boolean>;
      /** Whether to log parameter values (default: true, set false for sensitive data) */
      logParams?: boolean;
    }
  ): (params: TParams) => Promise<TResult> {
    return async (params: TParams): Promise<TResult> => {
      return withSpanAsync('mcp-tool', toolName, async () => {
        // Add base attributes
        addSpanAttribute('tool.name', toolName);

        // Add custom attributes if provided
        if (options?.attributes) {
          for (const [key, value] of Object.entries(options.attributes)) {
            addSpanAttribute(key, value);
          }
        }

        // Log parameters (unless disabled for sensitive data)
        if (options?.logParams !== false) {
          // Add safe parameter attributes (avoid logging sensitive data)
          for (const [key, value] of Object.entries(params)) {
            if (
              typeof value === 'string' ||
              typeof value === 'number' ||
              typeof value === 'boolean'
            ) {
              // Skip parameters that might contain sensitive data
              if (!isSensitiveParam(key)) {
                addSpanAttribute(`param.${key}`, value);
              }
            }
          }
        }

        // Log start event
        addSpanEvent('tool.execution.start', { tool: toolName });

        try {
          // Execute the actual tool handler
          const result = await handler(params);

          // Log completion event
          addSpanEvent('tool.execution.complete', {
            tool: toolName,
            success: true,
          });

          return result;
        } catch (error) {
          const forwarded = await forwardUpstream401<TResult>(error);
          if (forwarded) {
            return forwarded;
          }
          // Error is automatically recorded by withSpanAsync
          addSpanEvent('tool.execution.failed', {
            tool: toolName,
            error: (error as Error).message,
          });
          throw error;
        }
      });
    };
  }

  /**
   * Wraps a tool handler with tracing and additional context extraction.
   *
   * This variant allows extracting specific values from the result to add as span attributes,
   * useful for recording metrics like item counts, IDs, or status codes.
   *
   * @param toolName - The name of the tool being executed
   * @param handler - The async function that implements the tool logic
   * @param extractMetrics - Function to extract metrics from the result
   * @returns A wrapped handler function with tracing and metrics
   *
   * @example
   * ```typescript
   * ToolWrapper.traceWithMetrics(
   *   'list-project',
   *   async ({ org_id }) => {
   *     const projects = await client.project.list(org_id);
   *     return Response.json(projects);
   *   },
   *   (result, params) => ({
   *     'project.count': Array.isArray(result) ? result.length : 0,
   *     'organization.id': params.org_id
   *   })
   * )
   * ```
   */
  static traceWithMetrics<TParams extends Record<string, unknown>, TResult>(
    toolName: string,
    handler: (params: TParams) => Promise<TResult>,
    extractMetrics?: (result: TResult, params: TParams) => Record<string, string | number | boolean>
  ): (params: TParams) => Promise<TResult> {
    return async (params: TParams): Promise<TResult> => {
      return withSpanAsync('mcp-tool', toolName, async () => {
        addSpanAttribute('tool.name', toolName);

        // Log safe parameters
        for (const [key, value] of Object.entries(params)) {
          if (
            typeof value === 'string' ||
            typeof value === 'number' ||
            typeof value === 'boolean'
          ) {
            if (!isSensitiveParam(key)) {
              addSpanAttribute(`param.${key}`, value);
            }
          }
        }

        addSpanEvent('tool.execution.start', { tool: toolName });

        try {
          const result = await handler(params);

          // Extract and record metrics from result
          if (extractMetrics) {
            const metrics = extractMetrics(result, params);
            for (const [key, value] of Object.entries(metrics)) {
              addSpanAttribute(key, value);
            }
          }

          addSpanEvent('tool.execution.complete', {
            tool: toolName,
            success: true,
          });

          return result;
        } catch (error) {
          const forwarded = await forwardUpstream401<TResult>(error);
          if (forwarded) {
            return forwarded;
          }
          addSpanEvent('tool.execution.failed', {
            tool: toolName,
            error: (error as Error).message,
          });
          throw error;
        }
      });
    };
  }
}
