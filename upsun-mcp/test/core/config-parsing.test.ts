/**
 * Tests for configuration parsing functions
 * These tests verify the behavior of parseBoolean, parseNumber, and parseHeaders
 * by testing the config module with different environment variables
 */

import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';

describe('Configuration Parsing', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    // Clear module cache to force re-evaluation with new env vars
    jest.resetModules();
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    // Restore original environment
    process.env = originalEnv;
    jest.resetModules();
  });

  describe('parseBoolean functionality', () => {
    it('should parse "true" string as true', async () => {
      process.env.OTEL_ENABLED = 'true';
      const { otelConfig } = await import('../../src/core/config.js');
      expect(otelConfig.enabled).toBe(true);
    });

    it('should parse "false" string as false', async () => {
      process.env.OTEL_ENABLED = 'false';
      const { otelConfig } = await import('../../src/core/config.js');
      expect(otelConfig.enabled).toBe(false);
    });

    it('should parse "1" as true', async () => {
      process.env.OTEL_ENABLED = '1';
      const { otelConfig } = await import('../../src/core/config.js');
      expect(otelConfig.enabled).toBe(true);
    });

    it('should parse "0" as false', async () => {
      process.env.OTEL_ENABLED = '0';
      const { otelConfig } = await import('../../src/core/config.js');
      expect(otelConfig.enabled).toBe(false);
    });

    it('should use default value when undefined', async () => {
      delete process.env.OTEL_ENABLED;
      const { otelConfig } = await import('../../src/core/config.js');
      expect(typeof otelConfig.enabled).toBe('boolean');
    });

    it('should handle case insensitivity', async () => {
      process.env.OTEL_ENABLED = 'TRUE';
      const { otelConfig } = await import('../../src/core/config.js');
      expect(otelConfig.enabled).toBe(true);
    });
  });

  describe('parseNumber functionality', () => {
    it('should parse valid number string', async () => {
      process.env.OTEL_SAMPLING_RATE = '0.5';
      const { otelConfig } = await import('../../src/core/config.js');
      expect(otelConfig.samplingRate).toBe(0.5);
    });

    it('should use default value when undefined', async () => {
      delete process.env.OTEL_SAMPLING_RATE;
      const { otelConfig } = await import('../../src/core/config.js');
      expect(otelConfig.samplingRate).toBe(1.0);
    });

    it('should clamp value to minimum', async () => {
      process.env.OTEL_SAMPLING_RATE = '-0.5';
      const { otelConfig } = await import('../../src/core/config.js');
      expect(otelConfig.samplingRate).toBeGreaterThanOrEqual(0.0);
    });

    it('should clamp value to maximum', async () => {
      process.env.OTEL_SAMPLING_RATE = '2.0';
      const { otelConfig } = await import('../../src/core/config.js');
      expect(otelConfig.samplingRate).toBeLessThanOrEqual(1.0);
    });

    it('should use default for invalid number', async () => {
      process.env.OTEL_SAMPLING_RATE = 'invalid';
      const { otelConfig } = await import('../../src/core/config.js');
      expect(otelConfig.samplingRate).toBe(1.0);
    });

    it('should parse timeout with min/max constraints', async () => {
      process.env.OTEL_EXPORTER_TIMEOUT = '500';
      const { otelConfig } = await import('../../src/core/config.js');
      expect(otelConfig.exporterTimeout).toBeGreaterThanOrEqual(1000);
    });

    it('should clamp timeout to max', async () => {
      process.env.OTEL_EXPORTER_TIMEOUT = '100000';
      const { otelConfig } = await import('../../src/core/config.js');
      expect(otelConfig.exporterTimeout).toBeLessThanOrEqual(60000);
    });

    it('should parse port number', async () => {
      process.env.PORT = '8080';
      const { appConfig } = await import('../../src/core/config.js');
      expect(appConfig.port).toBe(8080);
    });

    it('should use default port when invalid', async () => {
      process.env.PORT = 'invalid';
      const { appConfig } = await import('../../src/core/config.js');
      expect(appConfig.port).toBe(3000);
    });
  });

  describe('parseHeaders functionality', () => {
    it('should parse single header', async () => {
      process.env.OTEL_EXPORTER_HEADERS = 'x-api-key=secret123';
      const { otelConfig } = await import('../../src/core/config.js');
      expect(otelConfig.exporterHeaders['x-api-key']).toBe('secret123');
    });

    it('should parse multiple headers', async () => {
      process.env.OTEL_EXPORTER_HEADERS = 'x-api-key=secret123,authorization=Bearer token';
      const { otelConfig } = await import('../../src/core/config.js');
      expect(otelConfig.exporterHeaders['x-api-key']).toBe('secret123');
      expect(otelConfig.exporterHeaders['authorization']).toBe('Bearer token');
    });

    it('should return empty object when undefined', async () => {
      delete process.env.OTEL_EXPORTER_HEADERS;
      const { otelConfig } = await import('../../src/core/config.js');
      expect(otelConfig.exporterHeaders).toEqual({});
    });

    it('should handle headers with spaces', async () => {
      process.env.OTEL_EXPORTER_HEADERS = 'key1 = value1 , key2 = value2';
      const { otelConfig } = await import('../../src/core/config.js');
      expect(otelConfig.exporterHeaders['key1']).toBe('value1');
      expect(otelConfig.exporterHeaders['key2']).toBe('value2');
    });

    it('should ignore malformed headers', async () => {
      process.env.OTEL_EXPORTER_HEADERS = 'valid=value,invalid,another=value2';
      const { otelConfig } = await import('../../src/core/config.js');
      expect(otelConfig.exporterHeaders['valid']).toBe('value');
      expect(otelConfig.exporterHeaders['another']).toBe('value2');
      expect(otelConfig.exporterHeaders['invalid']).toBeUndefined();
    });

    it('should handle empty header values', async () => {
      process.env.OTEL_EXPORTER_HEADERS = 'key1=,key2=value2';
      const { otelConfig } = await import('../../src/core/config.js');
      expect(otelConfig.exporterHeaders['key2']).toBe('value2');
    });
  });

  describe('otelConfig properties', () => {
    it('should set exporter type from env', async () => {
      process.env.OTEL_EXPORTER_TYPE = 'otlp';
      const { otelConfig } = await import('../../src/core/config.js');
      expect(otelConfig.exporterType).toBe('otlp');
    });

    it('should default exporter type to console', async () => {
      delete process.env.OTEL_EXPORTER_TYPE;
      const { otelConfig } = await import('../../src/core/config.js');
      expect(otelConfig.exporterType).toBe('console');
    });

    it('should set exporter endpoint from env', async () => {
      process.env.OTEL_EXPORTER_ENDPOINT = 'http://custom:4318/v1/traces';
      const { otelConfig } = await import('../../src/core/config.js');
      expect(otelConfig.exporterEndpoint).toBe('http://custom:4318/v1/traces');
    });

    it('should set service name from env', async () => {
      process.env.OTEL_SERVICE_NAME = 'custom-service';
      const { otelConfig } = await import('../../src/core/config.js');
      expect(otelConfig.serviceName).toBe('custom-service');
    });

    it('should set service namespace from env', async () => {
      process.env.OTEL_SERVICE_NAMESPACE = 'production';
      const { otelConfig } = await import('../../src/core/config.js');
      expect(otelConfig.serviceNamespace).toBe('production');
    });

    it('should set service instance id from env', async () => {
      process.env.OTEL_SERVICE_INSTANCE_ID = 'instance-123';
      const { otelConfig } = await import('../../src/core/config.js');
      expect(otelConfig.serviceInstanceId).toBe('instance-123');
    });

    it('should set environment from NODE_ENV', async () => {
      process.env.NODE_ENV = 'production';
      const { otelConfig } = await import('../../src/core/config.js');
      expect(otelConfig.environment).toBe('production');
    });
  });

  describe('appConfig properties', () => {
    it('should set type env from env', async () => {
      process.env.TYPE_ENV = 'local';
      const { appConfig } = await import('../../src/core/config.js');
      expect(appConfig.typeEnv).toBe('local');
    });

    it('should default type env to remote', async () => {
      delete process.env.TYPE_ENV;
      const { appConfig } = await import('../../src/core/config.js');
      expect(appConfig.typeEnv).toBe('remote');
    });

    it('should set mode from env', async () => {
      process.env.MODE = 'WRITABLE';
      const { appConfig } = await import('../../src/core/config.js');
      expect(appConfig.mode).toBe('WRITABLE');
    });

    it('should default mode to READONLY', async () => {
      delete process.env.MODE;
      const { appConfig } = await import('../../src/core/config.js');
      expect(appConfig.mode).toBe('READONLY');
    });

    it('should set API key from env', async () => {
      process.env.UPSUN_API_KEY = 'test-api-key-123';
      const { appConfig } = await import('../../src/core/config.js');
      expect(appConfig.apiKey).toBe('test-api-key-123');
    });

    it('should default API key to empty string', async () => {
      delete process.env.UPSUN_API_KEY;
      const { appConfig } = await import('../../src/core/config.js');
      expect(appConfig.apiKey).toBe('');
    });
  });

  describe('getConfigSummary', () => {
    it('should include all config sections with custom values', async () => {
      process.env.OTEL_ENABLED = 'true';
      process.env.OTEL_EXPORTER_TYPE = 'otlp';
      process.env.OTEL_SERVICE_NAME = 'test-service';
      process.env.PORT = '8080';

      const { getConfigSummary } = await import('../../src/core/config.js');
      const summary = getConfigSummary();

      expect(summary).toContain('OpenTelemetry');
      expect(summary).toContain('Application');
      expect(summary).toContain('test-service');
      expect(summary).toContain('8080');
    });

    it('should show different content for different exporter types', async () => {
      process.env.OTEL_EXPORTER_TYPE = 'none';
      const { getConfigSummary } = await import('../../src/core/config.js');
      const summary = getConfigSummary();

      expect(summary).toContain('none');
    });

    it('should handle headers in summary', async () => {
      process.env.OTEL_EXPORTER_TYPE = 'otlp';
      process.env.OTEL_EXPORTER_HEADERS = 'key1=value1,key2=value2';
      const { getConfigSummary } = await import('../../src/core/config.js');
      const summary = getConfigSummary();

      expect(summary).toContain('2 headers');
    });
  });
});
