const test = require('node:test');
const assert = require('node:assert/strict');
const { BadRequestException, NotFoundException } = require('@nestjs/common');

const { BotsService } = require('../src/bots/bots.service.ts');

const { mockAsyncFn, mockFn } = require('./helpers.ts');

function makeBotsService(overrides?: any) {
  const defaultPrisma = {
    bot: {
      findMany: mockAsyncFn(async () => []),
      findFirst: mockAsyncFn(async () => null),
      create: mockAsyncFn(async (args) => ({ id: 'bot-1', ...args.data, strategyConfig: null })),
      update: mockAsyncFn(async (args) => ({ id: args.where.id, ...args.data })),
      delete: mockAsyncFn(async () => ({ id: 'deleted' })),
      findUnique: mockAsyncFn(async () => ({ userId: 'user-1' })),
    },
    executionSession: {
      upsert: mockAsyncFn(async () => ({})),
      updateMany: mockAsyncFn(async () => ({ count: 1 })),
    },
    trade: {
      findFirst: mockAsyncFn(async () => null),
      update: mockAsyncFn(async (args) => ({ id: args.where.id, ...args.data })),
    },
    botLog: {
      create: mockAsyncFn(async (args) => ({
        id: 'log-1',
        botId: args.data.botId,
        level: args.data.level,
        category: args.data.category,
        message: args.data.message,
        metadata: args.data.metadata ?? null,
        createdAt: new Date(),
      })),
      count: mockAsyncFn(async () => 0),
      findMany: mockAsyncFn(async () => []),
    },
    notification: {
      create: mockAsyncFn(async (args) => ({
        id: 'n1',
        userId: args?.data?.userId ?? 'user-1',
        botId: args?.data?.botId ?? null,
        tradeId: null,
        type: args?.data?.type ?? 'BOT_STARTED',
        title: args?.data?.title ?? '',
        message: args?.data?.message ?? '',
        metadata: null,
        isRead: false,
        readAt: null,
        createdAt: new Date(),
      })),
    },
  };
  // Always include notification mock so NotificationsService (which uses prisma.notification.create)
  // never gets undefined
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const prisma: any = overrides?.prisma
    ? ({ ...defaultPrisma, ...overrides.prisma })
    : defaultPrisma;

  const marketData = overrides?.marketData ?? {
    getLatestPrice: mockAsyncFn(async () => null),
  };
  const marketGateway = overrides?.marketGateway ?? {
    emitBotStatus: mockFn(() => undefined),
    emitBotLog: mockFn(() => undefined),
    emitNewTrade: mockFn(() => undefined),
    emitNotification: mockFn(() => undefined),
  };
  const instrumentsService = overrides?.instrumentsService ?? {
    assertActiveBySymbol: mockAsyncFn(async (symbol) => ({ symbol, supportedIntervals: ['1m'] })),
  };
  const strategyService = overrides?.strategyService ?? {
    validateConfig: mockFn((strategy, params) => ({
      normalizedStrategy: strategy,
      normalizedParams: params,
    })),
    isSupportedInterval: mockFn(() => true),
  };
  const notificationsService = overrides?.notificationsService ?? {
    create: mockAsyncFn(async (input) => ({
      id: 'notif-1',
      userId: input.userId,
      botId: input.botId ?? null,
      tradeId: input.tradeId ?? null,
      type: input.type,
      title: input.title,
      message: input.message,
      metadata: input.metadata ?? null,
      isRead: false,
      readAt: null,
      createdAt: new Date(),
    })),
  };

  return {
    service: new BotsService(
      prisma,
      marketData,
      marketGateway,
      instrumentsService,
      strategyService,
      notificationsService,
    ),
    prisma,
    marketData,
    marketGateway,
    instrumentsService,
    strategyService,
    notificationsService,
  };
}

test('BotsService.create normalizes symbol and validates active instrument', async () => {
  const { service, prisma, instrumentsService } = makeBotsService();

  const created = await service.create(
    {
      name: 'My Bot',
      description: 'desc',
      symbol: ' btcusdt ',
      strategyConfig: {
        strategy: 'sma_crossover',
        params: { shortPeriod: 5, longPeriod: 10 },
      },
    },
    'user-1',
  );

  assert.equal(instrumentsService.assertActiveBySymbol.calls.length, 1);
  assert.equal(instrumentsService.assertActiveBySymbol.calls[0][0], 'BTCUSDT');
  assert.equal(prisma.bot.create.calls.length, 1);
  assert.equal(prisma.bot.create.calls[0][0].data.symbol, 'BTCUSDT');
  assert.equal(created.userId, 'user-1');
});

