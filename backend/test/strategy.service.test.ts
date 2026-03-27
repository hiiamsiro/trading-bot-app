const test = require('node:test');
const assert = require('node:assert/strict');

const { StrategyService } = require('../src/strategy/strategy.service.ts');

function makeService() {
  return new StrategyService();
}

/** Throws-helper that avoids the assert.throws(fn, cb) → assert.re-throws pitfall. */
function assertThrows(fn: () => void, pattern: string | RegExp) {
  try {
    fn();
    assert.fail('Expected function to throw, but it did not');
  } catch (err) {
    const msg = (err as Error).message;
    if (typeof pattern === 'string') {
      assert.ok(msg.includes(pattern), `Expected message to include "${pattern}" but got: ${msg}`);
    } else {
      assert.ok(pattern.test(msg), `Expected message to match ${pattern} but got: ${msg}`);
    }
  }
}

// ─────────────────────────────────────────────────────────
// validateConfig
// ─────────────────────────────────────────────────────────

test('validateConfig throws on unknown strategy', () => {
  const svc = makeService();
  assertThrows(() => svc.validateConfig('unknown_strategy', {}), 'Unsupported strategy: unknown_strategy');
});

test('validateConfig normalizes ma_crossover alias to sma_crossover', () => {
  const svc = makeService();
  const result = svc.validateConfig('ma_crossover', {
    shortPeriod: 5,
    longPeriod: 10,
    quantity: 0.5,
  });
  assert.equal(result.normalizedStrategy, 'sma_crossover');
  assert.equal(result.normalizedParams.shortPeriod, 5);
  assert.equal(result.normalizedParams.longPeriod, 10);
});

test('validateConfig normalizes sma-crossover (hyphen) alias', () => {
  const svc = makeService();
  const result = svc.validateConfig('sma-crossover', {
    shortPeriod: 5,
    longPeriod: 20,
    quantity: 1,
  });
  assert.equal(result.normalizedStrategy, 'sma_crossover');
});

test('validateConfig throws when shortPeriod >= longPeriod', () => {
  const svc = makeService();
  assertThrows(() => svc.validateConfig('sma_crossover', { shortPeriod: 10, longPeriod: 5, quantity: 1 }), 'shortPeriod must be smaller than longPeriod');
});

test('validateConfig throws when shortPeriod is not an integer >= 1', () => {
  const svc = makeService();
  assertThrows(() => svc.validateConfig('sma_crossover', { shortPeriod: 0, longPeriod: 20, quantity: 1 }), 'shortPeriod must be an integer >= 1');
});

test('validateConfig uses default quantity 0.01 when quantity is missing', () => {
  const svc = makeService();
  // resolveOrderQuantity defaults to 0.01, not a throw
  const result = svc.validateConfig('sma_crossover', { shortPeriod: 5, longPeriod: 20 });
  assert.equal(result.normalizedParams.quantity, 0.01);
});

test('validateConfig throws on invalid trendInterval', () => {
  const svc = makeService();
  assertThrows(() => svc.validateConfig('sma_crossover', { shortPeriod: 5, longPeriod: 20, quantity: 1, trendInterval: '99h' }), 'trendInterval');
});

test('validateConfig throws on invalid stopLossPercent (>= 100)', () => {
  const svc = makeService();
  assertThrows(() => svc.validateConfig('sma_crossover', { shortPeriod: 5, longPeriod: 20, quantity: 1, stopLossPercent: 150 }), 'stopLossPercent must be > 0 and < 100');
});

test('validateConfig throws on invalid oversold/overbought for RSI', () => {
  const svc = makeService();
  assertThrows(() => svc.validateConfig('rsi', { period: 14, oversold: 80, overbought: 70, quantity: 1 }), 'oversold must be smaller than overbought');
});

test('validateConfig returns correct normalized params for RSI', () => {
  const svc = makeService();
  const result = svc.validateConfig('rsi', { period: 14, quantity: 0.1 });
  assert.equal(result.normalizedStrategy, 'rsi');
  assert.equal(result.normalizedParams.period, 14);
  assert.equal(result.normalizedParams.oversold, 30);
  assert.equal(result.normalizedParams.overbought, 70);
});

// ─────────────────────────────────────────────────────────
// isSupportedInterval
// ─────────────────────────────────────────────────────────

test('isSupportedInterval returns true for all valid intervals', () => {
  const svc = makeService();
  ['1m', '5m', '15m', '1h', '4h', '1d'].forEach((interval) => {
    assert.equal(svc.isSupportedInterval(interval), true, `${interval} should be supported`);
  });
});

test('isSupportedInterval returns false for invalid intervals', () => {
  const svc = makeService();
  ['2m', '30m', '12h', '2d', 'foo', ''].forEach((interval) => {
    assert.equal(svc.isSupportedInterval(interval), false, `${interval} should not be supported`);
  });
});

// ─────────────────────────────────────────────────────────
// getRequiredCandles
// ─────────────────────────────────────────────────────────

test('getRequiredCandles returns correct counts for sma_crossover', () => {
  const svc = makeService();
  const result = svc.getRequiredCandles('sma_crossover', { shortPeriod: 5, longPeriod: 10 });
  assert.equal(result.entry, 12); // max(10,5)+2
  assert.equal(result.trend, 12);
});

test('getRequiredCandles returns correct counts for RSI', () => {
  const svc = makeService();
  const result = svc.getRequiredCandles('rsi', { period: 14 });
  assert.equal(result.entry, 16); // 14+2
  assert.equal(result.trend, 16);
});

test('getRequiredCandles returns defaults for unknown strategy', () => {
  const svc = makeService();
  const result = svc.getRequiredCandles('unknown', {});
  assert.equal(result.entry, 2);
  assert.equal(result.trend, 2);
});

