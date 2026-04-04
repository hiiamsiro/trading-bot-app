import { Injectable, NotFoundException, BadRequestException, ForbiddenException } from '@nestjs/common';
import { randomBytes } from 'crypto';
import { LogLevel, NotificationType, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { MarketDataService } from '../market-data/market-data.service';
import { MarketDataGateway } from '../market-data/market-data.gateway';
import { InstrumentsService } from '../instruments/instruments.service';
import { StrategyService } from '../strategy/strategy.service';
import { StrategyBuilderService } from '../strategy/strategy-builder.service';
import { CreateBotDto } from './dto/create-bot.dto';
import { UpdateBotDto } from './dto/update-bot.dto';
import { ListBotLogsQueryDto } from './dto/list-bot-logs-query.dto';
import { NotificationsService } from '../notifications/notifications.service';
import { CreateBotFromBuilderDto } from './dto/create-bot-from-builder.dto';
import { CreateBotFromCodeDto } from './dto/create-bot-from-code.dto';
import { BillingService } from '../billing/billing.service';
import { StrategyCodeService } from '../strategy-code/strategy-code.service';

@Injectable()
export class BotsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly marketData: MarketDataService,
    private readonly marketGateway: MarketDataGateway,
    private readonly instrumentsService: InstrumentsService,
    private readonly strategyService: StrategyService,
    private readonly strategyBuilderService: StrategyBuilderService,
    private readonly notificationsService: NotificationsService,
    private readonly billingService: BillingService,
    private readonly strategyCodeService: StrategyCodeService,
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
    const bot = await this.prisma.bot.findFirst({
      where: { id, userId },
      include: {
        strategyConfig: true,
        executionSession: true,
      },
    });

    if (!bot) {
      throw new NotFoundException('Bot not found');
    }

    return bot;
  }

  async create(createBotDto: CreateBotDto, userId: string) {
    const { allowed, reason } = await this.billingService.canCreateBot(userId);
    if (!allowed) throw new ForbiddenException(reason);

    const normalizedSymbol = createBotDto.symbol.trim().toUpperCase();
    const instrument = await this.instrumentsService.assertActiveBySymbol(normalizedSymbol);
    const validatedStrategyConfig = createBotDto.strategyConfig
      ? this.validateStrategyConfig(
          createBotDto.strategyConfig.strategy,
          createBotDto.strategyConfig.params,
          instrument.supportedIntervals,
        )
      : null;

    // Atomic: billing limit check + bot creation in same transaction to prevent TOCTOU
    return this.prisma.$transaction(async (tx) => {
      const botCount = await tx.bot.count({ where: { userId } });
      const sub = await tx.subscription.findUnique({ where: { userId } });
      const plan = sub?.plan ?? 'FREE';
      const limits = this.billingService.getPlanLimits(plan);
      if (limits.maxBots !== -1 && botCount >= limits.maxBots) {
        throw new ForbiddenException(
          `Bot limit reached (${limits.maxBots}). Upgrade for more bots.`,
        );
      }

      const sourceCodeId = createBotDto.strategyConfig?.sourceCodeId;
      const requestedStrategy = createBotDto.strategyConfig?.strategy?.trim().toLowerCase().replace(/-/g, '_');
      if (requestedStrategy === 'custom_code' && !sourceCodeId) {
        throw new BadRequestException('custom_code strategy requires sourceCodeId');
      }
      if (sourceCodeId) {
        // Guard: user must have Pro+ plan to attach custom code
        const { allowed, reason } = await this.billingService.canUseCustomCode(userId);
        if (!allowed) throw new ForbiddenException(reason);
        // Guard: sourceCodeId must be owned by the user
        await this.strategyCodeService.getCodeForUser(sourceCodeId, userId);
      }
      return tx.bot.create({
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
                  ...(sourceCodeId ? { sourceCodeId } : {}),
                },
              }
            : undefined,
        },
        include: { strategyConfig: true },
      });
    });
  }

  async createFromBuilder(dto: CreateBotFromBuilderDto, userId: string) {
    const { allowed, reason } = await this.billingService.canCreateBot(userId);
    if (!allowed) throw new ForbiddenException(reason);

    // 1. Validate builder config
    this.strategyBuilderService.validateConfig(dto.builderConfig);

    // 2. Compile into strategy+params
    const { strategy, params } = this.strategyBuilderService.compileConfig(
      dto.builderConfig as unknown as import('../strategy/strategy-builder.schema').BuilderConfig,
    );

    // 3. Resolve instrument
    const normalizedSymbol = dto.symbol.trim().toUpperCase();
    const instrument = await this.instrumentsService.assertActiveBySymbol(normalizedSymbol);

    // 4. Validate compiled params
    const validatedConfig = this.strategyService.validateConfig(strategy, {
      ...params,
      initialBalance: dto.initialBalance,
    });

    // 5. Atomic: billing limit check + bot creation in same transaction
    return this.prisma.$transaction(async (tx) => {
      const botCount = await tx.bot.count({ where: { userId } });
      const sub = await tx.subscription.findUnique({ where: { userId } });
      const plan = sub?.plan ?? 'FREE';
      const limits = this.billingService.getPlanLimits(plan);
      if (limits.maxBots !== -1 && botCount >= limits.maxBots) {
        throw new ForbiddenException(
          `Bot limit reached (${limits.maxBots}). Upgrade for more bots.`,
        );
      }

      return tx.bot.create({
        data: {
          name: dto.name,
          description: dto.description,
          symbol: normalizedSymbol,
          userId,
          strategyConfig: {
            create: {
              strategy: validatedConfig.normalizedStrategy,
              params: validatedConfig.normalizedParams as Prisma.InputJsonValue,
              builderConfig: dto.builderConfig as unknown as Prisma.InputJsonValue,
            },
          },
        },
        include: { strategyConfig: true, executionSession: true },
      });
    });
  }

  async createFromCode(dto: CreateBotFromCodeDto, userId: string) {
    // Guard: feature requires Pro+ plan
    const { allowed, reason } = await this.billingService.canUseCustomCode(userId);
    if (!allowed) throw new ForbiddenException(reason);

    // Guard: strategy code must be owned by user
    await this.strategyCodeService.getCodeForUser(dto.strategyCodeId, userId);

    return this.create(
      {
        name: dto.name,
        description: dto.description,
        symbol: dto.symbol,
        strategyConfig: {
          strategy: 'custom_code',
          params: {
            interval: dto.interval,
            initialBalance: dto.initialBalance ?? 10000,
          },
          sourceCodeId: dto.strategyCodeId,
        },
      },
      userId,
    );
  }

  async update(id: string, updateBotDto: UpdateBotDto, userId: string) {
    const existing = await this.findOne(id, userId);
    const normalizedSymbol = updateBotDto.symbol?.trim().toUpperCase();

    if (normalizedSymbol) {
      await this.instrumentsService.assertActiveBySymbol(normalizedSymbol);
    }

    // Guard: sourceCodeId assignment requires Pro+ plan and ownership
    if (updateBotDto.sourceCodeId !== undefined) {
      const { allowed, reason } = await this.billingService.canUseCustomCode(userId);
      if (!allowed) throw new ForbiddenException(reason);
      // Loose check catches both null and undefined (DTO allows either to mean "unlink")
      if (updateBotDto.sourceCodeId != null) {
        await this.strategyCodeService.getCodeForUser(updateBotDto.sourceCodeId, userId);
      }
    }

    const updated = await this.prisma.bot.update({
      where: { id },
      data: {
        name: updateBotDto.name,
        description: updateBotDto.description,
        symbol: normalizedSymbol,
        status: updateBotDto.status,
        ...(updateBotDto.sourceCodeId !== undefined
          ? {
              strategyConfig: {
                update: { sourceCodeId: updateBotDto.sourceCodeId },
              },
            }
          : {}),
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
    type: 'TRADE_OPENED' | 'TRADE_CLOSED' | 'STOP_LOSS_HIT' | 'TAKE_PROFIT_HIT' | 'TRAILING_STOP_HIT' | 'PARTIAL_TP_HIT';
    realizedPnl?: number;
    closeReason?: string;
  }) {
    const titleByType: Record<
      'TRADE_OPENED' | 'TRADE_CLOSED' | 'STOP_LOSS_HIT' | 'TAKE_PROFIT_HIT' | 'TRAILING_STOP_HIT' | 'PARTIAL_TP_HIT',
      string
    > = {
      TRADE_OPENED: 'Trade opened',
      TRADE_CLOSED: 'Trade closed',
      STOP_LOSS_HIT: 'Stop loss hit',
      TAKE_PROFIT_HIT: 'Take profit hit',
      TRAILING_STOP_HIT: 'Trailing stop hit',
      PARTIAL_TP_HIT: 'Partial take profit hit',
    };

    const messageByType: Record<
      'TRADE_OPENED' | 'TRADE_CLOSED' | 'STOP_LOSS_HIT' | 'TAKE_PROFIT_HIT' | 'TRAILING_STOP_HIT' | 'PARTIAL_TP_HIT',
      string
    > = {
      TRADE_OPENED: `${input.symbol} position opened.`,
      TRADE_CLOSED: `${input.symbol} position closed${input.realizedPnl != null ? ` (${input.realizedPnl >= 0 ? '+' : ''}${input.realizedPnl.toFixed(2)} PnL)` : ''}.`,
      STOP_LOSS_HIT: `${input.symbol} position closed by stop loss${input.realizedPnl != null ? ` (${input.realizedPnl >= 0 ? '+' : ''}${input.realizedPnl.toFixed(2)} PnL)` : ''}.`,
      TAKE_PROFIT_HIT: `${input.symbol} position closed by take profit${input.realizedPnl != null ? ` (${input.realizedPnl >= 0 ? '+' : ''}${input.realizedPnl.toFixed(2)} PnL)` : ''}.`,
      TRAILING_STOP_HIT: `${input.symbol} position closed by trailing stop${input.realizedPnl != null ? ` (${input.realizedPnl >= 0 ? '+' : ''}${input.realizedPnl.toFixed(2)} PnL)` : ''}.`,
      PARTIAL_TP_HIT: `${input.symbol} partial take profit triggered${input.realizedPnl != null ? ` (${input.realizedPnl >= 0 ? '+' : ''}${input.realizedPnl.toFixed(2)} PnL)` : ''}.`,
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
    // Fast-fail outside transaction: check subscription plan exists (not bot count yet)
    const { allowed, reason } = await this.billingService.canRunBot(userId);
    if (!allowed) throw new ForbiddenException(reason);

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

    // Atomic: running bot count check + bot start in same transaction
    const updated = await this.prisma.$transaction(async (tx) => {
      const runningCount = await tx.bot.count({
        where: { userId, status: 'RUNNING' },
      });
      const sub = await tx.subscription.findUnique({ where: { userId } });
      const plan = sub?.plan ?? 'FREE';
      const limits = this.billingService.getPlanLimits(plan);
      if (limits.maxRunningBots !== -1 && runningCount >= limits.maxRunningBots) {
        throw new ForbiddenException(
          `Running bot limit reached (${limits.maxRunningBots}). Upgrade for more concurrent bots.`,
        );
      }

      await tx.executionSession.upsert({
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

      return tx.bot.update({
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
        include: { strategyConfig: true, executionSession: true },
      });
    });

    await this.appendLog(
      id,
      LogLevel.INFO,
      'Bot started',
      { symbol: updated.symbol, strategy: updated.strategyConfig?.strategy },
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
        // Realistic exit: apply slippage + fee
        const slippageBps = Math.round(Math.sqrt(Math.random()) * 5);
        const exitFeeBps = 10;
        const slippageMultiplier = 1 - slippageBps / 10000;
        const executedExitPrice = exitPrice * slippageMultiplier;
        const exitNotional = openTrade.quantity * executedExitPrice;
        const exitFee = exitNotional * (exitFeeBps / 10000);
        const grossPnl = (executedExitPrice - openTrade.price) * openTrade.quantity;
        const entryFee = openTrade.entryFee ?? 0;
        const netPnl = grossPnl - entryFee - exitFee;

        const closed = await this.prisma.trade.update({
          where: { id: openTrade.id },
          data: {
            exitPrice: executedExitPrice,
            realizedPnl: grossPnl,
            netPnl,
            exitFee,
            slippageBps,
            closedAt: new Date(),
            closeReason: 'bot_stopped',
            status: 'CLOSED',
          },
        });
        await this.prisma.executionSession.updateMany({
          where: { botId: id, endedAt: null },
          data: {
            profitLoss: { increment: netPnl },
            currentBalance: { increment: netPnl },
          },
        });
        await this.appendLog(
          id,
          LogLevel.INFO,
          'Position closed on bot stop',
          {
            tradeId: closed.id,
            entryPrice: openTrade.price,
            exitPrice: executedExitPrice,
            marketPrice: exitPrice,
            slippageBps,
            slippageCost: openTrade.quantity * (exitPrice - executedExitPrice),
            entryFee,
            exitFee,
            totalFees: entryFee + exitFee,
            grossPnl,
            netPnl,
            execution: {
              type: 'simulated',
              priceSource: 'live_market',
              note: 'fees and slippage applied',
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
          realizedPnl: netPnl,
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
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
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
      const normalizedStrategy = strategy.trim().toLowerCase().replace(/-/g, '_');
      if (normalizedStrategy === 'custom_code') {
        // Custom strategies are executed via StrategySandboxService (not StrategyService.validateConfig).
        // Still validate optional timeframe/interval so downstream market-data fetches are sane.
        const requestedInterval = this.parseRequestedInterval(params);
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
        return { strategy: 'custom_code', params };
      }

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

  // ─── Sharing ──────────────────────────────────────────────────────────────────

  async publishBot(botId: string, userId: string): Promise<{ shareSlug: string }> {
    const { allowed, reason } = await this.billingService.canPublish(userId);
    if (!allowed) throw new ForbiddenException(reason);

    const bot = await this.findOne(botId, userId);
    if (!bot.strategyConfig) {
      throw new BadRequestException('Cannot publish a bot without a configured strategy');
    }

    const slug = generateSlug(bot.name);
    await this.prisma.bot.update({
      where: { id: botId },
      data: { isPublic: true, shareSlug: slug },
    });
    return { shareSlug: slug };
  }

  async unpublishBot(botId: string, userId: string): Promise<void> {
    await this.findOne(botId, userId);
    await this.prisma.bot.update({
      where: { id: botId },
      data: { isPublic: false, shareSlug: null },
    });
  }

  async cloneFromShare(
    source: {
      name: string;
      description: string | null;
      symbol: string;
      strategy: string;
      params: Record<string, unknown>;
      builderConfig: Record<string, unknown> | null;
    },
    userId: string,
    overrideName?: string,
    overrideSymbol?: string,
  ) {
    const { allowed, reason } = await this.billingService.canCreateBot(userId);
    if (!allowed) throw new ForbiddenException(reason);

    const symbol = (overrideSymbol ?? source.symbol).trim().toUpperCase();
    const instrument = await this.instrumentsService.assertActiveBySymbol(symbol);

    // Validate strategy
    const validated = this.validateStrategyConfig(
      source.strategy,
      source.params,
      instrument.supportedIntervals,
    );

    const cloneName = overrideName ? overrideName.trim() : `${source.name} (Copy)`;

    // Atomic: billing limit check + clone creation
    return this.prisma.$transaction(async (tx) => {
      const botCount = await tx.bot.count({ where: { userId } });
      const sub = await tx.subscription.findUnique({ where: { userId } });
      const plan = sub?.plan ?? 'FREE';
      const limits = this.billingService.getPlanLimits(plan);
      if (limits.maxBots !== -1 && botCount >= limits.maxBots) {
        throw new ForbiddenException(
          `Bot limit reached (${limits.maxBots}). Upgrade for more bots.`,
        );
      }

      return tx.bot.create({
        data: {
          name: cloneName,
          description: source.description ?? undefined,
          symbol,
          userId,
          strategyConfig: {
            create: {
              strategy: validated.strategy,
              params: validated.params as Prisma.InputJsonValue,
              builderConfig: source.builderConfig as Prisma.InputJsonValue | undefined,
            },
          },
        },
        include: { strategyConfig: true },
      });
    });
  }
}

// ─── Helpers ────────────────────────────────────────────────────────────────────

function generateSlug(name: string): string {
  const base = name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .slice(0, 40);
  const suffix = randomBytes(4).toString('hex');
  return `${base}-${suffix}`;
}
