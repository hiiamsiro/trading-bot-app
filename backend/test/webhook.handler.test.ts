import { test, describe, it, beforeEach, afterEach, before, after, mock } from 'node:test';
import * as assert from 'node:assert';
const { WebhookHandler } = require('../src/billing/webhook.handler.ts');

const { mockAsyncFn, mockFn } = require('./helpers.ts');

function makeWebhookHandler(prismaMock?: any, stripeServiceMock?: any, configMock?: any) {
  const prisma = prismaMock ?? {
    subscription: {
      upsert: mockAsyncFn(async ({ create }) => ({
        id: 'sub-1',
        userId: create.userId,
        plan: create.plan,
        status: create.status,
        currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      })),
      updateMany: mockAsyncFn(async () => ({ count: 1 })),
    },
  };

  const stripeService = stripeServiceMock ?? {
    retrieveSubscription: mockAsyncFn(async () => ({
      items: { data: [{ price: { id: 'price_pro' } }] },
      current_period_end: Math.floor(Date.now() / 1000) + 30 * 24 * 60 * 60,
    })),
  };

  const config = configMock ?? {
    get: mockFn(() => undefined),
  };

  return new WebhookHandler(prisma, stripeService, config);
}

test('handleCheckoutCompleted activates subscription with correct plan', async () => {
  const upsertFn = mockAsyncFn(async ({ create }) => ({
    id: 'sub-1',
    userId: create.userId,
    plan: create.plan,
    status: create.status,
    currentPeriodEnd: new Date(),
  }));
  const retrieveSubFn = mockAsyncFn(async () => ({
    items: { data: [{ price: { id: 'price_pro' } }] },
  }));
  const prisma = { subscription: { upsert: upsertFn } };
  const stripeService = { retrieveSubscription: retrieveSubFn };
  const handler = makeWebhookHandler(prisma, stripeService);

  const event = {
    type: 'checkout.session.completed',
    data: {
      object: {
        id: 'cs_123',
        metadata: { userId: 'user-1', plan: 'PRO' },
        subscription: 'sub_stripe_123',
      },
    },
  };

  await handler.handleEvent(event);

  assert.equal(upsertFn.calls.length, 1);
  assert.equal(upsertFn.calls[0][0].where.userId, 'user-1');
  assert.equal(upsertFn.calls[0][0].create.plan, 'PRO');
  assert.equal(upsertFn.calls[0][0].create.stripeSubscriptionId, 'sub_stripe_123');
  assert.equal(upsertFn.calls[0][0].create.status, 'ACTIVE');
});

test('handleCheckoutCompleted early-returns when userId is missing', async () => {
  const upsertFn = mockAsyncFn(async () => ({ id: 'sub-1' }));
  const prisma = { subscription: { upsert: upsertFn } };
  const handler = makeWebhookHandler(prisma);

  const event = {
    type: 'checkout.session.completed',
    data: { object: { id: 'cs_123', metadata: {}, subscription: 'sub_1' } },
  };

  await handler.handleEvent(event);

  assert.equal(upsertFn.calls.length, 0);
});

test('handleCheckoutCompleted early-returns when plan is missing', async () => {
  const upsertFn = mockAsyncFn(async () => ({ id: 'sub-1' }));
  const prisma = { subscription: { upsert: upsertFn } };
  const handler = makeWebhookHandler(prisma);

  const event = {
    type: 'checkout.session.completed',
    data: { object: { id: 'cs_123', metadata: { userId: 'user-1' }, subscription: 'sub_1' } },
  };

  await handler.handleEvent(event);

  assert.equal(upsertFn.calls.length, 0);
});

test('handleCheckoutCompleted early-returns when subscription is missing', async () => {
  const upsertFn = mockAsyncFn(async () => ({ id: 'sub-1' }));
  const prisma = { subscription: { upsert: upsertFn } };
  const handler = makeWebhookHandler(prisma);

  const event = {
    type: 'checkout.session.completed',
    data: { object: { id: 'cs_123', metadata: { userId: 'user-1', plan: 'PRO' } } },
  };

  await handler.handleEvent(event);

  assert.equal(upsertFn.calls.length, 0);
});

