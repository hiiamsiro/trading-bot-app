import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { Logger } from '@nestjs/common';
import { OptimizationService } from './optimization.service';
import { BacktestService } from '../backtest/backtest.service';
import type { OptimizationJobParams } from './optimization.service';

@Processor('optimization', { concurrency: 3 })
export class OptimizationProcessor extends WorkerHost {
  private readonly logger = new Logger(OptimizationProcessor.name);

  constructor(
    private readonly optimizationService: OptimizationService,
    private readonly backtestService: BacktestService,
  ) {
    super();
  }

  async process(job: Job<OptimizationJobParams, void, string>): Promise<void> {
    const data = job.data;
    const { optimizationId, params: strategyParams, fromDate, toDate, ...rest } = data;

    try {
      const result = await this.backtestService.runBacktest({
        ...rest,
        fromDate: new Date(fromDate),
        toDate: new Date(toDate),
        strategyParams,
      });

      await this.optimizationService.recordCombinationResult(
        optimizationId,
        { params: strategyParams, metrics: result.metrics },
        data.combinationIndex,
        data.totalCombinations,
      );

      this.logger.debug(
        `Optimization ${optimizationId}: completed combination ${data.combinationIndex + 1}/${data.totalCombinations}`,
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error(
        `Optimization ${optimizationId} combination ${data.combinationIndex} failed: ${message}`,
      );
      const balance = rest.initialBalance;
      // Record as a failed result so optimization can still complete
      await this.optimizationService.recordCombinationResult(
        optimizationId,
        {
          params: strategyParams,
          metrics: {
            totalTrades: 0,
            winningTrades: 0,
            losingTrades: 0,
            winRate: null,
            totalPnl: -999999,
            maxDrawdown: 1,
            initialBalance: balance,
            finalBalance: balance,
            averageWin: null,
            averageLoss: null,
          },
        },
        data.combinationIndex,
        data.totalCombinations,
      );
    }
  }
}
