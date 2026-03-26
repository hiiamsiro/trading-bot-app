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

type EquityPnlByDayRow = { day: unknown; pnl: unknown };

@Injectable()
export class DashboardService {
  constructor(private readonly prisma: PrismaService) {}

  async getSnapshot(userId: string) {
    const userScope = { userId };
    const now = new Date();
    const dayStart = utcDayStart(now);
    const dayEnd = nextUtcDay(dayStart);

    const closedWhere = {
      bot: userScope,
      status: TradeStatus.CLOSED,
      closedAt: { not: null },
      realizedPnl: { not: null },
    } as const;

    const [
      botGroup,
      botSymbolRows,
      totalTrades,
      closedAgg,
      winningAgg,
      losingAgg,
      dailyAgg,
      equityPnlByDay,
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
        distinct: ['symbol'],
        select: { symbol: true },
      }),
      this.prisma.trade.count({
        where: { bot: userScope },
      }),
      this.prisma.trade.aggregate({
        where: closedWhere,
        _count: { _all: true },
        _sum: { realizedPnl: true },
      }),
      this.prisma.trade.aggregate({
        where: { ...closedWhere, realizedPnl: { gt: 0 } },
        _count: { _all: true },
        _avg: { realizedPnl: true },
      }),
      this.prisma.trade.aggregate({
        where: { ...closedWhere, realizedPnl: { lt: 0 } },
        _count: { _all: true },
        _avg: { realizedPnl: true },
      }),
      this.prisma.trade.aggregate({
        where: { ...closedWhere, closedAt: { gte: dayStart, lt: dayEnd } },
        _sum: { realizedPnl: true },
      }),
      this.prisma.$queryRaw<EquityPnlByDayRow[]>`
        SELECT
          date_trunc('day', t."closedAt") AS day,
          SUM(t."realizedPnl") AS pnl
        FROM "trades" t
        INNER JOIN "bots" b ON b."id" = t."botId"
        WHERE
          b."userId" = ${userId}
          AND t."status" = 'CLOSED'
          AND t."closedAt" IS NOT NULL
          AND t."realizedPnl" IS NOT NULL
        GROUP BY 1
        ORDER BY 1 ASC
      `,
      this.prisma.trade.findMany({
        where: { bot: userScope },
        take: RECENT_LIMIT,
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
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
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
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
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
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
    const botSymbols = [...new Set(botSymbolRows.map((b) => b.symbol))].sort();

    const closedWithPnl = closedAgg._count._all;
    const totalPnl = closedAgg._sum.realizedPnl ?? 0;
    const winningTrades = winningAgg._count._all;
    const losingTrades = losingAgg._count._all;
    const dailyPnl = dailyAgg._sum.realizedPnl ?? 0;

    const winRate = closedWithPnl > 0 ? (winningTrades / closedWithPnl) * 100 : null;
    const averageWin = winningAgg._avg.realizedPnl ?? null;
    const averageLoss = losingAgg._avg.realizedPnl ?? null;

    let cumulative = 0;
    let peak = 0;
    let maxDrawdown = 0;
    const equityCurve: { at: string; cumulativePnl: number }[] = [];

    for (const row of equityPnlByDay) {
      const pnlRaw = row.pnl ?? 0;
      const pnl = typeof pnlRaw === 'number' ? pnlRaw : Number(pnlRaw);
      const safePnl = Number.isFinite(pnl) ? pnl : 0;

      const day = row.day instanceof Date ? row.day : new Date(String(row.day));

      cumulative += safePnl;
      if (cumulative > peak) {
        peak = cumulative;
      }
      const dd = peak - cumulative;
      if (dd > maxDrawdown) {
        maxDrawdown = dd;
      }
      equityCurve.push({
        at: day.toISOString(),
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
        winningTrades,
        losingTrades,
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
