/**
 * Structured error logger for the frontend.
 *
 * Schema mirrors the backend pino output so log aggregators (Loki, Datadog)
 * can correlate browser errors with their corresponding backend trace IDs.
 *
 * All errors are sent to the backend /logs endpoint (logged alongside bot events)
 * AND written to the browser console as structured JSON for development.
 *
 * Context automatically captured:
 *   - browserUserId   — decoded from the auth token if present
 *   - userAgent       — navigator.userAgent
 *   - url             — window.location.href
 *   - traceId         — X-Trace-Id from the last successful API response (set by api.ts)
 *
 * Usage:
 *   import { errorLogger } from '@/lib/error-logger'
 *   errorLogger.error('Portfolio metrics failed to load', { botId: '123', symbol: 'BTCUSDT' })
 */

export interface ErrorLogContext {
  traceId?: string;
  userId?: string;
  botId?: string;
  /** Human-readable event name — maps to BotLog.category */
  category?: string;
  /** Additional free-form key/value pairs */
  [key: string]: unknown;
  /** Error.stack captured manually before passing */
  stack?: string;
}

interface ErrorLogPayload {
  timestamp: string;
  level: 'error' | 'warn' | 'info';
  service: 'trading-bot-frontend';
  message: string;
  traceId?: string;
  userId?: string;
  botId?: string;
  category: string;
  userAgent: string;
  url: string;
  stack?: string;
  extra: Record<string, unknown>;
}

/**
 * Reads the trace ID injected by the backend response interceptor.
 * This lets us correlate a frontend error with a specific backend request.
 */
export function getLastTraceId(): string | undefined {
  try {
    return (window as Window & { __lastTraceId__?: string }).__lastTraceId__;
  } catch {
    return undefined;
  }
}

/**
 * Lightweight log sender — fire-and-forget, never throws.
 */
async function sendToBackend(payload: ErrorLogPayload): Promise<void> {
  try {
    const token = (window as Window & { __authToken__?: string }).__authToken__;
    await fetch(`${process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001'}/bots/system-logs`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify(payload),
    });
  } catch {
    // Never throw — logging must not affect app behaviour
  }
}

function buildPayload(
  level: ErrorLogPayload['level'],
  message: string,
  ctx: ErrorLogContext = {},
): ErrorLogPayload {
  return {
    timestamp: new Date().toISOString(),
    level,
    service: 'trading-bot-frontend',
    message,
    traceId: ctx.traceId ?? getLastTraceId(),
    userId: ctx.userId,
    botId: ctx.botId,
    category: ctx.category ?? 'system',
    userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : 'unknown',
    url: typeof window !== 'undefined' ? window.location.href : 'unknown',
    stack: ctx.stack,
    extra: ctx,
  };
}

function dispatch(level: ErrorLogPayload['level'], message: string, ctx: ErrorLogContext = {}) {
  const payload = buildPayload(level, message, ctx);

  // Always emit structured JSON to console so devs can filter it
  const consoleMethod = level === 'error' ? console.error : level === 'warn' ? console.warn : console.log;
  consoleMethod('[error-logger]', payload);

  // Send to backend asynchronously
  sendToBackend(payload);
}

export const errorLogger = {
  error(message: string, ctx?: ErrorLogContext) {
    dispatch('error', message, ctx);
  },
  warn(message: string, ctx?: ErrorLogContext) {
    dispatch('warn', message, ctx);
  },
  info(message: string, ctx?: ErrorLogContext) {
    dispatch('info', message, ctx);
  },
};
