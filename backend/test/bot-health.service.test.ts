const test = require('node:test');
const assert = require('node:assert/strict');

const { BotHealthService } = require('../src/health/bot-health.service.ts');
const { mockAsyncFn } = require('./helpers.ts');

// Freeze time at a known point so stale comparisons are deterministic
const NOW_MS = new Date('2026-03-29T12:00:00Z').getTime();
const STUCK_MS = 10 * 60 * 1000; // 10 minutes – the default threshold
const DATA_MS = 10 * 60 * 1000;

function mins(m: number): Date {
  return new Date(NOW_MS - m * 60 * 1000);
}

function makeService(overrides: Record<string, any> = {}) {
  const prisma = overrides.prisma ?? {
    bot: {
      findMany: mockAsyncFn(async () => []),
    },
  };
  return new BotHealthService(prisma);
}

test('getReport returns empty report when no bots are running', async () => {
  const svc = makeService({
    prisma: {
      bot: {
        findMany: mockAsyncFn(async () => []),
      },
    },
  });
  const report = await svc.getReport('user-1');
  assert.equal(report.totalRunning, 0);
  assert.deepEqual(report.stuck, []);
  assert.deepEqual(report.noData, []);
  assert.deepEqual(report.healthy, []);
});

test('getReport marks bot as stuck when lastRunAt is older than 10 minutes', async () => {
  const bots = [
    {
      id: 'bot-1',
      name: 'BTC Bot',
      symbol: 'BTCUSDT',
      userId: 'user-1',
      lastRunAt: mins(15),   // 15 min ago → stuck
      lastSignalAt: mins(1),
    },
  ];
  const svc = makeService({
    prisma: { bot: { findMany: mockAsyncFn(async () => bots) } },
  });
  const report = await svc.getReport('user-1');
  assert.equal(report.totalRunning, 1);
  assert.equal(report.stuck.length, 1);
  assert.equal(report.stuck[0].botId, 'bot-1');
  assert.equal(report.stuck[0].issue, 'stuck');
  assert.ok(report.stuck[0].detail.includes('15m'));
});

test('getReport marks bot as no_data when lastSignalAt is older than 10 minutes', async () => {
  const bots = [
    {
      id: 'bot-2',
      name: 'ETH Bot',
      symbol: 'ETHUSDT',
      userId: 'user-1',
      lastRunAt: mins(1),     // running fine
      lastSignalAt: mins(20), // 20 min ago → no market data
    },
  ];
  const svc = makeService({
    prisma: { bot: { findMany: mockAsyncFn(async () => bots) } },
  });
  const report = await svc.getReport('user-1');
  assert.equal(report.noData.length, 1);
  assert.equal(report.noData[0].botId, 'bot-2');
  assert.equal(report.noData[0].issue, 'no_data');
  assert.ok(report.noData[0].detail.includes('20m'));
});

test('getReport marks bot as stuck when lastRunAt is null', async () => {
  const bots = [
    {
      id: 'bot-3',
      name: 'Fresh Bot',
      symbol: 'SOLUSDT',
      userId: 'user-1',
      lastRunAt: null,
      lastSignalAt: mins(1),
    },
  ];
  const svc = makeService({
    prisma: { bot: { findMany: mockAsyncFn(async () => bots) } },
  });
  const report = await svc.getReport('user-1');
  assert.equal(report.stuck.length, 1);
  assert.equal(report.stuck[0].issue, 'stuck');
  assert.ok(report.stuck[0].detail.includes('Never executed'));
});

test('getReport marks bot as no_data when lastSignalAt is null', async () => {
  const bots = [
    {
      id: 'bot-4',
      name: 'Waiting Bot',
      symbol: 'ADAUSDT',
      userId: 'user-1',
      lastRunAt: mins(1),
      lastSignalAt: null,
    },
  ];
  const svc = makeService({
    prisma: { bot: { findMany: mockAsyncFn(async () => bots) } },
  });
  const report = await svc.getReport('user-1');
  assert.equal(report.noData.length, 1);
  assert.equal(report.noData[0].issue, 'no_data');
  assert.ok(report.noData[0].detail.includes('No strategy signal received'));
});

