import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Prisma } from '@prisma/client';

type LeaderboardSortBy = 'pnl' | 'winRate' | 'drawdown';

export interface LeaderboardItem {
  rank: number;
  botId: string;
  botName: string;
  symbol: string;
  strategy: string;
  totalPnl: number;
  winRate: number | null;
  maxDrawdown: number;
  totalTrades: number;
  shareSlug: string | null;
}

@Injectable()
export class LeaderboardService {
  constructor(private readonly prisma: PrismaService) {}

  async getLeaderboard(
    opts: {
      sortBy: LeaderboardSortBy;
      limit?: number;
      offset?: number;
    },
    requestingUserId?: string,
  ): Promise<{ items: LeaderboardItem[]; total: number }> {
    const limit = Math.min(opts.limit ?? 20, 100);
    const offset = opts.offset ?? 0;

    // Only public bots OR the requesting user's own bots (if authenticated)
    const botWhere: Prisma.BotWhereInput = requestingUserId
      ? { OR: [{ isPublic: true }, { userId: requestingUserId }] }
      : { isPublic: true };

    // Aggregate trade stats per bot
    const tradeStatsRows = await this.prisma.trade.groupBy({
      by: ['botId'],
      where: {
        status: 'CLOSED',
        netPnl: { not: null },
        bot: botWhere,
      },
      _count: { id: true },
      _sum: { netPnl: true },
    });

    const statsMap = new Map<string, { totalPnl: number; totalTrades: number }>();
    for (const row of tradeStatsRows) {
      statsMap.set(row.botId, {
        totalPnl: row._sum.netPnl ?? 0,
        totalTrades: row._count.id,
      });
    }

    // Fetch bots with closed trades that match criteria
    const bots = await this.prisma.bot.findMany({
      where: {
        ...botWhere,
        trades: { some: { status: 'CLOSED' } },
      },
      select: {
        id: true,
        name: true,
        symbol: true,
        shareSlug: true,
        strategyConfig: { select: { strategy: true } },
        _count: { select: { trades: { where: { status: 'CLOSED' } } } },
      },
    });

    // Compute winRate and maxDrawdown per bot
    const enriched: (LeaderboardItem & { winRate: number | null; maxDrawdown: number })[] = [];

    for (const bot of bots) {
      const stats = statsMap.get(bot.id);

      // Win rate
      const wins = await this.prisma.trade.count({
        where: { botId: bot.id, status: 'CLOSED', netPnl: { gt: 0 } },
      });
      const total = stats?.totalTrades ?? bot._count.trades;
      const winRate = total > 0 ? (wins / total) * 100 : null;

      // Max drawdown from equity curve
      const equityPoints = await this.prisma.trade.findMany({
        where: { botId: bot.id, status: 'CLOSED', netPnl: { not: null } },
        select: { netPnl: true, closedAt: true },
        orderBy: { closedAt: 'asc' },
      });

      let maxDrawdown = 0;
      let peak = 0;
      let cumulative = 0;
      for (const pt of equityPoints) {
        cumulative += pt.netPnl ?? 0;
        if (cumulative > peak) peak = cumulative;
        const drawdown = peak > 0 ? (peak - cumulative) / peak : 0;
        if (drawdown > maxDrawdown) maxDrawdown = drawdown;
      }

      enriched.push({
        rank: 0,
        botId: bot.id,
        botName: bot.name,
        symbol: bot.symbol,
        strategy: bot.strategyConfig?.strategy ?? 'unknown',
        totalPnl: stats?.totalPnl ?? 0,
        winRate,
        maxDrawdown: maxDrawdown * 100,
        totalTrades: total,
        shareSlug: bot.shareSlug,
      });
    }

    // Sort in memory
    if (opts.sortBy === 'pnl') {
      enriched.sort((a, b) => b.totalPnl - a.totalPnl);
    } else if (opts.sortBy === 'winRate') {
      enriched.sort((a, b) => (b.winRate ?? -1) - (a.winRate ?? -1));
    } else {
      // drawdown: lower is better
      enriched.sort((a, b) => a.maxDrawdown - b.maxDrawdown);
    }

    const page = enriched.slice(offset, offset + limit);
    const ranked: LeaderboardItem[] = page.map((item, idx) => ({
      ...item,
      rank: offset + idx + 1,
    }));

    return { items: ranked, total: enriched.length };
  }
}
