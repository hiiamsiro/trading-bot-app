import { test, describe, it, beforeEach, afterEach, before, after, mock } from 'node:test';
import * as assert from 'node:assert';
const { NotFoundException } = require('@nestjs/common');

const { mockAsyncFn } = require('./helpers.ts');
const { NotificationsService } = require('../src/notifications/notifications.service.ts');

function makeService(overrides?: any) {
  const countFn = overrides?.prisma?.notification?.count ?? (async () => 0);
  const findManyFn = overrides?.prisma?.notification?.findMany ?? (async () => []);

  const prisma = {
    $transaction: mockAsyncFn((fn: any) => {
      // Prisma $transaction(array) spreads the array as individual args
      return fn(countFn, countFn, findManyFn);
    }),
    notification: {
      create: mockAsyncFn(
        (args) => overrides?.prisma?.notification?.create?.(args) ?? { id: 'n1', ...args?.data },
      ),
      findMany: findManyFn,
      findFirst: overrides?.prisma?.notification?.findFirst ?? (async () => null),
      update: mockAsyncFn(
        (args) => overrides?.prisma?.notification?.update?.(args) ?? { id: args?.where?.id },
      ),
      updateMany: mockAsyncFn(
        (args) => overrides?.prisma?.notification?.updateMany?.(args) ?? { count: 0 },
      ),
      count: countFn,
    },
  };
  const svc: any = new NotificationsService(prisma);
  svc._prisma = prisma;
  return svc;
}

// ─────────────────────────────────────────────────────────
// create
// ─────────────────────────────────────────────────────────

test('create calls prisma.notification.create with correct fields', async () => {
  const svc = makeService();
  await svc.create({
    userId: 'u1',
    botId: 'b1',
    type: 'BOT_STARTED',
    title: 'Started',
    message: 'Bot started',
  });
  const call = svc._prisma.notification.create.calls[0];
  assert.equal(call[0].data.userId, 'u1');
  assert.equal(call[0].data.botId, 'b1');
  assert.equal(call[0].data.type, 'BOT_STARTED');
});

test('create passes metadata as undefined when not provided', async () => {
  const svc = makeService({
    prisma: {
      notification: {
        create: async (args: any) => {
          assert.equal(args.data.metadata, undefined);
          return { id: 'n1' };
        },
      },
    },
  });
  await svc.create({ userId: 'u1', type: 'BOT_STARTED', title: 'x', message: 'y' });
});

test('create passes defined metadata as InputJsonValue', async () => {
  const svc = makeService({
    prisma: {
      notification: {
        create: async (args: any) => {
          assert.deepEqual(args.data.metadata, { botId: 'b1', pnl: 10 });
          return { id: 'n1' };
        },
      },
    },
  });
  await svc.create({
    userId: 'u1',
    type: 'TRADE_CLOSED',
    title: 'Trade',
    message: 'Closed',
    metadata: { botId: 'b1', pnl: 10 },
  });
});

// ─────────────────────────────────────────────────────────
// findAll
// ─────────────────────────────────────────────────────────

test('findAll returns paginated result with all required fields', async () => {
  const svc = makeService();
  const result = await svc.findAll('u1', { take: 10, skip: 0 });
  assert.ok('items' in result);
  assert.ok('total' in result);
  assert.ok('unreadCount' in result);
  assert.ok('take' in result);
  assert.ok('skip' in result);
});

test('findAll applies take and skip from query', async () => {
  const svc = makeService();
  await svc.findAll('u1', { take: 5, skip: 20 });
  const call = svc._prisma.notification.findMany.calls[0];
  assert.equal(call[0].take, 5);
  assert.equal(call[0].skip, 20);
});

test('findAll filters by userId', async () => {
  const svc = makeService();
  await svc.findAll('user-123', {});
  const call = svc._prisma.notification.findMany.calls[0];
  assert.deepEqual(call[0].where.userId, 'user-123');
});

test('findAll filters by isRead when provided', async () => {
  const svc = makeService();
  await svc.findAll('u1', { isRead: true });
  const call = svc._prisma.notification.findMany.calls[0];
  assert.equal(call[0].where.isRead, true);
});

test('findAll returns all items when isRead is undefined', async () => {
  const svc = makeService();
  await svc.findAll('u1', {});
  const call = svc._prisma.notification.findMany.calls[0];
  assert.ok(!('isRead' in call[0].where));
});

test('findAll orders by createdAt desc, id desc', async () => {
  const svc = makeService();
  await svc.findAll('u1', {});
  const call = svc._prisma.notification.findMany.calls[0];
  assert.deepEqual(call[0].orderBy, [{ createdAt: 'desc' }, { id: 'desc' }]);
});

test('findAll counts total and unread correctly', async () => {
  const svc = makeService({
    prisma: {
      notification: {
        count: async (args: any) => (args?.where?.isRead !== undefined ? 5 : 12),
      },
    },
  });
  const result = await svc.findAll('u1', { take: 25, skip: 0 });
  assert.equal(result.total, 12);
  assert.equal(result.unreadCount, 5);
});

test('findAll uses defaults when take/skip not provided', async () => {
  const svc = makeService();
  await svc.findAll('u1', {});
  const call = svc._prisma.notification.findMany.calls[0];
  assert.equal(call[0].take, 25);
  assert.equal(call[0].skip, 0);
});

// ─────────────────────────────────────────────────────────
// markOneRead
// ─────────────────────────────────────────────────────────

test('markOneRead throws NotFoundException when notification does not exist', async () => {
  const svc = makeService({
    prisma: { notification: { findFirst: async () => null } },
  });
  try {
    await svc.markOneRead('u1', 'nonexistent-id');
    assert.fail('Expected NotFoundException');
  } catch (err: any) {
    assert.ok(err instanceof NotFoundException);
    assert.ok(err.message.includes('Notification not found'));
  }
});

test('markOneRead updates isRead and sets readAt', async () => {
  const svc = makeService({
    prisma: { notification: { findFirst: async () => ({ id: 'n1' }) } },
  });
  await svc.markOneRead('u1', 'n1');
  const call = svc._prisma.notification.update.calls[0];
  assert.equal(call[0].where.id, 'n1');
  assert.equal(call[0].data.isRead, true);
  assert.ok(call[0].data.readAt instanceof Date);
});

test('markOneRead can set isRead to false', async () => {
  const svc = makeService({
    prisma: { notification: { findFirst: async () => ({ id: 'n1' }) } },
  });
  await svc.markOneRead('u1', 'n1', false);
  const call = svc._prisma.notification.update.calls[0];
  assert.equal(call[0].data.isRead, false);
  assert.equal(call[0].data.readAt, null);
});

// ─────────────────────────────────────────────────────────
// markAllRead
// ─────────────────────────────────────────────────────────

test('markAllRead updates only unread notifications for the user', async () => {
  const svc = makeService();
  await svc.markAllRead('user-abc');
  const call = svc._prisma.notification.updateMany.calls[0];
  assert.deepEqual(call[0].where, { userId: 'user-abc', isRead: false });
});

test('markAllRead returns updatedCount from updateMany result', async () => {
  const svc = makeService({
    prisma: {
      notification: { updateMany: async () => ({ count: 7 }) },
    },
  });
  const result = await svc.markAllRead('u1');
  assert.equal(result.updatedCount, 7);
});

test('markAllRead returns updatedCount 0 when nothing to mark', async () => {
  const svc = makeService({
    prisma: {
      notification: { updateMany: async () => ({ count: 0 }) },
    },
  });
  const result = await svc.markAllRead('u1');
  assert.equal(result.updatedCount, 0);
});

export {};
