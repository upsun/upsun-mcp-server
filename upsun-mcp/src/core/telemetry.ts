/**
 * OpenTelemetry initialization and configuration module
 *
 * This module sets up distributed tracing for the Upsun MCP Server using OpenTelemetry.
 * It configures sampling, exporters, and instrumentation based on environment variables.
 */

import { NodeSDK } from '@opentelemetry/sdk-node';
import { Resource } from '@opentelemetry/resources';
import { ATTR_SERVICE_NAME, ATTR_SERVICE_VERSION } from '@opentelemetry/semantic-conventions';
import { ConsoleSpanExporter } from '@opentelemetry/sdk-trace-base';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';
import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node';
import { TraceIdRatioBasedSampler } from '@opentelemetry/sdk-trace-base';
import { trace, context, SpanStatusCode, Span } from '@opentelemetry/api';

import * as pjson from '../../package.json' with { type: 'json' };
import { otelConfig } from './config.js';
import { createLogger } from './logger.js';

// Create logger for telemetry operations
const log = createLogger('telemetry');

/** OpenTelemetry SDK instance */
let sdk: NodeSDK | null = null;

/** Flag to track if telemetry is initialized */
let isInitialized = false;

/**
 * Get the appropriate span exporter based on configuration
 */
function getSpanExporter() {
  switch (otelConfig.exporterType) {
    case 'console':
      log.info('Using Console span exporter');
      return new ConsoleSpanExporter();

    case 'otlp':
      log.info(`Using OTLP span exporter: ${otelConfig.exporterEndpoint}`);
      return new OTLPTraceExporter({
        url: otelConfig.exporterEndpoint,
        headers: {},
      });

    case 'none':
      log.info('Using no span exporter (traces collected but not exported)');
      // Return a no-op exporter that does nothing
      return new ConsoleSpanExporter(); // Will be filtered by sampler

    default:
      log.warn(`Unknown exporter type: ${otelConfig.exporterType}, defaulting to console`);
      return new ConsoleSpanExporter();
  }
}

/**
 * Initialize OpenTelemetry SDK
 *
 * Sets up distributed tracing with configured sampling rate, exporter,
 * and automatic instrumentation for Node.js libraries (HTTP, Express, etc.)
 *
 * @returns Promise that resolves when initialization is complete
 *
 * @example
 * ```typescript
 * await initTelemetry();
 * // Telemetry is now active
 * ```
 */
export async function initTelemetry(): Promise<void> {
  if (!otelConfig.enabled) {
    log.info('OpenTelemetry is disabled via configuration');
    return;
  }

  if (isInitialized) {
    log.warn('OpenTelemetry already initialized, skipping...');
    return;
  }

  try {
    log.info('Initializing OpenTelemetry...');
    log.info(`Service: ${otelConfig.serviceName} v${pjson.default.version}`);
    log.info(`Environment: ${otelConfig.environment}`);
    log.info(`Sampling rate: ${(otelConfig.samplingRate * 100).toFixed(0)}%`);
    log.info(`Exporter: ${otelConfig.exporterType}`);

    // Create resource with service information
    const resource = Resource.default().merge(
      new Resource({
        [ATTR_SERVICE_NAME]: otelConfig.serviceName,
        [ATTR_SERVICE_VERSION]: pjson.default.version,
        'deployment.environment': otelConfig.environment,
      })
    );

    // Create sampler based on configured sampling rate
    const sampler = new TraceIdRatioBasedSampler(otelConfig.samplingRate);

    // Get the appropriate exporter
    const traceExporter = getSpanExporter();

    // Initialize SDK with configuration
    sdk = new NodeSDK({
      resource,
      traceExporter,
      sampler,
      instrumentations: [
        getNodeAutoInstrumentations({
          // Customize auto-instrumentation here if needed
          '@opentelemetry/instrumentation-fs': {
            enabled: false, // Disable file system instrumentation (too verbose)
          },
          '@opentelemetry/instrumentation-http': {
            enabled: true,
          },
          '@opentelemetry/instrumentation-express': {
            enabled: true,
          },
        }),
      ],
    });

    // Start the SDK
    await sdk.start();
    isInitialized = true;

    log.info('OpenTelemetry initialized successfully ✓');
  } catch (error) {
    log.error('Failed to initialize OpenTelemetry:', error);
    throw error;
  }
}

/**
 * Shutdown OpenTelemetry SDK gracefully
 *
 * Flushes any pending spans and cleans up resources.
 * Should be called during application shutdown.
 *
 * @returns Promise that resolves when shutdown is complete
 *
 * @example
 * ```typescript
 * process.on('SIGTERM', async () => {
 *   await shutdownTelemetry();
 *   process.exit(0);
 * });
 * ```
 */
