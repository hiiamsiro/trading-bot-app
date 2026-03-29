-- Add bot health tracking fields for Phase 36
-- lastRunAt: updated after every execution tick (shows the bot is alive)
-- lastSignalAt: updated after every strategy evaluation (shows it has market data)

ALTER TABLE "bots"
  ADD COLUMN "lastRunAt"    TIMESTAMPTZ,
  ADD COLUMN "lastSignalAt" TIMESTAMPTZ;

-- Index so health queries are fast (don't scan all running bots)
CREATE INDEX "bots_status_lastRunAt_idx" ON "bots" ("status", "lastRunAt");
