/**
 * Worker scaling and retry configuration.
 *
 * Design rationale:
 * - bot-execution: CPU-light but latency-sensitive.  Concurrency 5 lets multiple
 *   bots tick in parallel without exhausting the event loop.  Each tick completes
 *   in < 500 ms under normal conditions, so back-pressure is minimal.
 * - market-data:  I/O-bound (fetches from exchange + WebSocket fan-out).  Concurrency 3
 *   lets us service more symbols per interval without hammering rate limits.
 * - instrument-sync:  Infrequent, runs once every 6 h.  Concurrency 1 is sufficient
 *   and avoids unnecessary DB write contention.
 *
 * Retry policy:
 *   bot-execution:  up to 3 attempts with exponential back-off.  The job is idempotent
 *   (it re-reads current bot state on every tick) so duplicate ticks are harmless.
 *   market-data:    up to 2 attempts — individual failures are not fatal and subsequent
 *   ticks will refresh the data shortly.
 *   instrument-sync: up to 3 attempts with exponential back-off — provider transient
 *   errors should be retried before giving up.
 */

export const BOT_EXECUTION_CONCURRENCY = parseInt(process.env.BOT_EXECUTION_CONCURRENCY ?? '5', 10);
export const BOT_EXECUTION_MAX_RETRIES = parseInt(process.env.BOT_EXECUTION_MAX_RETRIES ?? '3', 10);
export const BOT_EXECUTION_BACKOFF_BASE = 5_000; // ms, multiplied by 2^attempt each retry

export const MARKET_DATA_CONCURRENCY = parseInt(process.env.MARKET_DATA_CONCURRENCY ?? '3', 10);
export const MARKET_DATA_MAX_RETRIES = parseInt(process.env.MARKET_DATA_MAX_RETRIES ?? '2', 10);
export const MARKET_DATA_BACKOFF_BASE = 2_000;

export const INSTRUMENT_SYNC_CONCURRENCY = parseInt(
  process.env.INSTRUMENT_SYNC_CONCURRENCY ?? '1',
  10,
);
export const INSTRUMENT_SYNC_MAX_RETRIES = parseInt(
  process.env.INSTRUMENT_SYNC_MAX_RETRIES ?? '3',
  10,
);
export const INSTRUMENT_SYNC_BACKOFF_DELAY = 60_000; // 1 min — sync is infrequent so back-off can be generous

// data-retention queue — these are intentionally small: a retention job that fails repeatedly
// is worse than a missed run (data sits longer, which is safe).
export const DATA_RETENTION_QUEUE_MAX_RETRIES = 3;
export const DATA_RETENTION_QUEUE_BACKOFF_DELAY = 1_000; // ms, exponential
export const DATA_RETENTION_QUEUE_REMOVE_ON_COMPLETE = 10;
export const DATA_RETENTION_QUEUE_REMOVE_ON_FAIL = 20;
