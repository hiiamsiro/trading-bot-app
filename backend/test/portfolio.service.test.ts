import { test, describe, it, beforeEach, afterEach, before, after, mock } from 'node:test';
import * as assert from 'node:assert';
const { NotFoundException, BadRequestException } = require('@nestjs/common');

const { mockAsyncFn } = require('./helpers.ts');
const { PortfolioService } = require('../src/portfolio/portfolio.service.ts');

function makeService(overrides?: any) {
  const prisma = {
    portfolio: {
      findMany: mockAsyncFn((args) => overrides?.prisma?.portfolio?.findMany?.(args) ?? []),
      findFirst: mockAsyncFn((args) => overrides?.prisma?.portfolio?.findFirst?.(args) ?? null),
      create: mockAsyncFn(
        (args) => overrides?.prisma?.portfolio?.create?.(args) ?? { id: 'p1', ...args?.data },
      ),
      update: mockAsyncFn(
        (args) => overrides?.prisma?.portfolio?.update?.(args) ?? { id: args?.[0]?.where?.id },
      ),
      delete: mockAsyncFn(
        (args) => overrides?.prisma?.portfolio?.delete?.(args) ?? { id: args?.[0]?.where?.id },
      ),
    },
    bot: {
      count: mockAsyncFn((args) => overrides?.prisma?.bot?.count?.(args) ?? 0),
      updateMany: mockAsyncFn((args) => overrides?.prisma?.bot?.updateMany?.(args) ?? { count: 0 }),
    },
  };
  const svc: any = new PortfolioService(prisma);
  svc._prisma = prisma;
  return svc;
}

async function assertRejects(
  promise: Promise<any>,
  check: (err: any) => boolean,
  message = 'Expected to reject',
) {
  try {
    await promise;
    assert.fail(message);
  } catch (err) {
    assert.ok(check(err), `${message}: got ${(err as Error).message}`);
  }
}

// ─────────────────────────────────────────────────────────
// findAll
// ─────────────────────────────────────────────────────────

test('findAll returns portfolios for the user', async () => {
  const svc = makeService();
  await svc.findAll('user-1');
  const call = svc._prisma.portfolio.findMany.calls[0];
  assert.deepEqual(call[0].where, { userId: 'user-1' });
});

test('findAll includes bots with executionSession', async () => {
  const svc = makeService();
  await svc.findAll('user-1');
  const call = svc._prisma.portfolio.findMany.calls[0];
  assert.deepEqual(call[0].include, { bots: { include: { executionSession: true } } });
});

test('findAll orders by createdAt desc', async () => {
  const svc = makeService();
  await svc.findAll('user-1');
  const call = svc._prisma.portfolio.findMany.calls[0];
  assert.deepEqual(call[0].orderBy, { createdAt: 'desc' });
});

// ─────────────────────────────────────────────────────────
// findOne
// ─────────────────────────────────────────────────────────

test('findOne returns portfolio with bots, trades, and session', async () => {
  const svc = makeService({
    prisma: {
      portfolio: { findFirst: async () => ({ id: 'p1', name: 'My Portfolio', bots: [] }) },
    },
  });
  await svc.findOne('p1', 'user-1');
  const call = svc._prisma.portfolio.findFirst.calls[0];
  assert.equal(call[0].include.bots.include.trades.take, 20);
  assert.equal(call[0].include.bots.include.executionSession, true);
});

test('findOne throws NotFoundException when portfolio does not exist', async () => {
  const svc = makeService({ prisma: { portfolio: { findFirst: async () => null } } });
  await assertRejects(
    svc.findOne('nonexistent', 'user-1'),
    (err) => err instanceof NotFoundException,
  );
});

// ─────────────────────────────────────────────────────────
// create
// ─────────────────────────────────────────────────────────

test('create creates portfolio without bots', async () => {
  const svc = makeService();
  await svc.create('user-1', { name: 'My Portfolio' });
  const call = svc._prisma.portfolio.create.calls[0];
  assert.equal(call[0].data.name, 'My Portfolio');
  assert.equal(call[0].data.userId, 'user-1');
});

test('create with botIds verifies ownership before creating', async () => {
  const svc = makeService({ prisma: { bot: { count: async () => 2 } } });
  await svc.create('user-1', { name: 'P', botIds: ['b1', 'b2'] });
  const call = svc._prisma.bot.count.calls[0];
  assert.deepEqual(call[0].where, { id: { in: ['b1', 'b2'] }, userId: 'user-1' });
});

