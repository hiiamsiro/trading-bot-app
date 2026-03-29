-- Phase 39: Data Retention
--
-- Schema changes:
--   - Adds deletedAt column to bot_logs for two-phase soft-delete / hard-delete
--   - Adds indexes to support efficient batch-retention queries
--   - Adds indexes for existing queries that lacked them (performance fix)
--
-- Retention policy (applied by the BullMQ data-retention job):
--   bot_logs INFO/DEBUG:   soft-delete → hard-delete after 24 h safety window (7 days)
--   bot_logs WARNING/ERROR: soft-delete → hard-delete after 24 h safety window (90 days)
--   trades (terminal states): hard-delete (90 days; open positions never deleted)
--   notifications (read only):  hard-delete (30 days; unread never deleted)
--   backtests (completed/failed): hard-delete (90 days)
--   execution_sessions (ended): hard-delete (90 days)

-- ─────────────────────────────────────────────────────────────────────────────
-- bot_logs: soft-delete column
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE "bot_logs" ADD COLUMN "deletedAt" TIMESTAMPTZ;

-- Partial covering index: only indexes rows where deletedAt IS NULL (active records).
-- Enables the soft-delete UPDATE to seek directly to old active records without
-- scanning deleted ones, and without requiring deletedAt = NULL in the WHERE clause.
CREATE INDEX IF NOT EXISTS "bot_logs_botId_createdAt_active_idx"
  ON "bot_logs" ("botId", "createdAt")
  WHERE "deletedAt" IS NULL;

-- Hard-delete: range scan on deletedAt to find archived records past safety window
CREATE INDEX IF NOT EXISTS "bot_logs_deletedAt_idx" ON "bot_logs" ("deletedAt");

-- ─────────────────────────────────────────────────────────────────────────────
-- Performance indexes for existing queries that lacked them
-- ─────────────────────────────────────────────────────────────────────────────

-- trades: retention job batches by closedAt + status + createdAt
CREATE INDEX IF NOT EXISTS "trades_closedAt_status_createdAt_idx"
  ON "trades" ("closedAt", "status", "createdAt");

-- execution_sessions: hard-delete queries by endedAt
CREATE INDEX IF NOT EXISTS "execution_sessions_endedAt_idx" ON "execution_sessions" ("endedAt");

-- notifications: hard-delete queries by isRead + createdAt (no userId filter needed)
CREATE INDEX IF NOT EXISTS "notifications_isRead_createdAt_idx" ON "notifications" ("isRead", "createdAt");

-- backtests: retention job filters createdAt lt first (high-selectivity date cutoff), then status IN.
-- Index order (createdAt, status) avoids a residual filter over the full date range.
CREATE INDEX IF NOT EXISTS "backtests_createdAt_status_idx" ON "backtests" ("createdAt", "status");
