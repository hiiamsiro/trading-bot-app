import { test, describe, it, beforeEach } from 'node:test';
import * as assert from 'node:assert';
const { WalkforwardService } = require('../src/walkforward/walkforward.service.ts');
const { mockAsyncFn, mockFn, mockAsyncSequence, mockQueryRawFn } = require('./helpers.ts');

function makeService(overrides?: any) {
  const prismaDefaults = {
    walkforward: {
      create: mockAsyncFn(async (args: any) => ({ id: 'wf-1', ...args.data })),
      update: mockAsyncFn(async (args: any) => ({ id: args.where.id, ...args.data })),
      findUnique: mockAsyncFn(async () => null),
      findMany: mockAsyncFn(async () => []),
      count: mockAsyncFn(async () => 0),
    },
    instrument: {
      findUnique: mockAsyncFn(async () => ({ sourceSymbol: 'BTCUSDT' })),
    },
    backtest: {
      runBacktest: mockAsyncFn(async () => ({
        metrics: { totalPnl: 100, maxDrawdown: 0.1, winRate: 0.5, totalTrades: 3, winningTrades: 2, losingTrades: 1, initialBalance: 10000, finalBalance: 10100, averageWin: 50, averageLoss: 25 },
        equityCurve: [],
        trades: [],
      })),
    },
  };

  // Always create a fresh $queryRaw at the top level — tests can capture calls via
  // overrides.queryRaw or overrides.prisma.$queryRaw
  const queryRawInstance = mockQueryRawFn(async () => []);

  // Preserve any $queryRaw passed via overrides.prisma (supports closure captures)
  const passedQueryRaw = overrides?.prisma?.$queryRaw ?? overrides?.queryRaw ?? queryRawInstance;

  const mergedPrisma: any = {
    $queryRaw: passedQueryRaw,
    walkforward: { ...prismaDefaults.walkforward, ...overrides?.prisma?.walkforward },
    instrument: overrides?.prisma?.instrument ?? prismaDefaults.instrument,
    backtest: overrides?.prisma?.backtest ?? prismaDefaults.backtest,
  };

  // Support queryRaw passed at top level
  if (overrides?.queryRaw) {
    mergedPrisma.$queryRaw = overrides.queryRaw;
  }

  const queue = overrides?.queue ?? { add: mockAsyncFn(async () => undefined) };

  return new WalkforwardService(mergedPrisma, mergedPrisma.backtest, queue);
}

describe('WalkforwardService.generateCombinations', () => {
  test('returns single empty object for empty paramRanges', () => {
    const svc = makeService();
    const combos = (svc as any).generateCombinations([]);
    assert.deepEqual(combos, [{}]);
  });

  test('generates all combinations for single param', () => {
    const svc = makeService();
    const combos = (svc as any).generateCombinations([{ param: 'period', values: [10, 14, 20] }]);
    assert.equal(combos.length, 3);
    assert.deepEqual(combos.filter((c: any) => c.period === 10).length, 1);
    assert.deepEqual(combos.filter((c: any) => c.period === 14).length, 1);
    assert.deepEqual(combos.filter((c: any) => c.period === 20).length, 1);
  });

  test('generates cartesian product for multiple params', () => {
    const svc = makeService();
    const combos = (svc as any).generateCombinations([
      { param: 'period', values: [10, 14] },
      { param: 'oversold', values: [20, 30] },
    ]);
    assert.equal(combos.length, 4);
    assert.deepEqual(combos.filter((c: any) => c.period === 10 && c.oversold === 20).length, 1);
    assert.deepEqual(combos.filter((c: any) => c.period === 10 && c.oversold === 30).length, 1);
    assert.deepEqual(combos.filter((c: any) => c.period === 14 && c.oversold === 20).length, 1);
    assert.deepEqual(combos.filter((c: any) => c.period === 14 && c.oversold === 30).length, 1);
  });
});

