-- Migration: Phase 42 - Strategy Optimization System
-- Adds grid search optimization with async job processing

-- Optimization run record
CREATE TABLE "optimizations" (
    "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "user_id" TEXT NOT NULL,
    "symbol" TEXT NOT NULL,
    "interval" TEXT NOT NULL,
    "strategy" TEXT NOT NULL,
    "param_ranges" JSONB NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "progress" INTEGER NOT NULL DEFAULT 0,
    "total_combinations" INTEGER NOT NULL DEFAULT 0,
    "completed_combinations" INTEGER NOT NULL DEFAULT 0,
    "best_by_pnl" JSONB,
    "best_by_drawdown" JSONB,
    "best_by_winrate" JSONB,
    "all_results" JSONB,
    "error" TEXT,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX "optimizations_user_id_created_at_idx" ON "optimizations"("user_id", "created_at" DESC);
CREATE INDEX "optimizations_status_idx" ON "optimizations"("status");

ALTER TABLE "optimizations" ADD CONSTRAINT "optimizations_user_id_fkey"
    FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE;
