const test = require('node:test');
const assert = require('node:assert/strict');

const { DemoTradingService } = require('../src/demo-trading/demo-trading.service.ts');

const { mockAsyncFn, mockAsyncSequence, mockFn } = require('./helpers.ts');

function makeService(overrides?: any) {
  const prismaDefaults = {
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
    // bot.update is called to stamp lastSignalAt after every strategy evaluation
    bot: {
      update: mockAsyncFn(async (args) => ({
        id: args.where.id,
        ...args.data,
      })),
    },
  };

  // Deep-merge so partial prisma overrides preserve default trade/executionSession/bot methods
  const prisma = {
    instrument: overrides?.prisma?.instrument ?? prismaDefaults.instrument,
    trade: { ...prismaDefaults.trade, ...overrides?.prisma?.trade },
    executionSession: {
      ...prismaDefaults.executionSession,
      ...overrides?.prisma?.executionSession,
    },
    bot: { ...prismaDefaults.bot, ...overrides?.prisma?.bot },
  };

  const marketData = overrides?.marketData ?? {
    getLatestPrice: mockAsyncFn(async () => 100),
    getCloses: mockAsyncFn(async () => Array.from({ length: 50 }, (_, i) => 100 + i)),
  };

  const strategy = overrides?.strategy ?? {
    isSupportedInterval: mockFn(() => true),
    getRequiredCandles: mockFn(() => ({ entry: 50, trend: 50 })),
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
      getRequiredCandles: mockFn(() => ({ entry: 30, trend: 30 })),
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
  // Slippage adds up to 5 bps to entry price (range 200–200.1 for BUY)
  assert.ok(createArgs.data.price >= 200 && createArgs.data.price <= 200.1);
  assert.ok(createArgs.data.totalValue >= 100 && createArgs.data.totalValue <= 100.05);
  assert.equal(createArgs.data.openReason, 'strategy:signal');
  assert.ok(createArgs.data.executedAt instanceof Date);
  // stopLoss = executedEntryPrice * 0.9 → range [180, 180.09]
  assert.ok(createArgs.data.stopLoss >= 180 && createArgs.data.stopLoss <= 180.09);
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
  // Slippage reduces exit price slightly for BUY close (0–5 bps below 90)
  assert.ok(updateArgs.exitPrice >= 89.955 && updateArgs.exitPrice <= 90);
  // Gross PnL = (exitPrice − entryPrice) × quantity; entry=100, exit≈90, qty=1
  // slippageBps ∈ [0,5], exitPrice ∈ [89.955,90], grossPnl ∈ [-10.045, -10]
  assert.ok(updateArgs.realizedPnl >= -10.045 && updateArgs.realizedPnl <= -10.0005);
  assert.ok(updateArgs.closedAt instanceof Date);

  assert.equal(gateway.emitNewTrade.calls.length, 1);
  assert.equal(botsService.notifyTradeEvent.calls.length, 1);
});

// ─────────────────────────────────────────────────────────
// Additional coverage — edge cases
// ─────────────────────────────────────────────────────────

test('processTick HOLD signal → no trade created, no DB write', async () => {
  const { service, prisma, strategy } = makeService({
    strategy: {
      isSupportedInterval: mockFn(() => true),
      getRequiredCandles: mockFn(() => ({ entry: 2, trend: 2 })),
      evaluate: mockFn(() => ({ signal: 'HOLD', reason: 'No SMA crossover', metadata: {} })),
    },
    marketData: {
      getLatestPrice: mockAsyncFn(async () => 100),
      getCloses: mockAsyncFn(async () => [100, 105]),
    },
  });

  const bot = {
    id: 'bot-1',
    userId: 'user-1',
    symbol: 'BTCUSDT',
    status: 'RUNNING',
    strategyConfig: {
      strategy: 'sma_crossover',
      params: { shortPeriod: 5, longPeriod: 10, quantity: 0.1 },
    },
    executionSession: { botId: 'bot-1' },
  };

  await service.processTick(bot);

  assert.equal(strategy.evaluate.calls.length, 1);
  assert.equal(prisma.trade.create.calls.length, 0);
  assert.equal(prisma.trade.update.calls.length, 0);
});

