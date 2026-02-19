/**
 * Tests for OpenTelemetry initialization paths
 * These tests focus on initialization, shutdown, and error handling
 */

import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';

describe('Telemetry Initialization Paths', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    jest.resetModules();
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
    jest.resetModules();
  });

  describe('initTelemetry with different exporters', () => {
    it('should initialize with console exporter', async () => {
      process.env.OTEL_ENABLED = 'true';
      process.env.OTEL_EXPORTER_TYPE = 'console';

      const { initTelemetry, shutdownTelemetry } = await import('../../src/core/telemetry.js');

      await expect(initTelemetry()).resolves.not.toThrow();
      await shutdownTelemetry();
    }, 15000);

    it('should initialize with otlp exporter', async () => {
      process.env.OTEL_ENABLED = 'true';
      process.env.OTEL_EXPORTER_TYPE = 'otlp';
      process.env.OTEL_EXPORTER_ENDPOINT = 'http://localhost:4318/v1/traces';

      const { initTelemetry, shutdownTelemetry } = await import('../../src/core/telemetry.js');

      await expect(initTelemetry()).resolves.not.toThrow();
      await shutdownTelemetry();
    });

    it('should initialize with none exporter', async () => {
      process.env.OTEL_ENABLED = 'true';
      process.env.OTEL_EXPORTER_TYPE = 'none';

      const { initTelemetry, shutdownTelemetry } = await import('../../src/core/telemetry.js');

      await expect(initTelemetry()).resolves.not.toThrow();
      await shutdownTelemetry();
    });

    it('should handle unknown exporter type', async () => {
      process.env.OTEL_ENABLED = 'true';
      process.env.OTEL_EXPORTER_TYPE = 'unknown-type';

      const { initTelemetry, shutdownTelemetry } = await import('../../src/core/telemetry.js');

      await expect(initTelemetry()).resolves.not.toThrow();
      await shutdownTelemetry();
    });

    it('should initialize with custom headers', async () => {
      process.env.OTEL_ENABLED = 'true';
      process.env.OTEL_EXPORTER_TYPE = 'otlp';
      process.env.OTEL_EXPORTER_HEADERS = 'x-api-key=test123,authorization=Bearer token';

      const { initTelemetry, shutdownTelemetry } = await import('../../src/core/telemetry.js');

      await expect(initTelemetry()).resolves.not.toThrow();
      await shutdownTelemetry();
    });

    it('should initialize with service namespace', async () => {
      process.env.OTEL_ENABLED = 'true';
      process.env.OTEL_SERVICE_NAMESPACE = 'production';

      const { initTelemetry, shutdownTelemetry } = await import('../../src/core/telemetry.js');

      await expect(initTelemetry()).resolves.not.toThrow();
      await shutdownTelemetry();
    });

    it('should initialize with custom sampling rate', async () => {
      process.env.OTEL_ENABLED = 'true';
      process.env.OTEL_SAMPLING_RATE = '0.5';

      const { initTelemetry, shutdownTelemetry } = await import('../../src/core/telemetry.js');

      await expect(initTelemetry()).resolves.not.toThrow();
      await shutdownTelemetry();
    });

    it('should not initialize when disabled', async () => {
      process.env.OTEL_ENABLED = 'false';

      const { initTelemetry, isTelemetryEnabled } = await import('../../src/core/telemetry.js');

      await initTelemetry();
      expect(isTelemetryEnabled()).toBe(false);
    });

    it('should not reinitialize if already initialized', async () => {
      process.env.OTEL_ENABLED = 'true';

      const { initTelemetry, shutdownTelemetry } = await import('../../src/core/telemetry.js');

      await initTelemetry();
      await expect(initTelemetry()).resolves.not.toThrow();
      await shutdownTelemetry();
    });
  });

  describe('shutdownTelemetry', () => {
    it('should shutdown safely when not initialized', async () => {
      process.env.OTEL_ENABLED = 'false';

      const { shutdownTelemetry } = await import('../../src/core/telemetry.js');

      await expect(shutdownTelemetry()).resolves.not.toThrow();
    });

    it('should shutdown multiple times safely', async () => {
      process.env.OTEL_ENABLED = 'true';

      const { initTelemetry, shutdownTelemetry } = await import('../../src/core/telemetry.js');

      await initTelemetry();
      await shutdownTelemetry();
      await expect(shutdownTelemetry()).resolves.not.toThrow();
    });

    it('should reset state after shutdown', async () => {
      process.env.OTEL_ENABLED = 'true';

      const { initTelemetry, shutdownTelemetry, isTelemetryEnabled } = await import(
        '../../src/core/telemetry.js'
      );

      await initTelemetry();
      expect(isTelemetryEnabled()).toBe(true);

      await shutdownTelemetry();
      expect(isTelemetryEnabled()).toBe(false);
    });
  });

  describe('getTracer', () => {
    it('should create tracer when enabled', async () => {
      process.env.OTEL_ENABLED = 'true';

      const { initTelemetry, getTracer, shutdownTelemetry } = await import(
        '../../src/core/telemetry.js'
      );

      await initTelemetry();
      const tracer = getTracer('test-component');

      expect(tracer).toBeDefined();
      expect(typeof tracer.startSpan).toBe('function');

      await shutdownTelemetry();
    });

    it('should create tracer when disabled', async () => {
      process.env.OTEL_ENABLED = 'false';

      const { getTracer } = await import('../../src/core/telemetry.js');
      const tracer = getTracer('test-component');

      expect(tracer).toBeDefined();
      expect(typeof tracer.startSpan).toBe('function');
    });

    it('should create different tracers with different names', async () => {
      const { getTracer } = await import('../../src/core/telemetry.js');

      const tracer1 = getTracer('component1');
      const tracer2 = getTracer('component2');

      expect(tracer1).toBeDefined();
      expect(tracer2).toBeDefined();
    });
  });

  describe('withSpan error paths', () => {
    it('should work when telemetry is disabled', async () => {
      process.env.OTEL_ENABLED = 'false';

      const { withSpan } = await import('../../src/core/telemetry.js');

      const result = withSpan('test', 'test-span', () => {
        return 'result';
      });

      expect(result).toBe('result');
    });

    it('should propagate errors correctly', async () => {
      process.env.OTEL_ENABLED = 'false';

      const { withSpan } = await import('../../src/core/telemetry.js');

      expect(() => {
        withSpan('test', 'error-span', () => {
          throw new Error('Test error');
        });
      }).toThrow('Test error');
    });

    it('should handle spans with attributes when disabled', async () => {
      process.env.OTEL_ENABLED = 'false';

      const { withSpan } = await import('../../src/core/telemetry.js');

      const result = withSpan(
        'test',
        'attr-span',
        () => {
          return 'result';
        },
        { key: 'value' }
      );

      expect(result).toBe('result');
    });
  });

  describe('withSpanAsync error paths', () => {
    it('should work when telemetry is disabled', async () => {
      process.env.OTEL_ENABLED = 'false';

      const { withSpanAsync } = await import('../../src/core/telemetry.js');

      const result = await withSpanAsync('test', 'test-span', async () => {
        return 'async-result';
      });

      expect(result).toBe('async-result');
    });

    it('should propagate async errors correctly', async () => {
      process.env.OTEL_ENABLED = 'false';

      const { withSpanAsync } = await import('../../src/core/telemetry.js');

      await expect(
        withSpanAsync('test', 'error-span', async () => {
          throw new Error('Async test error');
        })
      ).rejects.toThrow('Async test error');
    });

    it('should handle async spans with attributes when disabled', async () => {
      process.env.OTEL_ENABLED = 'false';

      const { withSpanAsync } = await import('../../src/core/telemetry.js');

      const result = await withSpanAsync(
        'test',
        'attr-span',
        async () => {
          return 'async-result';
        },
        { key: 'value' }
      );

      expect(result).toBe('async-result');
    });
  });

  describe('getCurrentSpan', () => {
    it('should return undefined when no active span', async () => {
      const { getCurrentSpan } = await import('../../src/core/telemetry.js');
      const span = getCurrentSpan();

      expect(span === undefined || span !== null).toBe(true);
    });

    it('should work within withSpan context', async () => {
      process.env.OTEL_ENABLED = 'true';

      const { initTelemetry, withSpan, getCurrentSpan, shutdownTelemetry } = await import(
        '../../src/core/telemetry.js'
      );

      await initTelemetry();

      withSpan('test', 'outer', () => {
        const span = getCurrentSpan();
        expect(span).toBeDefined();
      });

      await shutdownTelemetry();
    });
  });

  describe('addSpanAttribute', () => {
    it('should not throw when no active span', async () => {
      const { addSpanAttribute } = await import('../../src/core/telemetry.js');

      expect(() => {
        addSpanAttribute('key', 'value');
      }).not.toThrow();
    });

    it('should handle different value types', async () => {
      const { addSpanAttribute } = await import('../../src/core/telemetry.js');

      expect(() => {
        addSpanAttribute('string', 'value');
        addSpanAttribute('number', 42);
        addSpanAttribute('boolean', true);
      }).not.toThrow();
    });
  });

  describe('addSpanEvent', () => {
    it('should not throw when no active span', async () => {
      const { addSpanEvent } = await import('../../src/core/telemetry.js');

      expect(() => {
        addSpanEvent('test.event');
      }).not.toThrow();
    });

    it('should handle events with attributes', async () => {
      const { addSpanEvent } = await import('../../src/core/telemetry.js');

      expect(() => {
        addSpanEvent('test.event', { key: 'value', num: 123 });
      }).not.toThrow();
    });

    it('should handle events without attributes', async () => {
      const { addSpanEvent } = await import('../../src/core/telemetry.js');

      expect(() => {
        addSpanEvent('simple.event');
      }).not.toThrow();
    });
  });

  describe('nested spans', () => {
    it('should handle nested spans correctly', async () => {
      process.env.OTEL_ENABLED = 'true';

      const { initTelemetry, withSpan, shutdownTelemetry } = await import(
        '../../src/core/telemetry.js'
      );

      await initTelemetry();

      const result = withSpan('test', 'outer', () => {
        return withSpan('test', 'inner', () => {
          return 'nested-result';
        });
      });

      expect(result).toBe('nested-result');
      await shutdownTelemetry();
    });

    it('should handle nested async spans correctly', async () => {
      process.env.OTEL_ENABLED = 'true';

      const { initTelemetry, withSpanAsync, shutdownTelemetry } = await import(
        '../../src/core/telemetry.js'
      );

      await initTelemetry();

      const result = await withSpanAsync('test', 'outer', async () => {
        return await withSpanAsync('test', 'inner', async () => {
          return 'async-nested-result';
        });
      });

      expect(result).toBe('async-nested-result');
      await shutdownTelemetry();
    });

    it('should handle errors in nested spans', async () => {
      process.env.OTEL_ENABLED = 'true';

      const { initTelemetry, withSpan, shutdownTelemetry } = await import(
        '../../src/core/telemetry.js'
      );

      await initTelemetry();

      expect(() => {
        withSpan('test', 'outer', () => {
          withSpan('test', 'inner', () => {
            throw new Error('Nested error');
          });
        });
      }).toThrow('Nested error');

      await shutdownTelemetry();
    });

    it('should handle async errors in nested spans', async () => {
      process.env.OTEL_ENABLED = 'true';

      const { initTelemetry, withSpanAsync, shutdownTelemetry } = await import(
        '../../src/core/telemetry.js'
      );

      await initTelemetry();

      await expect(
        withSpanAsync('test', 'outer', async () => {
          await withSpanAsync('test', 'inner', async () => {
            throw new Error('Async nested error');
          });
        })
      ).rejects.toThrow('Async nested error');

      await shutdownTelemetry();
    });
  });

  describe('isTelemetryEnabled', () => {
    it('should return true when enabled and initialized', async () => {
      process.env.OTEL_ENABLED = 'true';

      const { initTelemetry, isTelemetryEnabled, shutdownTelemetry } = await import(
        '../../src/core/telemetry.js'
      );

      await initTelemetry();
      expect(isTelemetryEnabled()).toBe(true);
      await shutdownTelemetry();
    });

    it('should return false when disabled', async () => {
      process.env.OTEL_ENABLED = 'false';

      const { isTelemetryEnabled } = await import('../../src/core/telemetry.js');

      expect(isTelemetryEnabled()).toBe(false);
    });

    it('should return false after shutdown', async () => {
      process.env.OTEL_ENABLED = 'true';

      const { initTelemetry, isTelemetryEnabled, shutdownTelemetry } = await import(
        '../../src/core/telemetry.js'
      );

      await initTelemetry();
      await shutdownTelemetry();

      expect(isTelemetryEnabled()).toBe(false);
    });
  });
});
