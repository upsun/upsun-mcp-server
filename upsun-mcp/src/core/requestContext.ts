import { AsyncLocalStorage } from 'node:async_hooks';
import type express from 'express';

/**
 * Carries the Express response into tool handler scope so that upstream
 * HTTP errors (e.g. 401) can be forwarded directly to the MCP client.
 */
export const requestContext = new AsyncLocalStorage<{ res: express.Response }>();