export async function shutdownTelemetry(): Promise<void> {
  if (!isInitialized || !sdk) {
    log.debug('OpenTelemetry not initialized, nothing to shutdown');
    return;
  }

  try {
    log.info('Shutting down OpenTelemetry...');
    await sdk.shutdown();
    sdk = null;
    isInitialized = false;
    log.info('OpenTelemetry shutdown complete ✓');
  } catch (error) {
    log.error('Error during OpenTelemetry shutdown:', error);
    throw error;
  }
}

/**
 * Get the current tracer instance
 *
 * @param name - Name of the tracer (typically module or component name)
 * @returns Tracer instance
 *
 * @example
 * ```typescript
 * const tracer = getTracer('gateway');
 * const span = tracer.startSpan('process_request');
 * ```
 */
export function getTracer(name: string) {
  return trace.getTracer(name, pjson.default.version);
}

/**
 * Create and execute a span around a synchronous function
 *
 * @param tracerName - Name of the tracer
 * @param spanName - Name of the span
 * @param fn - Function to execute within the span
 * @param attributes - Optional attributes to add to the span
 * @returns Result of the function
 *
 * @example
 * ```typescript
 * const result = withSpan('gateway', 'processRequest', () => {
 *   return processData();
 * }, { 'user.id': '123' });
 * ```
 */
export function withSpan<T>(
  tracerName: string,
  spanName: string,
  fn: () => T,
  attributes?: Record<string, string | number | boolean>
): T {
  if (!isInitialized || !otelConfig.enabled) {
    return fn();
  }

  const tracer = getTracer(tracerName);
  const span = tracer.startSpan(spanName);

  if (attributes) {
    span.setAttributes(attributes);
  }

  try {
    const result = context.with(trace.setSpan(context.active(), span), fn);
    span.setStatus({ code: SpanStatusCode.OK });
    return result;
  } catch (error) {
    span.recordException(error as Error);
    span.setStatus({
      code: SpanStatusCode.ERROR,
      message: (error as Error).message,
    });
    throw error;
  } finally {
    span.end();
  }
}

/**
 * Create and execute a span around an asynchronous function
 *
 * @param tracerName - Name of the tracer
 * @param spanName - Name of the span
 * @param fn - Async function to execute within the span
 * @param attributes - Optional attributes to add to the span
 * @returns Promise resolving to the function result
 *
 * @example
 * ```typescript
 * const result = await withSpanAsync('gateway', 'fetchData', async () => {
 *   return await fetchDataFromAPI();
 * }, { 'api.endpoint': '/data' });
 * ```
 */
export async function withSpanAsync<T>(
  tracerName: string,
  spanName: string,
  fn: () => Promise<T>,
  attributes?: Record<string, string | number | boolean>
): Promise<T> {
  if (!isInitialized || !otelConfig.enabled) {
    return fn();
  }

  const tracer = getTracer(tracerName);
  const span = tracer.startSpan(spanName);

  if (attributes) {
    span.setAttributes(attributes);
  }

  try {
    const result = await context.with(trace.setSpan(context.active(), span), fn);
    span.setStatus({ code: SpanStatusCode.OK });
    return result;
  } catch (error) {
    span.recordException(error as Error);
    span.setStatus({
      code: SpanStatusCode.ERROR,
      message: (error as Error).message,
    });
    throw error;
  } finally {
    span.end();
  }
}

/**
 * Get the current active span
 *
 * @returns Current span or undefined if no active span
 *
 * @example
 * ```typescript
 * const span = getCurrentSpan();
 * if (span) {
 *   span.addEvent('Custom event', { 'custom.data': 'value' });
 * }
 * ```
 */
export function getCurrentSpan(): Span | undefined {
  return trace.getSpan(context.active());
}

/**
 * Add an attribute to the current active span
 *
 * @param key - Attribute key
 * @param value - Attribute value
 *
 * @example
 * ```typescript
 * addSpanAttribute('user.id', '12345');
 * addSpanAttribute('operation.type', 'read');
 * ```
 */
export function addSpanAttribute(key: string, value: string | number | boolean): void {
  const span = getCurrentSpan();
  if (span) {
    span.setAttribute(key, value);
  }
}

/**
 * Add an event to the current active span
 *
 * @param name - Event name
 * @param attributes - Optional event attributes
 *
 * @example
 * ```typescript
 * addSpanEvent('cache.hit', { 'cache.key': 'user:123' });
 * addSpanEvent('validation.failed', { 'error': 'Invalid input' });
 * ```
 */
export function addSpanEvent(name: string, attributes?: Record<string, string | number | boolean>): void {
  const span = getCurrentSpan();
  if (span) {
    span.addEvent(name, attributes);
  }
}

/**
 * Check if telemetry is initialized and enabled
 *
 * @returns true if telemetry is active
 */
export function isTelemetryEnabled(): boolean {
  return isInitialized && otelConfig.enabled;
}
