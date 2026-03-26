import {
  PrismaClient,
  Prisma,
  LogLevel,
  TradeSide,
  TradeStatus,
  BotStatus,
  InstrumentAssetClass,
  InstrumentMarketType,
  InstrumentStatus,
  NotificationType,
} from '@prisma/client';
import { randomUUID } from 'crypto';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

const DEMO_PASSWORD = 'password123';
const ADMIN_EMAIL = 'admin@example.com';
const USER_EMAIL = 'user@example.com';

const USER_MARKER_BOT = 'BTC Momentum Runner';
const ADMIN_MARKER_BOT = 'Admin Liquidity Watch';

function parseTruthy(value: string | undefined): boolean {
  if (!value) return false;
  const v = value.trim().toLowerCase();
  return v === '1' || v === 'true' || v === 'yes' || v === 'y' || v === 'on';
}

function hasArg(flag: string): boolean {
  return process.argv.slice(2).includes(flag);
}

function minutesAgo(minutes: number, now = new Date()): Date {
  return new Date(now.getTime() - minutes * 60 * 1000);
}

function hoursAgo(hours: number, now = new Date()): Date {
  return new Date(now.getTime() - hours * 60 * 60 * 1000);
}

function daysAgo(days: number, now = new Date()): Date {
  return new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
}

function computePnlLong(entryPrice: number, exitPrice: number, quantity: number): number {
  return (exitPrice - entryPrice) * quantity;
}

async function upsertUser(email: string, name: string) {
  const password = await bcrypt.hash(DEMO_PASSWORD, 10);
  return prisma.user.upsert({
    where: { email },
    update: { name, password },
    create: { email, password, name },
  });
}

