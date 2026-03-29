const test = require('node:test');
const assert = require('node:assert/strict');
const { ForbiddenException } = require('@nestjs/common');

const { BillingService } = require('../src/billing/billing.service.ts');

const { mockAsyncFn, mockFn } = require('./helpers.ts');

function makeBillingService(prismaMock?: any) {
  const prisma = prismaMock ?? {
    subscription: {
      upsert: mockAsyncFn(async ({ create }) => ({
        id: 'sub-1',
        userId: create.userId,
        plan: create.plan,
        status: create.status,
        currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      })),
      findUnique: mockAsyncFn(async () => null),
      update: mockAsyncFn(async ({ data }) => ({
        id: 'sub-1',
        userId: 'user-1',
        plan: data.plan ?? 'FREE',
        status: data.status,
      })),
      updateMany: mockAsyncFn(async () => ({ count: 1 })),
    },
    bot: {
      count: mockAsyncFn(async () => 0),
    },
    $transaction: mockAsyncFn(async (fn) => {
      if (typeof fn === 'function') return fn(prisma);
      return fn;
    }),
  };
  return new BillingService(prisma);
}

test('getPlan returns FREE when no subscription exists', async () => {
  const prisma = {
    subscription: { findUnique: mockAsyncFn(async () => null) },
  };
  const service = makeBillingService(prisma);

  const plan = await service.getPlan('user-1');

  assert.equal(plan, 'FREE');
  assert.equal(prisma.subscription.findUnique.calls.length, 1);
  assert.deepEqual(prisma.subscription.findUnique.calls[0][0].where, { userId: 'user-1' });
});

test('getPlan returns existing plan when subscription found', async () => {
  const prisma = {
    subscription: {
      findUnique: mockAsyncFn(async () => ({ plan: 'PRO', status: 'ACTIVE' })),
    },
  };
  const service = makeBillingService(prisma);

  const plan = await service.getPlan('user-1');

  assert.equal(plan, 'PRO');
});

test('getOrCreateSubscription upserts when no subscription exists', async () => {
  const upsertFn = mockAsyncFn(async ({ create }) => ({
    id: 'sub-1',
    userId: create.userId,
    plan: create.plan,
    status: create.status,
    currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
  }));
  const prisma = {
    subscription: { upsert: upsertFn, findUnique: mockAsyncFn(async () => null) },
  };
  const service = makeBillingService(prisma);

  const sub = await service.getOrCreateSubscription('user-1');

  assert.equal(upsertFn.calls.length, 1);
  assert.equal(upsertFn.calls[0][0].where.userId, 'user-1');
  assert.equal(upsertFn.calls[0][0].create.plan, 'FREE');
  assert.equal(sub.plan, 'FREE');
});

test('getOrCreateSubscription calls upsert even when subscription exists (idempotent)', async () => {
  const existingSub = {
    id: 'sub-1',
    userId: 'user-1',
    plan: 'PRO',
    status: 'ACTIVE',
    currentPeriodEnd: new Date(),
  };
  const upsertFn = mockAsyncFn(async ({ create, update }) => existingSub);
  const prisma = {
    subscription: {
      upsert: upsertFn,
    },
  };
  const service = makeBillingService(prisma);

  await service.getOrCreateSubscription('user-1');

  // upsert IS called — that's the design (idempotent upsert, no pre-check needed)
  assert.equal(upsertFn.calls.length, 1);
  // update clause is empty when subscription exists (upsert applies the no-op update)
  assert.equal(upsertFn.calls[0][0].update.plan, undefined);
  // returned value is the existing subscription (upsert returns the existing row)
  const result = await service.getOrCreateSubscription('user-1');
  assert.equal(result.plan, 'PRO');
});

test('updatePlanAtomically rejects downgrade', async () => {
  const prisma = {
    subscription: {
      findUnique: mockAsyncFn(async () => ({ plan: 'PRO', status: 'ACTIVE' })),
      upsert: mockAsyncFn(async ({ create }) => create),
    },
    $transaction: mockAsyncFn(async (fn) => fn(prisma)),
  };
  const service = makeBillingService(prisma);

  await assert.rejects(
    () =>
      service.updatePlanAtomically(
        'user-1',
        'FREE',
        ['FREE', 'PRO', 'PREMIUM'],
        (currentRank, targetRank) => {
          if (targetRank < currentRank) {
            throw new ForbiddenException('Downgrade not supported');
          }
        },
      ),
    { name: 'ForbiddenException' },
  );
});

