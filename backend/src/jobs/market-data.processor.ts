import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job, Queue } from 'bullmq';
import { InjectQueue } from '@nestjs/bullmq';
import { PrismaService } from '../prisma/prisma.service';
import { MarketDataService } from '../market-data/market-data.service';
import { MarketDataGateway } from '../market-data/market-data.gateway';

@Processor('market-data', { concurrency: 1 })
export class MarketDataProcessor extends WorkerHost {
  constructor(
    private readonly prisma: PrismaService,
    private readonly marketData: MarketDataService,
    private readonly gateway: MarketDataGateway,
    @InjectQueue('bot-execution') private readonly botExecutionQueue: Queue,
  ) {
    super();
  }

  async process(_job: Job<Record<string, never>, void, string>): Promise<void> {
    const fromEnv = (process.env.MARKET_DATA_SYMBOLS || '')
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);

    const running = await this.prisma.bot.findMany({
      where: { status: 'RUNNING' },
      select: { symbol: true },
    });

    const symbols = new Set<string>([...fromEnv, ...running.map((b) => b.symbol)]);
    if (symbols.size === 0) {
      symbols.add('BTCUSD');
    }

    for (const symbol of symbols) {
      const tick = this.marketData.nextTick(symbol);
      this.gateway.emitMarketData(tick);
    }

    const bots = await this.prisma.bot.findMany({
      where: { status: 'RUNNING' },
      select: { id: true },
    });

    await Promise.all(
      bots.map((b) =>
        this.botExecutionQueue.add(
          'tick',
          { botId: b.id },
          { removeOnComplete: 1000, removeOnFail: 5000 },
        ),
      ),
    );
  }
}
