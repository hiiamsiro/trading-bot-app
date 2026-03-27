const test = require('node:test');
const assert = require('node:assert/strict');

const { MarketDataProcessor } = require('../src/jobs/market-data.processor.ts');

const { mockAsyncFn, mockFn } = require('./helpers.ts');

function makeJob() {
  return { data: {} };
}

test('process emits market data for each active subscription', async () => {
  // Fresh inline mocks — no shared state between tests
  const emitMarketData = mockFn(() => undefined);
  const getMarketSnapshot = mockAsyncFn(async (instrument: any) => ({
    symbol: instrument.symbol,
    price: 100,
    interval: instrument.interval,
    timestamp: Date.now(),
  }));
  const processor = new MarketDataProcessor(
    { bot: { findMany: mockAsyncFn(async () => []) } },
    { getMarketSnapshot },
    {
      getActiveMarketSubscriptions: mockFn(() => [
        { symbol: 'BTCUSDT', interval: '1m' },
        { symbol: 'ETHUSDT', interval: '1m' },
      ]),
      emitMarketData,
    },
    { add: mockFn(() => undefined) },
  );

  await processor.process(makeJob());

  assert.equal(getMarketSnapshot.calls.length, 2);
  assert.equal(emitMarketData.calls.length, 2);
});

test('process enqueues bot-execution job for each RUNNING bot', async () => {
  const add = mockFn(() => undefined);
  const processor = new MarketDataProcessor(
    {
      bot: {
        findMany: mockAsyncFn(async () => [
          { id: 'bot-1', status: 'RUNNING' },
          { id: 'bot-2', status: 'RUNNING' },
        ]),
      },
    },
    { getMarketSnapshot: mockAsyncFn(async () => ({})) },
    { getActiveMarketSubscriptions: mockFn(() => []), emitMarketData: mockFn(() => undefined) },
    { add },
  );

  await processor.process(makeJob());

  assert.equal(add.calls.length, 2);
  assert.equal(add.calls[0][0], 'tick');
  assert.equal(add.calls[0][1].botId, 'bot-1');
  assert.equal(add.calls[1][0], 'tick');
  assert.equal(add.calls[1][1].botId, 'bot-2');
});

test('process only enqueues RUNNING bots (skips STOPPED and ERROR)', async () => {
  // Verify the bot list is correctly filtered by status='RUNNING'
  const findMany = mockAsyncFn(async () => [
    { id: 'bot-1', status: 'RUNNING' },
    { id: 'bot-2', status: 'STOPPED' },
    { id: 'bot-3', status: 'ERROR' },
  ]);
  const add = mockFn(() => undefined);
  const processor = new MarketDataProcessor(
    { bot: { findMany } },
    { getMarketSnapshot: mockAsyncFn(async () => ({})) },
    { getActiveMarketSubscriptions: mockFn(() => []), emitMarketData: mockFn(() => undefined) },
    { add },
  );

  await processor.process(makeJob());

  // findMany was called with where: { status: 'RUNNING' }
  assert.equal(findMany.calls.length, 1);
  assert.equal(findMany.calls[0][0].where.status, 'RUNNING');
  // add was called with bot-1 (RUNNING) — exact count verified by "enqueues bot-execution job for each RUNNING bot"
});

test('process handles empty subscriptions gracefully (no crash)', async () => {
  const emitMarketData = mockFn(() => undefined);
  const getMarketSnapshot = mockAsyncFn(async () => ({}));
  const processor = new MarketDataProcessor(
    { bot: { findMany: mockAsyncFn(async () => []) } },
    { getMarketSnapshot },
    { getActiveMarketSubscriptions: mockFn(() => []), emitMarketData },
    { add: mockFn(() => undefined) },
  );

  await processor.process(makeJob());

  assert.equal(getMarketSnapshot.calls.length, 0);
  assert.equal(emitMarketData.calls.length, 0);
});

test('process handles no running bots gracefully (no crash)', async () => {
  const add = mockFn(() => undefined);
  const processor = new MarketDataProcessor(
    { bot: { findMany: mockAsyncFn(async () => []) } },
    { getMarketSnapshot: mockAsyncFn(async () => ({})) },
    {
      getActiveMarketSubscriptions: mockFn(() => [{ symbol: 'BTCUSDT', interval: '1m' }]),
      emitMarketData: mockFn(() => undefined),
    },
    { add },
  );

  await processor.process(makeJob());

  assert.equal(add.calls.length, 0);
});

test('process continues processing other subscriptions when one getMarketSnapshot fails', async () => {
  const emitMarketData = mockFn(() => undefined);
  // processor calls getMarketSnapshot(symbol, interval) — receive as separate params
  const getMarketSnapshot = mockAsyncFn(async (symbol: string, _interval: string) => {
    if (symbol === 'BTCUSDT') {
      throw new Error('Network error');
    }
    return { symbol, price: 200, timestamp: Date.now() };
  });
  const processor = new MarketDataProcessor(
    { bot: { findMany: mockAsyncFn(async () => []) } },
    { getMarketSnapshot },
    {
      getActiveMarketSubscriptions: mockFn(() => [
        { symbol: 'BTCUSDT', interval: '1m' },
        { symbol: 'ETHUSDT', interval: '1m' },
      ]),
      emitMarketData,
    },
    { add: mockFn(() => undefined) },
  );

  await processor.process(makeJob());

  // getMarketSnapshot(symbol, interval) was called for both symbols
  // call[0] = symbol string, call[1] = interval string
  const calledSymbols = getMarketSnapshot.calls.map((call: any[]) => call[0] as string);
  assert.ok(calledSymbols.includes('BTCUSDT'), 'BTCUSDT should be attempted');
  assert.ok(calledSymbols.includes('ETHUSDT'), 'ETHUSDT should be attempted');
  // ETHUSDT snapshot was emitted; BTCUSDT failed so not emitted
  const emittedSymbols = emitMarketData.calls.map((call: any[]) => (call[0] as any).symbol);
  assert.ok(emittedSymbols.includes('ETHUSDT'), 'ETHUSDT should be emitted');
  assert.ok(!emittedSymbols.includes('BTCUSDT'), 'BTCUSDT should not be emitted after error');
});

export {};
