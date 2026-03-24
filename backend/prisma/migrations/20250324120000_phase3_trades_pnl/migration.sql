-- AlterEnum
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_enum e
    JOIN pg_type t ON e.enumtypid = t.oid
    WHERE t.typname = 'TradeStatus' AND e.enumlabel = 'CLOSED'
  ) THEN
    ALTER TYPE "TradeStatus" ADD VALUE 'CLOSED';
  END IF;
END
$$;

-- AlterTable
ALTER TABLE "trades"
ADD COLUMN IF NOT EXISTS "exitPrice" DOUBLE PRECISION,
ADD COLUMN IF NOT EXISTS "realizedPnl" DOUBLE PRECISION,
ADD COLUMN IF NOT EXISTS "stopLoss" DOUBLE PRECISION,
ADD COLUMN IF NOT EXISTS "takeProfit" DOUBLE PRECISION,
ADD COLUMN IF NOT EXISTS "closedAt" TIMESTAMP(3),
ADD COLUMN IF NOT EXISTS "closeReason" TEXT;
