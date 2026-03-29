const test = require('node:test');
const assert = require('node:assert/strict');

const { BotExecutionProcessor } = require('../src/jobs/bot-execution.processor.ts');

const { mockAsyncFn, mockFn } = require('./helpers.ts');

function makeJob(data) {
  return { data };
}

function makeProcessor(overrides: Record<string, any> = {}) {
  const prisma = overrides.prisma ?? {
    bot: {
      findUnique: mockAsyncFn(async () => null),
      update: mockAsyncFn(async (args) => ({
        id: args.where.id,
        userId: 'user-1',
        symbol: 'BTCUSDT',
        status: args.data.status ?? 'RUNNING',
      })),
    },
  };
  const demoTrading = overrides.demoTrading ?? {
    processTick: mockAsyncFn(async () => undefined),
  };
  // BotsService delegates appendLog to notificationsService — mock at BotsService level
  const botsService = overrides.botsService ?? {
    appendLog: mockAsyncFn(async () => {
      throw new Error('BotsService.appendLog not mocked');
    }),
    notifyBotEvent: mockAsyncFn(async () => {
      throw new Error('BotsService.notifyBotEvent not mocked');
    }),
  };
  const marketGateway = overrides.marketGateway ?? {
    emitBotStatus: mockFn(() => undefined),
  };

  const processor = new BotExecutionProcessor(prisma, demoTrading, botsService, marketGateway);
  return { processor, prisma, demoTrading, botsService, marketGateway };
}

test('process early-returns when bot is null', async () => {
  const { processor, prisma, demoTrading } = makeProcessor({
    prisma: {
      bot: {
        findUnique: mockAsyncFn(async () => null),
      },
    },
  });

  await processor.process(makeJob({ botId: 'bot-1' }));

  assert.equal(prisma.bot.findUnique.calls.length, 1);
  assert.equal(prisma.bot.findUnique.calls[0][0].where.id, 'bot-1');
  assert.equal(demoTrading.processTick.calls.length, 0);
});

test('process early-returns when bot status is STOPPED', async () => {
  const { processor, prisma, demoTrading } = makeProcessor({
    prisma: {
      bot: {
        findUnique: mockAsyncFn(async () => ({
          id: 'bot-1',
          userId: 'user-1',
          symbol: 'BTCUSDT',
          status: 'STOPPED',
          strategyConfig: null,
          executionSession: null,
        })),
      },
    },
  });

  await processor.process(makeJob({ botId: 'bot-1' }));

  assert.equal(demoTrading.processTick.calls.length, 0);
});

test('process calls processTick with full bot object when RUNNING and stamps lastRunAt', async () => {
  const bot = {
    id: 'bot-1',
    userId: 'user-1',
    symbol: 'BTCUSDT',
    status: 'RUNNING',
    strategyConfig: { strategy: 'sma_crossover', params: {} },
    executionSession: { botId: 'bot-1' },
  };
  const { processor, prisma, demoTrading } = makeProcessor({
    prisma: {
      bot: {
        findUnique: mockAsyncFn(async () => bot),
        update: mockAsyncFn(async () => undefined),
      },
    },
  });

  await processor.process(makeJob({ botId: 'bot-1' }));

  assert.equal(prisma.bot.findUnique.calls.length, 1);
  assert.equal(demoTrading.processTick.calls.length, 1);
  assert.equal(demoTrading.processTick.calls[0][0], bot);
  // lastRunAt is stamped after successful tick
  assert.equal(prisma.bot.update.calls.length, 1);
  assert.ok(prisma.bot.update.calls[0][0].data.lastRunAt instanceof Date);
});

test('process on error: sets status ERROR, appends log, emits bot status, fires notification', async () => {
  const bot = {
    id: 'bot-1',
    userId: 'user-1',
    symbol: 'BTCUSDT',
    status: 'RUNNING',
    strategyConfig: null,
    executionSession: null,
  };
  const { processor, prisma, demoTrading, botsService, marketGateway } = makeProcessor({
    prisma: {
      bot: {
        findUnique: mockAsyncFn(async () => bot),
        update: mockAsyncFn(async (args) => ({
          ...bot,
          ...args.data,
          id: args.where.id,
        })),
      },
    },
    demoTrading: {
      processTick: mockAsyncFn(async () => {
        throw new Error('Market data unavailable');
      }),
    },
    botsService: {
      appendLog: mockAsyncFn(async () => undefined),
      notifyBotEvent: mockAsyncFn(async () => undefined),
    },
  });

  await processor.process(makeJob({ botId: 'bot-1' }));

  // Status updated to ERROR
  assert.equal(prisma.bot.update.calls.length, 1);
  assert.equal(prisma.bot.update.calls[0][0].data.status, 'ERROR');

  // Log appended
  assert.equal(botsService.appendLog.calls.length, 1);
  assert.equal(botsService.appendLog.calls[0][0], 'bot-1');

  // WebSocket event emitted
  assert.equal(marketGateway.emitBotStatus.calls.length, 1);

  // Notification fired
  assert.equal(botsService.notifyBotEvent.calls.length, 1);
});

test('process calls prisma.update when demoTrading throws (error recovery flow)', async () => {
  const bot = {
    id: 'bot-1',
    userId: 'user-1',
    symbol: 'BTCUSDT',
    status: 'RUNNING',
    strategyConfig: null,
    executionSession: null,
  };
  const { processor, prisma, botsService, marketGateway } = makeProcessor({
    prisma: {
      bot: {
        findUnique: mockAsyncFn(async () => bot),
        update: mockAsyncFn(async (args) => ({ ...bot, ...args.data })),
      },
    },
    demoTrading: {
      processTick: mockAsyncFn(async () => {
        throw new Error('Downstream service error');
      }),
    },
    botsService: {
      appendLog: mockAsyncFn(async () => undefined),
      notifyBotEvent: mockAsyncFn(async () => undefined),
    },
  });

  await processor.process(makeJob({ botId: 'bot-1' }));

  // Error handling ran: bot status updated to ERROR
  assert.equal(prisma.bot.update.calls.length, 1);
  assert.equal(prisma.bot.update.calls[0][0].data.status, 'ERROR');
  // Log + notification + WS event all triggered
  assert.equal(botsService.appendLog.calls.length, 1);
  assert.equal(marketGateway.emitBotStatus.calls.length, 1);
  assert.equal(botsService.notifyBotEvent.calls.length, 1);
});

export {};