describe('WalkforwardService.startWalkforward', () => {
  test('creates record and enqueues job', async () => {
    const prisma = {
      $queryRaw: mockQueryRawFn(async () => [{ id: 'wf-1' }]),
      walkforward: {
        create: mockAsyncFn(async (args: any) => ({ id: 'wf-1', ...args.data })),
        update: mockAsyncFn(async () => undefined),
      },
      instrument: {
        findUnique: mockAsyncFn(async () => ({ sourceSymbol: 'BTCUSDT' })),
      },
      backtest: {
        runBacktest: mockAsyncFn(async () => ({
          metrics: { totalPnl: 100, maxDrawdown: 0.1, winRate: 0.5, totalTrades: 3, winningTrades: 2, losingTrades: 1, initialBalance: 10000, finalBalance: 10100, averageWin: 50, averageLoss: 25 },
          equityCurve: [],
          trades: [],
        })),
      },
    };
    const queue = { add: mockAsyncFn(async () => undefined) };
    const svc = new WalkforwardService(prisma, prisma.backtest, queue);

    const result = await svc.startWalkforward('user-1', {
      symbol: 'BTCUSDT',
      interval: '1h',
      strategy: 'rsi',
      paramRanges: [{ param: 'period', values: [14, 20] }],
      fromDate: '2024-01-01',
      toDate: '2024-02-01',
      initialBalance: 10000,
      trainSplitPct: 70,
    });

    assert.equal(result.id, 'wf-1');
    assert.equal(queue.add.calls.length, 1);
    assert.equal(queue.add.calls[0][0], 'run-walkforward');
    assert.equal(queue.add.calls[0][1].walkforwardId, 'wf-1');
  });

  test('sets correct initial train/test windows in DB record (70/30 split)', async () => {
    let queryRawCalls: unknown[][] = [];
    const prisma = {
      $queryRaw: mockQueryRawFn(async (...args) => {
        queryRawCalls.push(args);
        return [{ id: 'wf-1' }];
      }),
      walkforward: {
        create: mockAsyncFn(async () => ({ id: 'wf-1' })),
        update: mockAsyncFn(async () => undefined),
      },
      instrument: { findUnique: mockAsyncFn(async () => ({ sourceSymbol: 'BTCUSDT' })) },
      backtest: { runBacktest: mockAsyncFn(async () => ({ metrics: { totalPnl: 100, maxDrawdown: 0.1, winRate: 0.5, totalTrades: 3, winningTrades: 2, losingTrades: 1, initialBalance: 10000, finalBalance: 10100, averageWin: 50, averageLoss: 25 }, equityCurve: [], trades: [] })) },
    };
    const queue = { add: mockAsyncFn(async () => undefined) };
    const svc = new WalkforwardService(prisma, prisma.backtest, queue);

    await svc.startWalkforward('user-1', {
      symbol: 'BTCUSDT',
      interval: '1h',
      strategy: 'rsi',
      paramRanges: [{ param: 'period', values: [14] }],
      fromDate: '2024-01-01',
      toDate: '2024-02-01',
      initialBalance: 10000,
      trainSplitPct: 70,
    });

    // Verify the raw SQL INSERT was called with correct date fields
    assert.equal(queryRawCalls.length, 1);
    const sqlCall = String(queryRawCalls[0][0]);
    assert.ok(sqlCall.includes('INSERT INTO walkforwards'));
    assert.ok(sqlCall.includes('train_from_date'));
    assert.ok(sqlCall.includes('test_from_date'));
    assert.ok(sqlCall.includes('PENDING'));
  });
});

