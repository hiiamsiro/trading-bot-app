import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { PrismaModule } from '../prisma/prisma.module';
import { MarketDataModule } from '../market-data/market-data.module';
import { DemoTradingModule } from '../demo-trading/demo-trading.module';
import { InstrumentsModule } from '../instruments/instruments.module';
import { BotsModule } from '../bots/bots.module';
import { DataRetentionModule } from './data-retention.module';
import { BotExecutionProcessor } from './bot-execution.processor';
import { MarketDataProcessor } from './market-data.processor';
import { MarketDataSchedulerService } from './market-data.scheduler';
import { InstrumentSyncProcessor } from './instrument-sync.processor';
import { InstrumentSyncSchedulerService } from './instrument-sync.scheduler';
import { DataRetentionSchedulerService } from './data-retention.scheduler';
import {
  BOT_EXECUTION_MAX_RETRIES,
  BOT_EXECUTION_BACKOFF_BASE,
  MARKET_DATA_MAX_RETRIES,
  MARKET_DATA_BACKOFF_BASE,
  INSTRUMENT_SYNC_MAX_RETRIES,
  INSTRUMENT_SYNC_BACKOFF_DELAY,
  DATA_RETENTION_QUEUE_MAX_RETRIES,
  DATA_RETENTION_QUEUE_BACKOFF_DELAY,
  DATA_RETENTION_QUEUE_REMOVE_ON_COMPLETE,
  DATA_RETENTION_QUEUE_REMOVE_ON_FAIL,
} from './worker.constants';

@Module({
  imports: [
    PrismaModule,
    MarketDataModule,
    DemoTradingModule,
    BotsModule,
    InstrumentsModule,
    DataRetentionModule,
    BullModule.registerQueue(
      {
        name: 'bot-execution',
        defaultJobOptions: {
          attempts: BOT_EXECUTION_MAX_RETRIES,
          backoff: { type: 'exponential', delay: BOT_EXECUTION_BACKOFF_BASE },
          removeOnComplete: { count: 500 },
          removeOnFail: { count: 1000 },
        },
      },
      {
        name: 'market-data',
        defaultJobOptions: {
          attempts: MARKET_DATA_MAX_RETRIES,
          backoff: { type: 'exponential', delay: MARKET_DATA_BACKOFF_BASE },
          removeOnComplete: { count: 100 },
          removeOnFail: { count: 500 },
        },
      },
      {
        name: 'instrument-sync',
        defaultJobOptions: {
          attempts: INSTRUMENT_SYNC_MAX_RETRIES,
          backoff: { type: 'exponential', delay: INSTRUMENT_SYNC_BACKOFF_DELAY },
          // Retention tuned for 60-second backoff: jobs live ~3 min before exhausting
          // retries. Completed cap of 50 preserves enough history for forensics.
          removeOnComplete: { count: 50 },
          removeOnFail: { count: 100 },
        },
      },
      {
        name: 'data-retention',
        defaultJobOptions: {
          attempts: DATA_RETENTION_QUEUE_MAX_RETRIES,
          backoff: { type: 'exponential', delay: DATA_RETENTION_QUEUE_BACKOFF_DELAY },
          removeOnComplete: { count: DATA_RETENTION_QUEUE_REMOVE_ON_COMPLETE },
          removeOnFail: { count: DATA_RETENTION_QUEUE_REMOVE_ON_FAIL },
        },
      },
    ),
  ],
  providers: [
    BotExecutionProcessor,
    MarketDataProcessor,
    MarketDataSchedulerService,
    InstrumentSyncProcessor,
    InstrumentSyncSchedulerService,
    DataRetentionSchedulerService,
  ],
  exports: [BullModule],
})
export class JobsModule {}
