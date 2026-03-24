import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { PrismaModule } from '../prisma/prisma.module';
import { MarketDataModule } from '../market-data/market-data.module';
import { DemoTradingModule } from '../demo-trading/demo-trading.module';
import { BotExecutionProcessor } from './bot-execution.processor';
import { MarketDataProcessor } from './market-data.processor';
import { MarketDataSchedulerService } from './market-data.scheduler';

@Module({
  imports: [
    PrismaModule,
    MarketDataModule,
    DemoTradingModule,
    BullModule.registerQueue(
      {
        name: 'bot-execution',
      },
      {
        name: 'market-data',
      },
    ),
  ],
  providers: [
    BotExecutionProcessor,
    MarketDataProcessor,
    MarketDataSchedulerService,
  ],
  exports: [BullModule],
})
export class JobsModule {}
