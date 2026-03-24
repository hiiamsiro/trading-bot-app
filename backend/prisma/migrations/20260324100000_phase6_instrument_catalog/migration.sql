-- CreateEnum
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'InstrumentAssetClass') THEN
    CREATE TYPE "InstrumentAssetClass" AS ENUM ('CRYPTO', 'COMMODITY');
  END IF;
END
$$;

-- CreateEnum
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'InstrumentMarketType') THEN
    CREATE TYPE "InstrumentMarketType" AS ENUM ('SPOT', 'CFD');
  END IF;
END
$$;

-- CreateEnum
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'InstrumentStatus') THEN
    CREATE TYPE "InstrumentStatus" AS ENUM ('ACTIVE', 'MAINTENANCE', 'DISABLED');
  END IF;
END
$$;

-- CreateTable
CREATE TABLE IF NOT EXISTS "instruments" (
    "id" TEXT NOT NULL,
    "symbol" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "assetClass" "InstrumentAssetClass" NOT NULL,
    "marketType" "InstrumentMarketType" NOT NULL,
    "baseAsset" TEXT,
    "quoteCurrency" TEXT NOT NULL,
    "exchange" TEXT NOT NULL,
    "dataSource" TEXT NOT NULL,
    "sourceSymbol" TEXT,
    "supportedIntervals" JSONB NOT NULL,
    "pricePrecision" INTEGER NOT NULL,
    "quantityPrecision" INTEGER NOT NULL,
    "status" "InstrumentStatus" NOT NULL DEFAULT 'ACTIVE',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "instruments_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "instruments_symbol_key" ON "instruments"("symbol");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "instruments_isActive_idx" ON "instruments"("isActive");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "instruments_assetClass_marketType_idx" ON "instruments"("assetClass", "marketType");
