-- Rollback Phase 39: Data Retention
DROP INDEX IF EXISTS "bot_logs_deletedAt_idx";
DROP INDEX IF EXISTS "bot_logs_botId_deletedAt_idx";
ALTER TABLE "bot_logs" DROP COLUMN IF EXISTS "deletedAt";
