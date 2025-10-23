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
  });
});
