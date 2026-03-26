-- CreateIndex
CREATE INDEX IF NOT EXISTS "bots_userId_createdAt_idx" ON "bots"("userId", "createdAt");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "bots_userId_status_idx" ON "bots"("userId", "status");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "trades_botId_createdAt_idx" ON "trades"("botId", "createdAt");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "trades_botId_status_createdAt_idx" ON "trades"("botId", "status", "createdAt");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "trades_botId_symbol_createdAt_idx" ON "trades"("botId", "symbol", "createdAt");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "trades_createdAt_botId_idx" ON "trades"("createdAt", "botId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "trades_botId_closedAt_idx" ON "trades"("botId", "closedAt");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "instruments_isActive_status_idx" ON "instruments"("isActive", "status");

