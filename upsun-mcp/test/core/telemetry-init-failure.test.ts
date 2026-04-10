/**
 * Tests for OpenTelemetry initialization failure handling.
 *
 * Isolated in its own file because jest.unstable_mockModule for
 * @opentelemetry/sdk-node contaminates the module registry for the
 * rest of the test suite.
 */

import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';

describe('initTelemetry failure handling', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    jest.resetModules();
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
    jest.resetModules();
  });

  it('should not throw when SDK.start() fails, and should leave telemetry disabled', async () => {
    process.env.OTEL_ENABLED = 'true';
    process.env.OTEL_EXPORTER_TYPE = 'console';

    // Intercept NodeSDK so we can make start() throw.
    jest.unstable_mockModule('@opentelemetry/sdk-node', () => ({
      NodeSDK: class {
        start() {
          throw new Error('simulated SDK failure');
        }
        shutdown() {
          return Promise.resolve();
        }
      },
    }));

    const { initTelemetry, isTelemetryEnabled, shutdownTelemetry } =
      await import('../../src/core/telemetry.js');

    // Must not throw.
    await expect(initTelemetry()).resolves.not.toThrow();

    // Telemetry should remain disabled.
    expect(isTelemetryEnabled()).toBe(false);

    // Shutdown should be safe to call afterwards.
    await expect(shutdownTelemetry()).resolves.not.toThrow();
  });
});
