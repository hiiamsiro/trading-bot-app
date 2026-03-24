import { Injectable } from '@nestjs/common';
import {
  Bot,
  ExecutionSession,
  Instrument,
  LogLevel,
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

@Injectable()
export class DemoTradingService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly marketData: MarketDataService,
    private readonly strategy: StrategyService,
    private readonly gateway: MarketDataGateway,
    private readonly botsService: BotsService,
  ) {}

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

  async processTick(bot: BotWithStrategy): Promise<void> {
    if (bot.status !== 'RUNNING' || !bot.strategyConfig) {
      return;
    }

    const instrument = await this.prisma.instrument.findUnique({
      where: { symbol: bot.symbol },
    });
    if (!instrument || !instrument.isActive || instrument.status !== 'ACTIVE') {
      await this.botsService.appendLog(bot.id, LogLevel.WARNING, 'Skipped strategy evaluation', {
        symbol: bot.symbol,
        reason: 'active_instrument_not_found',
      });
      return;
    }

    const livePrice = await this.marketData.getLatestPrice(bot.symbol, {
      forceRefresh: true,
    });
    if (livePrice === null) {
      await this.botsService.appendLog(bot.id, LogLevel.WARNING, 'Skipped strategy evaluation', {
        symbol: bot.symbol,
        reason: 'live_price_unavailable',
      });
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
      const hit = this.checkStopTake(openTrade, livePrice);
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
    const closes = await this.marketData.getCloses(bot.symbol, requiredCandles, interval);
    const decision = this.strategy.evaluate({
      strategyKey: bot.strategyConfig.strategy,
      instrument: bot.symbol,
      interval,
      params,
      closes,
    });

    await this.botsService.appendLog(bot.id, LogLevel.DEBUG, 'Strategy signal evaluated', {
      symbol: bot.symbol,
      strategy: bot.strategyConfig.strategy,
      interval,
      signal: decision.signal,
      reason: decision.reason,
      requiredCandles,
      closesCount: closes.length,
      livePrice,
      ...decision.metadata,
    });

    if (decision.signal === 'BUY' && !openTrade) {
      await this.openLong(bot, livePrice, params, decision);
    } else if (decision.signal === 'SELL' && openTrade && openTrade.side === TradeSide.BUY) {
      await this.closeTrade(bot, openTrade, livePrice, `strategy:${decision.reason}`, decision);
    }
  }

  private checkStopTake(trade: Trade, price: number): 'stop_loss' | 'take_profit' | null {
    if (trade.side === TradeSide.BUY) {
      if (trade.stopLoss != null && price <= trade.stopLoss) {
        return 'stop_loss';
      }
      if (trade.takeProfit != null && price >= trade.takeProfit) {
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
      await this.botsService.appendLog(bot.id, LogLevel.WARNING, 'Skipped opening position', {
        symbol: bot.symbol,
        reason: 'open_position_already_exists',
        activeTradeId: existingOpenTrade.id,
      });
      return;
    }

    const quantity = Number(params.quantity) > 0 ? Number(params.quantity) : 0.01;
    const totalValue = quantity * entryPrice;
    const slPct = params.stopLossPercent;
    const tpPct = params.takeProfitPercent;
    const stopLoss =
      slPct != null && !Number.isNaN(Number(slPct)) ? entryPrice * (1 - Number(slPct) / 100) : null;
    const takeProfit =
      tpPct != null && !Number.isNaN(Number(tpPct)) ? entryPrice * (1 + Number(tpPct) / 100) : null;

    const trade = await this.prisma.trade.create({
      data: {
        botId: bot.id,
        symbol: bot.symbol,
        side: TradeSide.BUY,
        quantity,
        price: entryPrice,
        totalValue,
        status: 'EXECUTED',
        executedAt: new Date(),
        openReason: `strategy:${decision.reason}`,
        stopLoss,
        takeProfit,
      },
    });

    await this.prisma.executionSession.updateMany({
      where: { botId: bot.id, endedAt: null },
      data: { totalTrades: { increment: 1 } },
    });

    await this.botsService.appendLog(bot.id, LogLevel.INFO, 'Opened demo long position', {
      tradeId: trade.id,
      symbol: bot.symbol,
      quantity,
      entryPrice,
      stopLoss,
      takeProfit,
      signal: decision.signal,
      signalReason: decision.reason,
      signalMetadata: decision.metadata,
      execution: {
        type: 'simulated',
        priceSource: 'live_market',
      },
    });

    this.gateway.emitNewTrade({
      ...trade,
      userId: bot.userId,
    });
  }

  private async closeTrade(
    bot: BotWithStrategy,
    trade: Trade,
    exitPrice: number,
    reason: string,
    decision?: { signal: string; reason: string; metadata: Record<string, unknown> },
  ): Promise<void> {
    const pnl = trade.side === TradeSide.BUY ? this.computePnlLong(trade, exitPrice) : 0;

    const updated = await this.prisma.trade.update({
      where: { id: trade.id },
      data: {
        exitPrice,
        realizedPnl: pnl,
        closedAt: new Date(),
        closeReason: reason,
        status: 'CLOSED',
      },
    });

    await this.prisma.executionSession.updateMany({
      where: { botId: bot.id, endedAt: null },
      data: {
        profitLoss: { increment: pnl },
        currentBalance: { increment: pnl },
      },
    });

    await this.botsService.appendLog(bot.id, LogLevel.INFO, 'Closed demo position', {
      tradeId: trade.id,
      symbol: bot.symbol,
      entryPrice: trade.price,
      exitPrice,
      realizedPnl: pnl,
      reason,
      signal: decision?.signal,
      signalReason: decision?.reason,
      signalMetadata: decision?.metadata,
      execution: {
        type: 'simulated',
        priceSource: 'live_market',
      },
    });

    this.gateway.emitNewTrade({
      ...updated,
      userId: bot.userId,
    });
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

    await this.botsService.appendLog(bot.id, LogLevel.WARNING, 'Max daily loss reached', {
      symbol: bot.symbol,
      maxDailyLoss,
      currentProfitLoss: session.profitLoss,
      action: openTrade ? 'close_position_and_stop_bot' : 'stop_bot',
    });

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