test('getReport marks bot as healthy when both timestamps are recent', async () => {
  const bots = [
    {
      id: 'bot-5',
      name: 'Healthy Bot',
      symbol: 'BNBUSDT',
      userId: 'user-1',
      lastRunAt: mins(1),
      lastSignalAt: mins(2),
    },
  ];
  const svc = makeService({
    prisma: { bot: { findMany: mockAsyncFn(async () => bots) } },
  });
  const report = await svc.getReport('user-1');
  assert.equal(report.totalRunning, 1);
  assert.equal(report.stuck.length, 0);
  assert.equal(report.noData.length, 0);
  assert.equal(report.healthy.length, 1);
  assert.equal(report.healthy[0].botId, 'bot-5');
});

test('getReport only queries RUNNING bots', async () => {
  const findMany = mockAsyncFn(async () => []);
  const svc = makeService({
    prisma: { bot: { findMany } },
  });
  await svc.getReport('user-1');
  assert.equal(findMany.calls.length, 1);
  assert.equal(findMany.calls[0][0].where.userId, 'user-1');
  assert.equal(findMany.calls[0][0].where.status, 'RUNNING');
});

test('getReport sinceMs is correct for stuck and no_data bots', async () => {
  const twentyMinsAgo = mins(20);
  const bots = [
    {
      id: 'bot-6',
      name: 'Old Bot',
      symbol: 'DOTUSDT',
      userId: 'user-1',
      lastRunAt: twentyMinsAgo,
      lastSignalAt: mins(1),
    },
  ];
  const svc = makeService({
    prisma: { bot: { findMany: mockAsyncFn(async () => bots) } },
  });
  const report = await svc.getReport('user-1');
  // sinceMs ≈ 20 minutes in ms, ±1 second tolerance
  assert.ok(Math.abs(report.stuck[0].sinceMs - 20 * 60 * 1000) < 5000);
});

test('getReport returns distinct lists for stuck and no_data bots', async () => {
  const bots = [
    {
      id: 'bot-a',
      name: 'Stuck Bot',
      symbol: 'BTCUSDT',
      userId: 'user-1',
      lastRunAt: mins(30),
      lastSignalAt: mins(30),
    },
    {
      id: 'bot-b',
      name: 'No-Data Bot',
      symbol: 'ETHUSDT',
      userId: 'user-1',
      lastRunAt: mins(1),
      lastSignalAt: mins(30),
    },
    {
      id: 'bot-c',
      name: 'Healthy Bot',
      symbol: 'SOLUSDT',
      userId: 'user-1',
      lastRunAt: mins(1),
      lastSignalAt: mins(1),
    },
  ];
  const svc = makeService({
    prisma: { bot: { findMany: mockAsyncFn(async () => bots) } },
  });
  const report = await svc.getReport('user-1');
  assert.equal(report.totalRunning, 3);
  assert.equal(report.stuck.length, 1);
  assert.equal(report.stuck[0].botId, 'bot-a');
  assert.equal(report.noData.length, 1);
  assert.equal(report.noData[0].botId, 'bot-b');
  assert.equal(report.healthy.length, 1);
  assert.equal(report.healthy[0].botId, 'bot-c');
});

test('getReport includes lastRunAt and lastSignalAt ISO strings in issue', async () => {
  const bots = [
    {
      id: 'bot-x',
      name: 'X Bot',
      symbol: 'MATICUSDT',
      userId: 'user-1',
      lastRunAt: mins(15),
      lastSignalAt: mins(15),
    },
  ];
  const svc = makeService({
    prisma: { bot: { findMany: mockAsyncFn(async () => bots) } },
  });
  const report = await svc.getReport('user-1');
  assert.equal(report.stuck.length, 1);
  assert.equal(typeof report.stuck[0].lastRunAt, 'string');
  assert.equal(typeof report.stuck[0].lastSignalAt, 'string');
});

export {};
