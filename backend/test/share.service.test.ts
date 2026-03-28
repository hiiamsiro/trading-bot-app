const test = require('node:test');
const assert = require('node:assert/strict');

const { ShareService } = require('../src/share/share.service.ts');
const { mockAsyncFn } = require('./helpers.ts');

function makeShareService(overrides?: any) {
  const prisma = overrides?.prisma ?? {
    bot: {
      findUnique: mockAsyncFn(async () => ({
        id: 'bot-1',
        name: 'My Bot',
        isPublic: false,
        shareSlug: null,
      })),
      findUniqueOrThrow: mockAsyncFn(async () => ({
        name: 'My Bot',
      })),
      update: mockAsyncFn(async (args) => ({
        id: args.where.id,
        ...args.data,
      })),
      findMany: mockAsyncFn(async () => []),
      count: mockAsyncFn(async () => 0),
    },
    $transaction: mockAsyncFn(async (args) => [0, []]),
  };

  return {
    service: new ShareService(prisma),
    prisma,
  };
}

test('ShareService.publishBot sets isPublic=true and generates a slug', async () => {
  const { service, prisma } = makeShareService();

  const result = await service.publishBot('bot-1');

  assert.equal(prisma.bot.findUniqueOrThrow.calls.length, 1);
  assert.equal(prisma.bot.findUniqueOrThrow.calls[0][0].where.id, 'bot-1');
  assert.equal(prisma.bot.update.calls.length, 1);
  assert.equal(prisma.bot.update.calls[0][0].where.id, 'bot-1');
  assert.equal(prisma.bot.update.calls[0][0].data.isPublic, true);
  assert.ok(prisma.bot.update.calls[0][0].data.shareSlug);
  assert.ok(prisma.bot.update.calls[0][0].data.shareSlug.startsWith('my-bot-'));
  assert.equal(result.shareSlug.startsWith('my-bot-'), true);
});

test('ShareService.unpublishBot sets isPublic=false and clears slug', async () => {
  const { service, prisma } = makeShareService();

  await service.unpublishBot('bot-1');

  assert.equal(prisma.bot.update.calls.length, 1);
  assert.equal(prisma.bot.update.calls[0][0].where.id, 'bot-1');
  assert.equal(prisma.bot.update.calls[0][0].data.isPublic, false);
  assert.equal(prisma.bot.update.calls[0][0].data.shareSlug, null);
});

test('ShareService.browsePublic returns paginated public bots', async () => {
  const mockBots = [
    {
      id: 'bot-1',
      name: 'BTC RSI Bot',
      description: 'RSI strategy',
      symbol: 'BTCUSDT',
      shareSlug: 'btc-rsi-bot-abc12',
      createdAt: new Date(),
      strategyConfig: { strategy: 'rsi' },
      user: { name: 'Alice' },
    },
    {
      id: 'bot-2',
      name: 'ETH MA Bot',
      description: null,
      symbol: 'ETHUSDT',
      shareSlug: 'eth-ma-bot-xyz34',
      createdAt: new Date(),
      strategyConfig: { strategy: 'sma_crossover' },
      user: { name: null },
    },
  ];

  const prisma = {
    bot: {
      findMany: mockAsyncFn(async () => mockBots),
      count: mockAsyncFn(async () => 2),
    },
    $transaction: mockAsyncFn(async () => [2, mockBots]),
  };

  const { service } = makeShareService({ prisma });

  const result = await service.browsePublic({ take: 24, skip: 0 });

  assert.equal(result.total, 2);
  assert.equal(result.items.length, 2);
  assert.equal(result.items[0].name, 'BTC RSI Bot');
  assert.equal(result.items[0].strategy, 'rsi');
  assert.equal(result.items[0].userName, 'Alice');
  assert.equal(result.items[0].shareSlug, 'btc-rsi-bot-abc12');
  assert.equal(result.items[1].userName, null);
  assert.equal(result.take, 24);
  assert.equal(result.skip, 0);
});

test('ShareService.browsePublic filters by search term', async () => {
  const prisma = {
    bot: {
      count: mockAsyncFn(async () => 0),
    },
    $transaction: mockAsyncFn(async () => [0, []]),
  };

  const { service, prisma: p } = makeShareService({ prisma });

  await service.browsePublic({ search: 'RSI', take: 10, skip: 0 });

  const txCall = p.$transaction.calls[0][0];
  const countCall = txCall[0];
  const findManyCall = txCall[1];

  assert.equal(countCall.where.OR.length, 3);
  assert.equal(findManyCall.where.OR.length, 3);
});

test('ShareService.browsePublic filters by strategy', async () => {
  const prisma = {
    bot: {
      count: mockAsyncFn(async () => 0),
    },
    $transaction: mockAsyncFn(async () => [0, []]),
  };

  const { service, prisma: p } = makeShareService({ prisma });

  await service.browsePublic({ strategy: 'rsi', take: 10, skip: 0 });

  const txCall = p.$transaction.calls[0][0];
  const findManyCall = txCall[1];
  assert.deepEqual(findManyCall.where.strategyConfig, { strategy: { equals: 'rsi' } });
});

test('ShareService.getBySlug returns bot details for public slug', async () => {
  const mockBot = {
    id: 'bot-1',
    name: 'BTC RSI Bot',
    description: 'RSI strategy for BTC',
    symbol: 'BTCUSDT',
    strategyConfig: {
      strategy: 'rsi',
      params: { period: 14, oversold: 30 },
      builderConfig: null,
    },
    user: { name: 'Alice', email: 'alice@example.com' },
  };

  const prisma = {
    bot: {
      findUnique: mockAsyncFn(async () => mockBot),
    },
  };

  const { service } = makeShareService({ prisma });

  const result = await service.getBySlug('btc-rsi-bot-abc12');

  assert.ok(result);
  assert.equal(result.name, 'BTC RSI Bot');
  assert.equal(result.strategy, 'rsi');
  assert.deepEqual(result.params, { period: 14, oversold: 30 });
  assert.equal(result.userName, 'Alice');
  assert.equal(result.userEmail, 'alice@example.com');
  assert.equal(result.builderConfig, null);
});

test('ShareService.getBySlug returns null for non-public slug', async () => {
  const prisma = {
    bot: {
      findUnique: mockAsyncFn(async () => null),
    },
  };

  const { service } = makeShareService({ prisma });

  const result = await service.getBySlug('non-existent');

  assert.equal(result, null);
});
