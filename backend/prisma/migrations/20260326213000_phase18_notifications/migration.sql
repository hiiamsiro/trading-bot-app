-- CreateEnum
CREATE TYPE "NotificationType" AS ENUM (
  'BOT_STARTED',
  'BOT_STOPPED',
  'BOT_ERROR',
  'TRADE_OPENED',
  'TRADE_CLOSED',
  'STOP_LOSS_HIT',
  'TAKE_PROFIT_HIT'
);

-- CreateTable
CREATE TABLE "notifications" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "botId" TEXT,
  "tradeId" TEXT,
  "type" "NotificationType" NOT NULL,
  "title" TEXT NOT NULL,
  "message" TEXT NOT NULL,
  "metadata" JSONB,
  "isRead" BOOLEAN NOT NULL DEFAULT false,
  "readAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "notifications_userId_isRead_createdAt_idx" ON "notifications"("userId", "isRead", "createdAt");

-- CreateIndex
CREATE INDEX "notifications_userId_createdAt_idx" ON "notifications"("userId", "createdAt");

-- AddForeignKey
ALTER TABLE "notifications"
ADD CONSTRAINT "notifications_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "users"("id")
ON DELETE CASCADE ON UPDATE CASCADE;
