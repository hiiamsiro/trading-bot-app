import { Injectable } from '@nestjs/common';
import {
  Bot,
  ExecutionSession,
  Instrument,
  LogLevel,
  NotificationType,
  Prisma,
  StrategyConfig,
  Trade,
  TradeSide,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { MarketDataGateway } from '../market-data/market-data.gateway';
import { MarketDataService } from '../market-data/market-data.service';
import { MarketKlineInterval } from '../market-data/providers/market-data-provider.types';
import { StrategyService } from '../strategy/strategy.service';
import { BotsService } from '../bots/bots.service';

type BotWithStrategy = Bot & {
  strategyConfig: StrategyConfig | null;
  executionSession: ExecutionSession | null;
};

// Realistic trading simulation defaults (can be overridden via env)
const DEFAULT_FEE_BPS = 10; // 0.10% per side (typical crypto spot fee)
const DEFAULT_MAX_SLIPPAGE_BPS = 5; // up to 0.05% slippage per side

@Injectable()
export class DemoTradingService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly marketData: MarketDataService,
    private readonly strategy: StrategyService,
    private readonly gateway: MarketDataGateway,
    private readonly botsService: BotsService,
  ) {}

  /**
   * Returns a random slippage amount in basis points (0 to maxBps).
   * Uses a simple deterministic-ish spread to keep results reproducible in demos.
   */
  private randomSlippageBps(maxBps: number): number {
    // Spread the slippage across [0, maxBps] — biased toward lower values
    const rand = Math.random();
    const bps = Math.round(Math.sqrt(rand) * maxBps);
    return Math.max(0, Math.min(bps, maxBps));
  }

  /**
   * Computes fee for a trade side and notional value.
   * feeBps is in basis points (10 bps = 0.10%).
   */
  private computeFee(notionalValue: number, feeBps: number): number {
    return notionalValue * (feeBps / 10000);
  }

  private parseRequestedInterval(params: Record<string, unknown>): string | null {
    const raw = params.interval ?? params.timeframe ?? params.candleInterval ?? null;
    if (typeof raw !== 'string') {
      return null;
    }
    const normalized = raw.trim().toLowerCase();
    return normalized.length > 0 ? normalized : null;
  }

  private resolveInterval(
    instrument: Instrument,
    params: Record<string, unknown>,
  ): MarketKlineInterval {
    const supportedRaw = Array.isArray(instrument.supportedIntervals)
      ? instrument.supportedIntervals
      : [];
    const supported = supportedRaw
      .filter((item): item is string => typeof item === 'string')
      .map((item) => item.toLowerCase())
      .filter((item): item is MarketKlineInterval => this.strategy.isSupportedInterval(item));
    const fallback: MarketKlineInterval = supported[0] ?? '1m';
    const requested = this.parseRequestedInterval(params);
    if (!requested) {
      return fallback;
    }
    if (!this.strategy.isSupportedInterval(requested)) {
      throw new Error(
        `Unsupported interval "${requested}". Supported values: 1m, 5m, 15m, 1h, 4h, 1d`,
      );
    }
    if (!supported.includes(requested)) {
      throw new Error(
        `Interval "${requested}" is not supported for instrument ${instrument.symbol}. Supported intervals: ${supported.join(', ')}`,
      );
    }
    return requested;
  }

  /**
   * Resolves the optional trend (higher) timeframe from strategy params.
   * Returns null when no trend interval is configured (single-timeframe mode).
   */
  private parseTrendInterval(params: Record<string, unknown>): MarketKlineInterval | null {
    const raw = params.trendInterval ?? null;
    if (typeof raw !== 'string' || raw.trim().length === 0) {
      return null;
    }
    const normalized = raw.trim().toLowerCase() as MarketKlineInterval;
    if (!this.strategy.isSupportedInterval(normalized)) {
      return null;
    }
    return normalized;
  }

  async processTick(bot: BotWithStrategy): Promise<void> {
    if (bot.status !== 'RUNNING' || !bot.strategyConfig) {
      return;
    }

    const instrument = await this.prisma.instrument.findUnique({
      where: { symbol: bot.symbol },
    });
    if (!instrument || !instrument.isActive || instrument.status !== 'ACTIVE') {
      await this.botsService.appendLog(
        bot.id,
        LogLevel.WARNING,
        'Skipped strategy evaluation',
        {
          symbol: bot.symbol,
          reason: 'active_instrument_not_found',
        },
        'market_data',
      );
      return;
    }

    const livePrice = await this.marketData.getLatestPrice(bot.symbol, {
      forceRefresh: true,
    });
    if (livePrice === null) {
      await this.botsService.appendLog(
        bot.id,
        LogLevel.WARNING,
        'Skipped strategy evaluation',
        {
          symbol: bot.symbol,
          reason: 'live_price_unavailable',
        },
        'market_data',
      );
      return;
    }

    const openTrade = await this.prisma.trade.findFirst({
      where: {
        botId: bot.id,
        closedAt: null,
        status: 'EXECUTED',
      },
      orderBy: { createdAt: 'desc' },
    });

    if (openTrade) {
      const params = (bot.strategyConfig.params ?? {}) as Record<string, unknown>;
      const explanation = (openTrade.openExplanation ?? {}) as Record<string, unknown>;
      const hit = this.checkStopTake(openTrade, livePrice, params, explanation);
      if (hit) {
        await this.closeTrade(bot, openTrade, livePrice, `risk:${hit}`, {
          signal: 'RISK_EXIT',
          reason: hit,
          metadata: {
            trigger: hit,
            checkedPrice: livePrice,
            stopLoss: openTrade.stopLoss,
            takeProfit: openTrade.takeProfit,
          },
        });
        return;
      }
    }

    const params = (bot.strategyConfig.params ?? {}) as Record<string, unknown>;
    const reachedDailyLossLimit = await this.enforceMaxDailyLoss(bot, openTrade, livePrice, params);
    if (reachedDailyLossLimit) {
      return;
    }

    const interval = this.resolveInterval(instrument, params);
    const requiredCandles = this.strategy.getRequiredCandles(bot.strategyConfig.strategy, params);
    const trendInterval = this.parseTrendInterval(params);

    const [entryCloses, trendCloses] = await Promise.all([
      this.marketData.getCloses(bot.symbol, requiredCandles.entry, interval),
      trendInterval
        ? this.marketData.getCloses(bot.symbol, requiredCandles.trend, trendInterval)
        : Promise.resolve([]),
    ]);

    const decision = this.strategy.evaluate({
      strategyKey: bot.strategyConfig.strategy,
      instrument: bot.symbol,
      interval,
      params,
      closes: { entry: entryCloses, trend: trendCloses },
    });

    await this.botsService.appendLog(
      bot.id,
      LogLevel.DEBUG,
      'Strategy signal evaluated',
      {
        symbol: bot.symbol,
        strategy: bot.strategyConfig.strategy,
        interval,
        trendInterval,
        signal: decision.signal,
        reason: decision.reason,
        requiredCandles,
        entryClosesCount: entryCloses.length,
        trendClosesCount: trendCloses.length,
        livePrice,
        ...decision.metadata,
      },
      'strategy',
    );

    // Stamp that the bot received fresh market data and evaluated a signal
    await this.prisma.bot.update({
      where: { id: bot.id },
      data: { lastSignalAt: new Date() },
    });

    if (decision.signal === 'BUY' && !openTrade) {
      await this.openLong(bot, livePrice, params, decision);
    } else if (decision.signal === 'SELL' && openTrade && openTrade.side === TradeSide.BUY) {
      await this.closeTrade(bot, openTrade, livePrice, `strategy:${decision.reason}`, decision);
    }
  }

  private checkStopTake(
    trade: Trade,
    price: number,
    params: Record<string, unknown>,
    explanation: Record<string, unknown>,
  ): 'stop_loss' | 'trailing_stop' | 'take_profit' | 'partial_take_profit' | null {
    if (trade.side === TradeSide.BUY) {
      const trailingDistance = params.trailingStopDistance != null
        ? Number(params.trailingStopDistance) : null;
      const partialTpPercent = params.partialTpPercent != null
        ? Number(params.partialTpPercent) : null;
      const highestPrice = (explanation.highestPrice as number) ?? trade.price;

      // Update highest price if current is higher
      if (price > highestPrice) {
        (explanation as { highestPrice: number }).highestPrice = price;
      }

      // Trailing stop: stop = highest - distance%
      if (trailingDistance != null && trailingDistance > 0) {
        const trailingStop = highestPrice * (1 - trailingDistance / 100);
        // Active stop = max(static SL, trailing stop)
        const activeStop = trade.stopLoss != null
          ? Math.max(trade.stopLoss, trailingStop)
          : trailingStop;
        if (activeStop != null && price <= activeStop) {
          return activeStop > (trade.stopLoss ?? -Infinity)
            ? 'trailing_stop' : 'stop_loss';
        }
      } else if (trade.stopLoss != null && price <= trade.stopLoss) {
        return 'stop_loss';
      }

      // Take profit check
      if (trade.takeProfit != null && price >= trade.takeProfit) {
        // Partial TP if enabled and not yet executed
        const partialExecuted = explanation.partialTpExecuted === true;
        if (partialTpPercent != null && partialTpPercent > 0 && !partialExecuted) {
          return 'partial_take_profit';
        }
        return 'take_profit';
      }
    }
    return null;
  }

  private computePnlLong(trade: Trade, exitPrice: number): number {
    return (exitPrice - trade.price) * trade.quantity;
  }

  private async openLong(
    bot: BotWithStrategy,
    entryPrice: number,
    params: Record<string, unknown>,
    decision: { signal: string; reason: string; metadata: Record<string, unknown> },
  ): Promise<void> {
    const existingOpenTrade = await this.prisma.trade.findFirst({
      where: {
        botId: bot.id,
        closedAt: null,
        status: 'EXECUTED',
      },
      select: { id: true },
    });
    if (existingOpenTrade) {
      await this.botsService.appendLog(
        bot.id,
        LogLevel.WARNING,
        'Skipped opening position',
        {
          symbol: bot.symbol,
          reason: 'open_position_already_exists',
          activeTradeId: existingOpenTrade.id,
        },
        'trade',
      );
      return;
    }

    // --- Dynamic position sizing ---
    const positionSizeMode = (params.positionSizeMode as string) ?? 'fixed';
    const sizeParam = Number(params.quantity) > 0 ? Number(params.quantity) : 0.01;
    const slPct = Number(params.stopLossPercent ?? 0);
    let quantity = sizeParam;

    if (positionSizeMode === 'balance_percent') {
      // sizeParam = percentage as decimal (0.01 = 1% of balance)
      const balance = bot.executionSession?.currentBalance ?? 10000;
      quantity = (balance * sizeParam) / entryPrice;
    } else if (positionSizeMode === 'risk_based') {
      // Risk-based: sizeParam = risk % of balance
      if (slPct > 0 && slPct < 100) {
        const balance = bot.executionSession?.currentBalance ?? 10000;
        const riskAmount = balance * (sizeParam / 100);
        const lossPerUnit = entryPrice * (slPct / 100);
        quantity = riskAmount / lossPerUnit;
      }
    }

    const slippageBps = this.randomSlippageBps(DEFAULT_MAX_SLIPPAGE_BPS);
    const entryFeeBps = DEFAULT_FEE_BPS;

    // Slippage moves price against the trader on entry (higher for buys)
    const slippageMultiplier = 1 + slippageBps / 10000;
    const executedEntryPrice = entryPrice * slippageMultiplier;
    const notional = quantity * executedEntryPrice;
    const entryFee = this.computeFee(notional, entryFeeBps);

    const totalValue = quantity * executedEntryPrice;
    const tpPct = Number(params.takeProfitPercent ?? 0);
    // Stop-loss and take-profit are set relative to the executed price (after slippage)
    const stopLoss =
      slPct > 0
        ? executedEntryPrice * (1 - slPct / 100)
        : null;
    const takeProfit =
      tpPct > 0
        ? executedEntryPrice * (1 + tpPct / 100)
        : null;

    const trailingDistance = params.trailingStopDistance != null
      ? Number(params.trailingStopDistance) : null;
    const partialTpPct = params.partialTpPercent != null
      ? Number(params.partialTpPercent) : null;
    const openExplanation = {
      ...decision.metadata,
      highestPrice: executedEntryPrice,
      trailingStopDistance: trailingDistance,
      partialTpPercent: partialTpPct,
      partialTpExecuted: false,
    };

    const trade = await this.prisma.trade.create({
      data: {
        botId: bot.id,
        symbol: bot.symbol,
        side: TradeSide.BUY,
        quantity,
        price: executedEntryPrice,
        totalValue,
        status: 'EXECUTED',
        executedAt: new Date(),
        openReason: `strategy:${decision.reason}`,
        openExplanation: openExplanation as Prisma.InputJsonValue,
        stopLoss,
        takeProfit,
        entryFee,
        slippageBps,
      },
    });

    // Subtract entry fee from session balance immediately
    await this.prisma.executionSession.updateMany({
      where: { botId: bot.id, endedAt: null },
      data: {
        totalTrades: { increment: 1 },
        profitLoss: { increment: -entryFee },
        currentBalance: { increment: -entryFee },
      },
    });

    await this.botsService.appendLog(
      bot.id,
      LogLevel.INFO,
      'Opened demo long position',
      {
        tradeId: trade.id,
        symbol: bot.symbol,
        quantity,
        entryPrice: executedEntryPrice,
        slippageBps,
        slippageCost: notional - quantity * entryPrice,
        entryFee,
        entryFeeBps,
        marketPrice: entryPrice,
        stopLoss,
        takeProfit,
        signal: decision.signal,
        signalReason: decision.reason,
        signalMetadata: decision.metadata,
        execution: {
          type: 'simulated',
          priceSource: 'live_market',
          note: 'fees and slippage applied',
        },
      },
      'trade',
    );

    this.gateway.emitNewTrade({
      ...trade,
      userId: bot.userId,
    });

    await this.botsService.notifyTradeEvent({
      userId: bot.userId,
      botId: bot.id,
      tradeId: trade.id,
      symbol: bot.symbol,
      type: NotificationType.TRADE_OPENED,
    });
  }

  private async closeTrade(
    bot: BotWithStrategy,
    trade: Trade,
    exitPrice: number,
    reason: string,
    decision?: { signal: string; reason: string; metadata: Record<string, unknown> },
  ): Promise<void> {
    const isPartialTp = reason === 'risk:partial_take_profit';
    const params = (bot.strategyConfig?.params ?? {}) as Record<string, unknown>;
    const partialTpPct = params.partialTpPercent != null ? Number(params.partialTpPercent) : 0;
    const partialPct = isPartialTp && partialTpPct > 0 ? partialTpPct / 100 : 1;

    // Qty to close this round
    const qtyToClose = trade.quantity * partialPct;
    const remainingQty = trade.quantity - qtyToClose;

    // --- Realistic exit execution simulation ---
    const slippageBps = this.randomSlippageBps(DEFAULT_MAX_SLIPPAGE_BPS);
    const exitFeeBps = DEFAULT_FEE_BPS;

    // Slippage moves price against the trader on exit (lower for sells / long closes)
    const slippageMultiplier = 1 - slippageBps / 10000;
    const executedExitPrice = exitPrice * slippageMultiplier;
    const exitNotional = qtyToClose * executedExitPrice;
    const exitFee = this.computeFee(exitNotional, exitFeeBps);

    // Gross PnL based on executed prices for qtyToClose
    const grossPnl =
      trade.side === TradeSide.BUY
        ? (executedExitPrice - trade.price) * qtyToClose
        : 0;

    // Entry fee proportion for the closed qty
    const entryFee = trade.entryFee ?? 0;
    const entryFeeClosed = entryFee * partialPct;
    const netPnl = grossPnl - entryFeeClosed - exitFee;

    const updated = await this.prisma.trade.update({
      where: { id: trade.id },
      data: {
        exitPrice: executedExitPrice,
        realizedPnl: grossPnl,
        netPnl,
        exitFee,
        slippageBps: trade.slippageBps ?? slippageBps,
        closedAt: new Date(),
        closeReason: reason,
        closeExplanation: decision?.metadata
          ? (decision.metadata as Prisma.InputJsonValue)
          : Prisma.DbNull,
        status: 'CLOSED',
      },
    });

    // Subtract exit fee from session (entry fee was already deducted on open)
    await this.prisma.executionSession.updateMany({
      where: { botId: bot.id, endedAt: null },
      data: {
        profitLoss: { increment: netPnl },
        currentBalance: { increment: netPnl },
      },
    });

    await this.botsService.appendLog(
      bot.id,
      LogLevel.INFO,
      'Closed demo position',
      {
        tradeId: trade.id,
        symbol: bot.symbol,
        entryPrice: trade.price,
        exitPrice: executedExitPrice,
        marketPrice: exitPrice,
        slippageBps,
        slippageCost: trade.quantity * (exitPrice - executedExitPrice),
        entryFee,
        exitFee,
        totalFees: entryFee + exitFee,
        grossPnl,
        netPnl,
        reason,
        signal: decision?.signal,
        signalReason: decision?.reason,
        signalMetadata: decision?.metadata,
        execution: {
          type: 'simulated',
          priceSource: 'live_market',
          note: 'fees and slippage applied',
        },
      },
      'trade',
    );

    this.gateway.emitNewTrade({
      ...updated,
      userId: bot.userId,
    });

    const notificationType =
      reason === 'risk:stop_loss'
        ? NotificationType.STOP_LOSS_HIT
        : reason === 'risk:trailing_stop'
          ? NotificationType.TRAILING_STOP_HIT
          : reason === 'risk:take_profit'
            ? NotificationType.TAKE_PROFIT_HIT
            : reason === 'risk:partial_take_profit'
              ? NotificationType.PARTIAL_TP_HIT
              : NotificationType.TRADE_CLOSED;

    await this.botsService.notifyTradeEvent({
      userId: bot.userId,
      botId: bot.id,
      tradeId: updated.id,
      symbol: bot.symbol,
      type: notificationType,
      realizedPnl: netPnl,
      closeReason: reason,
    });

    // If partial TP: re-open remaining position with updated openExplanation
    if (isPartialTp && remainingQty > 0) {
      const remainingEntryFee = entryFee * (remainingQty / trade.quantity);
      const newOpenExplanation = {
        ...(trade.openExplanation as Record<string, unknown>),
        partialTpExecuted: true,
        highestPrice: executedExitPrice,
      };
      await this.prisma.trade.create({
        data: {
          botId: bot.id,
          symbol: bot.symbol,
          side: TradeSide.BUY,
          quantity: remainingQty,
          price: trade.price, // same entry price
          totalValue: remainingQty * trade.price,
          status: 'EXECUTED',
          executedAt: trade.executedAt,
          openReason: `partial_tp:${reason}`,
          openExplanation: newOpenExplanation as Prisma.InputJsonValue,
          stopLoss: trade.stopLoss,
          takeProfit: trade.takeProfit,
          entryFee: remainingEntryFee,
          slippageBps: trade.slippageBps,
        },
      });
    }
  }

  private async enforceMaxDailyLoss(
    bot: BotWithStrategy,
    openTrade: Trade | null,
    livePrice: number,
    params: Record<string, unknown>,
  ): Promise<boolean> {
    const maxDailyLoss = Number(params.maxDailyLoss);
    if (!Number.isFinite(maxDailyLoss) || maxDailyLoss <= 0) {
      return false;
    }

    const session = await this.prisma.executionSession.findUnique({
      where: { botId: bot.id },
      select: { profitLoss: true, endedAt: true },
    });
    if (!session || session.endedAt) {
      return false;
    }
    if (session.profitLoss > -maxDailyLoss) {
      return false;
    }

    await this.botsService.appendLog(
      bot.id,
      LogLevel.WARNING,
      'Max daily loss reached',
      {
        symbol: bot.symbol,
        maxDailyLoss,
        currentProfitLoss: session.profitLoss,
        action: openTrade ? 'close_position_and_stop_bot' : 'stop_bot',
      },
      'risk',
    );

    if (openTrade) {
      await this.closeTrade(bot, openTrade, livePrice, 'risk:max_daily_loss', {
        signal: 'RISK_EXIT',
        reason: 'max_daily_loss',
        metadata: {
          trigger: 'max_daily_loss',
          maxDailyLoss,
          sessionProfitLossBeforeClose: session.profitLoss,
          checkedPrice: livePrice,
        },
      });
    }

    await this.botsService.stop(bot.id, bot.userId);
    return true;
  }
}