async function upsertInstrumentCatalog() {
  const instruments = [
    {
      symbol: 'BTCUSD',
      displayName: 'Bitcoin / US Dollar',
      assetClass: InstrumentAssetClass.CRYPTO,
      marketType: InstrumentMarketType.SPOT,
      baseAsset: 'BTC',
      quoteCurrency: 'USD',
      exchange: 'BINANCE',
      dataSource: 'BINANCE_WS',
      sourceSymbol: 'btcusdt',
      supportedIntervals: ['1m', '5m', '15m', '1h', '4h', '1d'],
      pricePrecision: 2,
      quantityPrecision: 6,
      status: InstrumentStatus.ACTIVE,
      isActive: true,
    },
    {
      symbol: 'ETHUSD',
      displayName: 'Ethereum / US Dollar',
      assetClass: InstrumentAssetClass.CRYPTO,
      marketType: InstrumentMarketType.SPOT,
      baseAsset: 'ETH',
      quoteCurrency: 'USD',
      exchange: 'BINANCE',
      dataSource: 'BINANCE_WS',
      sourceSymbol: 'ethusdt',
      supportedIntervals: ['1m', '5m', '15m', '1h', '4h', '1d'],
      pricePrecision: 2,
      quantityPrecision: 6,
      status: InstrumentStatus.ACTIVE,
      isActive: true,
    },
    {
      symbol: 'SOLUSD',
      displayName: 'Solana / US Dollar',
      assetClass: InstrumentAssetClass.CRYPTO,
      marketType: InstrumentMarketType.SPOT,
      baseAsset: 'SOL',
      quoteCurrency: 'USD',
      exchange: 'BINANCE',
      dataSource: 'BINANCE_WS',
      sourceSymbol: 'solusdt',
      supportedIntervals: ['1m', '5m', '15m', '1h', '4h', '1d'],
      pricePrecision: 2,
      quantityPrecision: 5,
      status: InstrumentStatus.ACTIVE,
      isActive: true,
    },
    {
      symbol: 'BNBUSD',
      displayName: 'BNB / US Dollar',
      assetClass: InstrumentAssetClass.CRYPTO,
      marketType: InstrumentMarketType.SPOT,
      baseAsset: 'BNB',
      quoteCurrency: 'USD',
      exchange: 'BINANCE',
      dataSource: 'BINANCE_WS',
      sourceSymbol: 'bnbusdt',
      supportedIntervals: ['1m', '5m', '15m', '1h', '4h', '1d'],
      pricePrecision: 2,
      quantityPrecision: 4,
      status: InstrumentStatus.ACTIVE,
      isActive: true,
    },
    {
      symbol: 'XRPUSD',
      displayName: 'XRP / US Dollar',
      assetClass: InstrumentAssetClass.CRYPTO,
      marketType: InstrumentMarketType.SPOT,
      baseAsset: 'XRP',
      quoteCurrency: 'USD',
      exchange: 'BINANCE',
      dataSource: 'BINANCE_WS',
      sourceSymbol: 'xrpusdt',
      supportedIntervals: ['1m', '5m', '15m', '1h', '4h', '1d'],
      pricePrecision: 4,
      quantityPrecision: 2,
      status: InstrumentStatus.ACTIVE,
      isActive: true,
    },
    {
      symbol: 'ADAUSD',
      displayName: 'Cardano / US Dollar',
      assetClass: InstrumentAssetClass.CRYPTO,
      marketType: InstrumentMarketType.SPOT,
      baseAsset: 'ADA',
      quoteCurrency: 'USD',
      exchange: 'BINANCE',
      dataSource: 'BINANCE_WS',
      sourceSymbol: 'adausdt',
      supportedIntervals: ['1m', '5m', '15m', '1h', '4h', '1d'],
      pricePrecision: 4,
      quantityPrecision: 2,
      status: InstrumentStatus.ACTIVE,
      isActive: true,
    },
    {
      symbol: 'DOGEUSD',
      displayName: 'Dogecoin / US Dollar',
      assetClass: InstrumentAssetClass.CRYPTO,
      marketType: InstrumentMarketType.SPOT,
      baseAsset: 'DOGE',
      quoteCurrency: 'USD',
      exchange: 'BINANCE',
      dataSource: 'BINANCE_WS',
      sourceSymbol: 'dogeusdt',
      supportedIntervals: ['1m', '5m', '15m', '1h', '4h', '1d'],
      pricePrecision: 5,
      quantityPrecision: 0,
      status: InstrumentStatus.ACTIVE,
      isActive: true,
    },
    {
      symbol: 'LTCUSD',
      displayName: 'Litecoin / US Dollar',
      assetClass: InstrumentAssetClass.CRYPTO,
      marketType: InstrumentMarketType.SPOT,
      baseAsset: 'LTC',
      quoteCurrency: 'USD',
      exchange: 'BINANCE',
      dataSource: 'BINANCE_WS',
      sourceSymbol: 'ltcusdt',
      supportedIntervals: ['1m', '5m', '15m', '1h', '4h', '1d'],
      pricePrecision: 2,
      quantityPrecision: 4,
      status: InstrumentStatus.ACTIVE,
      isActive: true,
    },
    {
      symbol: 'AVAXUSD',
      displayName: 'Avalanche / US Dollar',
      assetClass: InstrumentAssetClass.CRYPTO,
      marketType: InstrumentMarketType.SPOT,
      baseAsset: 'AVAX',
      quoteCurrency: 'USD',
      exchange: 'BINANCE',
      dataSource: 'BINANCE_WS',
      sourceSymbol: 'avaxusdt',
      supportedIntervals: ['1m', '5m', '15m', '1h', '4h', '1d'],
      pricePrecision: 3,
      quantityPrecision: 4,
      status: InstrumentStatus.ACTIVE,
      isActive: true,
    },
    {
      symbol: 'XAUUSD',
      displayName: 'Gold / US Dollar',
      assetClass: InstrumentAssetClass.COMMODITY,
      marketType: InstrumentMarketType.SPOT,
      baseAsset: 'XAU',
      quoteCurrency: 'USD',
      exchange: 'BINANCE',
      dataSource: 'BINANCE_WS',
      sourceSymbol: 'paxgusdt',
      supportedIntervals: ['1m', '5m', '15m', '1h', '4h', '1d'],
      pricePrecision: 2,
      quantityPrecision: 3,
      status: InstrumentStatus.ACTIVE,
      isActive: true,
    },
    {
      symbol: 'XAGUSD',
      displayName: 'Silver / US Dollar',
      assetClass: InstrumentAssetClass.COMMODITY,
      marketType: InstrumentMarketType.CFD,
      baseAsset: 'XAG',
      quoteCurrency: 'USD',
      exchange: 'SIMULATED',
      dataSource: 'SIMULATED',
      sourceSymbol: 'xagusd',
      supportedIntervals: ['1m', '5m', '15m', '1h', '4h', '1d'],
      pricePrecision: 3,
      quantityPrecision: 2,
      status: InstrumentStatus.ACTIVE,
      isActive: true,
    },
  ];

  for (const instrument of instruments) {
    await prisma.instrument.upsert({
      where: { symbol: instrument.symbol },
      update: instrument,
      create: instrument,
    });
  }
}

function openLongTrade(input: {
  botId: string;
  symbol: string;
  quantity: number;
  entryPrice: number;
  executedAt: Date;
  stopLoss?: number | null;
  takeProfit?: number | null;
  openReason: string;
}): Prisma.TradeCreateManyInput {
  return {
    id: randomUUID(),
    botId: input.botId,
    symbol: input.symbol,
    side: TradeSide.BUY,
    quantity: input.quantity,
    price: input.entryPrice,
    totalValue: input.quantity * input.entryPrice,
    status: TradeStatus.EXECUTED,
    createdAt: input.executedAt,
    executedAt: input.executedAt,
    openReason: input.openReason,
    stopLoss: input.stopLoss ?? null,
    takeProfit: input.takeProfit ?? null,
    exitPrice: null,
    realizedPnl: null,
    closedAt: null,
    closeReason: null,
  };
}

