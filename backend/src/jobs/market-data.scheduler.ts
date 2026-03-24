import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';

@Injectable()
export class MarketDataSchedulerService implements OnModuleInit {
  private readonly logger = new Logger(MarketDataSchedulerService.name);

  constructor(
    @InjectQueue('market-data') private readonly marketDataQueue: Queue,
  ) {}

  async onModuleInit(): Promise<void> {
    const everyMs = parseInt(process.env.MARKET_DATA_TICK_MS || '2000', 10);
    const interval = Number.isFinite(everyMs) && everyMs > 0 ? everyMs : 2000;

    await this.marketDataQueue.add(
      'tick',
      {},
      {
        repeat: { every: interval },
        jobId: 'market-data-tick-repeatable',
      },
    );

    this.logger.log(`Scheduled mock market-data tick every ${interval}ms`);
  }
}
