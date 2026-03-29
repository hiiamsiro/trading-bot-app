-- Add Stripe customer ID to users (nullable — created on first checkout)
ALTER TABLE "users" ADD COLUMN "stripeCustomerId" TEXT UNIQUE;

-- Add Stripe subscription fields to subscriptions
ALTER TABLE "subscriptions" ADD COLUMN "stripeSubscriptionId" TEXT UNIQUE;
ALTER TABLE "subscriptions" ADD COLUMN "stripePriceId" TEXT;