test('BotsService.update validates new symbol when provided', async () => {
  const instrumentsService = {
    assertActiveBySymbol: mockAsyncFn(async () => ({
      symbol: 'ETHUSDT',
      supportedIntervals: ['1m'],
    })),
  };
  const { service, prisma } = makeBotsService({
    instrumentsService,
    prisma: {
      bot: {
        findFirst: mockAsyncFn(async () => ({
          id: 'bot-1',
          userId: 'user-1',
          symbol: 'BTCUSDT',
          status: 'STOPPED',
          strategyConfig: null,
          executionSession: null,
        })),
        update: mockAsyncFn(async (args) => ({ id: 'bot-1', userId: 'user-1', ...args.data })),
      },
    },
  });

  const result = await service.update(
    'bot-1',
    { symbol: ' ethusdt ', name: 'new', description: 'd' },
    'user-1',
  );

  assert.equal(instrumentsService.assertActiveBySymbol.calls.length, 1);
  assert.equal(instrumentsService.assertActiveBySymbol.calls[0][0], 'ETHUSDT');
  assert.equal(prisma.bot.update.calls.length, 1);
  assert.equal(prisma.bot.update.calls[0][0].data.symbol, 'ETHUSDT');
  assert.equal(result.symbol, 'ETHUSDT');
});

test('BotsService.findOne throws NotFound when bot does not belong to user', async () => {
  const { service, prisma } = makeBotsService({
    prisma: {
      bot: {
        findFirst: mockAsyncFn(async () => null),
      },
    },
  });

  await assert.rejects(
    () => service.findOne('bot-1', 'user-1'),
    (err) => {
      assert.ok(err instanceof NotFoundException);
      assert.equal(err.message, 'Bot not found');
      return true;
    },
  );

  assert.equal(prisma.bot.findFirst.calls.length, 1);
});

test('BotsService.start requires strategy config and non-running status', async () => {
  const { service } = makeBotsService({
    prisma: {
      bot: {
        findFirst: mockAsyncFn(async () => ({
          id: 'bot-1',
          userId: 'user-1',
          symbol: 'BTCUSDT',
          status: 'STOPPED',
          strategyConfig: null,
          executionSession: null,
        })),
        update: mockAsyncFn(async () => ({})),
      },
      executionSession: { upsert: mockAsyncFn(async () => ({})) },
      trade: { findFirst: mockAsyncFn(async () => null) },
      botLog: { create: mockAsyncFn(async () => ({})) },
    },
  });

  await assert.rejects(
    () => service.start('bot-1', 'user-1'),
    (err) => {
      assert.ok(err instanceof BadRequestException);
      assert.equal(err.message, 'Configure a strategy before starting the bot');
      return true;
    },
  );
});

test('BotsService.start upserts executionSession and sets bot status RUNNING', async () => {
  const { service, prisma, marketGateway } = makeBotsService({
    prisma: {
      bot: {
        findFirst: mockAsyncFn(async () => ({
          id: 'bot-1',
          userId: 'user-1',
          symbol: 'BTCUSDT',
          status: 'STOPPED',
          strategyConfig: { strategy: 'sma_crossover', params: { initialBalance: 5000 } },
          executionSession: null,
        })),
        update: mockAsyncFn(async (args) => ({
          id: 'bot-1',
          userId: 'user-1',
          symbol: 'BTCUSDT',
          status: args.data.status,
          strategyConfig: { strategy: 'sma_crossover', params: { initialBalance: 5000 } },
          executionSession: { botId: 'bot-1' },
        })),
        findUnique: mockAsyncFn(async () => ({ userId: 'user-1' })),
      },
      executionSession: {
        upsert: mockAsyncFn(async () => ({})),
      },
      trade: { findFirst: mockAsyncFn(async () => null) },
      botLog: { create: mockAsyncFn(async () => ({ id: 'log-1', createdAt: new Date() })) },
      notification: {
        create: mockAsyncFn(async () => ({ id: 'n1', userId: 'user-1', createdAt: new Date() })),
      },
    },
  });

  const result = await service.start('bot-1', 'user-1');

  assert.equal(prisma.executionSession.upsert.calls.length, 1);
  const upsertArgs = prisma.executionSession.upsert.calls[0][0];
  assert.equal(upsertArgs.where.botId, 'bot-1');
  assert.equal(upsertArgs.create.initialBalance, 5000);
  assert.equal(upsertArgs.update.initialBalance, 5000);

  assert.equal(prisma.bot.update.calls.length, 1);
  assert.equal(prisma.bot.update.calls[0][0].data.status, 'RUNNING');
  assert.equal(result.status, 'RUNNING');
  assert.equal(marketGateway.emitBotStatus.calls.length, 1);
});

