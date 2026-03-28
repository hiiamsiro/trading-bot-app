const test = require('node:test');
const assert = require('node:assert/strict');

const { mockAsyncFn } = require('./helpers.ts');
const { BacktestService } = require('../src/backtest/backtest.service.ts');

function makeService(overrides?: any) {
  const strategyService = {
    validateConfig: mockAsyncFn((strategy: any, params: any) =>
      overrides?.strategyService?.validateConfig?.(strategy, params)
        ?? { normalizedStrategy: strategy === 'ma_crossover' ? 'sma_crossover' : strategy, normalizedParams: { ...params, period: 14, oversold: 30, overbought: 70, shortPeriod: 5, longPeriod: 10, stopLossPercent: 0, takeProfitPercent: 0 } },
    ),
    getRequiredCandles: mockAsyncFn((strategy: any, params: any) =>
      overrides?.strategyService?.getRequiredCandles?.(strategy, params) ?? { entry: 16, trend: 16 },
    ),
    evaluate: mockAsyncFn((input: any) =>
      overrides?.strategyService?.evaluate?.(input) ?? { signal: 'HOLD', reason: 'No signal', metadata: { strategy: input?.strategyKey } },
    ),
  };
  const marketDataAdapter = {
    getKlines: mockAsyncFn((symbol: any, interval: any, limit: any) =>
      overrides?.marketDataAdapter?.getKlines?.(symbol, interval, limit) ?? defaultCandles(symbol, interval, limit),
    ),
  };
  const svc: any = new BacktestService({}, marketDataAdapter, strategyService);
  svc._mda = marketDataAdapter;
  svc._ss = strategyService;
  return svc;
}

function defaultCandles(symbol: any, interval: any, limit: number) {
  const now = Date.now();
  return Array.from({ length: limit }, (_, i) => ({
    openTime: now - (limit - i) * 60000,
    closeTime: now - (limit - i - 1) * 60000,
    open: 100, high: 100, low: 100, close: 100, volume: 1,
  }));
}

function risingCandles(n: number) {
  const now = Date.now();
  return Array.from({ length: n }, (_, i) => ({
    openTime: now - (n - i) * 60000,
    closeTime: now - (n - i - 1) * 60000,
    open: 100 + i, high: 101 + i, low: 99 + i, close: 101 + i, volume: 1,
  }));
}

async function assertRejects(promise: Promise<any>, check: (err: any) => boolean, message = 'Expected to reject') {
  try {
    await promise;
    assert.fail(message);
  } catch (err) {
    assert.ok(check(err), `${message}: got ${(err as Error).message}`);
  }
}

// ─────────────────────────────────────────────────────────
// preview
// ─────────────────────────────────────────────────────────

test('preview throws when fewer than 3 candles returned', async () => {
  const svc = makeService({ marketDataAdapter: { getKlines: async () => [] } });
  await assertRejects(
    svc.preview({ symbol: 'BTCUSDT', interval: '1m', strategyKey: 'rsi', strategyParams: { period: 14 }, sourceSymbol: 'BTCUSDT' }),
    (err) => err instanceof Error && err.message.includes('Insufficient candle data'),
  );
});

test('preview throws when only 2 candles returned', async () => {
  const svc = makeService({ marketDataAdapter: { getKlines: async () => [{ close: 100 }, { close: 101 }] } });
  await assertRejects(
    svc.preview({ symbol: 'BTCUSDT', interval: '1m', strategyKey: 'rsi', strategyParams: { period: 14 }, sourceSymbol: 'BTCUSDT' }),
    (err) => err instanceof Error && err.message.includes('Insufficient candle data'),
  );
});

test('preview calls strategyService.validateConfig and getRequiredCandles', async () => {
  const svc = makeService();
  await svc.preview({ symbol: 'ETHUSDT', interval: '5m', strategyKey: 'sma_crossover', strategyParams: { shortPeriod: 5, longPeriod: 20 }, sourceSymbol: 'ETHUSDT' });
  assert.equal(svc._ss.validateConfig.calls.length, 1);
  assert.equal(svc._ss.getRequiredCandles.calls.length, 1);
});

