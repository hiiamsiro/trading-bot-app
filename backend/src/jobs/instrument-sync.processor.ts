import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { Logger } from '@nestjs/common';
import { InstrumentsService } from '../instruments/instruments.service';
import { INSTRUMENT_SYNC_CONCURRENCY } from './worker.constants';

@Processor('instrument-sync', { concurrency: INSTRUMENT_SYNC_CONCURRENCY })
export class InstrumentSyncProcessor extends WorkerHost {
  private readonly logger = new Logger(InstrumentSyncProcessor.name);

  constructor(private readonly instrumentsService: InstrumentsService) {
    super();
  }

  async process(job: Job<Record<string, never>, void, string>): Promise<void> {
    void job;
    const result = await this.instrumentsService.syncFromProvider();
    this.logger.log(
      `Instrument sync completed provider=${result.provider} fetched=${result.totalFetched} created=${result.created} updated=${result.updated}`,
    );
  }
}