test('BotsService.stop closes open trade when live price is available', async () => {
  const now = new Date();
  const openTrade = {
    id: 'trade-1',
    botId: 'bot-1',
    price: 100,
    quantity: 2,
    status: 'EXECUTED',
    closedAt: null,
  };

  const { service, prisma, marketData, marketGateway } = makeBotsService({
    prisma: {
      bot: {
        findFirst: mockAsyncFn(async () => ({
          id: 'bot-1',
          userId: 'user-1',
          symbol: 'BTCUSDT',
          status: 'RUNNING',
          strategyConfig: { strategy: 'sma_crossover', params: {} },
          executionSession: null,
        })),
        update: mockAsyncFn(async (args) => ({
          id: 'bot-1',
          userId: 'user-1',
          symbol: 'BTCUSDT',
          status: args.data.status,
          strategyConfig: null,
          executionSession: null,
        })),
        findUnique: mockAsyncFn(async () => ({ userId: 'user-1' })),
      },
      trade: {
        findFirst: mockAsyncFn(async () => openTrade),
        update: mockAsyncFn(async (args) => ({ ...openTrade, ...args.data })),
      },
      executionSession: {
        updateMany: mockAsyncFn(async () => ({ count: 1 })),
      },
      botLog: { create: mockAsyncFn(async () => ({ id: 'log-1', createdAt: now })) },
      notification: {
        create: mockAsyncFn(async () => ({ id: 'n1', userId: 'user-1', createdAt: new Date() })),
      },
    },
    marketData: {
      getLatestPrice: mockAsyncFn(async () => 120),
    },
  });

  const result = await service.stop('bot-1', 'user-1');

  assert.equal(marketData.getLatestPrice.calls.length, 1);
  assert.equal(prisma.trade.update.calls.length, 1);
  const tradeUpdateData = prisma.trade.update.calls[0][0].data;
  assert.equal(tradeUpdateData.status, 'CLOSED');
  assert.equal(tradeUpdateData.closeReason, 'bot_stopped');
  // Slippage reduces exit price slightly for BUY close (0–5 bps below 120)
  assert.ok(tradeUpdateData.exitPrice >= 119.94 && tradeUpdateData.exitPrice <= 120);
  // PnL = (exitPrice − entryPrice) × quantity = (≈120 − 100) × 2 = ≈40
  assert.ok(tradeUpdateData.realizedPnl >= 39.88 && tradeUpdateData.realizedPnl <= 40);
  assert.ok(tradeUpdateData.closedAt instanceof Date);

  assert.equal(marketGateway.emitNewTrade.calls.length, 1);
  assert.equal(result.status, 'STOPPED');
});

test('BotsService.stop throws when bot is not running', async () => {
  const { service } = makeBotsService({
    prisma: {
      bot: {
        findFirst: mockAsyncFn(async () => ({
          id: 'bot-1',
          userId: 'user-1',
          symbol: 'BTCUSDT',
          status: 'STOPPED',
          strategyConfig: { strategy: 'sma_crossover', params: {} },
          executionSession: null,
        })),
      },
    },
  });

  await assert.rejects(
    () => service.stop('bot-1', 'user-1'),
    (err) => {
      assert.ok(err instanceof BadRequestException);
      assert.equal(err.message, 'Bot is not running');
      return true;
    },
  );
});

test('BotsService.findLogs applies filters safely', async () => {
  const { service, prisma } = makeBotsService({
    prisma: {
      bot: { findFirst: mockAsyncFn(async () => ({ id: 'bot-1', userId: 'user-1' })) },
      botLog: {
        count: mockAsyncFn(async () => 1),
        findMany: mockAsyncFn(async () => [{ id: 'log-1' }]),
      },
      $transaction: mockAsyncFn(async (queries) => Promise.all(queries.map((q) => q))),
    },
  });

  const result = await service.findLogs('bot-1', 'user-1', {
    take: 10,
    skip: 0,
    level: 'INFO',
    category: ' trade ',
    search: ' opened ',
  });

  assert.equal(result.total, 1);
  assert.equal(result.items.length, 1);
  assert.equal(prisma.$transaction.calls.length, 1);
});

export {};
