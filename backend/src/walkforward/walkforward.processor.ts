import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { Logger } from '@nestjs/common';
import { WalkforwardService } from './walkforward.service';

type WalkforwardJobData = {
  walkforwardId: string;
  symbol: string;
  interval: string;
  strategy: string;
  paramRanges: { param: string; values: number[] }[];
  fromDate: string;
  toDate: string;
  initialBalance: number;
  trainSplitPct: number;
};

@Processor('walkforward', { concurrency: 1 })
export class WalkforwardProcessor extends WorkerHost {
  private readonly logger = new Logger(WalkforwardProcessor.name);

  constructor(private readonly walkforwardService: WalkforwardService) {
    super();
  }

  async process(job: Job<WalkforwardJobData, void, string>): Promise<void> {
    const { walkforwardId, ...params } = job.data;

    try {
      await this.walkforwardService.runWalkforwardAnalysis(walkforwardId, {
        ...params,
        interval: params.interval as '1m' | '5m' | '15m' | '1h' | '4h' | '1d',
      });
      this.logger.log(`Walkforward ${walkforwardId} completed successfully.`);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error(`Walkforward ${walkforwardId} failed: ${message}`);

      // markFailed uses raw SQL — bypasses Prisma's camelCase→snake_case field mismatch
      // and is safe to call even if onModuleInit hasn't fully connected yet.
      await this.walkforwardService.markFailed(walkforwardId, message);
    }
  }
}
