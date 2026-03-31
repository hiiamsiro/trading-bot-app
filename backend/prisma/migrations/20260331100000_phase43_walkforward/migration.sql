-- Migration: Phase 43 - Walk-Forward Testing
-- Adds walk-forward analysis model with train/test split results

CREATE TABLE "walkforwards" (
    "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "user_id" TEXT NOT NULL,
    "symbol" TEXT NOT NULL,
    "interval" TEXT NOT NULL,
    "strategy" TEXT NOT NULL,
    "param_ranges" JSONB NOT NULL,
    "train_from_date" TIMESTAMPTZ NOT NULL,
    "train_to_date" TIMESTAMPTZ NOT NULL,
    "test_from_date" TIMESTAMPTZ NOT NULL,
    "test_to_date" TIMESTAMPTZ NOT NULL,
    "train_split_pct" INTEGER NOT NULL DEFAULT 70,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "error" TEXT,
    "best_train_params" JSONB,
    "train_metrics" JSONB,
    "train_equity_curve" JSONB,
    "test_metrics" JSONB,
    "test_equity_curve" JSONB,
    "test_trades" JSONB,
    "train_trades" JSONB,
    "train_pnl" FLOAT,
    "test_pnl" FLOAT,
    "train_drawdown" FLOAT,
    "test_drawdown" FLOAT,
    "train_win_rate" FLOAT,
    "test_win_rate" FLOAT,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX "walkforwards_user_id_created_at_idx" ON "walkforwards"("user_id", "created_at" DESC);

ALTER TABLE "walkforwards" ADD CONSTRAINT "walkforwards_user_id_fkey"
    FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE;