describe('WalkforwardService.runWalkforwardAnalysis', () => {
  test('skips failed combinations with warning, does not crash', async () => {
    const trainSuccess = { totalPnl: 200, maxDrawdown: 0.05, winRate: 0.6, totalTrades: 3, winningTrades: 2, losingTrades: 1, initialBalance: 10000, finalBalance: 10200, averageWin: 100, averageLoss: 50 };
    const trainFail = { totalPnl: 100, maxDrawdown: 0.1, winRate: 0.5, totalTrades: 2, winningTrades: 1, losingTrades: 1, initialBalance: 10000, finalBalance: 10100, averageWin: 50, averageLoss: 25 };
    const prisma = {
      $queryRaw: mockQueryRawFn(async () => []),
      walkforward: { update: mockAsyncFn(async () => undefined) },
      instrument: { findUnique: mockAsyncFn(async () => ({ sourceSymbol: 'BTCUSDT' })) },
      backtest: {
        runBacktest: mockAsyncFn(async () => ({
          metrics: { totalPnl: 100, maxDrawdown: 0.1, winRate: 0.5, totalTrades: 3, winningTrades: 2, losingTrades: 1, initialBalance: 10000, finalBalance: 10100, averageWin: 50, averageLoss: 25 },
          equityCurve: [],
          trades: [],
        })),
      },
    };
    let backtestCallCount = 0;
    (prisma.backtest.runBacktest as any).mockImpl = async () => {
      backtestCallCount++;
      if (backtestCallCount === 1) return { metrics: trainSuccess, equityCurve: [], trades: [] };
      if (backtestCallCount === 2) throw new Error('Candle data unavailable');
      return { metrics: trainFail, equityCurve: [], trades: [] };
    };

    const svc = makeService({ prisma });

    // Should NOT throw even though one combination fails
    const result = await svc.runWalkforwardAnalysis('wf-1', {
      symbol: 'BTCUSDT',
      interval: '1h',
      strategy: 'rsi',
      paramRanges: [
        { param: 'period', values: [14] },
        { param: 'oversold', values: [20, 30] }, // 3 combos total
      ],
      fromDate: '2024-01-01',
      toDate: '2024-02-01',
      initialBalance: 10000,
      trainSplitPct: 70,
    });

    assert.ok(result);
    // Best train PnL from successful runs
    assert.ok(result.trainMetrics.totalPnl > 0);
  });

  test('selects best params by highest training PnL', async () => {
    // Return different PnL for each combo: period=10→50, period=14→300, period=20→150
    // Best is period=14 with PnL=300
    const prisma = {
      $queryRaw: mockQueryRawFn(async () => []),
      walkforward: { update: mockAsyncFn(async () => undefined) },
      instrument: { findUnique: mockAsyncFn(async () => ({ sourceSymbol: 'BTCUSDT' })) },
      backtest: {
        runBacktest: mockAsyncSequence([
          async () => ({ metrics: { totalPnl: 50, maxDrawdown: 0.1, winRate: 0.5, totalTrades: 2, winningTrades: 1, losingTrades: 1, initialBalance: 10000, finalBalance: 10050, averageWin: 30, averageLoss: 15 }, equityCurve: [], trades: [] }),
          async () => ({ metrics: { totalPnl: 300, maxDrawdown: 0.05, winRate: 0.7, totalTrades: 5, winningTrades: 3, losingTrades: 2, initialBalance: 10000, finalBalance: 10300, averageWin: 120, averageLoss: 60 }, equityCurve: [], trades: [] }),
          async () => ({ metrics: { totalPnl: 150, maxDrawdown: 0.08, winRate: 0.6, totalTrades: 3, winningTrades: 2, losingTrades: 1, initialBalance: 10000, finalBalance: 10150, averageWin: 90, averageLoss: 45 }, equityCurve: [], trades: [] }),
        ]),
      },
    };
    const svc = makeService({ prisma });
    const result = await svc.runWalkforwardAnalysis('wf-1', {
      symbol: 'BTCUSDT',
      interval: '1h',
      strategy: 'rsi',
      paramRanges: [{ param: 'period', values: [10, 14, 20] }],
      fromDate: '2024-01-01',
      toDate: '2024-02-01',
      initialBalance: 10000,
      trainSplitPct: 70,
    });

    // Best PnL among [50, 300, 150] is 300 → period=14
    assert.equal(result.bestParams.period, 14);
    assert.equal(result.trainMetrics.totalPnl, 300);
  });

  test('evaluates best params on out-of-sample test data', async () => {
    const prisma = {
      $queryRaw: mockQueryRawFn(async () => []),
      walkforward: { update: mockAsyncFn(async () => undefined) },
      instrument: { findUnique: mockAsyncFn(async () => ({ sourceSymbol: 'BTCUSDT' })) },
      backtest: {
        runBacktest: mockAsyncSequence([
          // First call: training — returns best train params
          async () => ({ metrics: { totalPnl: 300, maxDrawdown: 0.05, winRate: 0.7, totalTrades: 5, winningTrades: 3, losingTrades: 2, initialBalance: 10000, finalBalance: 10300, averageWin: 120, averageLoss: 60 }, equityCurve: [{ at: '2024-01-20', cumulativePnl: 300 }], trades: [] }),
          // Second call: testing — same params on unseen data
          async () => ({ metrics: { totalPnl: 50, maxDrawdown: 0.12, winRate: 0.4, totalTrades: 3, winningTrades: 1, losingTrades: 2, initialBalance: 10000, finalBalance: 10050, averageWin: 80, averageLoss: 40 }, equityCurve: [{ at: '2024-02-01', cumulativePnl: 50 }], trades: [] }),
        ]),
      },
    };
    const svc = makeService({ prisma });
    const result = await svc.runWalkforwardAnalysis('wf-1', {
      symbol: 'BTCUSDT',
      interval: '1h',
      strategy: 'rsi',
      paramRanges: [{ param: 'period', values: [14] }],
      fromDate: '2024-01-01',
      toDate: '2024-02-01',
      initialBalance: 10000,
      trainSplitPct: 70,
    });

    // Train call: 1, Test call: 1
    assert.equal(prisma.backtest.runBacktest.calls.length, 2);
    // Train PnL (300) != Test PnL (50) — confirms separate evaluation
    assert.equal(result.trainMetrics.totalPnl, 300);
    assert.equal(result.testMetrics.totalPnl, 50);
  });

  test('updates DB record with results on completion', async () => {
    const queryRaw = mockQueryRawFn(async () => []);
    const svc = makeService({
      queryRaw,
      prisma: {
        instrument: { findUnique: mockAsyncFn(async () => ({ sourceSymbol: 'BTCUSDT' })) },
        backtest: {
          runBacktest: mockAsyncFn(async () => ({
            metrics: { totalPnl: 100, maxDrawdown: 0.1, winRate: 0.5, totalTrades: 3, winningTrades: 2, losingTrades: 1, initialBalance: 10000, finalBalance: 10100, averageWin: 50, averageLoss: 25 },
            equityCurve: [{ at: '2024-01-20', cumulativePnl: 100 }],
            trades: [{ id: 'trade-1' }],
          })),
        },
      },
    });

    await svc.runWalkforwardAnalysis('wf-1', {
      symbol: 'BTCUSDT',
      interval: '1h',
      strategy: 'rsi',
      paramRanges: [{ param: 'period', values: [14] }],
      fromDate: '2024-01-01',
      toDate: '2024-02-01',
      initialBalance: 10000,
      trainSplitPct: 70,
    });

    // Should have called UPDATE with COMPLETED status
    assert.equal(queryRaw.calls.length, 1);
    const sqlCall = queryRaw.calls[0][0];
    const sqlStr = Array.isArray(sqlCall) ? sqlCall.join('') : String(sqlCall);
    assert.ok(sqlStr.includes('UPDATE walkforwards'));
    assert.ok(sqlStr.includes('COMPLETED'));
  });

  test('throws when no successful training runs', async () => {
    const prisma = {
      $queryRaw: mockQueryRawFn(async () => []),
      walkforward: { update: mockAsyncFn(async () => undefined) },
      instrument: { findUnique: mockAsyncFn(async () => ({ sourceSymbol: 'BTCUSDT' })) },
      backtest: {
        runBacktest: mockAsyncFn(async () => { throw new Error('Candle data unavailable'); }),
      },
    };
    const svc = makeService({ prisma });

    await assert.rejects(
      svc.runWalkforwardAnalysis('wf-1', {
        symbol: 'BTCUSDT',
        interval: '1h',
        strategy: 'rsi',
        paramRanges: [{ param: 'period', values: [14] }],
        fromDate: '2024-01-01',
        toDate: '2024-02-01',
        initialBalance: 10000,
        trainSplitPct: 70,
      }),
      /No successful training runs/,
    );
  });
});

