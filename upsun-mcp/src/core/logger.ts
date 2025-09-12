/**
 * Logging utility with Pino backend and configurable levels
 */

import pino from 'pino';

export enum LogLevel {
  DEBUG = 0,
  INFO = 1,
  WARN = 2,
  ERROR = 3,
  NONE = 4,
}

export interface Logger {
  debug(message: string, ...args: unknown[]): void;
  info(message: string, ...args: unknown[]): void;
  warn(message: string, ...args: unknown[]): void;
  error(message: string, ...args: unknown[]): void;
}

// Configure logging level based on environment
const getLogLevel = (): LogLevel => {
  const env = process.env.NODE_ENV || 'development';
  const logLevel = process.env.LOG_LEVEL?.toUpperCase();

  if (logLevel) {
    switch (logLevel) {
      case 'DEBUG':
        return LogLevel.DEBUG;
      case 'INFO':
        return LogLevel.INFO;
      case 'WARN':
        return LogLevel.WARN;
      case 'ERROR':
        return LogLevel.ERROR;
      case 'NONE':
        return LogLevel.NONE;
    }
  }

  // Default levels based on environment
  switch (env) {
    case 'production':
      return LogLevel.WARN;
    case 'test':
      return LogLevel.ERROR;
    default:
      return LogLevel.DEBUG; // development
  }
};

// Convert our LogLevel to Pino level
const toPinoLevel = (level: LogLevel): pino.LevelWithSilent => {
  switch (level) {
    case LogLevel.DEBUG:
      return 'debug';
    case LogLevel.INFO:
      return 'info';
    case LogLevel.WARN:
      return 'warn';
    case LogLevel.ERROR:
      return 'error';
    case LogLevel.NONE:
      return 'silent';
    default:
      return 'info';
  }
};

// Create the base Pino logger instance
const basePinoLogger = pino({
  level: toPinoLevel(getLogLevel()),
  ...(process.env.NODE_ENV !== 'production'
    ? {
        // Development: Pretty formatted logs avec le format demandé
        transport: {
          target: 'pino-pretty',
          options: {
            colorize: true,
            translateTime: 'dd-mm-yy HH:MM:ss.l',
            ignore: 'pid,hostname,component,args',
            messageFormat: '[{component}]: {msg}',
          },
        },
      }
    : {
        // Production: JSON logs to stdout
        timestamp: pino.stdTimeFunctions.isoTime,
      }),
});

class PinoLogger implements Logger {
  private level: LogLevel;
  private pinoLogger: pino.Logger;

  constructor(level: LogLevel = LogLevel.INFO, pinoInstance?: pino.Logger) {
    this.level = level;
    this.pinoLogger = pinoInstance || basePinoLogger;
  }

  setLevel(level: LogLevel): void {
    this.level = level;
    this.pinoLogger.level = toPinoLevel(level);
  }

  private getComponentName(): string {
    // Extract component from Pino bindings if available
    const bindings = (this.pinoLogger as { bindings?: { component?: string } }).bindings;
    return bindings?.component ? `[${bindings.component}]` : '';
  }

  debug(message: string, ...args: unknown[]): void {
    if (this.level <= LogLevel.DEBUG) {
      this.pinoLogger.debug({ args }, message);
    }
  }

  info(message: string, ...args: unknown[]): void {
    if (this.level <= LogLevel.INFO) {
      this.pinoLogger.info({ args }, message);
    }
  }

  warn(message: string, ...args: unknown[]): void {
    if (this.level <= LogLevel.WARN) {
      this.pinoLogger.warn({ args }, message);
    }
  }

  error(message: string, ...args: unknown[]): void {
    if (this.level <= LogLevel.ERROR) {
      this.pinoLogger.error({ args }, message);
    }
  }
}

// Export singleton logger instance
export const logger: Logger = new PinoLogger(getLogLevel());

// Export factory for creating loggers with custom prefixes
export const createLogger = (prefix: string): Logger => {
  const childLogger = basePinoLogger.child({ component: prefix });
  return new PinoLogger(getLogLevel(), childLogger);
};