function closedLongTrade(input: {
  botId: string;
  symbol: string;
  quantity: number;
  entryPrice: number;
  exitPrice: number;
  executedAt: Date;
  closedAt: Date;
  openReason: string;
  closeReason: string;
  stopLoss?: number | null;
  takeProfit?: number | null;
}): Prisma.TradeCreateManyInput {
  const pnl = computePnlLong(input.entryPrice, input.exitPrice, input.quantity);
  return {
    id: randomUUID(),
    botId: input.botId,
    symbol: input.symbol,
    side: TradeSide.BUY,
    quantity: input.quantity,
    price: input.entryPrice,
    totalValue: input.quantity * input.entryPrice,
    status: TradeStatus.CLOSED,
    createdAt: input.executedAt,
    executedAt: input.executedAt,
    openReason: input.openReason,
    stopLoss: input.stopLoss ?? null,
    takeProfit: input.takeProfit ?? null,
    exitPrice: input.exitPrice,
    realizedPnl: pnl,
    closedAt: input.closedAt,
    closeReason: input.closeReason,
  };
}

function summarizeTradesForSession(trades: Prisma.TradeCreateManyInput[]) {
  const executed = trades.filter((t) => t.executedAt != null);
  const realized = trades.filter((t) => t.status === TradeStatus.CLOSED && t.realizedPnl != null);
  const profitLoss = realized.reduce((s, t) => s + Number(t.realizedPnl ?? 0), 0);
  return {
    totalTrades: executed.length,
    profitLoss,
  };
}

function tradeToLogs(trade: Prisma.TradeCreateManyInput): Prisma.BotLogCreateManyInput[] {
  const base = {
    tradeId: trade.id,
    symbol: trade.symbol,
    quantity: trade.quantity,
    entryPrice: trade.price,
    stopLoss: trade.stopLoss,
    takeProfit: trade.takeProfit,
    execution: { type: 'simulated', priceSource: 'seed' },
  };

  const openLog: Prisma.BotLogCreateManyInput = {
    botId: trade.botId,
    level: LogLevel.INFO,
    category: 'trade',
    message: 'Opened demo long position',
    metadata: {
      ...base,
      openReason: trade.openReason,
    },
    createdAt: trade.executedAt ?? trade.createdAt,
  };

  if (trade.status !== TradeStatus.CLOSED) {
    return [openLog];
  }

  const closeLog: Prisma.BotLogCreateManyInput = {
    botId: trade.botId,
    level: LogLevel.INFO,
    category: 'trade',
    message: 'Closed demo position',
    metadata: {
      ...base,
      exitPrice: trade.exitPrice,
      realizedPnl: trade.realizedPnl,
      reason: trade.closeReason,
    },
    createdAt: (trade.closedAt ?? trade.createdAt) as Date,
  };

  return [openLog, closeLog];
}

async function seedTrades(items: Prisma.TradeCreateManyInput[]) {
  if (items.length === 0) return;
  await prisma.trade.createMany({ data: items });
}

async function seedBotLogs(items: Prisma.BotLogCreateManyInput[]) {
  if (items.length === 0) return;
  await prisma.botLog.createMany({ data: items });
}

async function seedNotifications(items: Prisma.NotificationCreateManyInput[]) {
  if (items.length === 0) return;
  await prisma.notification.createMany({ data: items });
}

async function seedExecutionSession(input: {
  botId: string;
  initialBalance: number;
  startedAt: Date;
  endedAt: Date | null;
  trades: Prisma.TradeCreateManyInput[];
}) {
  const summary = summarizeTradesForSession(input.trades);
  await prisma.executionSession.create({
    data: {
      botId: input.botId,
      startedAt: input.startedAt,
      endedAt: input.endedAt,
      initialBalance: input.initialBalance,
      currentBalance: input.initialBalance + summary.profitLoss,
      profitLoss: summary.profitLoss,
      totalTrades: summary.totalTrades,
    },
  });
}

