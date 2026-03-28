const test = require('node:test');
const assert = require('node:assert/strict');

const { mockAsyncFn } = require('./helpers.ts');
const { DashboardService } = require('../src/dashboard/dashboard.service.ts');

function makeService(overrides?: any) {
  const prisma = {
    bot: {
      groupBy: mockAsyncFn((args) => overrides?.prisma?.bot?.groupBy?.(args) ?? []),
      findMany: mockAsyncFn((args) => overrides?.prisma?.bot?.findMany?.(args) ?? []),
    },
    trade: {
      count: mockAsyncFn((args) => overrides?.prisma?.trade?.count?.(args) ?? 0),
      aggregate: mockAsyncFn((args) => overrides?.prisma?.trade?.aggregate?.(args) ?? ({ _count: { _all: 0 }, _sum: {}, _avg: {} })),
      findMany: mockAsyncFn((args) => overrides?.prisma?.trade?.findMany?.(args) ?? []),
    },
    botLog: {
      findMany: mockAsyncFn((args) => overrides?.prisma?.botLog?.findMany?.(args) ?? []),
    },
    $queryRaw: mockAsyncFn((query, ...args) => overrides?.prisma?.$queryRaw?.(query, ...args) ?? []),
  };
  const svc: any = new DashboardService(prisma);
  svc._prisma = prisma;
  return svc;
}

function makeEmptyAgg() {
  return { _count: { _all: 0 }, _sum: { realizedPnl: 0 }, _avg: { realizedPnl: null } };
}

// ─────────────────────────────────────────────────────────
// getSnapshot
// ─────────────────────────────────────────────────────────

test('getSnapshot returns all required fields', async () => {
  const svc = makeService();
  const result = await svc.getSnapshot('user-1');
  assert.ok('botSymbols' in result);
  assert.ok('metrics' in result);
  assert.ok('equityCurve' in result);
  assert.ok('recentTrades' in result);
  assert.ok('recentActivities' in result);
  assert.ok('recentErrors' in result);
});

test('getSnapshot aggregates bot status counts correctly', async () => {
  const svc = makeService({
    prisma: {
      bot: {
        groupBy: async () => [
          { status: 'RUNNING', _count: { _all: 3 } },
          { status: 'STOPPED', _count: { _all: 2 } },
          { status: 'PAUSED', _count: { _all: 1 } },
          { status: 'ERROR', _count: { _all: 4 } },
        ],
        findMany: async () => [{ symbol: 'BTCUSDT' }],
      },
      trade: {
        count: async () => 10,
        aggregate: async () => ({ _count: { _all: 8 }, _sum: { realizedPnl: 150 }, _avg: { realizedPnl: 18.75 } }),
        findMany: async () => [],
      },
      botLog: { findMany: async () => [] },
      $queryRaw: async () => [],
    },
  });
  const result = await svc.getSnapshot('user-1');
  assert.equal(result.metrics.runningBots, 3);
  assert.equal(result.metrics.stoppedBots, 3); // STOPPED + PAUSED
  assert.equal(result.metrics.errorBots, 4);
  assert.equal(result.metrics.totalBots, 10);
});

test('getSnapshot counts distinct bot symbols', async () => {
  const svc = makeService({
    prisma: {
      bot: {
        groupBy: async () => [],
        findMany: async () => [{ symbol: 'BTCUSDT' }, { symbol: 'ETHUSDT' }, { symbol: 'BTCUSDT' }],
      },
      trade: {
        count: async () => 0,
        aggregate: async () => makeEmptyAgg(),
        findMany: async () => [],
      },
      botLog: { findMany: async () => [] },
      $queryRaw: async () => [],
    },
  });
  const result = await svc.getSnapshot('user-1');
  assert.deepEqual(result.botSymbols, ['BTCUSDT', 'ETHUSDT']);
});

test('getSnapshot calculates winRate correctly', async () => {
  const svc = makeService({
    prisma: {
      bot: { groupBy: async () => [], findMany: async () => [] },
      trade: {
        count: async () => 20,
        aggregate: async (args: any) => {
          if (args?.where?.realizedPnl?.gt !== undefined) return { _count: { _all: 7 }, _avg: { realizedPnl: 10 } };
          if (args?.where?.realizedPnl?.lt !== undefined) return { _count: { _all: 5 }, _avg: { realizedPnl: -5 } };
          return { _count: { _all: 12 }, _sum: { realizedPnl: 45 }, _avg: { realizedPnl: 3.75 } };
        },
        findMany: async () => [],
      },
      botLog: { findMany: async () => [] },
      $queryRaw: async () => [],
    },
  });
  const result = await svc.getSnapshot('user-1');
  assert.equal(result.metrics.closedTradesWithPnl, 12);
  assert.equal(result.metrics.winRate, (7 / 12) * 100);
  assert.equal(result.metrics.totalPnl, 45);
  assert.equal(result.metrics.averageWin, 10);
  assert.equal(result.metrics.averageLoss, -5);
});

