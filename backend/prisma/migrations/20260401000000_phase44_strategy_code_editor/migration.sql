-- Migration: Phase 44 - Bot Code Editor
-- Adds StrategyCode model for sandboxed custom strategy execution

-- Create strategy_codes table
CREATE TABLE "strategy_codes" (
    "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "user_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "code" TEXT NOT NULL,
    "language" TEXT NOT NULL DEFAULT 'javascript',
    "is_valid" BOOLEAN NOT NULL DEFAULT true,
    "last_valid_at" TIMESTAMPTZ,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX "strategy_codes_user_id_idx" ON "strategy_codes"("user_id");

-- Add source_code_id column to strategy_configs
ALTER TABLE "strategy_configs" ADD COLUMN "source_code_id" UUID;

-- Add foreign key for source code reference (no cascade — bots keep working if code is unlinked)
ALTER TABLE "strategy_configs"
    ADD CONSTRAINT "strategy_configs_source_code_id_fkey"
    FOREIGN KEY ("source_code_id")
    REFERENCES "strategy_codes"("id")
    ON DELETE SET NULL;
