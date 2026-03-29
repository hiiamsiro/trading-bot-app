import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { PrismaModule } from '../prisma/prisma.module';
import { DataRetentionService } from './data-retention.service';
import { DataRetentionProcessor } from './data-retention.processor';
import {
  DATA_RETENTION_MAX_RETRIES,
  DATA_RETENTION_BACKOFF_DELAY,
} from './data-retention.constants';

@Module({
  imports: [
    PrismaModule,
    BullModule.registerQueue({
      name: 'data-retention',
      defaultJobOptions: {
        attempts: DATA_RETENTION_MAX_RETRIES,
        backoff: { type: 'fixed', delay: DATA_RETENTION_BACKOFF_DELAY },
        removeOnComplete: { count: 10 },
        // 100 entries ≈ 33 days of daily failures — enough for forensic post-mortem.
        // Increase if retention windows are extended (more time between failure and notice).
        removeOnFail: { count: 100 },
      },
    }),
  ],
  providers: [DataRetentionService, DataRetentionProcessor],
  exports: [DataRetentionService],
})
export class DataRetentionModule {}
