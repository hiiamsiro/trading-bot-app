import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { BotExecutionProcessor } from './bot-execution.processor';
import { MarketDataProcessor } from './market-data.processor';

@Module({
  imports: [
    BullModule.registerQueue(
      {
        name: 'bot-execution',
      },
      {
        name: 'market-data',
      },
    ),
  ],
  providers: [BotExecutionProcessor, MarketDataProcessor],
  exports: [BullModule],
})
export class JobsModule {}
