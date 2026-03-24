import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { LogLevel, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { MarketDataService } from '../market-data/market-data.service';
import { MarketDataGateway } from '../market-data/market-data.gateway';
import { InstrumentsService } from '../instruments/instruments.service';
import { CreateBotDto } from './dto/create-bot.dto';
import { UpdateBotDto } from './dto/update-bot.dto';

@Injectable()
export class BotsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly marketData: MarketDataService,
    private readonly marketGateway: MarketDataGateway,
    private readonly instrumentsService: InstrumentsService,
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
    await this.instrumentsService.assertActiveBySymbol(normalizedSymbol);

    return this.prisma.bot.create({
      data: {
        name: createBotDto.name,
        description: createBotDto.description,
        symbol: normalizedSymbol,
        userId,
        strategyConfig: createBotDto.strategyConfig
          ? {
              create: {
                strategy: createBotDto.strategyConfig.strategy,
                params: createBotDto.strategyConfig.params as Prisma.InputJsonValue,
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
  ) {
    const row = await this.prisma.botLog.create({
      data: {
        botId,
        level,
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
        message: row.message,
        metadata: row.metadata,
        createdAt: row.createdAt.toISOString(),
      });
    }

    return row;
  }

  async start(id: string, userId: string) {
    const bot = await this.findOne(id, userId);
    if (bot.status === 'RUNNING') {
      throw new BadRequestException('Bot is already running');
    }
    if (!bot.strategyConfig) {
      throw new BadRequestException('Configure a strategy before starting the bot');
    }

    const params = (bot.strategyConfig.params ?? {}) as Record<string, unknown>;
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
      data: { status: 'RUNNING' },
      include: {
        strategyConfig: true,
        executionSession: true,
      },
    });

    await this.appendLog(id, LogLevel.INFO, 'Bot started', {
      symbol: updated.symbol,
      strategy: updated.strategyConfig?.strategy,
    });

    this.marketGateway.emitBotStatus({
      botId: id,
      userId: updated.userId,
      status: updated.status,
      symbol: updated.symbol,
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
        await this.appendLog(id, LogLevel.WARNING, 'Skipped position close on bot stop', {
          tradeId: openTrade.id,
          symbol: bot.symbol,
          reason: 'live_price_unavailable',
        });
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
        await this.appendLog(id, LogLevel.INFO, 'Position closed on bot stop', {
          tradeId: closed.id,
          exitPrice,
          realizedPnl,
          execution: {
            type: 'simulated',
            priceSource: 'live_market',
          },
        });
        this.marketGateway.emitNewTrade({
          ...closed,
          userId: bot.userId,
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

    await this.appendLog(id, LogLevel.INFO, 'Bot stopped', {
      symbol: updated.symbol,
    });

    this.marketGateway.emitBotStatus({
      botId: id,
      userId: updated.userId,
      status: updated.status,
      symbol: updated.symbol,
    });

    return updated;
  }

  async findLogs(botId: string, userId: string, take: number, skip: number) {
    await this.findOne(botId, userId);

    const [items, total] = await Promise.all([
      this.prisma.botLog.findMany({
        where: { botId },
        orderBy: { createdAt: 'desc' },
        take,
        skip,
      }),
      this.prisma.botLog.count({ where: { botId } }),
    ]);

    return {
      items,
      total,
      take,
      skip,
    };
  }
}
