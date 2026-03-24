-- AlterEnum
ALTER TYPE "TradeStatus" ADD VALUE 'CLOSED';

-- AlterTable
ALTER TABLE "trades" ADD COLUMN     "exitPrice" DOUBLE PRECISION,
ADD COLUMN     "realizedPnl" DOUBLE PRECISION,
ADD COLUMN     "stopLoss" DOUBLE PRECISION,
ADD COLUMN     "takeProfit" DOUBLE PRECISION,
ADD COLUMN     "closedAt" TIMESTAMP(3),
ADD COLUMN     "closeReason" TEXT;
