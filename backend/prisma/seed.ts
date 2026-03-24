import {
  PrismaClient,
  LogLevel,
  TradeSide,
  TradeStatus,
  BotStatus,
  InstrumentAssetClass,
  InstrumentMarketType,
  InstrumentStatus,
} from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

const DEMO_PASSWORD = 'password123';

async function upsertUser(email: string, name: string) {
  const password = await bcrypt.hash(DEMO_PASSWORD, 10);
  return prisma.user.upsert({
    where: { email },
    update: { name },
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
  ];

  for (const instrument of instruments) {
    await prisma.instrument.upsert({
      where: { symbol: instrument.symbol },
      update: instrument,
      create: instrument,
    });
  }
}

async function main() {
  console.log('Seeding database...');

  await upsertInstrumentCatalog();

  const demo = await upsertUser('demo@example.com', 'Demo User');
  const demo2 = await upsertUser('demo2@example.com', 'Demo User Two');

  const seedMarker = await prisma.bot.findFirst({
    where: { userId: demo.id, name: 'Demo BTC Bot' },
  });
  if (seedMarker) {
    console.log('Seed data already present, skipping bot/trade creation.');
    console.log('Seeding completed!');
    return;
  }

  const btcBot = await prisma.bot.create({
    data: {
      name: 'Demo BTC Bot',
      description: 'Sample SMA bot with historical demo trades and logs',
      symbol: 'BTCUSD',
      status: BotStatus.STOPPED,
      userId: demo.id,
      strategyConfig: {
        create: {
          strategy: 'sma_crossover',
          params: {
            shortPeriod: 10,
            longPeriod: 20,
            quantity: 0.01,
            stopLossPercent: 2,
            takeProfitPercent: 4,
            initialBalance: 10000,
          },
        },
      },
      executionSession: {
        create: {
          initialBalance: 10000,
          currentBalance: 10042.5,
          profitLoss: 42.5,
          totalTrades: 2,
          startedAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
          endedAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000),
        },
      },
    },
  });

  const entryPrice = 42000;
  const exitPrice = 42500;
  const qty = 0.01;

  await prisma.trade.createMany({
    data: [
      {
        botId: btcBot.id,
        symbol: 'BTCUSD',
        side: TradeSide.BUY,
        quantity: qty,
        price: entryPrice,
        totalValue: qty * entryPrice,
        status: TradeStatus.CLOSED,
        executedAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000),
        exitPrice,
        realizedPnl: (exitPrice - entryPrice) * qty,
        closedAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
        closeReason: 'strategy',
      },
      {
        botId: btcBot.id,
        symbol: 'BTCUSD',
        side: TradeSide.BUY,
        quantity: qty,
        price: 42800,
        totalValue: qty * 42800,
        status: TradeStatus.EXECUTED,
        executedAt: new Date(Date.now() - 12 * 60 * 60 * 1000),
        stopLoss: 41800,
        takeProfit: 44200,
      },
    ],
  });

  await prisma.botLog.createMany({
    data: [
      {
        botId: btcBot.id,
        level: LogLevel.INFO,
        message: 'Bot session ended (seed)',
        metadata: { source: 'seed' },
      },
      {
        botId: btcBot.id,
        level: LogLevel.INFO,
        message: 'Opened demo long position',
        metadata: {
          symbol: 'BTCUSD',
          quantity: qty,
          entryPrice,
        },
      },
      {
        botId: btcBot.id,
        level: LogLevel.DEBUG,
        message: 'Strategy tick evaluated',
        metadata: { signal: 'HOLD' },
      },
      {
        botId: btcBot.id,
        level: LogLevel.WARNING,
        message: 'Demo spread widened (simulated)',
        metadata: { symbol: 'BTCUSD' },
      },
    ],
  });

  await prisma.bot.create({
    data: {
      name: 'ETH Sample Bot',
      description: 'Second sample bot (stopped)',
      symbol: 'ETHUSD',
      status: BotStatus.STOPPED,
      userId: demo.id,
      strategyConfig: {
        create: {
          strategy: 'sma_crossover',
          params: {
            shortPeriod: 5,
            longPeriod: 15,
            quantity: 0.1,
            initialBalance: 5000,
          },
        },
      },
    },
  });

  await prisma.bot.create({
    data: {
      name: 'Starter Bot',
      description: 'Minimal bot for second demo account',
      symbol: 'BTCUSD',
      status: BotStatus.STOPPED,
      userId: demo2.id,
      strategyConfig: {
        create: {
          strategy: 'sma_crossover',
          params: {
            shortPeriod: 12,
            longPeriod: 26,
            quantity: 0.01,
            initialBalance: 10000,
          },
        },
      },
    },
  });

  console.log('Demo accounts: demo@example.com, demo2@example.com');
  console.log('Password (both):', DEMO_PASSWORD);
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
