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

  private isSupportedInterval(
    value: string,
  ): value is MarketKlineInterval {
    return (
      value === '1m' ||
      value === '5m' ||
      value === '15m' ||
      value === '1h' ||
      value === '4h' ||
      value === '1d'
    );
  }

  private parseRequestedInterval(
    params: Record<string, unknown>,
  ): string | null {
    const raw =
      params.interval ?? params.timeframe ?? params.candleInterval ?? null;
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
      .filter((item): item is MarketKlineInterval => this.isSupportedInterval(item));
    const fallback: MarketKlineInterval = supported[0] ?? '1m';
    const requested = this.parseRequestedInterval(params);
    if (!requested || !this.isSupportedInterval(requested)) {
      return fallback;
    }
    if (!supported.includes(requested)) {
      return fallback;
    }
    return requested;
  }

  async processTick(bot: BotWithStrategy): Promise<void> {
    if (bot.status !== 'RUNNING' || !bot.strategyConfig) {
      return;
    }

    const price = await this.marketData.getLatestPrice(bot.symbol);
    if (price === null) {
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
      const hit = this.checkStopTake(openTrade, price);
      if (hit) {
        await this.closeTrade(bot, openTrade, price, hit);
        return;
      }
    }

    const params = (bot.strategyConfig.params ?? {}) as Record<string, unknown>;
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

    const interval = this.resolveInterval(instrument, params);
    const requiredCandles = this.strategy.getRequiredCandles(
      bot.strategyConfig.strategy,
      params,
    );
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
      ...decision.metadata,
    });

    if (decision.signal === 'BUY' && !openTrade) {
      await this.openLong(bot, price, params, decision);
    } else if (
      decision.signal === 'SELL' &&
      openTrade &&
      openTrade.side === TradeSide.BUY
    ) {
      await this.closeTrade(bot, openTrade, price, `strategy:${decision.reason}`, decision);
    }
  }

  private checkStopTake(
    trade: Trade,
    price: number,
  ): 'stop_loss' | 'take_profit' | null {
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
    const quantity = Number(params.quantity) > 0 ? Number(params.quantity) : 0.01;
    const totalValue = quantity * entryPrice;
    const slPct = params.stopLossPercent;
    const tpPct = params.takeProfitPercent;
    const stopLoss =
      slPct != null && !Number.isNaN(Number(slPct))
        ? entryPrice * (1 - Number(slPct) / 100)
        : null;
    const takeProfit =
      tpPct != null && !Number.isNaN(Number(tpPct))
        ? entryPrice * (1 + Number(tpPct) / 100)
        : null;

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
    const pnl =
      trade.side === TradeSide.BUY
        ? this.computePnlLong(trade, exitPrice)
        : 0;

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
      exitPrice,
      realizedPnl: pnl,
      reason,
      signal: decision?.signal,
      signalReason: decision?.reason,
      signalMetadata: decision?.metadata,
    });

    this.gateway.emitNewTrade({
      ...updated,
      userId: bot.userId,
    });
  }
}
