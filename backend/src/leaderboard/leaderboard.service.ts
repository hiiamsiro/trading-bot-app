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
  ): Promise<{ items: LeaderboardItem[]; total: number }> {
    const limit = Math.min(opts.limit ?? 20, 100);
    const offset = opts.offset ?? 0;

    // Only public bots are shown on the public leaderboard
    const botWhere: Prisma.BotWhereInput = { isPublic: true };

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
        trades: {
          where: { status: 'CLOSED', netPnl: { not: null } },
          select: { netPnl: true, closedAt: true },
          orderBy: { closedAt: 'asc' },
        },
      },
    });

    // Compute totalPnl, winRate, and maxDrawdown in a single pass per bot — no extra queries
    const enriched: LeaderboardItem[] = bots.map((bot) => {
      const totalTrades = bot.trades.length;
      const totalPnl = bot.trades.reduce((sum, t) => sum + (t.netPnl ?? 0), 0);
      const wins = bot.trades.filter((t) => (t.netPnl ?? 0) > 0).length;
      const winRate = totalTrades > 0 ? (wins / totalTrades) * 100 : null;

      let maxDrawdown = 0;
      let peak = 0;
      let cumulative = 0;
      for (const pt of bot.trades) {
        cumulative += pt.netPnl ?? 0;
        if (cumulative > peak) peak = cumulative;
        const drawdown = peak > 0 ? (peak - cumulative) / peak : 0;
        if (drawdown > maxDrawdown) maxDrawdown = drawdown;
      }

      return {
        rank: 0,
        botId: bot.id,
        botName: bot.name,
        symbol: bot.symbol,
        strategy: bot.strategyConfig?.strategy ?? 'unknown',
        totalPnl,
        winRate,
        maxDrawdown: maxDrawdown * 100,
        totalTrades,
        shareSlug: bot.shareSlug,
      };
    });

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
    const ranked = page.map((item, idx) => ({ ...item, rank: offset + idx + 1 }));

    return { items: ranked, total: enriched.length };
  }
}
