import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { WalkforwardController } from './walkforward.controller';
import { WalkforwardService } from './walkforward.service';
import { WalkforwardProcessor } from './walkforward.processor';
import { PrismaModule } from '../prisma/prisma.module';
import { BacktestModule } from '../backtest/backtest.module';

@Module({
  imports: [
    PrismaModule,
    BacktestModule,
    BullModule.registerQueue({
      name: 'walkforward',
      defaultJobOptions: {
        attempts: 2,
        backoff: { type: 'exponential', delay: 5000 },
        removeOnComplete: { count: 50 },
        removeOnFail: { count: 100 },
      },
    }),
  ],
  controllers: [WalkforwardController],
  providers: [WalkforwardService, WalkforwardProcessor],
  exports: [WalkforwardService],
})
export class WalkforwardModule {}
