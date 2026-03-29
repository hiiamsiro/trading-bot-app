-- Create subscription plans enum
CREATE TYPE "Plan" AS ENUM ('FREE', 'PRO', 'PREMIUM');

-- Create subscription status enum
CREATE TYPE "SubStatus" AS ENUM ('ACTIVE', 'PAST_DUE', 'CANCELLED');

-- Create subscriptions table
-- FK direction: Subscription.userId → User.id (one-to-one via child side, matches schema.prisma)
CREATE TABLE "subscriptions" (
    "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "userId" UUID NOT NULL,
    "plan" "Plan" NOT NULL DEFAULT 'FREE',
    "status" "SubStatus" NOT NULL DEFAULT 'ACTIVE',
    "currentPeriodEnd" TIMESTAMP NOT NULL DEFAULT (NOW() + INTERVAL '30 days'),
    "createdAt" TIMESTAMP NOT NULL DEFAULT NOW(),
    "updatedAt" TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Enforce unique userId (one subscription per user)
CREATE UNIQUE INDEX "subscriptions_userId_key" ON "subscriptions"("userId");

-- FK: subscriptions.userId → users.id
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE;
