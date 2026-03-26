const test = require('node:test');
const assert = require('node:assert/strict');

const { DemoTradingService } = require('../src/demo-trading/demo-trading.service.ts');

const { mockAsyncFn, mockAsyncSequence, mockFn } = require('./helpers.ts');

function makeService(overrides?: any) {
  const prisma = overrides?.prisma ?? {
    instrument: {
      findUnique: mockAsyncFn(async () => ({
        symbol: 'BTCUSDT',
        isActive: true,
        status: 'ACTIVE',
        supportedIntervals: ['1m'],
      })),
    },
    trade: {
      findFirst: mockAsyncFn(async () => null),
      create: mockAsyncFn(async (args) => ({
        id: 'trade-1',
        ...args.data,
      })),
      update: mockAsyncFn(async (args) => ({
        id: args.where.id,
        ...args.data,
      })),
    },
    executionSession: {
      updateMany: mockAsyncFn(async () => ({ count: 1 })),
      findUnique: mockAsyncFn(async () => ({ profitLoss: 0, endedAt: null })),
    },
  };

  const marketData = overrides?.marketData ?? {
    getLatestPrice: mockAsyncFn(async () => 100),
    getCloses: mockAsyncFn(async () => Array.from({ length: 50 }, (_, i) => 100 + i)),
  };

  const strategy = overrides?.strategy ?? {
    isSupportedInterval: mockFn(() => true),
    getRequiredCandles: mockFn(() => 50),
    evaluate: mockFn(() => ({ signal: 'HOLD', reason: 'none', metadata: {} })),
  };

  const gateway = overrides?.gateway ?? {
    emitNewTrade: mockFn(() => undefined),
  };

  const botsService = overrides?.botsService ?? {
    appendLog: mockAsyncFn(async () => ({})),
    notifyTradeEvent: mockAsyncFn(async () => ({})),
    stop: mockAsyncFn(async () => ({})),
  };

  return {
    service: new DemoTradingService(prisma, marketData, strategy, gateway, botsService),
    prisma,
    marketData,
    strategy,
    gateway,
    botsService,
  };
}

test('DemoTradingService.processTick opens a trade on BUY signal', async () => {
  const { service, prisma, marketData, strategy, gateway, botsService } = makeService({
    prisma: {
      instrument: {
        findUnique: mockAsyncFn(async () => ({
          symbol: 'BTCUSDT',
          isActive: true,
          status: 'ACTIVE',
          supportedIntervals: ['1m'],
        })),
      },
      trade: {
        // 1) openTrade check in processTick -> null
        // 2) existingOpenTrade check in openLong -> null
        findFirst: mockAsyncSequence([null, null]),
        create: mockAsyncFn(async (args) => ({ id: 'trade-1', ...args.data })),
        update: mockAsyncFn(async () => ({})),
      },
      executionSession: {
        updateMany: mockAsyncFn(async () => ({ count: 1 })),
        findUnique: mockAsyncFn(async () => ({ profitLoss: 0, endedAt: null })),
      },
    },
    marketData: {
      getLatestPrice: mockAsyncFn(async () => 200),
      getCloses: mockAsyncFn(async () => Array.from({ length: 30 }, () => 200)),
    },
    strategy: {
      isSupportedInterval: mockFn(() => true),
      getRequiredCandles: mockFn(() => 30),
      evaluate: mockFn(() => ({ signal: 'BUY', reason: 'signal', metadata: { foo: 'bar' } })),
    },
  });

  const bot = {
    id: 'bot-1',
    userId: 'user-1',
    symbol: 'BTCUSDT',
    status: 'RUNNING',
    strategyConfig: { strategy: 'sma_crossover', params: { quantity: 0.5, stopLossPercent: 10 } },
    executionSession: { botId: 'bot-1' },
  };

  await service.processTick(bot);

  assert.equal(marketData.getLatestPrice.calls.length, 1);
  assert.equal(strategy.evaluate.calls.length, 1);
  assert.equal(prisma.trade.create.calls.length, 1);

  const createArgs = prisma.trade.create.calls[0][0];
  assert.equal(createArgs.data.botId, 'bot-1');
  assert.equal(createArgs.data.symbol, 'BTCUSDT');
  assert.equal(createArgs.data.quantity, 0.5);
  assert.equal(createArgs.data.price, 200);
  assert.equal(createArgs.data.totalValue, 100);
  assert.equal(createArgs.data.openReason, 'strategy:signal');
  assert.ok(createArgs.data.executedAt instanceof Date);
  assert.equal(createArgs.data.stopLoss, 180);
  assert.equal(createArgs.data.takeProfit, null);

  assert.equal(gateway.emitNewTrade.calls.length, 1);
  assert.equal(botsService.notifyTradeEvent.calls.length, 1);
});

test('DemoTradingService.processTick closes a trade when stopLoss is hit', async () => {
  const openTrade = {
    id: 'trade-1',
    botId: 'bot-1',
    symbol: 'BTCUSDT',
    side: 'BUY',
    quantity: 1,
    price: 100,
    status: 'EXECUTED',
    closedAt: null,
    stopLoss: 95,
    takeProfit: null,
  };

  const { service, prisma, marketData, gateway, botsService } = makeService({
    prisma: {
      instrument: {
        findUnique: mockAsyncFn(async () => ({
          symbol: 'BTCUSDT',
          isActive: true,
          status: 'ACTIVE',
          supportedIntervals: ['1m'],
        })),
      },
      trade: {
        // openTrade check in processTick -> openTrade
        findFirst: mockAsyncFn(async () => openTrade),
        create: mockAsyncFn(async () => ({})),
        update: mockAsyncFn(async (args) => ({ ...openTrade, ...args.data })),
      },
      executionSession: {
        updateMany: mockAsyncFn(async () => ({ count: 1 })),
        findUnique: mockAsyncFn(async () => ({ profitLoss: 0, endedAt: null })),
      },
    },
    marketData: {
      getLatestPrice: mockAsyncFn(async () => 90),
      getCloses: mockAsyncFn(async () => []),
    },
  });

  const bot = {
    id: 'bot-1',
    userId: 'user-1',
    symbol: 'BTCUSDT',
    status: 'RUNNING',
    strategyConfig: { strategy: 'sma_crossover', params: {} },
    executionSession: { botId: 'bot-1' },
  };

  await service.processTick(bot);

  assert.equal(marketData.getLatestPrice.calls.length, 1);
  assert.equal(prisma.trade.update.calls.length, 1);
  const updateArgs = prisma.trade.update.calls[0][0].data;
  assert.equal(updateArgs.status, 'CLOSED');
  assert.equal(updateArgs.closeReason, 'risk:stop_loss');
  assert.equal(updateArgs.exitPrice, 90);
  assert.equal(updateArgs.realizedPnl, -10);
  assert.ok(updateArgs.closedAt instanceof Date);

  assert.equal(gateway.emitNewTrade.calls.length, 1);
  assert.equal(botsService.notifyTradeEvent.calls.length, 1);
});

export {};
