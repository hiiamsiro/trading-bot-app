-- Remove Stripe subscription fields
ALTER TABLE "subscriptions" DROP COLUMN IF EXISTS "stripePriceId";
ALTER TABLE "subscriptions" DROP COLUMN IF EXISTS "stripeSubscriptionId";

-- Remove Stripe customer ID from users
ALTER TABLE "users" DROP COLUMN IF EXISTS "stripeCustomerId";
