-- CreateTable
CREATE TABLE "bot_templates" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "strategy" TEXT NOT NULL,
    "params" JSONB NOT NULL,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "isSystem" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "bot_templates_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "bot_templates_userId_idx" ON "bot_templates"("userId");

-- CreateIndex
CREATE INDEX "bot_templates_isSystem_isDefault_idx" ON "bot_templates"("isSystem", "isDefault");

-- AddColumn
ALTER TABLE "bots" ADD COLUMN "templateId" TEXT;

-- CreateIndex
CREATE INDEX "bots_templateId_idx" ON "bots"("templateId");

-- AddForeignKey
ALTER TABLE "bot_templates" ADD CONSTRAINT "bot_templates_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bots" ADD CONSTRAINT "bots_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "bot_templates"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddColumns (idempotent — may already exist from prior edits)
DO $$ BEGIN
  ALTER TABLE "trades" ADD COLUMN "netPnl" DOUBLE PRECISION;
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "trades" ADD COLUMN "entryFee" DOUBLE PRECISION;
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "trades" ADD COLUMN "exitFee" DOUBLE PRECISION;
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "trades" ADD COLUMN "slippageBps" INTEGER;
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;