async function seedAdminScenario(adminId: string) {
  const existing = await prisma.bot.findFirst({
    where: { userId: adminId, name: ADMIN_MARKER_BOT },
    select: { id: true },
  });
  if (existing) {
    console.log(`Admin seed scenario already present (${ADMIN_EMAIL}), skipping.`);
    return;
  }

  const now = new Date();

  const liquidityBot = await prisma.bot.create({
    data: {
      name: ADMIN_MARKER_BOT,
      description:
        'Admin demo bot used to drive platform monitoring with recent simulated trades and errors.',
      symbol: 'BTCUSD',
      status: BotStatus.RUNNING,
      userId: adminId,
      createdAt: daysAgo(18, now),
      strategyConfig: {
        create: {
          strategy: 'sma_crossover',
          params: {
            shortPeriod: 9,
            longPeriod: 21,
            quantity: 0.008,
            stopLossPercent: 1.2,
            takeProfitPercent: 2.4,
            interval: '15m',
            initialBalance: 15000,
            maxDailyLoss: 250,
          },
        },
      },
    },
  });

  const auditBot = await prisma.bot.create({
    data: {
      name: 'Admin Audit Trail Bot',
      description: 'Stopped admin bot with older closed trades for demo history screens.',
      symbol: 'XAUUSD',
      status: BotStatus.STOPPED,
      userId: adminId,
      createdAt: daysAgo(35, now),
      strategyConfig: {
        create: {
          strategy: 'rsi',
          params: {
            period: 14,
            oversold: 32,
            overbought: 68,
            quantity: 0.35,
            interval: '1h',
            stopLossPercent: 0.9,
            takeProfitPercent: 1.8,
            initialBalance: 12000,
          },
        },
      },
    },
  });

  const liquidityTrades: Prisma.TradeCreateManyInput[] = [
    closedLongTrade({
      botId: liquidityBot.id,
      symbol: 'BTCUSD',
      quantity: 0.008,
      entryPrice: 64820,
      exitPrice: 65135,
      executedAt: hoursAgo(20, now),
      closedAt: hoursAgo(19.2, now),
      openReason: 'strategy:Bullish SMA crossover detected',
      closeReason: 'risk:take_profit',
      stopLoss: 64040,
      takeProfit: 66375,
    }),
    closedLongTrade({
      botId: liquidityBot.id,
      symbol: 'BTCUSD',
      quantity: 0.008,
      entryPrice: 65310,
      exitPrice: 65005,
      executedAt: hoursAgo(14, now),
      closedAt: hoursAgo(13.6, now),
      openReason: 'strategy:Bullish SMA crossover detected',
      closeReason: 'risk:stop_loss',
      stopLoss: 64526,
      takeProfit: 66877,
    }),
    openLongTrade({
      botId: liquidityBot.id,
      symbol: 'BTCUSD',
      quantity: 0.008,
      entryPrice: 64990,
      executedAt: hoursAgo(3.5, now),
      openReason: 'strategy:Bullish SMA crossover detected',
      stopLoss: 64210,
      takeProfit: 66549,
    }),
  ];

  const auditTrades: Prisma.TradeCreateManyInput[] = [
    closedLongTrade({
      botId: auditBot.id,
      symbol: 'XAUUSD',
      quantity: 0.35,
      entryPrice: 2142.3,
      exitPrice: 2166.8,
      executedAt: daysAgo(10, now),
      closedAt: daysAgo(9.7, now),
      openReason: 'strategy:RSI crossed into oversold zone',
      closeReason: 'risk:take_profit',
      stopLoss: 2123.0,
      takeProfit: 2180.9,
    }),
    closedLongTrade({
      botId: auditBot.id,
      symbol: 'XAUUSD',
      quantity: 0.35,
      entryPrice: 2161.4,
      exitPrice: 2144.1,
      executedAt: daysAgo(7, now),
      closedAt: daysAgo(6.9, now),
      openReason: 'strategy:RSI crossed into oversold zone',
      closeReason: 'risk:stop_loss',
      stopLoss: 2142.0,
      takeProfit: 2200.3,
    }),
  ];

  const allTrades = [...liquidityTrades, ...auditTrades];
  await seedTrades(allTrades);

  const logs: Prisma.BotLogCreateManyInput[] = [
    { botId: liquidityBot.id, level: LogLevel.INFO, category: 'lifecycle', message: 'Bot started', metadata: { symbol: 'BTCUSD', strategy: 'sma_crossover' }, createdAt: daysAgo(1, now) },
    { botId: liquidityBot.id, level: LogLevel.INFO, category: 'market_data', message: 'Market data subscription active', metadata: { symbol: 'BTCUSD', interval: '15m', provider: 'binance' }, createdAt: hoursAgo(22, now) },
    { botId: liquidityBot.id, level: LogLevel.ERROR, category: 'market_data', message: 'Binance snapshot fetch timed out (simulated)', metadata: { symbol: 'BTCUSD', interval: '15m', provider: 'binance', retryInMs: 2000 }, createdAt: minutesAgo(35, now) },
    { botId: auditBot.id, level: LogLevel.INFO, category: 'lifecycle', message: 'Bot stopped', metadata: { symbol: 'XAUUSD' }, createdAt: daysAgo(6.8, now) },
    ...allTrades.flatMap(tradeToLogs),
  ];

  await seedBotLogs(logs);

  await seedExecutionSession({
    botId: liquidityBot.id,
    initialBalance: 15000,
    startedAt: daysAgo(1.1, now),
    endedAt: null,
    trades: liquidityTrades,
  });

  await seedExecutionSession({
    botId: auditBot.id,
    initialBalance: 12000,
    startedAt: daysAgo(11, now),
    endedAt: daysAgo(6.8, now),
    trades: auditTrades,
  });
}

