import { Injectable, Logger } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { PrismaService } from '../prisma/prisma.service';
import { BacktestService } from '../backtest/backtest.service';
import { MarketKlineInterval } from '../market-data/providers/market-data-provider.types';
import { Prisma } from '@prisma/client';

export type WalkforwardMetrics = {
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

export type WalkforwardResult = {
  trainMetrics: WalkforwardMetrics;
  testMetrics: WalkforwardMetrics;
  bestParams: Record<string, unknown>;
  trainEquityCurve: { at: string; cumulativePnl: number }[];
  testEquityCurve: { at: string; cumulativePnl: number }[];
};

@Injectable()
export class WalkforwardService {
  private readonly logger = new Logger(WalkforwardService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly backtestService: BacktestService,
    @InjectQueue('walkforward') private readonly queue: Queue,
  ) {}

  async startWalkforward(
    userId: string,
    params: {
      symbol: string;
      interval: MarketKlineInterval;
      strategy: string;
      paramRanges: { param: string; values: number[] }[];
      fromDate: string;
      toDate: string;
      initialBalance: number;
      trainSplitPct: number;
    },
  ): Promise<{ id: string }> {
    const record = await this.prisma.walkforward.create({
      data: {
        userId,
        symbol: params.symbol.toUpperCase(),
        interval: params.interval,
        strategy: params.strategy,
        paramRanges: params.paramRanges as object,
        trainFromDate: new Date(params.fromDate),
        trainToDate: new Date(params.toDate),
        testFromDate: new Date(params.toDate),
        testToDate: new Date(params.toDate),
        trainSplitPct: params.trainSplitPct,
        status: 'PENDING',
      },
    });

    // Enqueue async job to process the walkforward analysis
    await this.queue.add('run-walkforward', {
      walkforwardId: record.id,
      ...params,
    });

    await this.prisma.walkforward.update({
      where: { id: record.id },
      data: { status: 'RUNNING' },
    });

    return { id: record.id };
  }

  /**
   * Main walk-forward analysis logic.
   * Runs optimization on training data, then evaluates on test data.
   * Called by the queue processor.
   */
  async runWalkforwardAnalysis(
    walkforwardId: string,
    params: {
      symbol: string;
      interval: MarketKlineInterval;
      strategy: string;
      paramRanges: { param: string; values: number[] }[];
      fromDate: string;
      toDate: string;
      initialBalance: number;
      trainSplitPct: number;
    },
  ): Promise<WalkforwardResult> {
    // Compute date split
    const fromMs = new Date(params.fromDate).getTime();
    const toMs = new Date(params.toDate).getTime();
    const splitMs = fromMs + (toMs - fromMs) * (params.trainSplitPct / 100);

    const trainTo = new Date(splitMs);
    const testFrom = new Date(splitMs + 1); // one ms after train end

    const instrument = await this.prisma.instrument.findUnique({
      where: { symbol: params.symbol.toUpperCase() },
      select: { sourceSymbol: true },
    });
    const sourceSymbol = (instrument?.sourceSymbol ?? params.symbol.toUpperCase())
      .replace('/', '')
      .toUpperCase();

    // Generate all parameter combinations
    const combinations = this.generateCombinations(params.paramRanges);
    if (combinations.length === 0) {
      throw new Error('No parameter combinations to test');
    }

    // Run all combinations on training data and find best by PnL
    let bestParams: Record<string, unknown> = {};
    let bestTrainPnl = -Infinity;

    const trainResults: {
      params: Record<string, unknown>;
      metrics: WalkforwardMetrics;
      equityCurve: { at: string; cumulativePnl: number }[];
      trades: unknown[];
    }[] = [];

    for (const combo of combinations) {
      try {
        const result = await this.backtestService.runBacktest({
          symbol: params.symbol.toUpperCase(),
          interval: params.interval,
          strategyKey: params.strategy,
          strategyParams: combo,
          fromDate: new Date(params.fromDate),
          toDate: trainTo,
          initialBalance: params.initialBalance,
          sourceSymbol,
        });

        const r = { params: combo, metrics: result.metrics, equityCurve: result.equityCurve, trades: result.trades };
        trainResults.push(r);

        if (result.metrics.totalPnl > bestTrainPnl) {
          bestTrainPnl = result.metrics.totalPnl;
          bestParams = combo;
        }
      } catch {
        // Skip failed combinations
      }
    }

    if (Object.keys(bestParams).length === 0) {
      throw new Error('No successful training runs — check date range and symbol');
    }

    // Run best params on test data
    const testResult = await this.backtestService.runBacktest({
      symbol: params.symbol.toUpperCase(),
      interval: params.interval,
      strategyKey: params.strategy,
      strategyParams: bestParams,
      fromDate: testFrom,
      toDate: new Date(params.toDate),
      initialBalance: params.initialBalance,
      sourceSymbol,
    });

    // Find train equity curve from the best training run
    const bestTrainRun = trainResults.find((r) => {
      return Object.keys(bestParams).every(
        (k) => String(r.params[k]) === String(bestParams[k]),
      );
    });

    // Update DB record
    await this.prisma.walkforward.update({
      where: { id: walkforwardId },
      data: {
        status: 'COMPLETED',
        bestTrainParams: bestParams as object,
        trainMetrics: bestTrainRun?.metrics as object ?? null,
        trainEquityCurve: bestTrainRun?.equityCurve as object ?? null,
        trainTrades: bestTrainRun?.trades as object ?? null,
        trainPnl: bestTrainRun?.metrics.totalPnl ?? null,
        trainDrawdown: bestTrainRun?.metrics.maxDrawdown ?? null,
        trainWinRate: bestTrainRun?.metrics.winRate ?? null,
        testMetrics: testResult.metrics as object,
        testEquityCurve: testResult.equityCurve as object,
        testTrades: testResult.trades as object,
        testPnl: testResult.metrics.totalPnl,
        testDrawdown: testResult.metrics.maxDrawdown,
        testWinRate: testResult.metrics.winRate,
        testFromDate: testFrom,
        testToDate: new Date(params.toDate),
      },
    });

    this.logger.log(
      `Walkforward ${walkforwardId} completed. Best train params: ${JSON.stringify(bestParams)}`,
    );

    return {
      trainMetrics: bestTrainRun?.metrics ?? {
        totalTrades: 0,
        winningTrades: 0,
        losingTrades: 0,
        winRate: null,
        totalPnl: 0,
        maxDrawdown: 0,
        initialBalance: params.initialBalance,
        finalBalance: params.initialBalance,
        averageWin: null,
        averageLoss: null,
      },
      testMetrics: testResult.metrics,
      bestParams,
      trainEquityCurve: bestTrainRun?.equityCurve ?? [],
      testEquityCurve: testResult.equityCurve,
    };
  }

  async markFailed(walkforwardId: string, error: string) {
    await this.prisma.walkforward.update({
      where: { id: walkforwardId },
      data: { status: 'FAILED', error },
    });
  }

  async getWalkforward(userId: string, id: string) {
    const record = await this.prisma.walkforward.findUnique({
      where: { id, userId },
    });
    if (!record) return null;

    return {
      id: record.id,
      symbol: record.symbol,
      interval: record.interval,
      strategy: record.strategy,
      paramRanges: record.paramRanges,
      trainFromDate: record.trainFromDate,
      trainToDate: record.trainToDate,
      testFromDate: record.testFromDate,
      testToDate: record.testToDate,
      trainSplitPct: record.trainSplitPct,
      status: record.status,
      error: record.error,
      bestTrainParams: record.bestTrainParams,
      trainMetrics: record.trainMetrics,
      testMetrics: record.testMetrics,
      trainEquityCurve: record.trainEquityCurve,
      testEquityCurve: record.testEquityCurve,
      trainPnl: record.trainPnl,
      testPnl: record.testPnl,
      trainDrawdown: record.trainDrawdown,
      testDrawdown: record.testDrawdown,
      trainWinRate: record.trainWinRate,
      testWinRate: record.testWinRate,
      createdAt: record.createdAt,
    };
  }

  async listWalkforwards(userId: string, take = 20, skip = 0) {
    const [items, total] = await Promise.all([
      this.prisma.walkforward.findMany({
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
          trainPnl: true,
          testPnl: true,
          trainDrawdown: true,
          testDrawdown: true,
          error: true,
          createdAt: true,
        },
      }),
      this.prisma.walkforward.count({ where: { userId } }),
    ]);
    return { items, total, take, skip };
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
}
