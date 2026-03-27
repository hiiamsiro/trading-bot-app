-- Init schema (baseline) so `prisma migrate deploy` can run on a fresh DB.

-- CreateEnum
CREATE TYPE "BotStatus" AS ENUM ('RUNNING', 'STOPPED', 'PAUSED', 'ERROR');

-- CreateEnum
CREATE TYPE "TradeSide" AS ENUM ('BUY', 'SELL');

-- CreateEnum
-- Note: phase3 adds 'CLOSED' later
CREATE TYPE "TradeStatus" AS ENUM ('PENDING', 'EXECUTED', 'CANCELLED', 'FAILED');

-- CreateEnum
CREATE TYPE "LogLevel" AS ENUM ('INFO', 'WARNING', 'ERROR', 'DEBUG');

-- CreateTable
CREATE TABLE "users" (
  "id" TEXT NOT NULL,
  "email" TEXT NOT NULL,
  "password" TEXT NOT NULL,
  "name" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateTable
CREATE TABLE "bots" (
  "id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "description" TEXT,
  "symbol" TEXT NOT NULL,
  "status" "BotStatus" NOT NULL DEFAULT 'STOPPED',
  "userId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "bots_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "bots"
ADD CONSTRAINT "bots_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "users"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

-- CreateTable
CREATE TABLE "strategy_configs" (
  "id" TEXT NOT NULL,
  "botId" TEXT NOT NULL,
  "strategy" TEXT NOT NULL,
  "params" JSONB NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "strategy_configs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "strategy_configs_botId_key" ON "strategy_configs"("botId");

-- AddForeignKey
ALTER TABLE "strategy_configs"
ADD CONSTRAINT "strategy_configs_botId_fkey"
FOREIGN KEY ("botId") REFERENCES "bots"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

-- CreateTable
CREATE TABLE "trades" (
  "id" TEXT NOT NULL,
  "botId" TEXT NOT NULL,
  "symbol" TEXT NOT NULL,
  "side" "TradeSide" NOT NULL,
  "quantity" DOUBLE PRECISION NOT NULL,
  "price" DOUBLE PRECISION NOT NULL,
  "totalValue" DOUBLE PRECISION NOT NULL,
  "status" "TradeStatus" NOT NULL DEFAULT 'PENDING',
  "executedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "trades_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "trades"
ADD CONSTRAINT "trades_botId_fkey"
FOREIGN KEY ("botId") REFERENCES "bots"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

-- CreateTable
CREATE TABLE "bot_logs" (
  "id" TEXT NOT NULL,
  "botId" TEXT NOT NULL,
  "level" "LogLevel" NOT NULL,
  "message" TEXT NOT NULL,
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "bot_logs_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "bot_logs"
ADD CONSTRAINT "bot_logs_botId_fkey"
FOREIGN KEY ("botId") REFERENCES "bots"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

-- CreateTable
CREATE TABLE "execution_sessions" (
  "id" TEXT NOT NULL,
  "botId" TEXT NOT NULL,
  "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "endedAt" TIMESTAMP(3),
  "totalTrades" INTEGER NOT NULL DEFAULT 0,
  "profitLoss" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "initialBalance" DOUBLE PRECISION NOT NULL,
  "currentBalance" DOUBLE PRECISION NOT NULL,
  CONSTRAINT "execution_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "execution_sessions_botId_key" ON "execution_sessions"("botId");

-- AddForeignKey
ALTER TABLE "execution_sessions"
ADD CONSTRAINT "execution_sessions_botId_fkey"
FOREIGN KEY ("botId") REFERENCES "bots"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

