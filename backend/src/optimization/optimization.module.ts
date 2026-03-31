import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { OptimizationController } from './optimization.controller';
import { OptimizationService } from './optimization.service';
import { OptimizationProcessor } from './optimization.processor';
import { PrismaModule } from '../prisma/prisma.module';
import { BacktestModule } from '../backtest/backtest.module';

@Module({
  imports: [
    PrismaModule,
    BacktestModule,
    BullModule.registerQueue({
      name: 'optimization',
      defaultJobOptions: {
        attempts: 2,
        backoff: { type: 'exponential', delay: 5000 },
        removeOnComplete: { count: 100 },
        removeOnFail: { count: 200 },
      },
    }),
  ],
  controllers: [OptimizationController],
  providers: [OptimizationService, OptimizationProcessor],
  exports: [OptimizationService],
})
export class OptimizationModule {}
