import { test, describe, it, beforeEach, afterEach, before, after, mock } from 'node:test';
import * as assert from 'node:assert';
const { BadRequestException } = require('@nestjs/common');

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
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const prisma: any = overrides?.prisma ? { ...defaultPrisma, ...overrides.prisma } : defaultPrisma;

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
    assertActiveBySymbol: mockAsyncFn(async (symbol) => ({
      symbol,
      supportedIntervals: ['1m'],
    })),
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

// ─── publishBot ─────────────────────────────────────────────────────────────────

test('BotsService.publishBot throws BadRequestException if bot has no strategy', async () => {
  const prisma = {
    bot: {
      findFirst: mockAsyncFn(async () => ({
        id: 'bot-1',
        name: 'My Bot',
        strategyConfig: null,
        userId: 'user-1',
      })),
    },
  };
  const { service } = makeBotsService({ prisma });

  await assert.rejects(() => service.publishBot('bot-1', 'user-1'), BadRequestException);
});

test('BotsService.publishBot sets isPublic and generates slug', async () => {
  const prisma = {
    bot: {
      findFirst: mockAsyncFn(async () => ({
        id: 'bot-1',
        name: 'BTC RSI Bot',
        strategyConfig: { strategy: 'rsi' },
        userId: 'user-1',
      })),
      update: mockAsyncFn(async (args) => ({
        id: args.where.id,
        ...args.data,
      })),
    },
  };
  const { service, prisma: p } = makeBotsService({ prisma });

  const result = await service.publishBot('bot-1', 'user-1');

  assert.equal(p.bot.findFirst.calls.length, 1);
  assert.equal(p.bot.update.calls.length, 1);
  assert.equal(p.bot.update.calls[0][0].data.isPublic, true);
  assert.ok(p.bot.update.calls[0][0].data.shareSlug);
  assert.equal(result.shareSlug.startsWith('btc-rsi-bot-'), true);
});

test('BotsService.publishBot throws NotFoundException for wrong user', async () => {
  const prisma = {
    bot: {
      findFirst: mockAsyncFn(async () => null),
    },
  };
  const { service } = makeBotsService({ prisma });

  await assert.rejects(() => service.publishBot('bot-999', 'user-1'), {
    constructor: { name: 'NotFoundException' },
  });
});

// ─── unpublishBot ────────────────────────────────────────────────────────────────

test('BotsService.unpublishBot clears isPublic and slug', async () => {
  const prisma = {
    bot: {
      findFirst: mockAsyncFn(async () => ({
        id: 'bot-1',
        name: 'BTC Bot',
        userId: 'user-1',
      })),
      update: mockAsyncFn(async (args) => ({ id: args.where.id, ...args.data })),
    },
  };
  const { service, prisma: p } = makeBotsService({ prisma });

  await service.unpublishBot('bot-1', 'user-1');

  assert.equal(p.bot.update.calls.length, 1);
  assert.equal(p.bot.update.calls[0][0].where.id, 'bot-1');
  assert.equal(p.bot.update.calls[0][0].data.isPublic, false);
  assert.equal(p.bot.update.calls[0][0].data.shareSlug, null);
});

test('BotsService.unpublishBot throws NotFoundException for wrong user', async () => {
  const prisma = {
    bot: {
      findFirst: mockAsyncFn(async () => null),
    },
  };
  const { service } = makeBotsService({ prisma });

  await assert.rejects(() => service.unpublishBot('bot-999', 'user-1'), {
    constructor: { name: 'NotFoundException' },
  });
});

// ─── cloneFromShare ─────────────────────────────────────────────────────────────

test('BotsService.cloneFromShare creates bot with strategy config', async () => {
  const prisma = {
    bot: {
      create: mockAsyncFn(async (args) => ({
        id: 'new-bot-1',
        ...args.data,
        strategyConfig: { id: 'sc-1' },
      })),
    },
  };
  const { service, prisma: p } = makeBotsService({ prisma });

  const source = {
    name: 'BTC RSI Bot',
    description: 'RSI strategy',
    symbol: 'BTCUSDT',
    strategy: 'rsi',
    params: { period: 14, oversold: 30 },
    builderConfig: null,
  };

  const result = await service.cloneFromShare(source, 'user-2');

  assert.equal(p.bot.create.calls.length, 1);
  assert.equal(result.id, 'new-bot-1');
  assert.equal(result.name, 'BTC RSI Bot');
  assert.equal(result.symbol, 'BTCUSDT');
  assert.equal(result.userId, 'user-2');
});

test('BotsService.cloneFromShare appends "(Copy)" to name when no override provided', async () => {
  const prisma = {
    bot: {
      create: mockAsyncFn(async (args) => ({ id: 'new-bot-1', ...args.data })),
    },
  };
  const { service, prisma: p } = makeBotsService({ prisma });

  await service.cloneFromShare(
    {
      name: 'Original Bot',
      description: null,
      symbol: 'ETHUSDT',
      strategy: 'rsi',
      params: {},
      builderConfig: null,
    },
    'user-2',
  );

  assert.equal(p.bot.create.calls[0][0].data.name, 'Original Bot (Copy)');
});

test('BotsService.cloneFromShare uses override name when provided', async () => {
  const prisma = {
    bot: {
      create: mockAsyncFn(async (args) => ({ id: 'new-bot-1', ...args.data })),
    },
  };
  const { service, prisma: p } = makeBotsService({ prisma });

  await service.cloneFromShare(
    {
      name: 'Original',
      description: null,
      symbol: 'ETHUSDT',
      strategy: 'rsi',
      params: {},
      builderConfig: null,
    },
    'user-2',
    'My Custom Bot',
  );

  assert.equal(p.bot.create.calls[0][0].data.name, 'My Custom Bot');
});

test('BotsService.cloneFromShare normalizes symbol to uppercase', async () => {
  const prisma = {
    bot: {
      create: mockAsyncFn(async (args) => ({ id: 'new-bot-1', ...args.data })),
    },
  };
  const { service, prisma: p } = makeBotsService({ prisma });

  await service.cloneFromShare(
    {
      name: 'Bot',
      description: null,
      symbol: 'btcusdt',
      strategy: 'rsi',
      params: {},
      builderConfig: null,
    },
    'user-2',
    undefined,
    'ethusdt',
  );

  assert.equal(p.bot.create.calls[0][0].data.symbol, 'ETHUSDT');
});

test('BotsService.cloneFromShare preserves builderConfig', async () => {
  const builderConfig = { version: 1, conditions: [], entryOperator: 'AND', risk: { quantity: 1 } };
  const prisma = {
    bot: {
      create: mockAsyncFn(async (args) => ({ id: 'new-bot-1', ...args.data })),
    },
  };
  const { service, prisma: p } = makeBotsService({ prisma });

  await service.cloneFromShare(
    {
      name: 'Bot',
      description: null,
      symbol: 'BTCUSDT',
      strategy: 'rsi',
      params: {},
      builderConfig,
    },
    'user-2',
  );

  assert.deepEqual(
    p.bot.create.calls[0][0].data.strategyConfig.create.builderConfig,
    builderConfig,
  );
});