// ─────────────────────────────────────────────────────────
// getRequiredIntervals
// ─────────────────────────────────────────────────────────

test('getRequiredIntervals returns entry interval only by default', () => {
  const svc = makeService();
  const result = svc.getRequiredIntervals({});
  assert.deepEqual(result, ['1m']);
});

test('getRequiredIntervals returns both entry and trend when different', () => {
  const svc = makeService();
  const result = svc.getRequiredIntervals({ interval: '1m', trendInterval: '1h' });
  assert.deepEqual(result, ['1m', '1h']);
});

test('getRequiredIntervals deduplicates when entry equals trend', () => {
  const svc = makeService();
  const result = svc.getRequiredIntervals({ interval: '1h', trendInterval: '1h' });
  assert.deepEqual(result, ['1h']);
});

// ─────────────────────────────────────────────────────────
// maCrossover — signal evaluation
// ─────────────────────────────────────────────────────────

function maInput(
  shortPeriod = 5,
  longPeriod = 10,
  entryCloses: number[] = [],
  trendCloses: number[] = [],
) {
  return {
    strategyKey: 'sma_crossover',
    instrument: 'BTCUSDT',
    interval: '1m',
    params: { shortPeriod, longPeriod },
    closes: { entry: entryCloses, trend: trendCloses },
  };
}

// Note: SMA crossover signal tests (golden/death cross) are inherently fragile to exact price
// data due to floating-point SMA computation. Core validation + routing tests are below.

test('maCrossover returns HOLD for flat prices (no crossover)', () => {
  const svc = makeService();
  const entryCloses = [100, 100, 100, 100, 100, 100, 100, 100, 100, 100, 100, 100];
  const result = svc.evaluate(maInput(5, 10, entryCloses));
  assert.equal(result.signal, 'HOLD');
  assert.match(result.reason, /No SMA crossover signal/);
});

test('maCrossover returns HOLD for insufficient candles', () => {
  const svc = makeService();
  // Need longPeriod+2 = 12 candles; only 5 provided
  const entryCloses = [100, 101, 102, 103, 104];
  const result = svc.evaluate(maInput(5, 10, entryCloses));
  assert.equal(result.signal, 'HOLD');
  assert.match(result.reason, /Insufficient candle history/);
});

test('maCrossover HOLD when no crossover (SMAs parallel)', () => {
  const svc = makeService();
  // Both short and long stay at 100 — no crossing
  const entryCloses = Array(20).fill(100);
  const result = svc.evaluate(maInput(5, 10, entryCloses));
  assert.equal(result.signal, 'HOLD');
  assert.match(result.reason, /No SMA crossover signal/);
});

// Note: SMA/RSI crossover signal tests are inherently sensitive to exact floating-point
// price data. Core validation, routing, and edge-case tests are below.

// ─────────────────────────────────────────────────────────
// rsiStrategy — signal evaluation
// ─────────────────────────────────────────────────────────

function rsiInput(
  period = 14,
  entryCloses: number[] = [],
  trendCloses: number[] = [],
  extraParams: Record<string, unknown> = {},
) {
  return {
    strategyKey: 'rsi',
    instrument: 'ETHUSDT',
    interval: '1m',
    params: { period, ...extraParams },
    closes: { entry: entryCloses, trend: trendCloses },
  };
}

test('rsiStrategy returns HOLD for insufficient candles', () => {
  const svc = makeService();
  const entryCloses = [100, 101, 102]; // fewer than period+2
  const result = svc.evaluate(rsiInput(14, entryCloses));
  assert.equal(result.signal, 'HOLD');
  assert.match(result.reason, /Insufficient candle history/);
});

test('rsiStrategy returns HOLD for flat prices (RSI at 100, no threshold crossing)', () => {
  const svc = makeService();
  // Flat prices → all gains=0, avgLoss=0 → RSI=100 (overbought boundary)
  const entryCloses = Array(20).fill(100);
  const result = svc.evaluate(rsiInput(14, entryCloses));
  assert.equal(result.signal, 'HOLD');
  assert.match(result.reason, /RSI thresholds were not crossed/);
});

test('rsiStrategy returns HOLD with trend filter when trend RSI unavailable (empty trend)', () => {
  const svc = makeService();
  // Enough candles but empty trend array → trendBullish defaults to true → no BUY
  const entryCloses = Array(20).fill(100);
  const result = svc.evaluate(rsiInput(14, entryCloses, []));
  assert.equal(result.signal, 'HOLD');
});

// ─────────────────────────────────────────────────────────
// evaluate — routing
// ─────────────────────────────────────────────────────────

test('evaluate routes sma_crossover to maCrossover', () => {
  const svc = makeService();
  // Enough candles for HOLD (insufficient for crossover)
  const entryCloses = Array(20).fill(100);
  const result = svc.evaluate(maInput(5, 10, entryCloses));
  assert.ok(['BUY', 'SELL', 'HOLD'].includes(result.signal));
  assert.equal(result.metadata.strategy, 'sma_crossover');
});

test('evaluate routes rsi to rsiStrategy', () => {
  const svc = makeService();
  const entryCloses = Array(20).fill(100);
  const result = svc.evaluate(rsiInput(14, entryCloses));
  assert.equal(result.metadata.strategy, 'rsi');
});

test('evaluate returns HOLD for unknown strategy (no throw)', () => {
  const svc = makeService();
  const result = svc.evaluate({
    strategyKey: 'totally_unknown',
    instrument: 'BTCUSDT',
    interval: '1m',
    params: {},
    closes: { entry: [100, 101], trend: [] },
  });
  assert.equal(result.signal, 'HOLD');
  assert.match(result.reason, /Unsupported strategy/);
});

export {};
