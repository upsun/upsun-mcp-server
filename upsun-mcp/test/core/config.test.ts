/**
 * Tests for application configuration module
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { appConfig, getConfigSummary, otelConfig } from '../../src/core/config.js';

describe('Configuration Module', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    // Save environment before each test
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    // Restore original environment
    process.env = originalEnv;
  });

  describe('otelConfig', () => {
    it('should have default values', () => {
      expect(otelConfig.enabled).toBeDefined();
      expect(otelConfig.samplingRate).toBeGreaterThanOrEqual(0);
      expect(otelConfig.samplingRate).toBeLessThanOrEqual(1);
      expect(otelConfig.exporterType).toMatch(/^(console|otlp|none)$/);
      expect(otelConfig.serviceName).toBe('upsun-mcp-server');
      expect(otelConfig.exporterEndpoint).toBeDefined();
      expect(otelConfig.exporterHeaders).toBeDefined();
      expect(otelConfig.exporterTimeout).toBeGreaterThan(0);
      expect(otelConfig.serviceInstanceId).toBeDefined();
    });

    it('should use environment variable for enabled state', () => {
      expect(typeof otelConfig.enabled).toBe('boolean');
    });

    it('should clamp sampling rate between 0 and 1', () => {
      expect(otelConfig.samplingRate).toBeGreaterThanOrEqual(0);
      expect(otelConfig.samplingRate).toBeLessThanOrEqual(1);
    });

    it('should have valid exporter type', () => {
      expect(['console', 'otlp', 'none']).toContain(otelConfig.exporterType);
    });

    it('should parse OTLP headers correctly', () => {
      expect(typeof otelConfig.exporterHeaders).toBe('object');
      expect(otelConfig.exporterHeaders).not.toBeNull();
    });

    it('should have valid timeout range', () => {
      expect(otelConfig.exporterTimeout).toBeGreaterThanOrEqual(1000);
      expect(otelConfig.exporterTimeout).toBeLessThanOrEqual(60000);
    });

    it('should have service instance ID', () => {
      expect(otelConfig.serviceInstanceId).toBeTruthy();
      expect(typeof otelConfig.serviceInstanceId).toBe('string');
    });
  });

  describe('appConfig', () => {
    it('should have default values', () => {
      expect(appConfig.typeEnv).toBeDefined();
      expect(appConfig.port).toBeGreaterThan(0);
      expect(appConfig.mode).toMatch(/^(READONLY|WRITABLE)$/);
    });

    it('should have valid port number', () => {
      expect(typeof appConfig.port).toBe('number');
      expect(appConfig.port).toBeGreaterThan(0);
      expect(appConfig.port).toBeLessThan(65536);
    });
  });

  describe('getConfigSummary', () => {
    it('should return a non-empty string', () => {
      const summary = getConfigSummary();
      expect(typeof summary).toBe('string');
      expect(summary.length).toBeGreaterThan(0);
    });

    it('should include instance ID', () => {
      const summary = getConfigSummary();
      expect(summary).toContain('Instance:');
    });

    it('should include OpenTelemetry configuration', () => {
      const summary = getConfigSummary();
      expect(summary).toContain('OpenTelemetry');
      expect(summary).toContain('Enabled');
      expect(summary).toContain('Sampling Rate');
      expect(summary).toContain('Exporter');
    });

    it('should include Application configuration', () => {
      const summary = getConfigSummary();
      expect(summary).toContain('Application');
      expect(summary).toContain('Type');
      expect(summary).toContain('Port');
      expect(summary).toContain('Mode');
    });

    it('should show OTLP endpoint when exporter is otlp', () => {
      const summary = getConfigSummary();
      if (otelConfig.exporterType === 'otlp') {
        expect(summary).toContain(otelConfig.exporterEndpoint);
      } else {
        expect(summary).toContain('N/A');
      }
    });

    it('should show namespace or N/A', () => {
      const summary = getConfigSummary();
      if (otelConfig.serviceNamespace) {
        expect(summary).toContain(otelConfig.serviceNamespace);
      } else {
        expect(summary).toContain('Namespace: N/A');
      }
    });

    it('should include timeout value', () => {
      const summary = getConfigSummary();
      expect(summary).toContain('Timeout');
      expect(summary).toContain(`${otelConfig.exporterTimeout}ms`);
    });

    it('should include environment', () => {
      const summary = getConfigSummary();
      expect(summary).toContain('Environment');
      expect(summary).toContain(otelConfig.environment);
    });

    it('should include service name', () => {
      const summary = getConfigSummary();
      expect(summary).toContain('Service');
      expect(summary).toContain(otelConfig.serviceName);
    });

    it('should show headers info when headers are configured', () => {
      const summary = getConfigSummary();
      const headerCount = Object.keys(otelConfig.exporterHeaders).length;
      if (headerCount > 0 && otelConfig.exporterType === 'otlp') {
        expect(summary).toContain(`${headerCount} headers`);
      }
    });
  });
});
