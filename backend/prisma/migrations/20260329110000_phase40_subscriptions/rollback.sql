-- Remove FK constraint from subscriptions
ALTER TABLE "subscriptions" DROP CONSTRAINT IF EXISTS "subscriptions_userId_fkey";

-- Drop subscriptions table
DROP TABLE IF EXISTS "subscriptions";

-- Drop enums
DROP TYPE IF EXISTS "SubStatus";
DROP TYPE IF EXISTS "Plan";