test('create throws BadRequestException when a botId is not owned by user', async () => {
  const svc = makeService({ prisma: { bot: { count: async () => 1 } } });
  await assertRejects(
    svc.create('user-1', { name: 'P', botIds: ['b1', 'b2'] }),
    (err) =>
      err instanceof BadRequestException &&
      err.message.includes('One or more bots not found or not owned by user'),
  );
});

test('create connects bots when botIds provided and ownership verified', async () => {
  const svc = makeService({ prisma: { bot: { count: async () => 2 } } });
  await svc.create('user-1', { name: 'My Portfolio', botIds: ['b1', 'b2'] });
  const call = svc._prisma.portfolio.create.calls[0];
  assert.deepEqual(call[0].data.bots.connect, [{ id: 'b1' }, { id: 'b2' }]);
});

test('create does not set bots field when no botIds', async () => {
  const svc = makeService();
  await svc.create('user-1', { name: 'Empty Portfolio' });
  const call = svc._prisma.portfolio.create.calls[0];
  assert.equal(call[0].data.bots, undefined);
});

// ─────────────────────────────────────────────────────────
// update
// ─────────────────────────────────────────────────────────

test('update throws NotFoundException when portfolio not found', async () => {
  const svc = makeService({ prisma: { portfolio: { findFirst: async () => null } } });
  await assertRejects(
    svc.update('p1', 'user-1', { name: 'New Name' }),
    (err) => err instanceof NotFoundException,
  );
});

test('update renames portfolio', async () => {
  const svc = makeService({ prisma: { portfolio: { findFirst: async () => ({ id: 'p1' }) } } });
  await svc.update('p1', 'user-1', { name: 'New Name' });
  const call = svc._prisma.portfolio.update.calls[0];
  assert.equal(call[0].data.name, 'New Name');
});

test('update replaces bots when botIds provided and ownership verified', async () => {
  const svc = makeService({
    prisma: { portfolio: { findFirst: async () => ({ id: 'p1' }) }, bot: { count: async () => 2 } },
  });
  await svc.update('p1', 'user-1', { botIds: ['b3', 'b4'] });
  const call = svc._prisma.portfolio.update.calls[0];
  assert.deepEqual(call[0].data.bots.set, [{ id: 'b3' }, { id: 'b4' }]);
});

test('update does not change bots field when botIds is undefined', async () => {
  const svc = makeService({ prisma: { portfolio: { findFirst: async () => ({ id: 'p1' }) } } });
  await svc.update('p1', 'user-1', { name: 'Only Name' });
  const call = svc._prisma.portfolio.update.calls[0];
  assert.equal(call[0].data.bots, undefined);
});

// ─────────────────────────────────────────────────────────
// remove
// ─────────────────────────────────────────────────────────

test('remove throws NotFoundException when portfolio not found', async () => {
  const svc = makeService({ prisma: { portfolio: { findFirst: async () => null } } });
  await assertRejects(svc.remove('p1', 'user-1'), (err) => err instanceof NotFoundException);
});

test('remove unlinks bots from portfolio before deleting', async () => {
  const svc = makeService({ prisma: { portfolio: { findFirst: async () => ({ id: 'p1' }) } } });
  await svc.remove('p1', 'user-1');
  const call = svc._prisma.bot.updateMany.calls[0];
  assert.deepEqual(call[0].where, { portfolioId: 'p1' });
  assert.deepEqual(call[0].data, { portfolioId: null });
});

test('remove deletes portfolio after unlinking bots', async () => {
  const svc = makeService();
  await svc.remove('p1', 'user-1');
  const call = svc._prisma.portfolio.delete.calls[0];
  assert.deepEqual(call[0].where, { id: 'p1' });
});

// ─────────────────────────────────────────────────────────
// getMetrics
// ─────────────────────────────────────────────────────────

test('getMetrics throws NotFoundException when portfolio not found', async () => {
  const svc = makeService({ prisma: { portfolio: { findFirst: async () => null } } });
  await assertRejects(svc.getMetrics('p1', 'user-1'), (err) => err instanceof NotFoundException);
});

