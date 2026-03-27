import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { BinanceMarketDataAdapter } from '../market-data/providers/binance-market-data.adapter';
import { StrategyService } from '../strategy/strategy.service';
import {
  MarketKline,
  MarketKlineInterval,
} from '../market-data/providers/market-data-provider.types';
import { Prisma } from '@prisma/client';

export type BacktestMetrics = {
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

export type BacktestTrade = {
  id: number;
  entryTime: number;
  entryPrice: number;
  quantity: number;
  side: string;
  exitTime: number | null;
  exitPrice: number | null;
  pnl: number | null;
  closeReason: string | null;
};

export type BacktestEquityPoint = {
  at: string;
  cumulativePnl: number;
};

export type BacktestResult = {
  metrics: BacktestMetrics;
  trades: BacktestTrade[];
  equityCurve: BacktestEquityPoint[];
};

type OpenPosition = {
  entryTime: number;
  entryPrice: number;
  quantity: number;
  stopLoss: number | null;
  takeProfit: number | null;
};

@Injectable()
export class BacktestService {
  private readonly logger = new Logger(BacktestService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly marketDataAdapter: BinanceMarketDataAdapter,
    private readonly strategyService: StrategyService,
  ) {}

  async runBacktest(params: {
    symbol: string;
    interval: MarketKlineInterval;
    strategyKey: string;
    strategyParams: Record<string, unknown>;
    fromDate: Date;
    toDate: Date;
    initialBalance: number;
    sourceSymbol: string;
  }): Promise<BacktestResult> {
    const {
      symbol,
      interval,
      strategyKey,
      strategyParams,
      fromDate,
      toDate,
      initialBalance,
      sourceSymbol,
    } = params;

    // Fetch historical candles from provider
    const allCandles = await this.fetchCandlesInRange(sourceSymbol, interval, fromDate, toDate);
    if (allCandles.length < 3) {
      throw new Error(
        `Insufficient candle data for ${symbol} between ${fromDate.toISOString()} and ${toDate.toISOString()}. Got ${allCandles.length} candles.`,
      );
    }

    // Validate strategy config
    const validated = this.strategyService.validateConfig(strategyKey, strategyParams);
    const requiredCandles = this.strategyService.getRequiredCandles(strategyKey, validated.normalizedParams);

    const results = this.simulate(symbol, interval, validated.normalizedStrategy, validated.normalizedParams, allCandles, requiredCandles, initialBalance);
    return results;
  }

  private async fetchCandlesInRange(
    sourceSymbol: string,
    interval: MarketKlineInterval,
    _from: Date,
    to: Date,
  ): Promise<MarketKline[]> {
    // Binance REST API returns up to 1500 candles per request.
    // For backtests that span long ranges, we fetch the maximum available
    // and filter to the requested window.
    const LIMIT = 1500;
    const candles = await this.marketDataAdapter.getKlines(sourceSymbol, interval, LIMIT);
    if (candles.length === 0) return [];

    // If the user requested toDate before the oldest candle, return empty.
    const cutoff = to.getTime();
    const oldest = candles[0];
    const newest = candles[candles.length - 1];

    // Return candles that close before the user's toDate
    return candles.filter((c) => c.closeTime <= cutoff);
  }

  private simulate(
    symbol: string,
    interval: MarketKlineInterval,
    strategyKey: string,
    params: Record<string, unknown>,
    candles: MarketKline[],
    requiredCandles: number,
    initialBalance: number,
  ): BacktestResult {
    const trades: BacktestTrade[] = [];
    const equityCurve: BacktestEquityPoint[] = [];

    let openPosition: OpenPosition | null = null;
    let cumulativePnl = 0;
    let peakEquity = initialBalance;
    let maxDrawdown = 0;
    let totalWinningPnl = 0;
    let totalLosingPnl = 0;
    let winningTrades = 0;
    let losingTrades = 0;
    let tradeCounter = 0;

    const slPct = Number(params.stopLossPercent);
    const tpPct = Number(params.takeProfitPercent);
    const quantity = Number(params.quantity) > 0 ? Number(params.quantity) : 0.01;
    const maxDailyLoss = Number(params.maxDailyLoss);

    // Slide window: evaluate on each completed candle
    for (let i = requiredCandles; i < candles.length; i += 1) {
      const completedCandles = candles.slice(0, i + 1);
      const currentCandle = candles[i];
      const closes = completedCandles.map((c) => c.close);

      // 1. Check stop-loss / take-profit on open position
      if (openPosition) {
        const price = currentCandle.close;
        let closed = false;
        let closeReason = '';

        if (openPosition.stopLoss != null && price <= openPosition.stopLoss) {
          closed = true;
          closeReason = 'stop_loss';
        } else if (openPosition.takeProfit != null && price >= openPosition.takeProfit) {
          closed = true;
          closeReason = 'take_profit';
        }

        if (closed) {
          const pnl = (price - openPosition.entryPrice) * openPosition.quantity;
          cumulativePnl += pnl;

          if (pnl > 0) {
            winningTrades += 1;
            totalWinningPnl += pnl;
          } else {
            losingTrades += 1;
            totalLosingPnl += pnl;
          }

          trades.push({
            id: tradeCounter,
            entryTime: openPosition.entryTime,
            entryPrice: openPosition.entryPrice,
            quantity: openPosition.quantity,
            side: 'BUY',
            exitTime: currentCandle.closeTime,
            exitPrice: price,
            pnl,
            closeReason,
          });
          tradeCounter += 1;
          openPosition = null;
        }
      }

      // 2. Enforce max daily loss (computed from cumulative PnL vs initialBalance)
      if (maxDailyLoss > 0 && cumulativePnl < -maxDailyLoss) {
        if (openPosition) {
          const price = currentCandle.close;
          const pnl = (price - openPosition.entryPrice) * openPosition.quantity;
          cumulativePnl += pnl;

          if (pnl > 0) {
            winningTrades += 1;
            totalWinningPnl += pnl;
          } else {
            losingTrades += 1;
            totalLosingPnl += pnl;
          }

          trades.push({
            id: tradeCounter,
            entryTime: openPosition.entryTime,
            entryPrice: openPosition.entryPrice,
            quantity: openPosition.quantity,
            side: 'BUY',
            exitTime: currentCandle.closeTime,
            exitPrice: price,
            pnl,
            closeReason: 'max_daily_loss',
          });
          tradeCounter += 1;
          openPosition = null;
        }
        break; // stop backtest
      }

      // 3. Strategy evaluation (only if no open position)
      if (!openPosition) {
        const decision = this.strategyService.evaluate({
          strategyKey,
          instrument: symbol,
          interval,
          params,
          closes,
        });

        if (decision.signal === 'BUY') {
          const entryPrice = currentCandle.close;
          const stopLoss =
            slPct > 0 && slPct < 100 ? entryPrice * (1 - slPct / 100) : null;
          const takeProfit =
            tpPct > 0 && tpPct < 100 ? entryPrice * (1 + tpPct / 100) : null;

          openPosition = {
            entryTime: currentCandle.openTime,
            entryPrice,
            quantity,
            stopLoss,
            takeProfit,
          };
        }
      }

      // 4. Record equity point at close of this candle
      const equity = initialBalance + cumulativePnl;
      if (equity > peakEquity) peakEquity = equity;
      const drawdown = peakEquity > 0 ? (peakEquity - equity) / peakEquity : 0;
      if (drawdown > maxDrawdown) maxDrawdown = drawdown;

      equityCurve.push({
        at: new Date(currentCandle.closeTime).toISOString(),
        cumulativePnl,
      });
    }

    // Close any remaining open position at last candle close
    if (openPosition) {
      const lastCandle = candles[candles.length - 1];
      const price = lastCandle.close;
      const pnl = (price - openPosition.entryPrice) * openPosition.quantity;
      cumulativePnl += pnl;

      if (pnl > 0) {
        winningTrades += 1;
        totalWinningPnl += pnl;
      } else {
        losingTrades += 1;
        totalLosingPnl += pnl;
      }

      trades.push({
        id: tradeCounter,
        entryTime: openPosition.entryTime,
        entryPrice: openPosition.entryPrice,
        quantity: openPosition.quantity,
        side: 'BUY',
        exitTime: lastCandle.closeTime,
        exitPrice: price,
        pnl,
        closeReason: 'backtest_end',
      });
    }

    const totalTrades = winningTrades + losingTrades;
    const finalBalance = initialBalance + cumulativePnl;

    return {
      metrics: {
        totalTrades,
        winningTrades,
        losingTrades,
        winRate: totalTrades > 0 ? winningTrades / totalTrades : null,
        totalPnl: cumulativePnl,
        maxDrawdown,
        initialBalance,
        finalBalance,
        averageWin: winningTrades > 0 ? totalWinningPnl / winningTrades : null,
        averageLoss: losingTrades > 0 ? totalLosingPnl / losingTrades : null,
      },
      trades,
      equityCurve,
    };
  }
}
