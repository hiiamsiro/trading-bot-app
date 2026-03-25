import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { PrismaModule } from '../prisma/prisma.module';
import { MarketDataModule } from '../market-data/market-data.module';
import { DemoTradingModule } from '../demo-trading/demo-trading.module';
import { InstrumentsModule } from '../instruments/instruments.module';
import { BotsModule } from '../bots/bots.module';
import { BotExecutionProcessor } from './bot-execution.processor';
import { MarketDataProcessor } from './market-data.processor';
import { MarketDataSchedulerService } from './market-data.scheduler';
import { InstrumentSyncProcessor } from './instrument-sync.processor';
import { InstrumentSyncSchedulerService } from './instrument-sync.scheduler';

@Module({
  imports: [
    PrismaModule,
    MarketDataModule,
    DemoTradingModule,
    BotsModule,
    InstrumentsModule,
    BullModule.registerQueue(
      {
        name: 'bot-execution',
      },
      {
        name: 'market-data',
      },
      {
        name: 'instrument-sync',
      },
    ),
  ],
  providers: [
    BotExecutionProcessor,
    MarketDataProcessor,
    MarketDataSchedulerService,
    InstrumentSyncProcessor,
    InstrumentSyncSchedulerService,
  ],
  exports: [BullModule],
})
export class JobsModule {}
