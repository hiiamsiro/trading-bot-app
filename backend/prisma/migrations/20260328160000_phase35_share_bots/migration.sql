-- Migration: Phase 35 — Share & Clone strategies
-- Add isPublic + shareSlug to bots table

BEGIN;

ALTER TABLE "bots" ADD COLUMN "isPublic" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "bots" ADD COLUMN "shareSlug" TEXT;

CREATE UNIQUE INDEX "bots_shareSlug_key" ON "bots"("shareSlug") WHERE "shareSlug" IS NOT NULL;
CREATE INDEX "bots_isPublic_createdAt_idx" ON "bots"("isPublic", "createdAt");

COMMIT;
