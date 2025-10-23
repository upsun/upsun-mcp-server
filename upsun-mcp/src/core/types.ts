/**
 * Shared types and enums used across the core modules
 */

/**
 * Logging level enumeration
 */
export enum LogLevel {
  DEBUG = 0,
  INFO = 1,
  WARN = 2,
  ERROR = 3,
  NONE = 4,
}

/**
 * MCP type enumeration
 */
export enum McpType {
  REMOTE = 'remote',
  LOCAL = 'local',
}

/**
 * Writable mode enumeration (by priority)
 */
export enum WritableMode {
  READONLY = 'readonly',
  NON_DESTRUCTIVE = 'no-destructive',
  WRITABLE = 'writable',
}

/**
 * Header keys used in requests
 */
export enum HeaderKey {
  MCP_SESSION_ID = 'mcp-session-id',
  API_KEY = 'upsun-api-token',
  ENABLE_WRITE = 'enable-write',
}
