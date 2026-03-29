import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { DATA_RETENTION_CRON } from './data-retention.constants';

const RETENTION_JOB_ID = 'data-retention-repeatable';

@Injectable()
export class DataRetentionSchedulerService implements OnModuleInit {
  private readonly logger = new Logger(DataRetentionSchedulerService.name);

  constructor(@InjectQueue('data-retention') private readonly retentionQueue: Queue) {}

  async onModuleInit(): Promise<void> {
    try {
      // Remove any existing repeatable job with this jobId so the next add()
      // creates a clean, deduplicated entry.  We target only our own jobId —
      // other repeatable jobs (market-data, etc.) are left untouched.
      const existing = await this.retentionQueue.getRepeatableJobs();
      const ours = existing.find((j) => j.name === 'run' && j.id === RETENTION_JOB_ID);
      if (ours) {
        await this.retentionQueue.removeRepeatableByKey(ours.key);
      }
    } catch (err) {
      // getRepeatableJobs is Redis 6.2+; ignore on older versions.
      this.logger.debug(`Could not check for stale repeatable job: ${err instanceof Error ? err.message : String(err)}`);
    }

    try {
      await this.retentionQueue.add(
        'run',
        {},
        {
          repeat: { pattern: DATA_RETENTION_CRON },
          jobId: RETENTION_JOB_ID,
        },
      );
      this.logger.log(`Scheduled data-retention job with cron pattern: ${DATA_RETENTION_CRON}`);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      this.logger.error(`Failed to schedule data-retention job: ${message}`);
      // Don't re-throw — let the app boot so other workers can start.
      // The job can be re-scheduled manually or on the next restart.
    }
  }
}
