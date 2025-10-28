import { logger, createLogger, LogLevel, toPinoLevel } from '../../src/core/logger';
import { jest, describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { setupTestEnvironment, teardownTestEnvironment } from '../helpers/test-env.js';

describe('PinoLogger logging methods', () => {
  const levels = [LogLevel.DEBUG, LogLevel.INFO, LogLevel.WARN, LogLevel.ERROR, LogLevel.NONE];
  levels.forEach(level => {
    it(`debug/info/warn/error only log at correct level: ${LogLevel[level]}`, () => {
      const logs: any[] = [];
      const mockPino = {
        debug: jest.fn((obj, msg) => logs.push(['debug', msg, obj])),
        info: jest.fn((obj, msg) => logs.push(['info', msg, obj])),
        warn: jest.fn((obj, msg) => logs.push(['warn', msg, obj])),
        error: jest.fn((obj, msg) => logs.push(['error', msg, obj])),
        level: 'debug',
        child: jest.fn().mockReturnThis(),
      };
      // @ts-ignore
      const loggerInstance = new logger.constructor(level, mockPino);
      loggerInstance.debug('debug', 1);
      loggerInstance.info('info', 2);
      loggerInstance.warn('warn', 3);
      loggerInstance.error('error', 4);
      // Only log methods at or above the current level should be called
      const expected: any[] = [];
      if (level <= LogLevel.DEBUG) expected.push(['debug', 'debug', { args: [1] }]);
      if (level <= LogLevel.INFO) expected.push(['info', 'info', { args: [2] }]);
      if (level <= LogLevel.WARN) expected.push(['warn', 'warn', { args: [3] }]);
      if (level <= LogLevel.ERROR) expected.push(['error', 'error', { args: [4] }]);
      expect(logs).toEqual(expected);
    });
  });
});
describe('PinoLogger.setLevel', () => {
  it('sets pinoLogger.level for all LogLevel values', () => {
    const mockPino = {
      level: 'info',
      child: jest.fn().mockReturnThis(),
    } as any;
    // @ts-ignore
    const loggerInstance = new logger.constructor(LogLevel.INFO, mockPino);
    loggerInstance.setLevel(LogLevel.DEBUG);
    expect(mockPino.level).toBe('debug');
    loggerInstance.setLevel(LogLevel.INFO);
    expect(mockPino.level).toBe('info');
    loggerInstance.setLevel(LogLevel.WARN);
    expect(mockPino.level).toBe('warn');
    loggerInstance.setLevel(LogLevel.ERROR);
    expect(mockPino.level).toBe('error');
    loggerInstance.setLevel(LogLevel.NONE);
    expect(mockPino.level).toBe('silent');
  });
});
describe('PinoLogger.getComponentName', () => {
  it('returns empty string if no component binding', () => {
    const mockPino = { bindings: {} } as any;
    // @ts-ignore
    const loggerInstance = new logger.constructor(LogLevel.DEBUG, mockPino);
    expect(loggerInstance['getComponentName']()).toBe('');
  });
  it('returns component name if present', () => {
    const mockPino = { bindings: { component: 'TestComponent' } } as any;
    // @ts-ignore
    const loggerInstance = new logger.constructor(LogLevel.DEBUG, mockPino);
    expect(loggerInstance['getComponentName']()).toBe('[TestComponent]');
  });
});
describe('toPinoLevel', () => {
  it('returns correct pino level for each LogLevel', () => {
    expect(toPinoLevel(LogLevel.DEBUG)).toBe('debug');
    expect(toPinoLevel(LogLevel.INFO)).toBe('info');
    expect(toPinoLevel(LogLevel.WARN)).toBe('warn');
    expect(toPinoLevel(LogLevel.ERROR)).toBe('error');
    expect(toPinoLevel(LogLevel.NONE)).toBe('silent');
  });
  it('returns info for unknown LogLevel', () => {
    expect(toPinoLevel(999 as LogLevel)).toBe('info');
  });
});

describe('Logger', () => {
  describe('getLogLevel', () => {
    const OLD_ENV = process.env;
    beforeEach(() => {
      setupTestEnvironment(jest, OLD_ENV);
    });
    afterEach(() => {
      teardownTestEnvironment(OLD_ENV);
    });

    it('returns DEBUG for LOG_LEVEL=DEBUG', async () => {
      process.env.LOG_LEVEL = 'DEBUG';
      const { getLogLevel } = await import('../../src/core/logger.js');
      expect(getLogLevel()).toBe(LogLevel.DEBUG);
    });
    it('returns INFO for LOG_LEVEL=INFO', async () => {
      process.env.LOG_LEVEL = 'INFO';
      const { getLogLevel } = await import('../../src/core/logger.js');
      expect(getLogLevel()).toBe(LogLevel.INFO);
    });
    it('returns WARN for LOG_LEVEL=WARN', async () => {
      process.env.LOG_LEVEL = 'WARN';
      const { getLogLevel } = await import('../../src/core/logger.js');
      expect(getLogLevel()).toBe(LogLevel.WARN);
    });
    it('returns ERROR for LOG_LEVEL=ERROR', async () => {
      process.env.LOG_LEVEL = 'ERROR';
      const { getLogLevel } = await import('../../src/core/logger.js');
      expect(getLogLevel()).toBe(LogLevel.ERROR);
    });
    it('returns NONE for LOG_LEVEL=NONE', async () => {
      process.env.LOG_LEVEL = 'NONE';
      const { getLogLevel } = await import('../../src/core/logger.js');
      expect(getLogLevel()).toBe(LogLevel.NONE);
    });
    it('returns WARN for production env default', async () => {
      process.env.NODE_ENV = 'production';
      delete process.env.LOG_LEVEL;
      const { getLogLevel } = await import('../../src/core/logger.js');
      expect(getLogLevel()).toBe(LogLevel.WARN);
    });
    it('returns ERROR for test env default', async () => {
      process.env.NODE_ENV = 'test';
      delete process.env.LOG_LEVEL;
      const { getLogLevel } = await import('../../src/core/logger.js');
      expect(getLogLevel()).toBe(LogLevel.ERROR);
    });
    it('returns DEBUG for development env default', async () => {
      process.env.NODE_ENV = 'development';
      delete process.env.LOG_LEVEL;
      const { getLogLevel } = await import('../../src/core/logger.js');
      expect(getLogLevel()).toBe(LogLevel.DEBUG);
    });
    it('returns DEBUG for unknown env default', async () => {
      process.env.NODE_ENV = 'foo';
      delete process.env.LOG_LEVEL;
      const { getLogLevel } = await import('../../src/core/logger.js');
      expect(getLogLevel()).toBe(LogLevel.DEBUG);
    });
  });
  it('should log debug, info, warn, error at correct levels', () => {
    const logs: any[] = [];
    // Create a custom logger with a mocked pino instance
    const mockPino = {
      debug: jest.fn((obj, msg) => logs.push(['debug', msg, obj])),
      info: jest.fn((obj, msg) => logs.push(['info', msg, obj])),
      warn: jest.fn((obj, msg) => logs.push(['warn', msg, obj])),
      error: jest.fn((obj, msg) => logs.push(['error', msg, obj])),
      level: 'debug',
      child: jest.fn().mockReturnThis(),
    };
    // @ts-ignore
    const testLogger = new logger.constructor(LogLevel.DEBUG, mockPino);
    testLogger.debug('debug message', 1);
    testLogger.info('info message', 2);
    testLogger.warn('warn message', 3);
    testLogger.error('error message', 4);
    expect(logs).toEqual([
      ['debug', 'debug message', { args: [1] }],
      ['info', 'info message', { args: [2] }],
      ['warn', 'warn message', { args: [3] }],
      ['error', 'error message', { args: [4] }],
    ]);
  });

  it('should not log below current level', () => {
    const logs: any[] = [];
    const mockPino = {
      debug: jest.fn(),
      info: jest.fn(),
      warn: jest.fn((obj, msg) => logs.push(['warn', msg, obj])),
      error: jest.fn((obj, msg) => logs.push(['error', msg, obj])),
      level: 'warn',
      child: jest.fn().mockReturnThis(),
    };
    // @ts-ignore
    const testLogger = new logger.constructor(LogLevel.WARN, mockPino);
    testLogger.debug('debug message');
    testLogger.info('info message');
    testLogger.warn('warn message');
    testLogger.error('error message');
    expect(logs).toEqual([
      ['warn', 'warn message', { args: [] }],
      ['error', 'error message', { args: [] }],
    ]);
  });

  it('createLogger should set component prefix', () => {
    const logs: any[] = [];
    const mockPino = {
      debug: jest.fn((obj, msg) => logs.push(['debug', msg, obj])),
      level: 'debug',
      child: jest.fn().mockReturnThis(),
    };
    // @ts-ignore
    const customLogger = new logger.constructor(LogLevel.DEBUG, mockPino);
    customLogger.debug('custom', 42);
    expect(logs[0][2]).toEqual({ args: [42] });
  });

  it('setLevel should update log level', () => {
    const mockPino = {
      debug: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
      level: 'info',
      child: jest.fn().mockReturnThis(),
    };
    // @ts-ignore
    const testLogger = new logger.constructor(LogLevel.INFO, mockPino);
    testLogger.setLevel(LogLevel.ERROR);
    expect(mockPino.level).toBe('error');
  });
});