test('handleSubscriptionUpdated updates plan and status', async () => {
  const updateManyFn = mockAsyncFn(async () => ({ count: 1 }));
  const prisma = { subscription: { updateMany: updateManyFn } };
  const handler = makeWebhookHandler(prisma);

  const event = {
    type: 'customer.subscription.updated',
    data: {
      object: {
        id: 'sub_stripe_123',
        status: 'active',
        metadata: { userId: 'user-1', plan: 'PREMIUM' },
        items: { data: [{ price: { id: 'price_premium' } }] },
      },
    },
  };

  await handler.handleEvent(event);

  assert.equal(updateManyFn.calls.length, 1);
  assert.deepEqual(updateManyFn.calls[0][0].where, { stripeSubscriptionId: 'sub_stripe_123' });
  assert.equal(updateManyFn.calls[0][0].data.plan, 'PREMIUM');
  assert.equal(updateManyFn.calls[0][0].data.status, 'ACTIVE');
});

test('handleSubscriptionUpdated uses metadata.plan when provided', async () => {
  const updateManyFn = mockAsyncFn(async () => ({ count: 1 }));
  const prisma = { subscription: { updateMany: updateManyFn } };
  const handler = makeWebhookHandler(prisma);

  const event = {
    type: 'customer.subscription.updated',
    data: {
      object: {
        id: 'sub_stripe_123',
        status: 'active',
        metadata: { userId: 'user-1', plan: 'PREMIUM' },
        items: { data: [{ price: { id: 'price_premium' } }] },
      },
    },
  };

  await handler.handleEvent(event);

  assert.equal(updateManyFn.calls.length, 1);
  // metadata.plan takes precedence over price inference
  assert.equal(updateManyFn.calls[0][0].data.plan, 'PREMIUM');
});

test('handleSubscriptionUpdated logs warning when no DB record found', async () => {
  const updateManyFn = mockAsyncFn(async () => ({ count: 0 }));
  const prisma = { subscription: { updateMany: updateManyFn } };
  const handler = makeWebhookHandler(prisma);

  const event = {
    type: 'customer.subscription.updated',
    data: {
      object: {
        id: 'sub_unknown',
        status: 'active',
        metadata: { userId: 'user-1', plan: 'PRO' },
        items: { data: [{ price: { id: 'price_pro' } }] },
      },
    },
  };

  // Should not throw — just logs a warning
  await handler.handleEvent(event);
  assert.equal(updateManyFn.calls.length, 1);
});

test('handleSubscriptionUpdated early-returns when userId is missing', async () => {
  const updateManyFn = mockAsyncFn(async () => ({ count: 1 }));
  const prisma = { subscription: { updateMany: updateManyFn } };
  const handler = makeWebhookHandler(prisma);

  const event = {
    type: 'customer.subscription.updated',
    data: { object: { id: 'sub_1', status: 'active', metadata: {} } },
  };

  await handler.handleEvent(event);

  assert.equal(updateManyFn.calls.length, 0);
});

test('handleSubscriptionUpdated maps past_due to PAST_DUE status', async () => {
  const updateManyFn = mockAsyncFn(async () => ({ count: 1 }));
  const prisma = { subscription: { updateMany: updateManyFn } };
  const handler = makeWebhookHandler(prisma);

  const event = {
    type: 'customer.subscription.updated',
    data: {
      object: {
        id: 'sub_stripe_123',
        status: 'past_due',
        metadata: { userId: 'user-1', plan: 'PRO' },
        items: { data: [{ price: { id: 'price_pro' } }] },
      },
    },
  };

  await handler.handleEvent(event);

  assert.equal(updateManyFn.calls[0][0].data.status, 'PAST_DUE');
});

test('handleSubscriptionDeleted sets status to CANCELLED', async () => {
  const updateManyFn = mockAsyncFn(async () => ({ count: 1 }));
  const prisma = { subscription: { updateMany: updateManyFn } };
  const handler = makeWebhookHandler(prisma);

  const event = {
    type: 'customer.subscription.deleted',
    data: { object: { id: 'sub_stripe_123', metadata: {} } },
  };

  await handler.handleEvent(event);

  assert.equal(updateManyFn.calls.length, 1);
  assert.deepEqual(updateManyFn.calls[0][0].data, { status: 'CANCELLED' });
});

test('handleSubscriptionDeleted logs warning when no DB record found', async () => {
  const updateManyFn = mockAsyncFn(async () => ({ count: 0 }));
  const prisma = { subscription: { updateMany: updateManyFn } };
  const handler = makeWebhookHandler(prisma);

  const event = {
    type: 'customer.subscription.deleted',
    data: { object: { id: 'sub_unknown', metadata: {} } },
  };

  // Should not throw
  await handler.handleEvent(event);
  assert.equal(updateManyFn.calls.length, 1);
});

