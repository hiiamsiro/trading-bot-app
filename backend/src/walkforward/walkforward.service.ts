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
    // Compute date split immediately so the DB record has correct initial windows
    const fromMs = new Date(params.fromDate).getTime();
    const toMs = new Date(params.toDate).getTime();
    const splitMs = fromMs + (toMs - fromMs) * (params.trainSplitPct / 100);
    const splitDate = new Date(splitMs);

    // Use raw SQL to bypass stale Prisma client (expects userId but DB has user_id).
    const [{ id }] = await this.prisma.$queryRaw<{ id: string }[]>`
      INSERT INTO walkforwards (
        id, user_id, symbol, interval, strategy, param_ranges,
        train_from_date, train_to_date, test_from_date, test_to_date,
        train_split_pct, status
      ) VALUES (
        gen_random_uuid(),
        ${userId},
        ${params.symbol.toUpperCase()},
        ${params.interval},
        ${params.strategy},
        ${JSON.stringify(params.paramRanges)}::jsonb,
        ${new Date(params.fromDate)},
        ${splitDate},
        ${new Date(splitMs + 1)},
        ${new Date(params.toDate)},
        ${params.trainSplitPct},
        'PENDING'
      )
      RETURNING id
    `;

    // Enqueue async job to process the walkforward analysis
    await this.queue.add('run-walkforward', {
      walkforwardId: id,
      ...params,
    });

    return { id };
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
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        this.logger.warn(`Walkforward combination skipped (${combo}): ${msg}`);
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

    // Update DB record using raw SQL (bypasses Prisma userId → user_id mismatch).
    await this.prisma.$queryRaw`
      UPDATE walkforwards SET
        status = 'COMPLETED',
        best_train_params = ${JSON.stringify(bestParams)}::jsonb,
        train_metrics = ${JSON.stringify(bestTrainRun?.metrics ?? null)}::jsonb,
        train_equity_curve = ${JSON.stringify(bestTrainRun?.equityCurve ?? null)}::jsonb,
        train_trades = ${JSON.stringify(bestTrainRun?.trades ?? null)}::jsonb,
        train_pnl = ${bestTrainRun?.metrics.totalPnl ?? null},
        train_drawdown = ${bestTrainRun?.metrics.maxDrawdown ?? null},
        train_win_rate = ${bestTrainRun?.metrics.winRate ?? null},
        test_metrics = ${JSON.stringify(testResult.metrics)}::jsonb,
        test_equity_curve = ${JSON.stringify(testResult.equityCurve)}::jsonb,
        test_trades = ${JSON.stringify(testResult.trades)}::jsonb,
        test_pnl = ${testResult.metrics.totalPnl},
        test_drawdown = ${testResult.metrics.maxDrawdown},
        test_win_rate = ${testResult.metrics.winRate},
        test_from_date = ${testFrom},
        test_to_date = ${new Date(params.toDate)}
      WHERE id = ${walkforwardId}::uuid
    `;

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
    // Use raw SQL to bypass Prisma userId → user_id mismatch.
    await this.prisma.$queryRaw`
      UPDATE walkforwards SET status = 'FAILED', error = ${error}
      WHERE id = ${walkforwardId}::uuid
    `;
  }

  async getWalkforward(userId: string, id: string) {
    const [record] = await this.prisma.$queryRaw<{
        id: string;
        symbol: string;
        interval: string;
        strategy: string;
        param_ranges: object;
        train_from_date: Date;
        train_to_date: Date;
        test_from_date: Date | null;
        test_to_date: Date | null;
        train_split_pct: number;
        status: string;
        error: string | null;
        best_train_params: object | null;
        train_metrics: object | null;
        test_metrics: object | null;
        train_equity_curve: object | null;
        test_equity_curve: object | null;
        train_trades: object | null;
        test_trades: object | null;
        train_pnl: number | null;
        test_pnl: number | null;
        train_drawdown: number | null;
        test_drawdown: number | null;
        train_win_rate: number | null;
        test_win_rate: number | null;
        created_at: Date;
      }[]>`SELECT * FROM walkforwards WHERE id = ${id}::uuid AND user_id = ${userId}`;
    if (!record) return null;

    return {
      id: record.id,
      symbol: record.symbol,
      interval: record.interval,
      strategy: record.strategy,
      paramRanges: record.param_ranges,
      trainFromDate: record.train_from_date,
      trainToDate: record.train_to_date,
      testFromDate: record.test_from_date,
      testToDate: record.test_to_date,
      trainSplitPct: record.train_split_pct,
      status: record.status,
      error: record.error,
      bestTrainParams: record.best_train_params,
      trainMetrics: record.train_metrics,
      testMetrics: record.test_metrics,
      trainEquityCurve: record.train_equity_curve,
      testEquityCurve: record.test_equity_curve,
      trainPnl: record.train_pnl,
      testPnl: record.test_pnl,
      trainDrawdown: record.train_drawdown,
      testDrawdown: record.test_drawdown,
      trainWinRate: record.train_win_rate,
      testWinRate: record.test_win_rate,
      createdAt: record.created_at,
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