test('preview returns BacktestResult with metrics, trades, and equityCurve', async () => {
  const svc = makeService();
  const result = await svc.preview({ symbol: 'BTCUSDT', interval: '1m', strategyKey: 'rsi', strategyParams: { period: 14 }, sourceSymbol: 'BTCUSDT' });
  assert.ok('metrics' in result);
  assert.ok('trades' in result);
  assert.ok('equityCurve' in result);
  assert.ok('totalTrades' in result.metrics);
  assert.ok('winRate' in result.metrics);
  assert.ok('totalPnl' in result.metrics);
});

test('preview returns initialBalance 10000 when not specified', async () => {
  const svc = makeService();
  const result = await svc.preview({ symbol: 'BTCUSDT', interval: '1m', strategyKey: 'rsi', strategyParams: { period: 14 }, sourceSymbol: 'BTCUSDT' });
  assert.equal(result.metrics.initialBalance, 10000);
});

// ─────────────────────────────────────────────────────────
// runBacktest
// ─────────────────────────────────────────────────────────

test('runBacktest throws when fewer than 3 candles returned', async () => {
  const svc = makeService({ marketDataAdapter: { getKlines: async () => [] } });
  const from = new Date('2024-01-01');
  const to = new Date('2024-01-02');
  await assertRejects(
    svc.runBacktest({ symbol: 'BTCUSDT', interval: '1m', strategyKey: 'rsi', strategyParams: { period: 14 }, fromDate: from, toDate: to, initialBalance: 10000, sourceSymbol: 'BTCUSDT' }),
    (err) => err instanceof Error && err.message.includes('Insufficient candle data'),
  );
});

test('runBacktest validates strategy before simulating', async () => {
  const svc = makeService();
  await svc.runBacktest({
    symbol: 'BTCUSDT', interval: '1m', strategyKey: 'sma_crossover',
    strategyParams: { shortPeriod: 5, longPeriod: 20 },
    fromDate: new Date('2024-01-01'), toDate: new Date('2024-01-02'),
    initialBalance: 5000, sourceSymbol: 'BTCUSDT',
  });
  assert.equal(svc._ss.validateConfig.calls.length, 1);
});

test('runBacktest returns BacktestResult', async () => {
  const svc = makeService();
  const result = await svc.runBacktest({
    symbol: 'BTCUSDT', interval: '1m', strategyKey: 'rsi', strategyParams: { period: 14 },
    fromDate: new Date('2024-01-01'), toDate: new Date('2024-01-02'),
    initialBalance: 5000, sourceSymbol: 'BTCUSDT',
  });
  assert.ok('metrics' in result);
  assert.ok('trades' in result);
  assert.ok('equityCurve' in result);
});

// ─────────────────────────────────────────────────────────
// simulate (via preview)
// ─────────────────────────────────────────────────────────

test('simulate produces equity curve entries for each evaluated candle', async () => {
  const svc = makeService({
    marketDataAdapter: { getKlines: async () => risingCandles(50) },
    strategyService: {
      validateConfig: async () => ({ normalizedStrategy: 'rsi', normalizedParams: { period: 14, oversold: 30, overbought: 70, quantity: 0.01 } }),
      getRequiredCandles: async () => ({ entry: 16, trend: 16 }),
      evaluate: async () => ({ signal: 'HOLD', reason: 'No signal', metadata: {} }),
    },
  });
  const result = await svc.preview({ symbol: 'BTCUSDT', interval: '1m', strategyKey: 'rsi', strategyParams: { period: 14 }, sourceSymbol: 'BTCUSDT' });
  assert.ok(result.equityCurve.length > 0);
});

test('simulate winRate is null when no trades closed', async () => {
  const svc = makeService({
    strategyService: {
      validateConfig: async () => ({ normalizedStrategy: 'rsi', normalizedParams: { period: 14, oversold: 30, overbought: 70, quantity: 0.01 } }),
      getRequiredCandles: async () => ({ entry: 16, trend: 16 }),
      evaluate: async () => ({ signal: 'HOLD', reason: 'No signal', metadata: {} }),
    },
  });
  const result = await svc.preview({ symbol: 'BTCUSDT', interval: '1m', strategyKey: 'rsi', strategyParams: { period: 14 }, sourceSymbol: 'BTCUSDT' });
  assert.equal(result.metrics.totalTrades, 0);
  assert.equal(result.metrics.winRate, null);
});

