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
  // Trailing stop
  trailingStopDistance: number | null; // e.g. 0.02 = 2%
  highestPrice: number;
  // Partial take profit
  partialTpPercent: number | null; // e.g. 50 = close 50% at TP
  partialTpExecuted: boolean;
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
    const maxDailyLoss = Number(params.maxDailyLoss);
    const feeBps = DEFAULT_FEE_BPS;
    const maxSlippageBps = DEFAULT_MAX_SLIPPAGE_BPS;
    // Trailing stop: distance in % (e.g. 2 = 2% from high)
    const trailingStopDistance = params.trailingStopDistance != null
      ? Number(params.trailingStopDistance) : null;
    // Partial TP: % of position to close at TP (e.g. 50 = close 50% at TP)
    const partialTpPercent = params.partialTpPercent != null
      ? Number(params.partialTpPercent) : null;
    // Position sizing: 'fixed' | 'balance_percent' | 'risk_based'
    const positionSizeMode = (params.positionSizeMode as string) ?? 'fixed';
    const sizeParam = Number(params.quantity) > 0 ? Number(params.quantity) : 0.01;
    let currentBalance = initialBalance;

    function resolveQuantity(entryPrice: number): number {
      if (positionSizeMode === 'fixed') {
        return sizeParam;
      }
      if (positionSizeMode === 'balance_percent') {
        // sizeParam = percentage of balance as decimal (e.g. 0.01 = 1%)
        const notional = currentBalance * sizeParam;
        return notional / entryPrice;
      }
      if (positionSizeMode === 'risk_based') {
        // Risk-based: risk sizeParam% of balance, stop loss limits max loss
        if (slPct <= 0 || slPct >= 100) {
          return sizeParam; // fallback to fixed if no stop loss defined
        }
        const riskAmount = currentBalance * (sizeParam / 100);
        const lossPerUnit = entryPrice * (slPct / 100);
        return riskAmount / lossPerUnit;
      }
      return sizeParam;
    }

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

        // Compute trailing stop: stop price = high - distance%
        const trailingStop = openPosition.trailingStopDistance != null
          ? openPosition.highestPrice * (1 - openPosition.trailingStopDistance)
          : null;
        // Active stop = max of static SL and trailing stop (trailing only moves up)
        const activeStopLoss = trailingStop != null
          ? (openPosition.stopLoss == null
            ? trailingStop
            : Math.max(openPosition.stopLoss, trailingStop))
          : openPosition.stopLoss;

        let closed = false;
        let closeReason = '';
        let partialClose = false;

        if (activeStopLoss != null && price <= activeStopLoss) {
          closed = true;
          closeReason = openPosition.trailingStopDistance != null && activeStopLoss > (openPosition.stopLoss ?? -Infinity)
            ? 'trailing_stop'
            : 'stop_loss';
        } else if (openPosition.takeProfit != null && price >= openPosition.takeProfit) {
          // Check partial TP first
          if (openPosition.partialTpPercent != null && !openPosition.partialTpExecuted) {
            partialClose = true;
            closeReason = 'partial_take_profit';
          } else {
            closed = true;
            closeReason = 'take_profit';
          }
        }

        if (closed || partialClose) {
          const exitSlippageBps = randomSlippageBps();
          const executedExitPrice = applySlippage(price, exitSlippageBps, false);
          const closedQty = partialClose
            ? openPosition.quantity * openPosition.partialTpPercent!
            : openPosition.quantity;
          const remainingQty = partialClose
            ? openPosition.quantity * (1 - openPosition.partialTpPercent!)
            : 0;
          const exitNotional = closedQty * executedExitPrice;
          const exitFee = computeFee(exitNotional, feeBps);

          // Gross PnL on the closed qty
          const grossPnl = (executedExitPrice - openPosition.executedEntryPrice) * closedQty;
          // Entry fee proportion for the closed qty
          const entryFeeClosed = openPosition.entryFee * (closedQty / openPosition.quantity);
          const netPnl = grossPnl - entryFeeClosed - exitFee;

          cumulativePnl += netPnl;
          cumulativeFees += entryFeeClosed + exitFee;

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
            quantity: closedQty,
            side: 'BUY',
            exitTime: currentCandle.closeTime,
            exitPrice: price,
            executedExitPrice,
            pnl: netPnl,
            grossPnl,
            netPnl,
            entryFee: entryFeeClosed,
            exitFee,
            totalFees: entryFeeClosed + exitFee,
            slippageBps: exitSlippageBps,
            closeReason,
          });
          // Update running balance with net PnL
          currentBalance += netPnl;
          if (currentBalance < 0) currentBalance = 0;
          tradeCounter += 1;

          if (partialClose) {
            // Update remaining position
            openPosition.quantity = remainingQty;
            openPosition.partialTpExecuted = true;
          } else {
            openPosition = null;
          }
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
          currentBalance += netPnl;
          if (currentBalance < 0) currentBalance = 0;
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
          const quantity = resolveQuantity(executedEntryPrice);
          const entryNotional = quantity * executedEntryPrice;
          const entryFee = computeFee(entryNotional, feeBps);

          // Subtract entry fee from running balance immediately
          currentBalance -= entryFee;
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
            trailingStopDistance: trailingStopDistance != null && trailingStopDistance > 0 ? trailingStopDistance / 100 : null,
            highestPrice: executedEntryPrice,
            partialTpPercent: partialTpPercent != null && partialTpPercent > 0 ? partialTpPercent / 100 : null,
            partialTpExecuted: false,
          };
        }
      }

      // 4. Update trailing stop highest price on each candle
      if (openPosition) {
        if (currentCandle.high > openPosition.highestPrice) {
          openPosition.highestPrice = currentCandle.high;
        }
      }

      // 5. Record equity point at close of this candle
      const equity = currentBalance;
      if (equity > peakEquity) peakEquity = equity;
      const drawdown = peakEquity > 0 ? (peakEquity - equity) / peakEquity : 0;
      if (drawdown > maxDrawdown) maxDrawdown = drawdown;

      equityCurve.push({
        at: new Date(currentCandle.closeTime).toISOString(),
        cumulativePnl: currentBalance - initialBalance,
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
      currentBalance += netPnl;
      if (currentBalance < 0) currentBalance = 0;
    }

    const totalTrades = winningTrades + losingTrades;
    const finalBalance = currentBalance;
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
