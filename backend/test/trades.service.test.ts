import { test, describe, it, beforeEach, afterEach, before, after, mock } from 'node:test';
import * as assert from 'node:assert';
const { NotFoundException } = require('@nestjs/common');

const { TradesService } = require('../src/trades/trades.service.ts');

const { mockAsyncFn } = require('./helpers.ts');

test('TradesService.findAll applies YYYY-MM-DD from/to boundaries as UTC day range', async () => {
  const prisma = {
    trade: {
      count: mockAsyncFn(async () => 0),
      findMany: mockAsyncFn(async () => []),
    },
    $transaction: mockAsyncFn(async (promises) => Promise.all(promises)),
  };

  const service = new TradesService(prisma);

  await service.findAll('user-1', {
    take: 50,
    skip: 0,
    from: '2026-03-01',
    to: '2026-03-02',
  });

  assert.equal(prisma.trade.count.calls.length, 1);
  const where = prisma.trade.count.calls[0][0].where;
  assert.equal(where.bot.userId, 'user-1');
  assert.ok(where.createdAt.gte instanceof Date);
  assert.ok(where.createdAt.lte instanceof Date);
  assert.equal(where.createdAt.gte.toISOString(), '2026-03-01T00:00:00.000Z');
  assert.equal(where.createdAt.lte.toISOString(), '2026-03-02T23:59:59.999Z');
});

test('TradesService.findOne throws NotFoundException for trade not owned by user', async () => {
  const prisma = {
    trade: {
      findFirst: mockAsyncFn(async () => null),
    },
  };

  const service = new TradesService(prisma);

  await assert.rejects(
    () => service.findOne('trade-1', 'user-1'),
    (err: unknown) => {
      assert.ok(err instanceof NotFoundException);
      assert.equal((err as Error).message, 'Trade not found');
      return true;
    },
  );
});

export {};
