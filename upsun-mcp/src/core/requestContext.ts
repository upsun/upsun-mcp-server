import { AsyncLocalStorage } from 'node:async_hooks';

/**
 * Per-request state shared with tool handlers, so that an upstream 401 can be
 * sent to the MCP client in place of the MCP response.
 */
export const requestContext = new AsyncLocalStorage<{ upstream401?: Response }>();
