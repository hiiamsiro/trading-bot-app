import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { LogLevel, NotificationType, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { MarketDataService } from '../market-data/market-data.service';
import { MarketDataGateway } from '../market-data/market-data.gateway';
import { InstrumentsService } from '../instruments/instruments.service';
import { StrategyService } from '../strategy/strategy.service';
import { CreateBotDto } from './dto/create-bot.dto';
import { UpdateBotDto } from './dto/update-bot.dto';
import { ListBotLogsQueryDto } from './dto/list-bot-logs-query.dto';
import { NotificationsService } from '../notifications/notifications.service';

@Injectable()
export class BotsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly marketData: MarketDataService,
    private readonly marketGateway: MarketDataGateway,
    private readonly instrumentsService: InstrumentsService,
    private readonly strategyService: StrategyService,
    private readonly notificationsService: NotificationsService,
  ) {}

  async findAll(userId: string) {
    return this.prisma.bot.findMany({
      where: { userId },
      include: {
        strategyConfig: true,
        executionSession: true,
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(id: string, userId: string) {
    const bot = await this.prisma.bot.findUnique({
      where: { id },
      include: {
        strategyConfig: true,
        executionSession: true,
      },
    });

    if (!bot) {
      throw new NotFoundException('Bot not found');
    }

    if (bot.userId !== userId) {
      throw new ForbiddenException('Access denied');
    }

    return bot;
  }

  async create(createBotDto: CreateBotDto, userId: string) {
    const normalizedSymbol = createBotDto.symbol.trim().toUpperCase();
    const instrument = await this.instrumentsService.assertActiveBySymbol(normalizedSymbol);
    const validatedStrategyConfig = createBotDto.strategyConfig
      ? this.validateStrategyConfig(
          createBotDto.strategyConfig.strategy,
          createBotDto.strategyConfig.params,
          instrument.supportedIntervals,
        )
      : null;

    return this.prisma.bot.create({
      data: {
        name: createBotDto.name,
        description: createBotDto.description,
        symbol: normalizedSymbol,
        userId,
        strategyConfig: validatedStrategyConfig
          ? {
              create: {
                strategy: validatedStrategyConfig.strategy,
                params: validatedStrategyConfig.params as Prisma.InputJsonValue,
              },
            }
          : undefined,
      },
      include: {
        strategyConfig: true,
      },
    });
  }

  async update(id: string, updateBotDto: UpdateBotDto, userId: string) {
    const existing = await this.findOne(id, userId);
    const normalizedSymbol = updateBotDto.symbol?.trim().toUpperCase();

    if (normalizedSymbol) {
      await this.instrumentsService.assertActiveBySymbol(normalizedSymbol);
    }

    const updated = await this.prisma.bot.update({
      where: { id },
      data: {
        name: updateBotDto.name,
        description: updateBotDto.description,
        symbol: normalizedSymbol,
        status: updateBotDto.status,
      },
      include: {
        strategyConfig: true,
      },
    });

    if (updateBotDto.status !== undefined && updateBotDto.status !== existing.status) {
      this.marketGateway.emitBotStatus({
        botId: id,
        userId: updated.userId,
        status: updated.status,
        symbol: updated.symbol,
      });
    }

    return updated;
  }

  async remove(id: string, userId: string) {
    await this.findOne(id, userId);

    return this.prisma.bot.delete({
      where: { id },
    });
  }

  async appendLog(
    botId: string,
    level: LogLevel,
    message: string,
    metadata?: Record<string, unknown>,
    category = 'system',
  ) {
    const row = await this.prisma.botLog.create({
      data: {
        botId,
        level,
        category,
        message,
        metadata: metadata === undefined ? undefined : (metadata as object),
      },
    });

    const owner = await this.prisma.bot.findUnique({
      where: { id: botId },
      select: { userId: true },
    });
    if (owner) {
      this.marketGateway.emitBotLog({
        id: row.id,
        botId: row.botId,
        userId: owner.userId,
        level: row.level,
        category: row.category,
        message: row.message,
        metadata: row.metadata,
        createdAt: row.createdAt.toISOString(),
      });
    }

    return row;
  }

  async createNotification(input: {
    userId: string;
    botId?: string;
    tradeId?: string;
    type: NotificationType;
    title: string;
    message: string;
    metadata?: Record<string, unknown>;
  }) {
    const notification = await this.notificationsService.create(input);

    this.marketGateway.emitNotification({
      id: notification.id,
      userId: notification.userId,
      botId: notification.botId,
      tradeId: notification.tradeId,
      type: notification.type,
      title: notification.title,
      message: notification.message,
      metadata: notification.metadata,
      isRead: notification.isRead,
      readAt: notification.readAt ? notification.readAt.toISOString() : null,
      createdAt: notification.createdAt.toISOString(),
    });

    return notification;
  }

  async notifyBotEvent(input: {
    userId: string;
    botId: string;
    symbol: string;
    type: 'BOT_STARTED' | 'BOT_STOPPED' | 'BOT_ERROR';
    reason?: string;
  }) {
    const titleByType: Record<'BOT_STARTED' | 'BOT_STOPPED' | 'BOT_ERROR', string> = {
      BOT_STARTED: 'Bot started',
      BOT_STOPPED: 'Bot stopped',
      BOT_ERROR: 'Bot error',
    };

    const messageByType: Record<'BOT_STARTED' | 'BOT_STOPPED' | 'BOT_ERROR', string> = {
      BOT_STARTED: `${input.symbol} bot is now running.`,
      BOT_STOPPED: `${input.symbol} bot has been stopped.`,
      BOT_ERROR: input.reason
        ? `${input.symbol} bot entered error state: ${input.reason}`
        : `${input.symbol} bot entered error state.`,
    };

    return this.createNotification({
      userId: input.userId,
      botId: input.botId,
      type: input.type,
      title: titleByType[input.type],
      message: messageByType[input.type],
      metadata: {
        symbol: input.symbol,
        reason: input.reason,
      },
    });
  }

  async notifyTradeEvent(input: {
    userId: string;
    botId: string;
    tradeId: string;
    symbol: string;
    type: 'TRADE_OPENED' | 'TRADE_CLOSED' | 'STOP_LOSS_HIT' | 'TAKE_PROFIT_HIT';
    realizedPnl?: number;
    closeReason?: string;
  }) {
    const titleByType: Record<
      'TRADE_OPENED' | 'TRADE_CLOSED' | 'STOP_LOSS_HIT' | 'TAKE_PROFIT_HIT',
      string
    > = {
      TRADE_OPENED: 'Trade opened',
      TRADE_CLOSED: 'Trade closed',
      STOP_LOSS_HIT: 'Stop loss hit',
      TAKE_PROFIT_HIT: 'Take profit hit',
    };

    const messageByType: Record<
      'TRADE_OPENED' | 'TRADE_CLOSED' | 'STOP_LOSS_HIT' | 'TAKE_PROFIT_HIT',
      string
    > = {
      TRADE_OPENED: `${input.symbol} position opened.`,
      TRADE_CLOSED: `${input.symbol} position closed${input.realizedPnl != null ? ` (${input.realizedPnl >= 0 ? '+' : ''}${input.realizedPnl.toFixed(2)} PnL)` : ''}.`,
      STOP_LOSS_HIT: `${input.symbol} position closed by stop loss${input.realizedPnl != null ? ` (${input.realizedPnl >= 0 ? '+' : ''}${input.realizedPnl.toFixed(2)} PnL)` : ''}.`,
      TAKE_PROFIT_HIT: `${input.symbol} position closed by take profit${input.realizedPnl != null ? ` (${input.realizedPnl >= 0 ? '+' : ''}${input.realizedPnl.toFixed(2)} PnL)` : ''}.`,
    };

    return this.createNotification({
      userId: input.userId,
      botId: input.botId,
      tradeId: input.tradeId,
      type: input.type,
      title: titleByType[input.type],
      message: messageByType[input.type],
      metadata: {
        symbol: input.symbol,
        realizedPnl: input.realizedPnl,
        closeReason: input.closeReason,
      },
    });
  }

  async start(id: string, userId: string) {
    const bot = await this.findOne(id, userId);
    if (bot.status === 'RUNNING') {
      throw new BadRequestException('Bot is already running');
    }
    if (!bot.strategyConfig) {
      throw new BadRequestException('Configure a strategy before starting the bot');
    }

    const instrument = await this.instrumentsService.assertActiveBySymbol(bot.symbol);
    const validatedStrategyConfig = this.validateStrategyConfig(
      bot.strategyConfig.strategy,
      (bot.strategyConfig.params ?? {}) as Record<string, unknown>,
      instrument.supportedIntervals,
    );
    const params = validatedStrategyConfig.params;
    const initialBalance =
      params.initialBalance != null && !Number.isNaN(Number(params.initialBalance))
        ? Number(params.initialBalance)
        : 10000;

    await this.prisma.executionSession.upsert({
      where: { botId: id },
      create: {
        botId: id,
        initialBalance,
        currentBalance: initialBalance,
        profitLoss: 0,
        totalTrades: 0,
      },
      update: {
        startedAt: new Date(),
        endedAt: null,
        initialBalance,
        currentBalance: initialBalance,
        profitLoss: 0,
        totalTrades: 0,
      },
    });

    const updated = await this.prisma.bot.update({
      where: { id },
      data: {
        status: 'RUNNING',
        strategyConfig: {
          update: {
            strategy: validatedStrategyConfig.strategy,
            params: validatedStrategyConfig.params as Prisma.InputJsonValue,
          },
        },
      },
      include: {
        strategyConfig: true,
        executionSession: true,
      },
    });

    await this.appendLog(
      id,
      LogLevel.INFO,
      'Bot started',
      {
        symbol: updated.symbol,
        strategy: updated.strategyConfig?.strategy,
      },
      'lifecycle',
    );

    this.marketGateway.emitBotStatus({
      botId: id,
      userId: updated.userId,
      status: updated.status,
      symbol: updated.symbol,
    });

    await this.notifyBotEvent({
      userId: updated.userId,
      botId: updated.id,
      symbol: updated.symbol,
      type: NotificationType.BOT_STARTED,
    });

    return updated;
  }

  async stop(id: string, userId: string) {
    const bot = await this.findOne(id, userId);
    if (bot.status !== 'RUNNING') {
      throw new BadRequestException('Bot is not running');
    }

    const openTrade = await this.prisma.trade.findFirst({
      where: {
        botId: id,
        closedAt: null,
        status: 'EXECUTED',
      },
      orderBy: { createdAt: 'desc' },
    });

    if (openTrade) {
      const exitPrice = await this.marketData.getLatestPrice(bot.symbol, {
        forceRefresh: true,
      });
      if (exitPrice === null) {
        await this.appendLog(
          id,
          LogLevel.WARNING,
          'Skipped position close on bot stop',
          {
            tradeId: openTrade.id,
            symbol: bot.symbol,
            reason: 'live_price_unavailable',
          },
          'market_data',
        );
      } else {
        const realizedPnl = (exitPrice - openTrade.price) * openTrade.quantity;
        const closed = await this.prisma.trade.update({
          where: { id: openTrade.id },
          data: {
            exitPrice,
            realizedPnl,
            closedAt: new Date(),
            closeReason: 'bot_stopped',
            status: 'CLOSED',
          },
        });
        await this.prisma.executionSession.updateMany({
          where: { botId: id, endedAt: null },
          data: {
            profitLoss: { increment: realizedPnl },
            currentBalance: { increment: realizedPnl },
          },
        });
        await this.appendLog(
          id,
          LogLevel.INFO,
          'Position closed on bot stop',
          {
            tradeId: closed.id,
            exitPrice,
            realizedPnl,
            execution: {
              type: 'simulated',
              priceSource: 'live_market',
            },
          },
          'trade',
        );
        this.marketGateway.emitNewTrade({
          ...closed,
          userId: bot.userId,
        });
        await this.notifyTradeEvent({
          userId: bot.userId,
          botId: bot.id,
          tradeId: closed.id,
          symbol: bot.symbol,
          type: NotificationType.TRADE_CLOSED,
          realizedPnl,
          closeReason: 'bot_stopped',
        });
      }
    }

    await this.prisma.executionSession.updateMany({
      where: { botId: id, endedAt: null },
      data: { endedAt: new Date() },
    });

    const updated = await this.prisma.bot.update({
      where: { id },
      data: { status: 'STOPPED' },
      include: {
        strategyConfig: true,
        executionSession: true,
      },
    });

    await this.appendLog(
      id,
      LogLevel.INFO,
      'Bot stopped',
      {
        symbol: updated.symbol,
      },
      'lifecycle',
    );

    this.marketGateway.emitBotStatus({
      botId: id,
      userId: updated.userId,
      status: updated.status,
      symbol: updated.symbol,
    });

    await this.notifyBotEvent({
      userId: updated.userId,
      botId: updated.id,
      symbol: updated.symbol,
      type: NotificationType.BOT_STOPPED,
    });

    return updated;
  }

  async findLogs(botId: string, userId: string, query: ListBotLogsQueryDto) {
    await this.findOne(botId, userId);

    const take = query.take ?? 50;
    const skip = query.skip ?? 0;

    const where: Prisma.BotLogWhereInput = {
      botId,
      ...(query.level ? { level: query.level } : {}),
    };

    const category = query.category?.trim();
    if (category) {
      where.category = { equals: category, mode: 'insensitive' };
    }

    const search = query.search?.trim();
    if (search) {
      where.message = { contains: search, mode: 'insensitive' };
    }

    const [total, items] = await this.prisma.$transaction([
      this.prisma.botLog.count({ where }),
      this.prisma.botLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take,
        skip,
      }),
    ]);

    return {
      items,
      total,
      take,
      skip,
    };
  }

  private validateStrategyConfig(
    strategy: string,
    params: Record<string, unknown>,
    supportedIntervalsRaw: unknown,
  ): { strategy: string; params: Record<string, unknown> } {
    try {
      const validated = this.strategyService.validateConfig(strategy, params);
      const requestedInterval = this.parseRequestedInterval(validated.normalizedParams);
      if (requestedInterval) {
        if (!this.strategyService.isSupportedInterval(requestedInterval)) {
          throw new BadRequestException(
            `Unsupported interval "${requestedInterval}". Supported values: 1m, 5m, 15m, 1h, 4h, 1d`,
          );
        }
        const supportedByInstrument = this.normalizeInstrumentIntervals(supportedIntervalsRaw);
        if (
          supportedByInstrument.length > 0 &&
          !supportedByInstrument.includes(requestedInterval)
        ) {
          throw new BadRequestException(
            `Interval "${requestedInterval}" is not supported for this instrument. Supported intervals: ${supportedByInstrument.join(', ')}`,
          );
        }
      }
      return {
        strategy: validated.normalizedStrategy,
        params: validated.normalizedParams,
      };
    } catch (error) {
      if (error instanceof BadRequestException) {
        throw error;
      }
      const message = error instanceof Error ? error.message : 'Invalid strategy config';
      throw new BadRequestException(message);
    }
  }

  private parseRequestedInterval(params: Record<string, unknown>): string | null {
    const value = params.interval ?? params.timeframe ?? params.candleInterval;
    if (typeof value !== 'string') {
      return null;
    }
    const normalized = value.trim().toLowerCase();
    return normalized.length > 0 ? normalized : null;
  }

  private normalizeInstrumentIntervals(supportedIntervalsRaw: unknown): string[] {
    if (!Array.isArray(supportedIntervalsRaw)) {
      return [];
    }
    return supportedIntervalsRaw
      .filter((item): item is string => typeof item === 'string')
      .map((item) => item.toLowerCase());
  }
}
