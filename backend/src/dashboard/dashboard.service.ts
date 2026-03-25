import { Injectable } from '@nestjs/common';
import { BotStatus, LogLevel, TradeStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

const RECENT_LIMIT = 20;
const ERROR_LIMIT = 15;

function utcDayStart(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), 0, 0, 0, 0));
}

function nextUtcDay(start: Date): Date {
  const n = new Date(start);
  n.setUTCDate(n.getUTCDate() + 1);
  return n;
}

@Injectable()
export class DashboardService {
  constructor(private readonly prisma: PrismaService) {}

  async getSnapshot(userId: string) {
    const userScope = { userId };
    const now = new Date();
    const dayStart = utcDayStart(now);
    const dayEnd = nextUtcDay(dayStart);

    const [
      botGroup,
      botSymbolRows,
      totalTrades,
      closedForPnl,
      recentTrades,
      recentActivities,
      recentErrors,
    ] = await Promise.all([
      this.prisma.bot.groupBy({
        by: ['status'],
        where: userScope,
        _count: { _all: true },
      }),
      this.prisma.bot.findMany({
        where: userScope,
        select: { symbol: true },
      }),
      this.prisma.trade.count({
        where: { bot: userScope },
      }),
      this.prisma.trade.findMany({
        where: {
          bot: userScope,
          status: TradeStatus.CLOSED,
          closedAt: { not: null },
          realizedPnl: { not: null },
        },
        select: {
          realizedPnl: true,
          closedAt: true,
        },
        orderBy: { closedAt: 'asc' },
      }),
      this.prisma.trade.findMany({
        where: { bot: userScope },
        take: RECENT_LIMIT,
        orderBy: { createdAt: 'desc' },
        include: {
          bot: {
            select: { id: true, name: true, symbol: true },
          },
        },
      }),
      this.prisma.botLog.findMany({
        where: {
          bot: userScope,
          level: { not: LogLevel.ERROR },
        },
        take: RECENT_LIMIT,
        orderBy: { createdAt: 'desc' },
        include: {
          bot: { select: { name: true } },
        },
      }),
      this.prisma.botLog.findMany({
        where: {
          bot: userScope,
          level: LogLevel.ERROR,
        },
        take: ERROR_LIMIT,
        orderBy: { createdAt: 'desc' },
        include: {
          bot: { select: { name: true } },
        },
      }),
    ]);

    const statusCounts = new Map<BotStatus, number>();
    for (const row of botGroup) {
      statusCounts.set(row.status, row._count._all);
    }

    const runningBots = statusCounts.get(BotStatus.RUNNING) ?? 0;
    const stoppedBots =
      (statusCounts.get(BotStatus.STOPPED) ?? 0) + (statusCounts.get(BotStatus.PAUSED) ?? 0);
    const errorBots = statusCounts.get(BotStatus.ERROR) ?? 0;
    const totalBots = botGroup.reduce((acc, r) => acc + r._count._all, 0);
    const botSymbols = [...new Set(botSymbolRows.map((b) => b.symbol))];

    const totalPnl = closedForPnl.reduce((s, t) => s + (t.realizedPnl ?? 0), 0);
    const winning = closedForPnl.filter((t) => (t.realizedPnl ?? 0) > 0);
    const losing = closedForPnl.filter((t) => (t.realizedPnl ?? 0) < 0);
    const closedWithPnl = closedForPnl.length;

    const dailyPnl = closedForPnl
      .filter((t) => {
        const c = t.closedAt!;
        return c >= dayStart && c < dayEnd;
      })
      .reduce((s, t) => s + (t.realizedPnl ?? 0), 0);

    const winRate =
      closedWithPnl > 0 ? (winning.length / closedWithPnl) * 100 : null;

    const averageWin =
      winning.length > 0
        ? winning.reduce((s, t) => s + (t.realizedPnl ?? 0), 0) / winning.length
        : null;

    const averageLoss =
      losing.length > 0
        ? losing.reduce((s, t) => s + (t.realizedPnl ?? 0), 0) / losing.length
        : null;

    let cumulative = 0;
    let peak = 0;
    let maxDrawdown = 0;
    const equityCurve: { at: string; cumulativePnl: number }[] = [];

    for (const t of closedForPnl) {
      cumulative += t.realizedPnl ?? 0;
      if (cumulative > peak) {
        peak = cumulative;
      }
      const dd = peak - cumulative;
      if (dd > maxDrawdown) {
        maxDrawdown = dd;
      }
      equityCurve.push({
        at: t.closedAt!.toISOString(),
        cumulativePnl: cumulative,
      });
    }

    return {
      botSymbols,
      metrics: {
        totalBots,
        runningBots,
        stoppedBots,
        errorBots,
        totalTrades,
        closedTradesWithPnl: closedWithPnl,
        winningTrades: winning.length,
        losingTrades: losing.length,
        winRate,
        totalPnl,
        dailyPnl,
        averageWin,
        averageLoss,
        maxDrawdown,
      },
      equityCurve,
      recentTrades,
      recentActivities: recentActivities.map((log) => ({
        id: log.id,
        botId: log.botId,
        level: log.level,
        message: log.message,
        createdAt: log.createdAt.toISOString(),
        botName: log.bot.name,
      })),
      recentErrors: recentErrors.map((log) => ({
        id: log.id,
        botId: log.botId,
        level: log.level,
        message: log.message,
        createdAt: log.createdAt.toISOString(),
        botName: log.bot.name,
      })),
    };
  }
}
