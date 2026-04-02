import { Injectable, Logger } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { PrismaService } from '../prisma/prisma.service';
import { BacktestService } from '../backtest/backtest.service';
import { MarketKlineInterval } from '../market-data/providers/market-data-provider.types';
import { Prisma } from '@prisma/client';

export type OptimizationResult = {
  params: Record<string, unknown>;
  metrics: {
    totalTrades: number;
    winningTrades: number;
    losingTrades: number;
    winRate: number | null;
    totalPnl: number;
    maxDrawdown: number;
    initialBalance: number;
    finalBalance: number;
    averageWin: number | null;
    averageLoss: number | null;
  };
};

export type OptimizationJobParams = {
  optimizationId: string;
  symbol: string;
  interval: MarketKlineInterval;
  strategyKey: string;
  params: Record<string, unknown>;
  sourceSymbol: string;
  fromDate: string;
  toDate: string;
  initialBalance: number;
  combinationIndex: number;
  totalCombinations: number;
};

@Injectable()
export class OptimizationService {
  private readonly logger = new Logger(OptimizationService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly backtestService: BacktestService,
    @InjectQueue('optimization') private readonly optimizationQueue: Queue,
  ) {}

  async startOptimization(
    userId: string,
    params: {
      symbol: string;
      interval: MarketKlineInterval;
      strategy: string;
      paramRanges: { param: string; values: number[] }[];
      fromDate: string;
      toDate: string;
      initialBalance: number;
      botId?: string;
    },
  ): Promise<{ id: string }> {
    const combinations = this.generateCombinations(params.paramRanges);
    const totalCombinations = combinations.length;

    if (totalCombinations === 0) {
      throw new Error('No parameter combinations generated. Check your parameter ranges.');
    }
    if (totalCombinations > 5000) {
      throw new Error(
        `Too many combinations (${totalCombinations}). Maximum allowed is 5000. Reduce parameter ranges.`,
      );
    }

    const record = await this.prisma.optimization.create({
      data: {
        userId,
        symbol: params.symbol.toUpperCase(),
        interval: params.interval,
        strategy: params.strategy,
        paramRanges: params.paramRanges as object,
        status: 'PENDING',
        totalCombinations,
        completedCombinations: 0,
        progress: 0,
      },
    });

    // Enqueue all combinations as individual jobs
    const instrument = await this.prisma.instrument.findUnique({
      where: { symbol: params.symbol.toUpperCase() },
      select: { sourceSymbol: true },
    });
    const sourceSymbol = (instrument?.sourceSymbol ?? params.symbol.toUpperCase())
      .replace('/', '')
      .toUpperCase();

    const jobParams: OptimizationJobParams[] = combinations.map((combination, idx) => ({
      optimizationId: record.id,
      symbol: params.symbol.toUpperCase(),
      interval: params.interval,
      strategyKey: params.strategy,
      params: combination,
      sourceSymbol,
      fromDate: params.fromDate,
      toDate: params.toDate,
      initialBalance: params.initialBalance,
      combinationIndex: idx,
      totalCombinations,
    }));

    // Add all jobs to the queue
    for (const jobData of jobParams) {
      await this.optimizationQueue.add('run-combination', jobData, {
        removeOnComplete: 100,
        removeOnFail: 200,
      });
    }

    // Mark as RUNNING and enqueue completion check
    await this.prisma.optimization.update({
      where: { id: record.id },
      data: { status: 'RUNNING' },
    });

    return { id: record.id };
  }

  async getOptimization(userId: string, id: string) {
    const record = await this.prisma.optimization.findUnique({
      where: { id, userId },
    });
    if (!record) return null;

    return {
      id: record.id,
      symbol: record.symbol,
      interval: record.interval,
      strategy: record.strategy,
      paramRanges: record.paramRanges,
      status: record.status,
      progress: record.progress,
      totalCombinations: record.totalCombinations,
      completedCombinations: record.completedCombinations,
      bestByPnl: record.bestByPnl,
      bestByDrawdown: record.bestByDrawdown,
      bestByWinrate: record.bestByWinrate,
      allResults: record.allResults,
      error: record.error,
      createdAt: record.createdAt,
    };
  }

