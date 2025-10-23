/**
 * Tests for OpenTelemetry telemetry module
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';

describe('Telemetry Module', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    // Reset environment before each test
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    // Restore original environment
    process.env = originalEnv;
  });

  describe('Module Import', () => {
    it('should import telemetry module without errors', async () => {
      const telemetry = await import('../../src/core/telemetry.js');

      expect(telemetry.initTelemetry).toBeDefined();
      expect(telemetry.shutdownTelemetry).toBeDefined();
      expect(telemetry.getTracer).toBeDefined();
      expect(telemetry.withSpan).toBeDefined();
      expect(telemetry.withSpanAsync).toBeDefined();
      expect(telemetry.getCurrentSpan).toBeDefined();
      expect(telemetry.addSpanAttribute).toBeDefined();
      expect(telemetry.addSpanEvent).toBeDefined();
      expect(telemetry.isTelemetryEnabled).toBeDefined();
    });
  });

  describe('Telemetry Functions', () => {
    it('should provide getTracer function', async () => {
      const { getTracer } = await import('../../src/core/telemetry.js');
      const tracer = getTracer('test-tracer');

      expect(tracer).toBeDefined();
      expect(typeof tracer.startSpan).toBe('function');
    });

    it('should provide isTelemetryEnabled function', async () => {
      const { isTelemetryEnabled } = await import('../../src/core/telemetry.js');
      const enabled = isTelemetryEnabled();

      expect(typeof enabled).toBe('boolean');
    });

    it('should handle withSpan for synchronous functions', async () => {
      const { withSpan } = await import('../../src/core/telemetry.js');

      const result = withSpan('test', 'test-span', () => {
        return 'test-result';
      });

      expect(result).toBe('test-result');
    });

    it('should handle withSpanAsync for asynchronous functions', async () => {
      const { withSpanAsync } = await import('../../src/core/telemetry.js');

      const result = await withSpanAsync('test', 'test-span', async () => {
        return 'async-result';
      });

      expect(result).toBe('async-result');
    });

    it('should handle errors in withSpan', async () => {
      const { withSpan } = await import('../../src/core/telemetry.js');

      expect(() => {
        withSpan('test', 'error-span', () => {
          throw new Error('Test error');
        });
      }).toThrow('Test error');
    });

    it('should handle errors in withSpanAsync', async () => {
      const { withSpanAsync } = await import('../../src/core/telemetry.js');

      await expect(
        withSpanAsync('test', 'error-span', async () => {
          throw new Error('Async test error');
        })
      ).rejects.toThrow('Async test error');
    });

    it('should safely handle getCurrentSpan when no span is active', async () => {
      const { getCurrentSpan } = await import('../../src/core/telemetry.js');
      const span = getCurrentSpan();

      // Should return undefined or a valid span, never throw
      expect(span === undefined || typeof span === 'object').toBe(true);
    });

    it('should safely handle addSpanAttribute when no span is active', async () => {
      const { addSpanAttribute } = await import('../../src/core/telemetry.js');

      // Should not throw even if no active span
      expect(() => {
        addSpanAttribute('test.key', 'test.value');
      }).not.toThrow();
    });

    it('should safely handle addSpanEvent when no span is active', async () => {
      const { addSpanEvent } = await import('../../src/core/telemetry.js');

      // Should not throw even if no active span
      expect(() => {
        addSpanEvent('test.event', { 'test.attr': 'value' });
      }).not.toThrow();
    });
  });

  describe('Initialization and Shutdown', () => {
    it('should handle initTelemetry when disabled', async () => {
      process.env.OTEL_ENABLED = 'false';

      // Re-import to get new config
      const { initTelemetry } = await import('../../src/core/telemetry.js');

      // Should not throw when disabled
      await expect(initTelemetry()).resolves.not.toThrow();
    });

    it('should handle shutdownTelemetry safely', async () => {
      const { shutdownTelemetry } = await import('../../src/core/telemetry.js');

      // Should not throw even if not initialized
      await expect(shutdownTelemetry()).resolves.not.toThrow();
    });
  });

  describe('Span Attributes and Events', () => {
    it('should accept various attribute types', async () => {
      const { addSpanAttribute } = await import('../../src/core/telemetry.js');

      expect(() => {
        addSpanAttribute('string.attr', 'value');
        addSpanAttribute('number.attr', 123);
        addSpanAttribute('boolean.attr', true);
      }).not.toThrow();
    });

    it('should accept event with attributes', async () => {
      const { addSpanEvent } = await import('../../src/core/telemetry.js');

      expect(() => {
        addSpanEvent('test.event', {
          str: 'value',
          num: 42,
          bool: false,
        });
      }).not.toThrow();
    });

    it('should accept event without attributes', async () => {
      const { addSpanEvent } = await import('../../src/core/telemetry.js');

      expect(() => {
        addSpanEvent('simple.event');
      }).not.toThrow();
    });
  });

  describe('Span Context Propagation', () => {
    it('should propagate context in withSpan', async () => {
      const { withSpan } = await import('../../src/core/telemetry.js');

      const result = withSpan('test', 'outer-span', () => {
        return withSpan('test', 'inner-span', () => {
          return 'nested-result';
        });
      });

      expect(result).toBe('nested-result');
    });

    it('should propagate context in withSpanAsync', async () => {
      const { withSpanAsync } = await import('../../src/core/telemetry.js');

      const result = await withSpanAsync('test', 'outer-span', async () => {
        return await withSpanAsync('test', 'inner-span', async () => {
          return 'async-nested-result';
        });
      });

      expect(result).toBe('async-nested-result');
    });
  });
});
