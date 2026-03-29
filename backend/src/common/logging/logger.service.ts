/**
 * Central structured logger for the trading bot application.
 *
 * All log output is JSON (pino default).  The schema is intentionally flat so it
 * feeds cleanly into Loki, Datadog, or any JSON log aggregator.
 *
 * Log levels follow Pino conventions:
 *   10 = trace  20 = debug  30 = info  40 = warn  50 = error  60 = fatal
 *
 * Every log event carries at minimum:
 *   - ts       – ISO-8601 timestamp (pino default)
 *   - level    – numeric level + human label
 *   - msg      – human-readable message
 *   - service  – always "trading-bot-backend"
 *
 * Optional contextual fields that SHOULD be added wherever known:
 *   - traceId  – correlation ID from pino-http / request interceptor
 *   - userId   – authenticated user making the request (set by guard/interceptor)
 *   - botId    – trading bot being operated on
 *   - jobId    – BullMQ job ID
 *   - category – logical domain (auth|bot|trade|market|job|system)
 *
 * Usage:
 *   import { AppLogger } from './common/logging/logger.service'
 *   const logger = new AppLogger('auth')
 *   logger.warn({ userId: '…', traceId }, 'Login attempt rejected')
 */

import { Logger as PinoLogger, pino } from 'pino';

const SERVICE_NAME = 'trading-bot-backend';

const baseLogger = pino({
  level: process.env.LOG_LEVEL ?? 'info',
  base: {
    service: SERVICE_NAME,
  },
  // Timestamp is always ISO-8601
  timestamp: pino.stdTimeFunctions.isoTime,
  // Pretty-print in development only
  ...(process.env.NODE_ENV !== 'production'
    ? {
        transport: {
          target: 'pino/file',
          options: { destination: 1 }, // stdout
        },
      }
    : {}),
});

export type LogLevel = 'trace' | 'debug' | 'info' | 'warn' | 'error' | 'fatal';

export interface LogContext {
  traceId?: string;
  userId?: string;
  botId?: string;
  jobId?: string;
  category?: string;
  // Allow arbitrary extra keys
  [key: string]: unknown;
}

export class AppLogger {
  /**
   * Exposed for pino-http injection (pino-http requires direct access to a
   * PinoLogger instance, not the AppLogger wrapper).
   */
  logger: PinoLogger;
  private category: string;

  constructor(category: string) {
    this.category = category;
    // Clone the base logger so we can stamp each instance with its category
    this.logger = baseLogger.child({ category });
  }

  /**
   * Stamp the logger with a trace ID from the incoming HTTP request.
   * The returned instance will include traceId on every subsequent log line.
   */
  withTrace(traceId: string): AppLogger {
    const child = new AppLogger(this.category);
    child.logger = this.logger.child({ traceId });
    return child;
  }

  /**
   * Stamp the logger with a user ID (set after JWT verification).
   */
  withUser(userId: string): AppLogger {
    const child = new AppLogger(this.category);
    child.logger = this.logger.child({ userId });
    return child;
  }

  private write(level: LogLevel, message: string, context?: LogContext) {
    // pino.child() expects plain values; spread context in to avoid type issues
    const child = context
      ? this.logger.child(context as Record<string, unknown>)
      : this.logger;
    (child as PinoLogger)[level](message);
  }

  trace(message: string, context?: LogContext): void {
    this.write('trace', message, context);
  }

  debug(message: string, context?: LogContext): void {
    this.write('debug', message, context);
  }

  info(message: string, context?: LogContext): void {
    this.write('info', message, context);
  }

  warn(message: string, context?: LogContext): void {
    this.write('warn', message, context);
  }

  error(message: string, context?: LogContext): void {
    this.write('error', message, context);
  }

  fatal(message: string, context?: LogContext): void {
    this.write('fatal', message, context);
  }
}
