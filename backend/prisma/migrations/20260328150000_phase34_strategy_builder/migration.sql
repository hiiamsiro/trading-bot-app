-- Add builderConfig JSON column to StrategyConfig for visual strategy builder
ALTER TABLE "strategy_configs" ADD COLUMN "builder_config" JSONB;