test('getMetrics calculates winRate correctly', async () => {
  const svc = makeService({
    prisma: {
      portfolio: {
        findFirst: async () => ({
          id: 'p1',
          bots: [
            {
              status: 'RUNNING',
              executionSession: { initialBalance: 1000, currentBalance: 1100 },
              trades: [
                { netPnl: 50, createdAt: new Date('2024-01-01') },
                { netPnl: -20, createdAt: new Date('2024-01-02') },
                { netPnl: 30, createdAt: new Date('2024-01-03') },
              ],
            },
          ],
        }),
      },
    },
  });
  const result = await svc.getMetrics('p1', 'user-1');
  assert.equal(result.winRate, 2 / 3);
  assert.equal(result.totalPnl, 60);
  assert.equal(result.closedTrades, 3);
});

test('getMetrics calculates avgWin and avgLoss correctly', async () => {
  const svc = makeService({
    prisma: {
      portfolio: {
        findFirst: async () => ({
          id: 'p1',
          bots: [
            {
              status: 'RUNNING',
              executionSession: { initialBalance: 1000, currentBalance: 1100 },
              trades: [
                { netPnl: 50, createdAt: new Date('2024-01-01') },
                { netPnl: -20, createdAt: new Date('2024-01-02') },
              ],
            },
          ],
        }),
      },
    },
  });
  const result = await svc.getMetrics('p1', 'user-1');
  assert.equal(result.avgWin, 50);
  assert.equal(result.avgLoss, -20);
});

test('getMetrics returns null winRate when no closed trades', async () => {
  const svc = makeService({
    prisma: {
      portfolio: {
        findFirst: async () => ({
          id: 'p1',
          bots: [
            {
              status: 'RUNNING',
              executionSession: { initialBalance: 1000, currentBalance: 1000 },
              trades: [],
            },
          ],
        }),
      },
    },
  });
  const result = await svc.getMetrics('p1', 'user-1');
  assert.equal(result.winRate, null);
  assert.equal(result.avgWin, null);
  assert.equal(result.avgLoss, null);
});

test('getMetrics computes maxDrawdown from trade history', async () => {
  const svc = makeService({
    prisma: {
      portfolio: {
        findFirst: async () => ({
          id: 'p1',
          bots: [
            {
              status: 'RUNNING',
              executionSession: { initialBalance: 1000, currentBalance: 900 },
              trades: [
                { netPnl: 200, createdAt: new Date('2024-01-01') },
                { netPnl: -400, createdAt: new Date('2024-01-02') },
              ],
            },
          ],
        }),
      },
    },
  });
  const result = await svc.getMetrics('p1', 'user-1');
  assert.ok(result.drawdown > 0);
  assert.ok(result.drawdown <= 1);
});

test('getMetrics computes totalInitialBalance and totalCurrentBalance', async () => {
  const svc = makeService({
    prisma: {
      portfolio: {
        findFirst: async () => ({
          id: 'p1',
          bots: [
            {
              status: 'RUNNING',
              executionSession: { initialBalance: 1000, currentBalance: 1100 },
              trades: [],
            },
            {
              status: 'STOPPED',
              executionSession: { initialBalance: 2000, currentBalance: 1800 },
              trades: [],
            },
          ],
        }),
      },
    },
  });
  const result = await svc.getMetrics('p1', 'user-1');
  assert.equal(result.totalInitialBalance, 3000);
  assert.equal(result.totalCurrentBalance, 2900);
  assert.equal(result.totalBots, 2);
  assert.equal(result.runningBots, 1);
});

test('getMetrics handles missing executionSession gracefully', async () => {
  const svc = makeService({
    prisma: {
      portfolio: {
        findFirst: async () => ({
          id: 'p1',
          bots: [{ status: 'RUNNING', executionSession: null, trades: [] }],
        }),
      },
    },
  });
  const result = await svc.getMetrics('p1', 'user-1');
  assert.equal(result.totalInitialBalance, 0);
  assert.equal(result.totalCurrentBalance, 0);
});

test('getMetrics counts runningBots correctly', async () => {
  const svc = makeService({
    prisma: {
      portfolio: {
        findFirst: async () => ({
          id: 'p1',
          bots: [
            { status: 'RUNNING', executionSession: null, trades: [] },
            { status: 'RUNNING', executionSession: null, trades: [] },
            { status: 'STOPPED', executionSession: null, trades: [] },
            { status: 'ERROR', executionSession: null, trades: [] },
          ],
        }),
      },
    },
  });
  const result = await svc.getMetrics('p1', 'user-1');
  assert.equal(result.runningBots, 2);
  assert.equal(result.totalBots, 4);
});

export {};
