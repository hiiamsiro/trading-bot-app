/**
 * Data-retention configuration.
 *
 * All values are in days.  Override via environment variables.
 *
 * IMPORTANT: values are read once at module-boot time.  Invalid values (NaN, negative)
 * will throw at startup rather than silently corrupt data — see validateRetentionConfig().
 *
 * Retention rationale per table:
 * - bot_logs INFO/DEBUG: 7 days — tick noise is high-volume; no diagnostic value
 *   unless a bot was under active investigation during that window.
 * - bot_logs WARNING/ERROR: 90 days — rare, high diagnostic value.  DEBUG is included
 *   in the INFO/DEBUG bucket (too noisy for the long window).
 * - trades (CLOSED/EXECUTED/CANCELLED/FAILED): 90 days — financial record.  Open
 *   positions (closedAt = NULL) are NEVER deleted.
 * - notifications: 30 days — in-app noise; unread ones are always preserved.
 * - backtests: 90 days — equity curve + metrics JSON can be large; re-run is cheap.
 * - execution_sessions: 90 days — session history is only referenced for the most-
 *   recent run per bot.
 */

// Validators: throw at module-boot time so a bad .env fails the app immediately
// rather than silently corrupting data at the first retention run.

function nonNegativeInt(envKey: string, fallback: number): number {
  const raw = process.env[envKey];
  const val = raw !== undefined ? parseInt(raw, 10) : fallback;
  if (!Number.isFinite(val) || val < 0) {
    throw new Error(`Invalid ${envKey}="${raw}" — must be a non-negative integer`);
  }
  return val;
}

function positiveInt(envKey: string, fallback: number): number {
  const raw = process.env[envKey];
  const val = raw !== undefined ? parseInt(raw, 10) : fallback;
  if (!Number.isFinite(val) || val <= 0) {
    throw new Error(`Invalid ${envKey}="${raw}" — must be a positive integer`);
  }
  return val;
}

// Export as `const` so callers get a plain number (not a function call).
export const LOG_RETENTION_INFO_DEBUG_DAYS = nonNegativeInt('LOG_RETENTION_INFO_DEBUG_DAYS', 7);
export const LOG_RETENTION_WARNING_ERROR_DAYS = nonNegativeInt('LOG_RETENTION_WARNING_ERROR_DAYS', 90);
export const TRADE_RETENTION_DAYS = nonNegativeInt('TRADE_RETENTION_DAYS', 90);
export const NOTIFICATION_RETENTION_DAYS = nonNegativeInt('NOTIFICATION_RETENTION_DAYS', 30);
export const BACKTEST_RETENTION_DAYS = nonNegativeInt('BACKTEST_RETENTION_DAYS', 90);
export const EXECUTION_SESSION_RETENTION_DAYS = nonNegativeInt('EXECUTION_SESSION_RETENTION_DAYS', 90);

export const RETENTION_BATCH_SIZE = positiveInt('RETENTION_BATCH_SIZE', 1000);

/**
 * How often the retention job runs.
 * Default: daily at 03:00 UTC (low-traffic window).
 * Operators can align with their DB backup window via cron expression.
 */
export const DATA_RETENTION_CRON = process.env.DATA_RETENTION_CRON ?? '0 3 * * *';

export const DATA_RETENTION_MAX_RETRIES = positiveInt('DATA_RETENTION_MAX_RETRIES', 3);
export const DATA_RETENTION_BACKOFF_DELAY = 60_000; // 1 min fixed backoff between retries
