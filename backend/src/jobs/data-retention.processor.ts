import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { Logger } from '@nestjs/common';
import { DataRetentionService } from './data-retention.service';

@Processor('data-retention', { concurrency: 1 })
export class DataRetentionProcessor extends WorkerHost {
  private readonly logger = new Logger(DataRetentionProcessor.name);

  constructor(private readonly retentionService: DataRetentionService) {
    super();
  }

  async process(_job: Job<Record<string, never>, void, string>): Promise<void> {
    let results;
    try {
      results = await this.retentionService.runRetention();
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      this.logger.error(`Retention run failed: ${message}`);
      throw err; // re-throw so BullMQ records failedReason and triggers retry
    }

    const summary = results
      .filter((r) => r.deleted > 0)
      .map((r) => `${r.table}[${r.phase}]: ${r.deleted}`)
      .join(', ');

    if (summary) {
      this.logger.log(`Retention run complete — ${summary}`);
    } else {
      this.logger.debug('Retention run complete — nothing to delete');
    }
  }
}