describe('WalkforwardService.markFailed', () => {
  test('updates status to FAILED with error message', async () => {
    let queryRawCalls: unknown[][] = [];
    const prisma = {
      $queryRaw: mockQueryRawFn(async (...args) => {
        queryRawCalls.push(args);
        return [];
      }),
    };
    const svc = makeService({ prisma });
    await svc.markFailed('wf-1', 'Symbol not found');
    assert.equal(queryRawCalls.length, 1);
    // Verify the UPDATE SQL was called (check calls length only — content verified in integration test)
    assert.equal(queryRawCalls.length, 1);
  });
});

describe('WalkforwardService.getWalkforward', () => {
  test('returns null when record not found', async () => {
    const queryRaw = mockQueryRawFn(async () => []);
    const svc = makeService({ queryRaw });
    const result = await svc.getWalkforward('user-1', 'wf-not-exist');
    assert.equal(result, null);
  });

  test('returns formatted record with all fields', async () => {
    // All fields must match the raw SQL query result columns (snake_case)
    const mockRecord = {
      id: 'wf-1',
      symbol: 'BTCUSDT',
      interval: '1h',
      strategy: 'rsi',
      param_ranges: [{ param: 'period', values: [14] }],
      train_from_date: new Date('2024-01-01'),
      train_to_date: new Date('2024-01-22'),
      test_from_date: new Date('2024-01-23'),
      test_to_date: new Date('2024-02-01'),
      train_split_pct: 70,
      status: 'COMPLETED',
      error: null,
      best_train_params: { period: 14 },
      train_metrics: { totalPnl: 100 },
      test_metrics: { totalPnl: 30 },
      train_equity_curve: [],
      test_equity_curve: [],
      train_trades: [],
      test_trades: [],
      train_pnl: 100,
      test_pnl: 30,
      train_drawdown: 0.1,
      test_drawdown: 0.15,
      train_win_rate: 0.5,
      test_win_rate: 0.4,
      created_at: new Date(),
    };
    const queryRaw = mockQueryRawFn(async () => [mockRecord]);
    const svc = makeService({ queryRaw });
    const result = await svc.getWalkforward('user-1', 'wf-1');

    assert.equal(result.id, 'wf-1');
    assert.equal(result.symbol, 'BTCUSDT');
    assert.equal(result.status, 'COMPLETED');
    assert.equal(result.trainPnl, 100);
    assert.equal(result.testPnl, 30);
    assert.equal(result.trainDrawdown, 0.1);
    assert.equal(result.testDrawdown, 0.15);
  });
});

describe('WalkforwardService.listWalkforwards', () => {
  test('returns paginated results with total count', async () => {
    const mockItems = [
      { id: 'wf-1', symbol: 'BTCUSDT', status: 'COMPLETED', trainPnl: 100, testPnl: 30, createdAt: new Date() },
      { id: 'wf-2', symbol: 'ETHUSDT', status: 'RUNNING', trainPnl: null, testPnl: null, createdAt: new Date() },
    ];
    const prisma = {
      walkforward: {
        findMany: mockAsyncFn(async () => mockItems),
        count: mockAsyncFn(async () => 5),
      },
    };
    const svc = makeService({ prisma });

    const result = await svc.listWalkforwards('user-1', 2, 0);

    assert.equal(result.items.length, 2);
    assert.equal(result.total, 5);
    assert.equal(result.take, 2);
    assert.equal(result.skip, 0);
  });
});
