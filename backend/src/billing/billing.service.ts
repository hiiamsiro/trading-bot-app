import { Injectable } from '@nestjs/common';
import { Plan, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

export interface PlanLimits {
  maxBots: number
  maxRunningBots: number
  canBacktest: boolean
  canPublish: boolean
  canCloneFromMarketplace: boolean
  canUseCustomCode: boolean
}

export const PLAN_ORDER: Plan[] = ['FREE', 'PRO', 'PREMIUM']

export const PLAN_LIMITS: Record<Plan, PlanLimits> = {
  FREE: {
    maxBots: 1,
    maxRunningBots: 1,
    canBacktest: false,
    canPublish: false,
    canCloneFromMarketplace: false,
    canUseCustomCode: false,
  },
  PRO: {
    maxBots: 5,
    maxRunningBots: 3,
    canBacktest: true,
    canPublish: true,
    canCloneFromMarketplace: true,
    canUseCustomCode: true,
  },
  PREMIUM: {
    maxBots: -1, // unlimited
    maxRunningBots: -1,
    canBacktest: true,
    canPublish: true,
    canCloneFromMarketplace: true,
    canUseCustomCode: true,
  },
}

// Shared with frontend via API response; also used here for error messages
export const PLAN_LABELS: Record<Plan, string> = {
  FREE: 'Free',
  PRO: 'Pro',
  PREMIUM: 'Premium',
}

// 30 days in milliseconds
export const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000

// Exported so users.service.ts can reuse without duplicating
export function periodEnd(): Date {
  return new Date(Date.now() + THIRTY_DAYS_MS);
}

@Injectable()
export class BillingService {
  constructor(private readonly prisma: PrismaService) {}

  async getOrCreateSubscription(userId: string): Promise<Prisma.SubscriptionGetPayload<{}>> {
    // Use upsert to avoid race condition: only one request succeeds, others are no-ops
    return this.prisma.subscription.upsert({
      where: { userId },
      create: {
        userId,
        plan: 'FREE',
        status: 'ACTIVE',
        currentPeriodEnd: periodEnd(),
      },
      update: {},
    });
  }

  async getSubscription(userId: string): Promise<Prisma.SubscriptionGetPayload<{}> | null> {
    return this.prisma.subscription.findUnique({ where: { userId } });
  }

  async getUserWithStripeCustomer(userId: string) {
    return this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, stripeCustomerId: true },
    });
  }

  async getPlan(userId: string): Promise<Plan> {
    const sub = await this.getSubscription(userId);
    return sub?.plan ?? 'FREE';
  }

  getPlanLimits(plan: Plan): PlanLimits {
    return PLAN_LIMITS[plan];
  }

  async canCreateBot(userId: string): Promise<{ allowed: boolean; reason?: string }> {
    const [sub, botCount] = await Promise.all([
      this.getSubscription(userId),
      this.prisma.bot.count({ where: { userId } }),
    ]);

    const plan = sub?.plan ?? 'FREE';
    const limits = PLAN_LIMITS[plan];

    if (limits.maxBots !== -1 && botCount >= limits.maxBots) {
      const label = PLAN_LABELS[plan === 'FREE' ? 'PRO' : 'PREMIUM'];
      return {
        allowed: false,
        reason: `Bot limit reached (${limits.maxBots}). Upgrade to ${label} for more bots.`,
      };
    }

    return { allowed: true };
  }

  async canRunBot(userId: string): Promise<{ allowed: boolean; reason?: string }> {
    const [sub, runningCount] = await Promise.all([
      this.getSubscription(userId),
      this.prisma.bot.count({ where: { userId, status: 'RUNNING' } }),
    ]);

    const plan = sub?.plan ?? 'FREE';
    const limits = PLAN_LIMITS[plan];

    if (limits.maxRunningBots !== -1 && runningCount >= limits.maxRunningBots) {
      return {
        allowed: false,
        reason: `Running bot limit reached (${limits.maxRunningBots}). Upgrade for more concurrent bots.`,
      };
    }

    return { allowed: true };
  }

  async canPublish(userId: string): Promise<{ allowed: boolean; reason?: string }> {
    const plan = await this.getPlan(userId);
    if (PLAN_LIMITS[plan].canPublish) {
      return { allowed: true };
    }
    return {
      allowed: false,
      reason: 'Publishing requires a Pro or Premium plan.',
    };
  }

  async canUseCustomCode(userId: string): Promise<{ allowed: boolean; reason?: string }> {
    const plan = await this.getPlan(userId);
    if (PLAN_LIMITS[plan].canUseCustomCode) {
      return { allowed: true };
    }
    return {
      allowed: false,
      reason: 'Custom code editor requires a Pro or Premium plan.',
    };
  }

  async getBotCount(userId: string): Promise<number> {
    return this.prisma.bot.count({ where: { userId } });
  }

  async updatePlan(
    userId: string,
    plan: Plan,
  ): Promise<Prisma.SubscriptionGetPayload<{}>> {
    // Idempotent upsert: works for both existing and new users
    return this.prisma.subscription.upsert({
      where: { userId },
      create: {
        userId,
        plan,
        status: 'ACTIVE',
        currentPeriodEnd: periodEnd(),
      },
      update: {
        plan,
        status: 'ACTIVE',
        currentPeriodEnd: periodEnd(),
      },
    });
  }

  /**
   * Atomically reads the current plan, runs a guard callback, then upserts the new plan.
   * The guard is evaluated inside the transaction so it sees a consistent snapshot.
   */
  async updatePlanAtomically(
    userId: string,
    targetPlan: Plan,
    planOrder: Plan[],
    guard: (currentRank: number, targetRank: number) => void,
  ): Promise<Prisma.SubscriptionGetPayload<{}>> {
    return this.prisma.$transaction(async (tx) => {
      const current = await tx.subscription.findUnique({ where: { userId } });
      const currentRank = planOrder.indexOf(current?.plan ?? 'FREE');
      const targetRank = planOrder.indexOf(targetPlan);
      guard(currentRank, targetRank);

      return tx.subscription.upsert({
        where: { userId },
        create: {
          userId,
          plan: targetPlan,
          status: 'ACTIVE',
          currentPeriodEnd: periodEnd(),
        },
        update: {
          plan: targetPlan,
          status: 'ACTIVE',
          currentPeriodEnd: periodEnd(),
        },
      });
    });
  }

  async cancelSubscription(userId: string): Promise<Prisma.SubscriptionGetPayload<{}> | null> {
    return this.prisma.$transaction(async (tx) => {
      await tx.subscription.updateMany({
        where: { userId },
        data: { status: 'CANCELLED' },
      });
      return tx.subscription.findUnique({ where: { userId } });
    });
  }
}