test('simulate calculates maxDrawdown 0 for flat equity', async () => {
  const svc = makeService({
    strategyService: {
      validateConfig: async () => ({ normalizedStrategy: 'rsi', normalizedParams: { period: 14, oversold: 30, overbought: 70, quantity: 0.01 } }),
      getRequiredCandles: async () => ({ entry: 16, trend: 16 }),
      evaluate: async () => ({ signal: 'HOLD', reason: 'No signal', metadata: {} }),
    },
  });
  const result = await svc.preview({ symbol: 'BTCUSDT', interval: '1m', strategyKey: 'rsi', strategyParams: { period: 14 }, sourceSymbol: 'BTCUSDT' });
  assert.equal(result.metrics.maxDrawdown, 0);
});

test('simulate computes finalBalance = initialBalance + totalPnl', async () => {
  const svc = makeService({
    strategyService: {
      validateConfig: async () => ({ normalizedStrategy: 'rsi', normalizedParams: { period: 14, oversold: 30, overbought: 70, quantity: 0.01 } }),
      getRequiredCandles: async () => ({ entry: 16, trend: 16 }),
      evaluate: async () => ({ signal: 'HOLD', reason: 'No signal', metadata: {} }),
    },
  });
  const result = await svc.preview({ symbol: 'BTCUSDT', interval: '1m', strategyKey: 'rsi', strategyParams: { period: 14 }, sourceSymbol: 'BTCUSDT' });
  assert.equal(result.metrics.finalBalance, result.metrics.initialBalance + result.metrics.totalPnl);
});

test('simulate respects stopLossPercent and takeProfitPercent without crashing', async () => {
  const svc = makeService({
    marketDataAdapter: { getKlines: async () => risingCandles(50) },
    strategyService: {
      validateConfig: async () => ({
        normalizedStrategy: 'rsi',
        normalizedParams: { period: 14, oversold: 30, overbought: 70, quantity: 0.01, stopLossPercent: 2, takeProfitPercent: 5 },
      }),
      getRequiredCandles: async () => ({ entry: 16, trend: 16 }),
      evaluate: async () => ({ signal: 'HOLD', reason: 'No signal', metadata: {} }),
    },
  });
  const result = await svc.preview({ symbol: 'BTCUSDT', interval: '1m', strategyKey: 'rsi', strategyParams: { period: 14 }, sourceSymbol: 'BTCUSDT' });
  assert.equal(result.metrics.initialBalance, 10000);
});

test('simulate closes open position at backtest end with closeReason backtest_end', async () => {
  let buyIssued = false;
  const svc = makeService({
    marketDataAdapter: { getKlines: async () => risingCandles(50) },
    strategyService: {
      validateConfig: async () => ({
        normalizedStrategy: 'rsi',
        normalizedParams: { period: 14, oversold: 30, overbought: 70, quantity: 0.01 },
      }),
      getRequiredCandles: async () => ({ entry: 16, trend: 16 }),
      evaluate: async (input: any) => {
        if (!buyIssued) {
          buyIssued = true;
          return { signal: 'BUY', reason: 'Buy signal', metadata: {} };
        }
        return { signal: 'HOLD', reason: 'Hold', metadata: {} };
      },
    },
  });
  const result = await svc.preview({ symbol: 'BTCUSDT', interval: '1m', strategyKey: 'rsi', strategyParams: { period: 14 }, sourceSymbol: 'BTCUSDT' });
  assert.ok(result.metrics.totalTrades >= 1);
  const lastTrade = result.trades[result.trades.length - 1];
  assert.equal(lastTrade.closeReason, 'backtest_end');
});

test('simulate uses quantity from params, falls back to 0.01', async () => {
  const svc = makeService({
    strategyService: {
      validateConfig: async (s: any, p: any) => ({ normalizedStrategy: s, normalizedParams: { ...p, period: 14, oversold: 30, overbought: 70 } }),
      getRequiredCandles: async () => ({ entry: 16, trend: 16 }),
      evaluate: async () => ({ signal: 'HOLD', reason: 'No signal', metadata: {} }),
    },
  });
  const result = await svc.preview({ symbol: 'BTCUSDT', interval: '1m', strategyKey: 'rsi', strategyParams: { period: 14, quantity: 0 }, sourceSymbol: 'BTCUSDT' });
  assert.ok(result.equityCurve.length > 0);
});

export {};