test('processTick with existing open position skips openLong, still evaluates SL/TP', async () => {
  const openTrade = {
    id: 'trade-1',
    botId: 'bot-1',
    symbol: 'BTCUSDT',
    side: 'BUY',
    quantity: 1,
    price: 100,
    status: 'EXECUTED',
    closedAt: null,
    stopLoss: 90,
    takeProfit: null,
  };

  const { service, prisma, marketData, strategy } = makeService({
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
        findFirst: mockAsyncFn(async () => openTrade),
        create: mockAsyncFn(async (args) => ({ id: 'trade-new', ...args.data })),
        update: mockAsyncFn(async (args) => ({ ...openTrade, ...args.data })),
      },
      executionSession: {
        updateMany: mockAsyncFn(async () => ({ count: 1 })),
        findUnique: mockAsyncFn(async () => ({ profitLoss: 0, endedAt: null })),
      },
    },
    marketData: {
      getLatestPrice: mockAsyncFn(async () => 95), // price between SL and entry
      getCloses: mockAsyncFn(async () => [100, 105]),
    },
    strategy: {
      isSupportedInterval: mockFn(() => true),
      getRequiredCandles: mockFn(() => ({ entry: 2, trend: 2 })),
      evaluate: mockFn(() => ({ signal: 'BUY', reason: 'fake', metadata: {} })),
    },
  });

  const bot = {
    id: 'bot-1',
    userId: 'user-1',
    symbol: 'BTCUSDT',
    status: 'RUNNING',
    strategyConfig: { strategy: 'sma_crossover', params: { quantity: 0.5 } },
    executionSession: { botId: 'bot-1' },
  };

  await service.processTick(bot);

  // SL not hit (95 > 90), TP not hit — no trade update
  assert.equal(prisma.trade.update.calls.length, 0);
  // BUY signal blocked because open position exists
  assert.equal(prisma.trade.create.calls.length, 0);
});