  async listOptimizations(userId: string, take = 20, skip = 0) {
    const [items, total] = await Promise.all([
      this.prisma.optimization.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        take,
        skip,
        select: {
          id: true,
          symbol: true,
          interval: true,
          strategy: true,
          status: true,
          progress: true,
          totalCombinations: true,
          completedCombinations: true,
          bestByPnl: true,
          error: true,
          createdAt: true,
        },
      }),
      this.prisma.optimization.count({ where: { userId } }),
    ]);
    return { items, total, take, skip };
  }

  /**
   * Called by OptimizationProcessor for each combination result.
   * Uses a transaction so that reading current results and writing the updated
   * list is atomic — this prevents lost updates when concurrency > 1.
   */
  async recordCombinationResult(
    optimizationId: string,
    result: OptimizationResult,
    combinationIndex: number,
    totalCombinations: number,
  ): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      const record = await tx.optimization.findUnique({
        where: { id: optimizationId },
        select: {
          completedCombinations: true,
          bestByPnl: true,
          bestByDrawdown: true,
          bestByWinrate: true,
          allResults: true,
          status: true,
        },
      });

      if (!record || record.status === 'COMPLETED') return;

      // Atomic increment inside the transaction so concurrent workers never clash
      const [updated] = await tx.$queryRaw<{ completed_combinations: bigint }[]>`
        UPDATE optimizations
        SET completed_combinations = completed_combinations + 1
        WHERE id::text = ${optimizationId}
        RETURNING completed_combinations
      `;
      const completedSoFar = Number(updated.completed_combinations);
      const progress = Math.round((completedSoFar / totalCombinations) * 100);

      const currentResults = (record.allResults ?? []) as OptimizationResult[];
      const updatedResults = [...currentResults, result];

      const newBestByPnl = this.compareAndUpdateBest(
        record.bestByPnl as OptimizationResult | null,
        result,
        'pnl',
      );
      const newBestByDrawdown = this.compareAndUpdateBest(
        record.bestByDrawdown as OptimizationResult | null,
        result,
        'drawdown',
      );
      const newBestByWinrate = this.compareAndUpdateBest(
        record.bestByWinrate as OptimizationResult | null,
        result,
        'winrate',
      );

      const isComplete = completedSoFar >= totalCombinations;

      await tx.optimization.update({
        where: { id: optimizationId },
        data: {
          progress,
          bestByPnl: (newBestByPnl ?? undefined) as Prisma.InputJsonValue,
          bestByDrawdown: (newBestByDrawdown ?? undefined) as Prisma.InputJsonValue,
          bestByWinrate: (newBestByWinrate ?? undefined) as Prisma.InputJsonValue,
          allResults: updatedResults as Prisma.InputJsonValue,
          status: isComplete ? 'COMPLETED' : 'RUNNING',
        },
      });

      if (isComplete) {
        this.logger.log(
          `Optimization ${optimizationId} completed. ${totalCombinations} combinations tested.`,
        );
      }
    });
  }

  private generateCombinations(
    paramRanges: { param: string; values: number[] }[],
  ): Record<string, unknown>[] {
    if (paramRanges.length === 0) return [{}];

    const [first, ...rest] = paramRanges;
    const restCombinations = this.generateCombinations(rest);

    const results: Record<string, unknown>[] = [];
    for (const value of first.values) {
      for (const base of restCombinations) {
        results.push({ ...base, [first.param]: value });
      }
    }
    return results;
  }

  private compareAndUpdateBest(
    current: OptimizationResult | null,
    candidate: OptimizationResult,
    metric: 'pnl' | 'drawdown' | 'winrate',
  ): OptimizationResult {
    if (!current) return candidate;

    const currentVal =
      metric === 'pnl'
        ? current.metrics.totalPnl
        : metric === 'drawdown'
          ? -current.metrics.maxDrawdown // lower drawdown is better, negate
          : current.metrics.winRate ?? -1;

    const candidateVal =
      metric === 'pnl'
        ? candidate.metrics.totalPnl
        : metric === 'drawdown'
          ? -candidate.metrics.maxDrawdown
          : candidate.metrics.winRate ?? -1;

    return candidateVal > currentVal ? candidate : current;
  }
}