test('handlePaymentFailed sets PAST_DUE status', async () => {
  const updateManyFn = mockAsyncFn(async () => ({ count: 1 }));
  const prisma = { subscription: { updateMany: updateManyFn } };
  const handler = makeWebhookHandler(prisma);

  // invoice with subscription as string (most common)
  const event = {
    type: 'invoice.payment_failed',
    data: { object: { id: 'in_123', subscription: 'sub_stripe_123' } },
  };

  await handler.handleEvent(event);

  assert.equal(updateManyFn.calls.length, 1);
  assert.deepEqual(updateManyFn.calls[0][0].data, { status: 'PAST_DUE' });
});

test('handlePaymentFailed early-returns when subscription is absent', async () => {
  const updateManyFn = mockAsyncFn(async () => ({ count: 1 }));
  const prisma = { subscription: { updateMany: updateManyFn } };
  const handler = makeWebhookHandler(prisma);

  const event = {
    type: 'invoice.payment_failed',
    data: { object: { id: 'in_123' } },
  };

  await handler.handleEvent(event);

  assert.equal(updateManyFn.calls.length, 0);
});

test('handleEvent ignores unhandled event types', async () => {
  const updateManyFn = mockAsyncFn(async () => ({ count: 1 }));
  const upsertFn = mockAsyncFn(async () => ({ id: 'sub-1' }));
  const prisma = {
    subscription: { updateMany: updateManyFn, upsert: upsertFn },
  };
  const handler = makeWebhookHandler(prisma);

  const event = { type: 'customer.subscription.created', data: { object: {} } };

  await handler.handleEvent(event);

  assert.equal(updateManyFn.calls.length, 0);
  assert.equal(upsertFn.calls.length, 0);
});

test('mapSubscriptionStatus: active → ACTIVE', async () => {
  const handler = makeWebhookHandler();
  // Access private method via prototype (testing boundary via public behavior)
  const updateManyFn = mockAsyncFn(async () => ({ count: 1 }));
  const prisma = { subscription: { updateMany: updateManyFn } };
  const h = makeWebhookHandler(prisma);

  await h.handleEvent({
    type: 'customer.subscription.updated',
    data: {
      object: {
        id: 'sub_1',
        status: 'active',
        metadata: { userId: 'user-1', plan: 'PRO' },
        items: { data: [{ price: { id: 'price_pro' } }] },
      },
    },
  });

  assert.equal(updateManyFn.calls[0][0].data.status, 'ACTIVE');
});

test('mapSubscriptionStatus: trialing → ACTIVE', async () => {
  const updateManyFn = mockAsyncFn(async () => ({ count: 1 }));
  const prisma = { subscription: { updateMany: updateManyFn } };
  const h = makeWebhookHandler(prisma);

  await h.handleEvent({
    type: 'customer.subscription.updated',
    data: {
      object: {
        id: 'sub_1',
        status: 'trialing',
        metadata: { userId: 'user-1', plan: 'PRO' },
        items: { data: [{ price: { id: 'price_pro' } }] },
      },
    },
  });

  assert.equal(updateManyFn.calls[0][0].data.status, 'ACTIVE');
});

test('mapSubscriptionStatus: past_due → PAST_DUE', async () => {
  const updateManyFn = mockAsyncFn(async () => ({ count: 1 }));
  const prisma = { subscription: { updateMany: updateManyFn } };
  const h = makeWebhookHandler(prisma);

  await h.handleEvent({
    type: 'customer.subscription.updated',
    data: {
      object: {
        id: 'sub_1',
        status: 'past_due',
        metadata: { userId: 'user-1', plan: 'PRO' },
        items: { data: [{ price: { id: 'price_pro' } }] },
      },
    },
  });

  assert.equal(updateManyFn.calls[0][0].data.status, 'PAST_DUE');
});

test('mapSubscriptionStatus: canceled → CANCELLED', async () => {
  const updateManyFn = mockAsyncFn(async () => ({ count: 1 }));
  const prisma = { subscription: { updateMany: updateManyFn } };
  const h = makeWebhookHandler(prisma);

  await h.handleEvent({
    type: 'customer.subscription.updated',
    data: {
      object: {
        id: 'sub_1',
        status: 'canceled',
        metadata: { userId: 'user-1', plan: 'PRO' },
        items: { data: [{ price: { id: 'price_pro' } }] },
      },
    },
  });

  assert.equal(updateManyFn.calls[0][0].data.status, 'CANCELLED');
});