test('getSnapshot returns null winRate when no closed trades with pnl', async () => {
  const svc = makeService({
    prisma: {
      bot: { groupBy: async () => [], findMany: async () => [] },
      trade: {
        count: async () => 0,
        aggregate: async () => ({ _count: { _all: 0 }, _sum: { realizedPnl: null }, _avg: { realizedPnl: null } }),
        findMany: async () => [],
      },
      botLog: { findMany: async () => [] },
      $queryRaw: async () => [],
    },
  });
  const result = await svc.getSnapshot('user-1');
  assert.equal(result.metrics.winRate, null);
  assert.equal(result.metrics.averageWin, null);
  assert.equal(result.metrics.averageLoss, null);
});

test('getSnapshot maps recentTrades with bot info', async () => {
  const svc = makeService({
    prisma: {
      bot: { groupBy: async () => [], findMany: async () => [] },
      trade: {
        count: async () => 0,
        aggregate: async () => makeEmptyAgg(),
        findMany: async (args: any) => {
          if (args?.where?.bot) {
            return [{ id: 't1', symbol: 'BTCUSDT', status: 'CLOSED', realizedPnl: 10, createdAt: new Date('2024-01-01'), bot: { id: 'b1', name: 'My Bot', symbol: 'BTCUSDT' } }];
          }
          return [];
        },
      },
      botLog: { findMany: async () => [] },
      $queryRaw: async () => [],
    },
  });
  const result = await svc.getSnapshot('user-1');
  assert.equal(result.recentTrades.length, 1);
  assert.equal(result.recentTrades[0].bot.name, 'My Bot');
});

test('getSnapshot maps recentActivities from botLog (non-ERROR)', async () => {
  const svc = makeService({
    prisma: {
      bot: { groupBy: async () => [], findMany: async () => [] },
      trade: {
        count: async () => 0,
        aggregate: async () => makeEmptyAgg(),
        findMany: async () => [],
      },
      botLog: {
        findMany: async (args: any) => {
          if (args?.where?.level?.not === 'ERROR') {
            return [{ id: 'l1', botId: 'b1', level: 'INFO', message: 'Bot started', createdAt: new Date('2024-01-01'), bot: { name: 'BTC Bot' } }];
          }
          return [];
        },
      },
      $queryRaw: async () => [],
    },
  });
  const result = await svc.getSnapshot('user-1');
  assert.equal(result.recentActivities.length, 1);
  assert.equal(result.recentActivities[0].botName, 'BTC Bot');
  assert.equal(result.recentActivities[0].message, 'Bot started');
});

test('getSnapshot maps recentErrors from botLog (ERROR level)', async () => {
  const svc = makeService({
    prisma: {
      bot: { groupBy: async () => [], findMany: async () => [] },
      trade: {
        count: async () => 0,
        aggregate: async () => makeEmptyAgg(),
        findMany: async () => [],
      },
      botLog: {
        findMany: async (args: any) => {
          if (args?.where?.level === 'ERROR') {
            return [{ id: 'e1', botId: 'b2', level: 'ERROR', message: 'Connection failed', createdAt: new Date('2024-01-01'), bot: { name: 'ETH Bot' } }];
          }
          return [];
        },
      },
      $queryRaw: async () => [],
    },
  });
  const result = await svc.getSnapshot('user-1');
  assert.equal(result.recentErrors.length, 1);
  assert.equal(result.recentErrors[0].botName, 'ETH Bot');
  assert.equal(result.recentErrors[0].message, 'Connection failed');
});

test('getSnapshot handles equityPnlByDay raw SQL results safely', async () => {
  const svc = makeService({
    prisma: {
      bot: { groupBy: async () => [], findMany: async () => [] },
      trade: {
        count: async () => 0,
        aggregate: async () => makeEmptyAgg(),
        findMany: async () => [],
      },
      botLog: { findMany: async () => [] },
      $queryRaw: async () => [
        { day: new Date('2024-01-01'), pnl: 10.5 },
        { day: new Date('2024-01-02'), pnl: null },
        { day: '2024-01-03', pnl: 20 },
      ],
    },
  });
  const result = await svc.getSnapshot('user-1');
  assert.equal(result.equityCurve.length, 3);
  assert.equal(result.equityCurve[0].cumulativePnl, 10.5);
  assert.equal(result.equityCurve[1].cumulativePnl, 10.5); // null → 0
  assert.equal(result.equityCurve[2].cumulativePnl, 30.5);
});

export {};