test('processTick TAKE_PROFIT closes trade correctly', async () => {
  const openTrade = {
    id: 'trade-1',
    botId: 'bot-1',
    symbol: 'BTCUSDT',
    side: 'BUY',
    quantity: 1,
    price: 100,
    status: 'EXECUTED',
    closedAt: null,
    stopLoss: 90,
    takeProfit: 120,
    entryFee: 0.1,
    slippageBps: 0,
  };

  const { service, prisma, marketData } = makeService({
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
        findFirst: mockAsyncFn(async () => openTrade),
        update: mockAsyncFn(async (args) => ({ ...openTrade, ...args.data })),
      },
      executionSession: {
        updateMany: mockAsyncFn(async () => ({ count: 1 })),
        findUnique: mockAsyncFn(async () => ({ profitLoss: 0, endedAt: null })),
      },
    },
    marketData: {
      getLatestPrice: mockAsyncFn(async () => 125), // above TP
      getCloses: mockAsyncFn(async () => []),
    },
    strategy: {
      isSupportedInterval: mockFn(() => true),
      getRequiredCandles: mockFn(() => ({ entry: 2, trend: 2 })),
      evaluate: mockFn(() => ({ signal: 'HOLD', reason: 'none', metadata: {} })),
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

  assert.equal(prisma.trade.update.calls.length, 1);
  assert.equal(prisma.trade.update.calls[0][0].data.closeReason, 'risk:take_profit');
  assert.equal(prisma.trade.update.calls[0][0].data.status, 'CLOSED');
});

test('processTick SELL signal closes BUY position', async () => {
  const openTrade = {
    id: 'trade-1',
    botId: 'bot-1',
    symbol: 'BTCUSDT',
    side: 'BUY',
    quantity: 1,
    price: 100,
    status: 'EXECUTED',
    closedAt: null,
    stopLoss: null,
    takeProfit: null,
    entryFee: 0.1,
    slippageBps: 0,
  };

  const { service, prisma, marketData, strategy, gateway } = makeService({
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
        update: mockAsyncFn(async (args) => ({ ...openTrade, ...args.data })),
      },
      executionSession: {
        updateMany: mockAsyncFn(async () => ({ count: 1 })),
        findUnique: mockAsyncFn(async () => ({ profitLoss: 0, endedAt: null })),
      },
    },
    marketData: {
      getLatestPrice: mockAsyncFn(async () => 110),
      getCloses: mockAsyncFn(async () => [100, 105]),
    },
    strategy: {
      isSupportedInterval: mockFn(() => true),
      getRequiredCandles: mockFn(() => ({ entry: 2, trend: 2 })),
      evaluate: mockFn(() => ({
        signal: 'SELL',
        reason: 'MA crossover bearish',
        metadata: {},
      })),
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

  assert.equal(prisma.trade.update.calls.length, 1);
  const updateArgs = prisma.trade.update.calls[0][0].data;
  assert.equal(updateArgs.status, 'CLOSED');
  assert.match(updateArgs.closeReason, /^strategy:/);
  assert.equal(gateway.emitNewTrade.calls.length, 1);
});

test('processTick quantity defaults to 0.01 when not provided', async () => {
  const { service, prisma, strategy } = makeService({
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
      getRequiredCandles: mockFn(() => ({ entry: 30, trend: 30 })),
      evaluate: mockFn(() => ({ signal: 'BUY', reason: 'test', metadata: {} })),
    },
  });

  const bot = {
    id: 'bot-1',
    userId: 'user-1',
    symbol: 'BTCUSDT',
    status: 'RUNNING',
    // quantity NOT provided in params
    strategyConfig: { strategy: 'sma_crossover', params: { shortPeriod: 5, longPeriod: 10 } },
    executionSession: { botId: 'bot-1' },
  };

  await service.processTick(bot);

  const createArgs = prisma.trade.create.calls[0][0];
  assert.equal(createArgs.data.quantity, 0.01);
});

test('processTick skips when live price is unavailable', async () => {
  const { service, marketData, strategy, prisma } = makeService({
    marketData: {
      getLatestPrice: mockAsyncFn(async () => null),
      getCloses: mockAsyncFn(async () => []),
    },
    strategy: {
      isSupportedInterval: mockFn(() => true),
      getRequiredCandles: mockFn(() => ({ entry: 2, trend: 2 })),
      evaluate: mockFn(() => ({ signal: 'BUY', reason: 'x', metadata: {} })),
    },
  });

  const bot = {
    id: 'bot-1',
    userId: 'user-1',
    symbol: 'BTCUSDT',
    status: 'RUNNING',
    strategyConfig: { strategy: 'sma_crossover', params: { quantity: 0.1 } },
    executionSession: { botId: 'bot-1' },
  };

  await service.processTick(bot);

  assert.equal(marketData.getLatestPrice.calls.length, 1);
  assert.equal(strategy.evaluate.calls.length, 0);
  assert.equal(prisma.trade.create.calls.length, 0);
});

test('processTick skips when instrument is inactive', async () => {
  const { service, prisma } = makeService({
    prisma: {
      instrument: {
        findUnique: mockAsyncFn(async () => null),
      },
      trade: {
        findFirst: mockAsyncFn(async () => null),
        create: mockAsyncFn(async () => ({})),
        update: mockAsyncFn(async () => ({})),
      },
      executionSession: {
        updateMany: mockAsyncFn(async () => ({ count: 1 })),
        findUnique: mockAsyncFn(async () => ({ profitLoss: 0, endedAt: null })),
      },
    },
    marketData: {
      getLatestPrice: mockAsyncFn(async () => 100),
      getCloses: mockAsyncFn(async () => [100, 105]),
    },
    strategy: {
      isSupportedInterval: mockFn(() => true),
      getRequiredCandles: mockFn(() => ({ entry: 2, trend: 2 })),
      evaluate: mockFn(() => ({ signal: 'BUY', reason: 'x', metadata: {} })),
    },
  });

  const bot = {
    id: 'bot-1',
    userId: 'user-1',
    symbol: 'BTCUSDT',
    status: 'RUNNING',
    strategyConfig: { strategy: 'sma_crossover', params: { quantity: 0.1 } },
    executionSession: { botId: 'bot-1' },
  };

  await service.processTick(bot);

  assert.equal(prisma.trade.create.calls.length, 0);
});

test('processTick enforceMaxDailyLoss closes position and stops bot when limit exceeded', async () => {
  const openTrade = {
    id: 'trade-1',
    botId: 'bot-1',
    symbol: 'BTCUSDT',
    side: 'BUY',
    quantity: 1,
    price: 100,
    status: 'EXECUTED',
    closedAt: null,
    stopLoss: null,
    takeProfit: null,
    entryFee: 0.1,
    slippageBps: 0,
  };

  const { service, prisma, marketData, strategy, botsService } = makeService({
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
        findFirst: mockAsyncFn(async () => openTrade),
        update: mockAsyncFn(async (args) => ({ ...openTrade, ...args.data })),
      },
      executionSession: {
        updateMany: mockAsyncFn(async () => ({ count: 1 })),
        // profitLoss = -100, exceeds maxDailyLoss = 50
        findUnique: mockAsyncFn(async () => ({ profitLoss: -100, endedAt: null })),
      },
    },
    marketData: {
      getLatestPrice: mockAsyncFn(async () => 95),
      getCloses: mockAsyncFn(async () => [100, 105]),
    },
    strategy: {
      isSupportedInterval: mockFn(() => true),
      getRequiredCandles: mockFn(() => ({ entry: 2, trend: 2 })),
      evaluate: mockFn(() => ({ signal: 'HOLD', reason: 'none', metadata: {} })),
    },
  });

  const bot = {
    id: 'bot-1',
    userId: 'user-1',
    symbol: 'BTCUSDT',
    status: 'RUNNING',
    strategyConfig: {
      strategy: 'sma_crossover',
      params: { quantity: 1, maxDailyLoss: 50 },
    },
    executionSession: { botId: 'bot-1' },
  };

  await service.processTick(bot);

  // Trade was closed due to max daily loss
  assert.equal(prisma.trade.update.calls.length, 1);
  assert.equal(prisma.trade.update.calls[0][0].data.closeReason, 'risk:max_daily_loss');

  // Bot was stopped
  assert.equal(botsService.stop.calls.length, 1);
  assert.equal(botsService.stop.calls[0][0], 'bot-1');
  assert.equal(botsService.stop.calls[0][1], 'user-1');
});

export {};
