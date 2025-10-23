/**
 * Application configuration module
 *
 * This module centralizes all configuration values and environment variables
 * used throughout the application, including OpenTelemetry settings.
 */

/**
 * Parse a string value to boolean
 */
function parseBoolean(value: string | undefined, defaultValue: boolean): boolean {
  if (!value) return defaultValue;
  return value.toLowerCase() === 'true' || value === '1';
}

/**
 * Parse a string value to number with validation
 */
function parseNumber(
  value: string | undefined,
  defaultValue: number,
  min?: number,
  max?: number
): number {
  if (!value) return defaultValue;
  const parsed = parseFloat(value);
  if (isNaN(parsed)) return defaultValue;
  if (min !== undefined && parsed < min) return min;
  if (max !== undefined && parsed > max) return max;
  return parsed;
}

/**
 * OpenTelemetry configuration
 */
export const otelConfig = {
  /** Enable or disable OpenTelemetry tracing */
  enabled: parseBoolean(process.env.OTEL_ENABLED, true),

  /** Sampling rate for traces (0.0 to 1.0) */
  samplingRate: parseNumber(process.env.OTEL_SAMPLING_RATE, 1.0, 0.0, 1.0),

  /** Exporter type: console, otlp, or none */
  exporterType: (process.env.OTEL_EXPORTER_TYPE || 'console') as 'console' | 'otlp' | 'none',

  /** OTLP exporter endpoint URL */
  exporterEndpoint: process.env.OTEL_EXPORTER_ENDPOINT || 'http://localhost:4318/v1/traces',

  /** Service name for telemetry */
  serviceName: process.env.OTEL_SERVICE_NAME || 'upsun-mcp-server',

  /** Current environment */
  environment: process.env.NODE_ENV || 'development',
} as const;

/**
 * Application configuration
 */
export const appConfig = {
  /** Server type: local (stdio) or remote (http) */
  typeEnv: process.env.TYPE_ENV || 'remote',

  /** HTTP server port */
  port: parseNumber(process.env.PORT, 3000),

  /** Server mode: READONLY or WRITABLE */
  mode: process.env.MODE || 'READONLY',

  /** Upsun API key */
  apiKey: process.env.UPSUN_API_KEY || '',
} as const;

/**
 * Get a human-readable configuration summary
 */
export function getConfigSummary(): string {
  return `
Configuration:
  OpenTelemetry:
    - Enabled: ${otelConfig.enabled}
    - Sampling Rate: ${(otelConfig.samplingRate * 100).toFixed(0)}%
    - Exporter: ${otelConfig.exporterType}
    - Service Name: ${otelConfig.serviceName}
    - Environment: ${otelConfig.environment}
  
  Application:
    - Type: ${appConfig.typeEnv}
    - Port: ${appConfig.port}
    - Mode: ${appConfig.mode}
  `.trim();
}
