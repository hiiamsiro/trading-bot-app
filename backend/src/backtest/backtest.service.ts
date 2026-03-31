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
  netPnl: number;
  maxDrawdown: number;
  initialBalance: number;
  finalBalance: number;
  averageWin: number | null;
  averageLoss: number | null;
  totalFees: number;
  grossPnl: number;
};

export type BacktestTrade = {
  id: number;
  entryTime: number;
  entryPrice: number;
  executedEntryPrice: number;
  quantity: number;
  side: string;
  exitTime: number | null;
  exitPrice: number | null;
  executedExitPrice: number | null;
  pnl: number | null;
  grossPnl: number | null;
  netPnl: number | null;
  entryFee: number;
  exitFee: number;
  totalFees: number;
  slippageBps: number;
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

// Realistic trading simulation defaults (same as DemoTradingService)
const DEFAULT_FEE_BPS = 10; // 0.10% per side (typical crypto spot fee)
const DEFAULT_MAX_SLIPPAGE_BPS = 5; // up to 0.05% slippage per side

type OpenPosition = {
  entryTime: number;
  entryPrice: number;
  executedEntryPrice: number;
  quantity: number;
  stopLoss: number | null;
  takeProfit: number | null;
  slippageBps: number;
  entryFee: number;
};

@Injectable()
export class BacktestService {
  private readonly logger = new Logger(BacktestService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly marketDataAdapter: BinanceMarketDataAdapter,
    private readonly strategyService: StrategyService,
  ) {}

  /**
   * Quick preview: run backtest against the last 100 candles.
   * Returns sample trades + win rate so user can validate a strategy before starting a bot.
   */
  async preview(params: {
    symbol: string;
    interval: MarketKlineInterval;
    strategyKey: string;
    strategyParams: Record<string, unknown>;
    sourceSymbol: string;
  }): Promise<BacktestResult> {
    const { symbol, interval, strategyKey, strategyParams, sourceSymbol } = params;

    const candles = await this.marketDataAdapter.getKlines(sourceSymbol, interval, 100);
    if (candles.length < 3) {
      throw new Error(`Insufficient candle data for ${symbol}. Got ${candles.length} candles.`);
    }

    const validated = this.strategyService.validateConfig(strategyKey, strategyParams);
    const requiredCandles = this.strategyService.getRequiredCandles(
      strategyKey,
      validated.normalizedParams,
    );

    return this.simulate(
      symbol,
      interval,
      validated.normalizedStrategy,
      validated.normalizedParams,
      candles,
      requiredCandles.entry,
      10000,
    );
  }

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
    const requiredCandles = this.strategyService.getRequiredCandles(
      strategyKey,
      validated.normalizedParams,
    );

    const results = this.simulate(
      symbol,
      interval,
      validated.normalizedStrategy,
      validated.normalizedParams,
      allCandles,
      requiredCandles.entry,
      initialBalance,
    );
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
    let cumulativeFees = 0;
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
    const feeBps = DEFAULT_FEE_BPS;
    const maxSlippageBps = DEFAULT_MAX_SLIPPAGE_BPS;

    function randomSlippageBps(): number {
      // Spread the slippage across [0, maxBps] — biased toward lower values
      const rand = Math.random();
      return Math.max(0, Math.min(Math.round(Math.sqrt(rand) * maxSlippageBps), maxSlippageBps));
    }

    function computeFee(notional: number, bps: number): number {
      return notional * (bps / 10000);
    }

    /**
     * Apply realistic slippage: price moves against trader.
     * Entry: BUY -> price goes up (slippage multiplier > 1)
     * Exit (BUY): SELL -> price goes down (slippage multiplier < 1)
     */
    function applySlippage(price: number, slippageBps: number, isEntry: boolean): number {
      const multiplier = isEntry
        ? 1 + slippageBps / 10000  // buys: price goes up
        : 1 - slippageBps / 10000; // sells/closes: price goes down
      return price * multiplier;
    }

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
          const exitSlippageBps = randomSlippageBps();
          const executedExitPrice = applySlippage(price, exitSlippageBps, false);
          const exitNotional = openPosition.quantity * executedExitPrice;
          const exitFee = computeFee(exitNotional, feeBps);

          // Gross PnL (executed prices)
          const grossPnl = (executedExitPrice - openPosition.executedEntryPrice) * openPosition.quantity;
          const netPnl = grossPnl - openPosition.entryFee - exitFee;

          cumulativePnl += netPnl;
          cumulativeFees += openPosition.entryFee + exitFee;

          if (grossPnl > 0) {
            winningTrades += 1;
            totalWinningPnl += netPnl;
          } else {
            losingTrades += 1;
            totalLosingPnl += netPnl;
          }

          trades.push({
            id: tradeCounter,
            entryTime: openPosition.entryTime,
            entryPrice: openPosition.entryPrice,
            executedEntryPrice: openPosition.executedEntryPrice,
            quantity: openPosition.quantity,
            side: 'BUY',
            exitTime: currentCandle.closeTime,
            exitPrice: price,
            executedExitPrice,
            pnl: netPnl,
            grossPnl,
            netPnl,
            entryFee: openPosition.entryFee,
            exitFee,
            totalFees: openPosition.entryFee + exitFee,
            slippageBps: exitSlippageBps,
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
          const exitSlippageBps = randomSlippageBps();
          const executedExitPrice = applySlippage(price, exitSlippageBps, false);
          const exitNotional = openPosition.quantity * executedExitPrice;
          const exitFee = computeFee(exitNotional, feeBps);
          const grossPnl = (executedExitPrice - openPosition.executedEntryPrice) * openPosition.quantity;
          const netPnl = grossPnl - openPosition.entryFee - exitFee;

          cumulativePnl += netPnl;
          cumulativeFees += openPosition.entryFee + exitFee;

          if (grossPnl > 0) {
            winningTrades += 1;
            totalWinningPnl += netPnl;
          } else {
            losingTrades += 1;
            totalLosingPnl += netPnl;
          }

          trades.push({
            id: tradeCounter,
            entryTime: openPosition.entryTime,
            entryPrice: openPosition.entryPrice,
            executedEntryPrice: openPosition.executedEntryPrice,
            quantity: openPosition.quantity,
            side: 'BUY',
            exitTime: currentCandle.closeTime,
            exitPrice: price,
            executedExitPrice,
            pnl: netPnl,
            grossPnl,
            netPnl,
            entryFee: openPosition.entryFee,
            exitFee,
            totalFees: openPosition.entryFee + exitFee,
            slippageBps: exitSlippageBps,
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
          closes: { entry: closes, trend: [] },
        });

        if (decision.signal === 'BUY') {
          const entryPrice = currentCandle.close;
          const slippageBps = randomSlippageBps();
          const executedEntryPrice = applySlippage(entryPrice, slippageBps, true);
          const entryNotional = quantity * executedEntryPrice;
          const entryFee = computeFee(entryNotional, feeBps);

          // Net cost: subtract entry fee immediately from equity
          cumulativePnl -= entryFee;
          cumulativeFees += entryFee;

          const stopLoss = slPct > 0 && slPct < 100 ? executedEntryPrice * (1 - slPct / 100) : null;
          const takeProfit = tpPct > 0 && tpPct < 100 ? executedEntryPrice * (1 + tpPct / 100) : null;

          openPosition = {
            entryTime: currentCandle.openTime,
            entryPrice,
            executedEntryPrice,
            quantity,
            stopLoss,
            takeProfit,
            slippageBps,
            entryFee,
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
      const exitSlippageBps = randomSlippageBps();
      const executedExitPrice = applySlippage(price, exitSlippageBps, false);
      const exitNotional = openPosition.quantity * executedExitPrice;
      const exitFee = computeFee(exitNotional, feeBps);

      const grossPnl = (executedExitPrice - openPosition.executedEntryPrice) * openPosition.quantity;
      const netPnl = grossPnl - openPosition.entryFee - exitFee;
      cumulativePnl += netPnl;
      cumulativeFees += openPosition.entryFee + exitFee;

      if (grossPnl > 0) {
        winningTrades += 1;
        totalWinningPnl += netPnl;
      } else {
        losingTrades += 1;
        totalLosingPnl += netPnl;
      }

      trades.push({
        id: tradeCounter,
        entryTime: openPosition.entryTime,
        entryPrice: openPosition.entryPrice,
        executedEntryPrice: openPosition.executedEntryPrice,
        quantity: openPosition.quantity,
        side: 'BUY',
        exitTime: lastCandle.closeTime,
        exitPrice: price,
        executedExitPrice,
        pnl: netPnl,
        grossPnl,
        netPnl,
        entryFee: openPosition.entryFee,
        exitFee,
        totalFees: openPosition.entryFee + exitFee,
        slippageBps: exitSlippageBps,
        closeReason: 'backtest_end',
      });
    }

    const totalTrades = winningTrades + losingTrades;
    const finalBalance = initialBalance + cumulativePnl;
    // Net PnL = cumulative PnL after all fees
    const netPnlTotal = cumulativePnl;
    // Gross PnL = net + total fees (PnL before fees were deducted)
    const grossPnlTotal = cumulativePnl + cumulativeFees;

    return {
      metrics: {
        totalTrades,
        winningTrades,
        losingTrades,
        winRate: totalTrades > 0 ? winningTrades / totalTrades : null,
        totalPnl: netPnlTotal,
        netPnl: netPnlTotal,
        maxDrawdown,
        initialBalance,
        finalBalance,
        averageWin: winningTrades > 0 ? totalWinningPnl / winningTrades : null,
        averageLoss: losingTrades > 0 ? totalLosingPnl / losingTrades : null,
        totalFees: cumulativeFees,
        grossPnl: grossPnlTotal,
      },
      trades,
      equityCurve,
    };
  }
}
