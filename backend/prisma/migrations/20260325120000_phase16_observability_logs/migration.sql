-- AlterTable
ALTER TABLE "bot_logs"
ADD COLUMN "category" TEXT NOT NULL DEFAULT 'system';

-- CreateIndex
CREATE INDEX "bot_logs_botId_createdAt_idx" ON "bot_logs"("botId", "createdAt");

-- CreateIndex
CREATE INDEX "bot_logs_level_createdAt_idx" ON "bot_logs"("level", "createdAt");

