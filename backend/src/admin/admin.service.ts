import { Injectable } from '@nestjs/common';
import { BotStatus, LogLevel, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AdminMonitoringQueryDto } from './dto/admin-monitoring-query.dto';

const TOP_USERS_BOT_SCAN_LIMIT = 200;

function statusCounts(rows: { status: BotStatus; _count: { _all: number } }[]) {
  const counts: Record<BotStatus, number> = {
    RUNNING: 0,
    STOPPED: 0,
    PAUSED: 0,
    ERROR: 0,
  };

  for (const row of rows) {
    counts[row.status] = row._count._all;
  }

  return counts;
}

@Injectable()
export class AdminService {
  constructor(private readonly prisma: PrismaService) {}

  async getMonitoringSnapshot(query: AdminMonitoringQueryDto) {
    const recentErrorsTake = query.recentErrorsTake ?? 15;
    const recentTradesTake = query.recentTradesTake ?? 20;
    const topTake = query.topTake ?? 5;
    const windowHours = query.windowHours ?? 24;

    const now = new Date();
    const windowStart = new Date(now.getTime() - windowHours * 60 * 60 * 1000);

    const tradeGroupTake = Math.max(topTake, TOP_USERS_BOT_SCAN_LIMIT);

    const [totalUsers, totalBots, botGroup, recentErrors, recentTrades, tradesByBot] =
      await Promise.all([
        this.prisma.user.count(),
        this.prisma.bot.count(),
        this.prisma.bot.groupBy({
          by: ['status'],
          _count: { _all: true },
        }),
        this.prisma.botLog.findMany({
          where: { level: LogLevel.ERROR },
          take: recentErrorsTake,
          orderBy: { createdAt: 'desc' },
          include: {
            bot: {
              select: {
                id: true,
                name: true,
                symbol: true,
                status: true,
                user: { select: { id: true, email: true } },
              },
            },
          },
        }),
        this.prisma.trade.findMany({
          take: recentTradesTake,
          orderBy: { createdAt: 'desc' },
          include: {
            bot: {
              select: {
                id: true,
                name: true,
                symbol: true,
                status: true,
                user: { select: { id: true, email: true } },
              },
            },
          },
        }),
        this.prisma.trade.groupBy({
          by: ['botId'],
          where: { createdAt: { gte: windowStart } },
          _count: { botId: true },
          orderBy: { _count: { botId: 'desc' } },
          take: tradeGroupTake,
        }),
      ]);

    const botStatusCounts = statusCounts(botGroup);

    const topBotIds = tradesByBot.slice(0, topTake).map((r) => r.botId);
    const userScanBotIds = tradesByBot.map((r) => r.botId);
    const botIdsToFetch = [...new Set([...topBotIds, ...userScanBotIds])];

    const botsForTop = botIdsToFetch.length
      ? await this.prisma.bot.findMany({
          where: { id: { in: botIdsToFetch } },
          select: {
            id: true,
            name: true,
            symbol: true,
            status: true,
            userId: true,
            user: { select: { email: true } },
          },
        })
      : [];

    const botById = new Map<string, (typeof botsForTop)[number]>();
    for (const b of botsForTop) botById.set(b.id, b);

    const topActiveBots = tradesByBot.slice(0, topTake).flatMap((row) => {
      const bot = botById.get(row.botId);
      if (!bot) return [];
      const tradeCount = row._count?.botId ?? 0;
      return [
        {
          botId: bot.id,
          botName: bot.name,
          symbol: bot.symbol,
          status: bot.status,
          userId: bot.userId,
          userEmail: bot.user.email,
          tradeCount,
        },
      ];
    });

    const activeByUser = new Map<
      string,
      { userId: string; email: string; tradeCount: number; activeBotCount: number }
    >();

    for (const row of tradesByBot) {
      const bot = botById.get(row.botId);
      if (!bot) continue;
      const tradeCount = row._count?.botId ?? 0;
      const current = activeByUser.get(bot.userId);
      if (!current) {
        activeByUser.set(bot.userId, {
          userId: bot.userId,
          email: bot.user.email,
          tradeCount,
          activeBotCount: 1,
        });
        continue;
      }
      current.tradeCount += tradeCount;
      current.activeBotCount += 1;
    }

    const topActiveUsers = [...activeByUser.values()]
      .sort((a, b) => b.tradeCount - a.tradeCount)
      .slice(0, topTake);

    return {
      totals: { users: totalUsers, bots: totalBots },
      botStatusCounts,
      windowHours,
      recentErrors: recentErrors.map((log) => ({
        id: log.id,
        botId: log.botId,
        botName: log.bot.name,
        botSymbol: log.bot.symbol,
        botStatus: log.bot.status,
        userId: log.bot.user.id,
        userEmail: log.bot.user.email,
        level: log.level,
        category: log.category,
        message: log.message,
        metadata: log.metadata as Prisma.JsonValue | null,
        createdAt: log.createdAt.toISOString(),
      })),
      recentTrades: recentTrades.map((t) => ({
        id: t.id,
        botId: t.botId,
        botName: t.bot.name,
        botSymbol: t.bot.symbol,
        botStatus: t.bot.status,
        userId: t.bot.user.id,
        userEmail: t.bot.user.email,
        symbol: t.symbol,
        side: t.side,
        quantity: t.quantity,
        price: t.price,
        totalValue: t.totalValue,
        status: t.status,
        executedAt: t.executedAt ? t.executedAt.toISOString() : null,
        openReason: t.openReason,
        exitPrice: t.exitPrice,
        realizedPnl: t.realizedPnl,
        closedAt: t.closedAt ? t.closedAt.toISOString() : null,
        closeReason: t.closeReason,
        createdAt: t.createdAt.toISOString(),
      })),
      topActiveBots,
      topActiveUsers,
    };
  }
}