async function seedUserScenario(userId: string) {
  const existing = await prisma.bot.findFirst({
    where: { userId, name: USER_MARKER_BOT },
    select: { id: true },
  });
  if (existing) {
    console.log(`User seed scenario already present (${USER_EMAIL}), skipping.`);
    return;
  }

  const now = new Date();

  const btcBot = await prisma.bot.create({
    data: {
      name: USER_MARKER_BOT,
      description:
        'Primary demo bot with a realistic audit trail: mixed winners/losers, equity curve, and an open position.',
      symbol: 'BTCUSD',
      status: BotStatus.RUNNING,
      userId,
      createdAt: daysAgo(42, now),
      strategyConfig: {
        create: {
          strategy: 'sma_crossover',
          params: {
            shortPeriod: 21,
            longPeriod: 55,
            quantity: 0.012,
            stopLossPercent: 1.5,
            takeProfitPercent: 3.0,
            interval: '1h',
            initialBalance: 25000,
            maxDailyLoss: 400,
          },
        },
      },
    },
  });

  const ethBot = await prisma.bot.create({
    data: {
      name: 'ETH Mean Reversion Desk',
      description: 'RSI-based demo bot with a finished session and closed performance history.',
      symbol: 'ETHUSD',
      status: BotStatus.STOPPED,
      userId,
      createdAt: daysAgo(33, now),
      strategyConfig: {
        create: {
          strategy: 'rsi',
          params: {
            period: 14,
            oversold: 30,
            overbought: 70,
            quantity: 0.45,
            interval: '15m',
            stopLossPercent: 1.1,
            takeProfitPercent: 2.2,
            initialBalance: 10000,
          },
        },
      },
    },
  });

  const goldBot = await prisma.bot.create({
    data: {
      name: 'Gold Breakout Sentinel',
      description:
        'Gold-focused bot seeded with controlled drawdowns and a clean equity curve for walkthroughs.',
      symbol: 'XAUUSD',
      status: BotStatus.PAUSED,
      userId,
      createdAt: daysAgo(21, now),
      strategyConfig: {
        create: {
          strategy: 'sma_crossover',
          params: {
            shortPeriod: 12,
            longPeriod: 26,
            quantity: 0.55,
            interval: '4h',
            stopLossPercent: 0.8,
            takeProfitPercent: 1.6,
            initialBalance: 18000,
          },
        },
      },
    },
  });

  const solBot = await prisma.bot.create({
    data: {
      name: 'SOL Trend Rider',
      description: 'Secondary crypto bot (stopped) to make the bots list feel real.',
      symbol: 'SOLUSD',
      status: BotStatus.STOPPED,
      userId,
      createdAt: daysAgo(12, now),
      strategyConfig: {
        create: {
          strategy: 'sma_crossover',
          params: {
            shortPeriod: 10,
            longPeriod: 30,
            quantity: 2.5,
            interval: '1h',
            stopLossPercent: 2.0,
            takeProfitPercent: 4.0,
            initialBalance: 8000,
          },
        },
      },
    },
  });

  const opsBot = await prisma.bot.create({
    data: {
      name: 'Ops Canary (Metals Feed)',
      description:
        'Intentionally degraded bot with recent errors to populate the error cards and admin monitoring tables.',
      symbol: 'XAUUSD',
      status: BotStatus.ERROR,
      userId,
      createdAt: daysAgo(6, now),
      strategyConfig: {
        create: {
          strategy: 'rsi',
          params: {
            period: 10,
            oversold: 28,
            overbought: 72,
            quantity: 0.25,
            interval: '1h',
            stopLossPercent: 0.7,
            takeProfitPercent: 1.4,
            initialBalance: 9000,
          },
        },
      },
    },
  });

  const btcTrades: Prisma.TradeCreateManyInput[] = [
    closedLongTrade({ botId: btcBot.id, symbol: 'BTCUSD', quantity: 0.012, entryPrice: 61250, exitPrice: 62140, executedAt: daysAgo(19, now), closedAt: daysAgo(18.9, now), openReason: 'strategy:Bullish SMA crossover detected', closeReason: 'risk:take_profit', stopLoss: 60330, takeProfit: 63088 }),
    closedLongTrade({ botId: btcBot.id, symbol: 'BTCUSD', quantity: 0.012, entryPrice: 62480, exitPrice: 61890, executedAt: daysAgo(17, now), closedAt: daysAgo(16.85, now), openReason: 'strategy:Bullish SMA crossover detected', closeReason: 'risk:stop_loss', stopLoss: 61540, takeProfit: 64354 }),
    closedLongTrade({ botId: btcBot.id, symbol: 'BTCUSD', quantity: 0.012, entryPrice: 60790, exitPrice: 61420, executedAt: daysAgo(14, now), closedAt: daysAgo(13.8, now), openReason: 'strategy:Bullish SMA crossover detected', closeReason: 'signal:trend_fade', stopLoss: 59880, takeProfit: 62613 }),
    closedLongTrade({ botId: btcBot.id, symbol: 'BTCUSD', quantity: 0.012, entryPrice: 63210, exitPrice: 64610, executedAt: daysAgo(9, now), closedAt: daysAgo(8.95, now), openReason: 'strategy:Bullish SMA crossover detected', closeReason: 'risk:take_profit', stopLoss: 62260, takeProfit: 65106 }),
    closedLongTrade({ botId: btcBot.id, symbol: 'BTCUSD', quantity: 0.012, entryPrice: 65380, exitPrice: 64840, executedAt: daysAgo(6, now), closedAt: daysAgo(5.9, now), openReason: 'strategy:Bullish SMA crossover detected', closeReason: 'risk:stop_loss', stopLoss: 64399, takeProfit: 67341 }),
    closedLongTrade({ botId: btcBot.id, symbol: 'BTCUSD', quantity: 0.012, entryPrice: 64910, exitPrice: 65760, executedAt: daysAgo(3, now), closedAt: daysAgo(2.95, now), openReason: 'strategy:Bullish SMA crossover detected', closeReason: 'risk:take_profit', stopLoss: 63936, takeProfit: 66857 }),
    closedLongTrade({ botId: btcBot.id, symbol: 'BTCUSD', quantity: 0.012, entryPrice: 66105, exitPrice: 65510, executedAt: hoursAgo(30, now), closedAt: hoursAgo(28.5, now), openReason: 'strategy:Bullish SMA crossover detected', closeReason: 'signal:trend_break', stopLoss: 65113, takeProfit: 68088 }),
    closedLongTrade({ botId: btcBot.id, symbol: 'BTCUSD', quantity: 0.012, entryPrice: 65740, exitPrice: 66620, executedAt: hoursAgo(10, now), closedAt: hoursAgo(8.6, now), openReason: 'strategy:Bullish SMA crossover detected', closeReason: 'risk:take_profit', stopLoss: 64754, takeProfit: 67712 }),
    closedLongTrade({ botId: btcBot.id, symbol: 'BTCUSD', quantity: 0.012, entryPrice: 66610, exitPrice: 67040, executedAt: hoursAgo(3.2, now), closedAt: hoursAgo(2.1, now), openReason: 'strategy:Bullish SMA crossover detected', closeReason: 'signal:scale_out', stopLoss: 65611, takeProfit: 68608 }),
    openLongTrade({ botId: btcBot.id, symbol: 'BTCUSD', quantity: 0.012, entryPrice: 66890, executedAt: hoursAgo(1.3, now), openReason: 'strategy:Bullish SMA crossover detected', stopLoss: 65887, takeProfit: 68896 }),
  ];

  const ethTrades: Prisma.TradeCreateManyInput[] = [
    closedLongTrade({ botId: ethBot.id, symbol: 'ETHUSD', quantity: 0.45, entryPrice: 3298.2, exitPrice: 3369.4, executedAt: daysAgo(16, now), closedAt: daysAgo(15.9, now), openReason: 'strategy:RSI crossed into oversold zone', closeReason: 'risk:take_profit', stopLoss: 3262.9, takeProfit: 3370.8 }),
    closedLongTrade({ botId: ethBot.id, symbol: 'ETHUSD', quantity: 0.45, entryPrice: 3412.6, exitPrice: 3368.9, executedAt: daysAgo(13, now), closedAt: daysAgo(12.95, now), openReason: 'strategy:RSI crossed into oversold zone', closeReason: 'signal:mean_revert_failed', stopLoss: 3375.1, takeProfit: 3487.7 }),
    closedLongTrade({ botId: ethBot.id, symbol: 'ETHUSD', quantity: 0.45, entryPrice: 3345.1, exitPrice: 3388.0, executedAt: daysAgo(10, now), closedAt: daysAgo(9.95, now), openReason: 'strategy:RSI crossed into oversold zone', closeReason: 'risk:take_profit', stopLoss: 3308.3, takeProfit: 3418.7 }),
    closedLongTrade({ botId: ethBot.id, symbol: 'ETHUSD', quantity: 0.45, entryPrice: 3461.3, exitPrice: 3418.8, executedAt: daysAgo(8, now), closedAt: daysAgo(7.9, now), openReason: 'strategy:RSI crossed into oversold zone', closeReason: 'risk:stop_loss', stopLoss: 3423.2, takeProfit: 3537.5 }),
  ];

  const goldTrades: Prisma.TradeCreateManyInput[] = [
    closedLongTrade({ botId: goldBot.id, symbol: 'XAUUSD', quantity: 0.55, entryPrice: 2088.4, exitPrice: 2116.1, executedAt: daysAgo(15, now), closedAt: daysAgo(14.7, now), openReason: 'strategy:Bullish SMA crossover detected', closeReason: 'risk:take_profit', stopLoss: 2071.7, takeProfit: 2121.8 }),
    closedLongTrade({ botId: goldBot.id, symbol: 'XAUUSD', quantity: 0.55, entryPrice: 2130.9, exitPrice: 2113.0, executedAt: daysAgo(12, now), closedAt: daysAgo(11.9, now), openReason: 'strategy:Bullish SMA crossover detected', closeReason: 'signal:breakout_failed', stopLoss: 2113.9, takeProfit: 2165.0 }),
    closedLongTrade({ botId: goldBot.id, symbol: 'XAUUSD', quantity: 0.55, entryPrice: 2111.8, exitPrice: 2124.6, executedAt: daysAgo(7, now), closedAt: daysAgo(6.8, now), openReason: 'strategy:Bullish SMA crossover detected', closeReason: 'signal:scale_out', stopLoss: 2094.9, takeProfit: 2145.6 }),
  ];

  const solTrades: Prisma.TradeCreateManyInput[] = [
    closedLongTrade({ botId: solBot.id, symbol: 'SOLUSD', quantity: 2.5, entryPrice: 132.45, exitPrice: 140.12, executedAt: daysAgo(5, now), closedAt: daysAgo(4.95, now), openReason: 'strategy:Bullish SMA crossover detected', closeReason: 'risk:take_profit', stopLoss: 129.8, takeProfit: 137.75 }),
    closedLongTrade({ botId: solBot.id, symbol: 'SOLUSD', quantity: 2.5, entryPrice: 141.02, exitPrice: 137.96, executedAt: daysAgo(3.6, now), closedAt: daysAgo(3.55, now), openReason: 'strategy:Bullish SMA crossover detected', closeReason: 'risk:stop_loss', stopLoss: 138.2, takeProfit: 146.66 }),
  ];

  const opsTrades: Prisma.TradeCreateManyInput[] = [
    closedLongTrade({ botId: opsBot.id, symbol: 'XAUUSD', quantity: 0.25, entryPrice: 2157.2, exitPrice: 2146.3, executedAt: daysAgo(1.4, now), closedAt: daysAgo(1.38, now), openReason: 'strategy:RSI crossed into oversold zone', closeReason: 'risk:stop_loss', stopLoss: 2142.1, takeProfit: 2187.4 }),
  ];

  const allTrades = [...btcTrades, ...ethTrades, ...goldTrades, ...solTrades, ...opsTrades];
  await seedTrades(allTrades);

  const btcLastOpen = btcTrades.find((t) => t.status === TradeStatus.EXECUTED);
  const btcRecentClosed = btcTrades
    .filter((t) => t.status === TradeStatus.CLOSED)
    .sort(
      (a, b) =>
        new Date(b.closedAt as Date).getTime() - new Date(a.closedAt as Date).getTime(),
    )[0];

  const logs: Prisma.BotLogCreateManyInput[] = [
    { botId: btcBot.id, level: LogLevel.INFO, category: 'lifecycle', message: 'Bot started', metadata: { symbol: 'BTCUSD', strategy: 'sma_crossover' }, createdAt: daysAgo(1.2, now) },
    { botId: btcBot.id, level: LogLevel.DEBUG, category: 'strategy', message: 'Strategy tick evaluated', metadata: { strategy: 'sma_crossover', interval: '1h', signal: 'HOLD', reason: 'No crossover' }, createdAt: minutesAgo(18, now) },
    { botId: ethBot.id, level: LogLevel.INFO, category: 'lifecycle', message: 'Bot stopped', metadata: { symbol: 'ETHUSD' }, createdAt: daysAgo(7.7, now) },
    { botId: goldBot.id, level: LogLevel.WARNING, category: 'risk', message: 'Volatility spike detected (seeded)', metadata: { symbol: 'XAUUSD', note: 'Higher ATR during NY session' }, createdAt: daysAgo(6.6, now) },
    { botId: opsBot.id, level: LogLevel.ERROR, category: 'market_data', message: 'Metals feed returned stale candle batch (simulated)', metadata: { symbol: 'XAUUSD', interval: '1h', provider: 'simulated', ageSeconds: 7200 }, createdAt: hoursAgo(6, now) },
    { botId: opsBot.id, level: LogLevel.ERROR, category: 'jobs', message: 'Bot execution tick failed: price unavailable', metadata: { symbol: 'XAUUSD', hint: 'Restart worker or switch provider' }, createdAt: hoursAgo(2.8, now) },
    { botId: opsBot.id, level: LogLevel.ERROR, category: 'system', message: 'Strategy evaluation aborted: insufficient candle history', metadata: { strategy: 'rsi', requiredCandles: 16, closesCount: 9 }, createdAt: minutesAgo(55, now) },
    ...allTrades.flatMap(tradeToLogs),
  ];

  await seedBotLogs(logs);

  const byBot = (botId: string) => allTrades.filter((t) => t.botId === botId);

  await seedExecutionSession({ botId: btcBot.id, initialBalance: 25000, startedAt: daysAgo(10.5, now), endedAt: null, trades: byBot(btcBot.id) });
  await seedExecutionSession({ botId: ethBot.id, initialBalance: 10000, startedAt: daysAgo(18, now), endedAt: daysAgo(7.7, now), trades: byBot(ethBot.id) });
  await seedExecutionSession({ botId: goldBot.id, initialBalance: 18000, startedAt: daysAgo(16, now), endedAt: null, trades: byBot(goldBot.id) });
  await seedExecutionSession({ botId: solBot.id, initialBalance: 8000, startedAt: daysAgo(6, now), endedAt: daysAgo(3.4, now), trades: byBot(solBot.id) });
  await seedExecutionSession({ botId: opsBot.id, initialBalance: 9000, startedAt: daysAgo(2, now), endedAt: daysAgo(1.2, now), trades: byBot(opsBot.id) });

  const notifications: Prisma.NotificationCreateManyInput[] = [
    {
      userId,
      botId: btcBot.id,
      tradeId: btcRecentClosed?.id,
      type: NotificationType.TRADE_CLOSED,
      title: 'BTCUSD position closed',
      message: `BTCUSD position closed${
        btcRecentClosed?.realizedPnl != null
          ? ` (${Number(btcRecentClosed.realizedPnl) >= 0 ? '+' : ''}${Number(
              btcRecentClosed.realizedPnl,
            ).toFixed(2)} PnL)`
          : ''
      }.`,
      metadata: {
        symbol: 'BTCUSD',
        realizedPnl: btcRecentClosed?.realizedPnl ?? null,
        closeReason: btcRecentClosed?.closeReason ?? null,
      },
      isRead: true,
      readAt: hoursAgo(2, now),
      createdAt: hoursAgo(2.1, now),
    },
    {
      userId,
      botId: btcBot.id,
      tradeId: btcLastOpen?.id,
      type: NotificationType.TRADE_OPENED,
      title: 'BTCUSD position opened',
      message: 'BTCUSD position opened.',
      metadata: { symbol: 'BTCUSD' },
      isRead: false,
      createdAt: hoursAgo(1.25, now),
    },
    {
      userId,
      botId: opsBot.id,
      type: NotificationType.BOT_ERROR,
      title: 'Bot error',
      message: 'XAUUSD bot encountered an error.',
      metadata: { symbol: 'XAUUSD' },
      isRead: false,
      createdAt: minutesAgo(52, now),
    },
  ];

  await seedNotifications(notifications);
}

async function main() {
  console.log('Seeding database...');

  const reset = hasArg('--reset') || hasArg('-r') || parseTruthy(process.env.SEED_RESET);
  if (reset) {
    console.log('Reset requested: removing existing demo accounts (admin/user) and their data...');
    await prisma.user.deleteMany({
      where: { email: { in: [ADMIN_EMAIL, USER_EMAIL, 'demo@example.com', 'demo2@example.com'] } },
    });
  }

  await upsertInstrumentCatalog();

  const admin = await upsertUser(ADMIN_EMAIL, 'Admin Demo');
  const user = await upsertUser(USER_EMAIL, 'Demo Trader');

  await seedUserScenario(user.id);
  await seedAdminScenario(admin.id);

  console.log('Demo accounts:');
  console.log(`- ${ADMIN_EMAIL} / ${DEMO_PASSWORD} (admin)`);
  console.log(`- ${USER_EMAIL} / ${DEMO_PASSWORD}`);
  if (!reset) {
    console.log('Tip: to recreate the demo dataset, run the seed with `--reset` (or set SEED_RESET=true).');
  }
  console.log('Seeding completed!');
}

main()
  .catch((e) => {
    console.error('Error seeding database:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
