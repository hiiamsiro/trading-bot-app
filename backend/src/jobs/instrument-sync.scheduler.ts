import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';

@Injectable()
export class InstrumentSyncSchedulerService implements OnModuleInit {
  private readonly logger = new Logger(InstrumentSyncSchedulerService.name);

  constructor(@InjectQueue('instrument-sync') private readonly instrumentSyncQueue: Queue) {}

  async onModuleInit(): Promise<void> {
    const everyMs = parseInt(
      process.env.INSTRUMENT_SYNC_INTERVAL_MS || String(6 * 60 * 60 * 1000),
      10,
    );
    const interval = Number.isFinite(everyMs) && everyMs > 0 ? everyMs : 21600000;

    await this.instrumentSyncQueue.add(
      'sync',
      {},
      {
        repeat: { every: interval },
        jobId: 'instrument-sync-repeatable',
      },
    );

    this.logger.log(`Scheduled instrument sync every ${interval}ms`);
  }
}