test('updatePlanAtomically allows upgrade', async () => {
  const upsertFn = mockAsyncFn(async ({ create }) => ({
    id: 'sub-1',
    userId: create.userId,
    plan: create.plan,
    status: create.status,
    currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
  }));
  const prisma = {
    subscription: {
      findUnique: mockAsyncFn(async () => ({ plan: 'FREE', status: 'ACTIVE' })),
      upsert: upsertFn,
    },
    $transaction: mockAsyncFn(async (fn) => fn(prisma)),
  };
  const service = makeBillingService(prisma);

  const sub = await service.updatePlanAtomically(
    'user-1',
    'PRO',
    ['FREE', 'PRO', 'PREMIUM'],
    (currentRank, targetRank) => {
      if (targetRank < currentRank) {
        throw new ForbiddenException('Downgrade not supported');
      }
    },
  );

  assert.equal(upsertFn.calls.length, 1);
  assert.equal(upsertFn.calls[0][0].update.plan, 'PRO');
  assert.equal(sub.plan, 'PRO');
});

test('cancelSubscription sets status to CANCELLED (uses updateMany + findUnique)', async () => {
  const updateManyFn = mockAsyncFn(async ({ data }) => ({ count: 1 }));
  const findUniqueFn = mockAsyncFn(async () => ({
    id: 'sub-1',
    userId: 'user-1',
    plan: 'FREE',
    status: 'CANCELLED',
    currentPeriodEnd: new Date(),
  }));
  const prisma = {
    subscription: { updateMany: updateManyFn, findUnique: findUniqueFn },
    $transaction: mockAsyncFn(async (fn) => {
      if (typeof fn === 'function') return fn(prisma);
      return fn;
    }),
  };
  const service = makeBillingService(prisma);

  const sub = await service.cancelSubscription('user-1');

  assert.equal(updateManyFn.calls.length, 1);
  assert.deepEqual(updateManyFn.calls[0][0].where, { userId: 'user-1' });
  assert.deepEqual(updateManyFn.calls[0][0].data, { status: 'CANCELLED' });
  assert.equal(sub.status, 'CANCELLED');
});

test('cancelSubscription is idempotent when no subscription exists', async () => {
  const updateManyFn = mockAsyncFn(async () => ({ count: 0 }));
  const findUniqueFn = mockAsyncFn(async () => null);
  const prisma = {
    subscription: { updateMany: updateManyFn, findUnique: findUniqueFn },
    $transaction: mockAsyncFn(async (fn) => {
      if (typeof fn === 'function') return fn(prisma);
      return fn;
    }),
  };
  const service = makeBillingService(prisma);

  const sub = await service.cancelSubscription('user-no-sub');

  assert.equal(updateManyFn.calls.length, 1);
  assert.equal(sub, null);
});

test('getPlanLimits returns correct limits for each plan', () => {
  const service = makeBillingService();

  const free = service.getPlanLimits('FREE');
  assert.equal(free.maxBots, 1);
  assert.equal(free.canBacktest, false);

  const pro = service.getPlanLimits('PRO');
  assert.equal(pro.maxBots, 5);
  assert.equal(pro.canBacktest, true);

  const premium = service.getPlanLimits('PREMIUM');
  assert.equal(premium.maxBots, -1);
  assert.equal(premium.canPublish, true);
});

test('canCreateBot denies when at FREE bot limit', async () => {
  const prisma = {
    subscription: {
      findUnique: mockAsyncFn(async () => ({ plan: 'FREE', status: 'ACTIVE' })),
    },
    bot: { count: mockAsyncFn(async () => 1) },
  };
  const service = makeBillingService(prisma);

  const result = await service.canCreateBot('user-1');

  assert.equal(result.allowed, false);
  assert.match(result.reason, /limit reached/);
});

test('canRunBot denies when at PRO running bot limit', async () => {
  const prisma = {
    subscription: {
      findUnique: mockAsyncFn(async () => ({ plan: 'PRO', status: 'ACTIVE' })),
    },
    bot: { count: mockAsyncFn(async () => 3) },
  };
  const service = makeBillingService(prisma);

  const result = await service.canRunBot('user-1');

  assert.equal(result.allowed, false);
  assert.match(result.reason, /Running bot limit/);
});
