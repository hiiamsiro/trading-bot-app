import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

interface DailyReturn {
  date: string; // YYYY-MM-DD
  returnPct: number;
}

interface BotReturns {
  botId: string;
  botName: string;
  symbol: string;
  returns: Map<string, number>; // date -> returnPct
}

/** Pearson correlation coefficient: r = cov(X,Y) / (stdX * stdY) */
function pearsonCorrelation(xs: number[], ys: number[]): number {
  const n = xs.length;
  if (n === 0) return 0;

  const meanX = xs.reduce((a, b) => a + b, 0) / n;
  const meanY = ys.reduce((a, b) => a + b, 0) / n;

  let cov = 0;
  let varX = 0;
  let varY = 0;

  for (let i = 0; i < n; i++) {
    const dx = xs[i] - meanX;
    const dy = ys[i] - meanY;
    cov += dx * dy;
    varX += dx * dx;
    varY += dy * dy;
  }

  const stdX = Math.sqrt(varX);
  const stdY = Math.sqrt(varY);

  if (stdX === 0 || stdY === 0) return 0;
  return cov / (stdX * stdY);
}

function computeEquityCurve(trades: {
  closedAt: Date | null;
  netPnl: number | null;
}[]): Map<string, number> {
  // date -> cumulative balance
  const byDate = new Map<string, { balance: number }>();

  const closed = trades
    .filter((t) => t.closedAt && t.netPnl != null)
    .sort((a, b) => new Date(a.closedAt!).getTime() - new Date(b.closedAt!).getTime());

  let runningBalance = 10000; // assumed initial
  for (const t of closed) {
    const date = t.closedAt!.toISOString().slice(0, 10);
    runningBalance += t.netPnl!;
    const prev = byDate.get(date);
    if (prev) {
      prev.balance = runningBalance;
    } else {
      byDate.set(date, { balance: runningBalance });
    }
  }

  // Build return series: daily % change
  const returns = new Map<string, number>();
  const dates = Array.from(byDate.keys()).sort();
  let prevBalance = 10000;
  for (const date of dates) {
    const { balance } = byDate.get(date)!;
    const ret = prevBalance > 0 ? (balance - prevBalance) / prevBalance : 0;
    returns.set(date, ret);
    prevBalance = balance;
  }

  return returns;
}

function alignReturns(
  series: Map<string, number>[],
  dates: string[],
): number[][] {
  return series.map((s) => dates.map((d) => s.get(d) ?? 0));
}

@Injectable()
export class CorrelationService {
  constructor(private readonly prisma: PrismaService) {}

  async getCorrelationMatrix(userId: string): Promise<{
    bots: { id: string; name: string; symbol: string }[];
    matrix: { botId: string; otherBotId: string; correlation: number }[];
    symbolCorrelations: { symbol1: string; symbol2: string; correlation: number }[];
  }> {
    // 1. Fetch user's bots with closed trades
    const bots = await this.prisma.bot.findMany({
      where: { userId },
      select: {
        id: true,
        name: true,
        symbol: true,
        trades: {
          where: { status: 'CLOSED', closedAt: { not: null } },
          select: { closedAt: true, netPnl: true },
        },
      },
      orderBy: { createdAt: 'asc' },
    });

    if (bots.length === 0) {
      return { bots: [], matrix: [], symbolCorrelations: [] };
    }

    // 2. Build equity curve returns for each bot
    const botReturns: BotReturns[] = bots.map((b) => ({
      botId: b.id,
      botName: b.name,
      symbol: b.symbol,
      returns: computeEquityCurve(b.trades),
    }));

    // 3. All unique dates
    const allDates = Array.from(
      new Set(botReturns.flatMap((b) => Array.from(b.returns.keys()))).values(),
    ).sort();

    if (allDates.length < 2) {
      return {
        bots: bots.map((b) => ({ id: b.id, name: b.name, symbol: b.symbol })),
        matrix: [],
        symbolCorrelations: [],
      };
    }

    // 4. Bot-to-bot correlations
    const aligned = botReturns.map((b) => alignReturns([b.returns], allDates)[0]);
    const matrix: { botId: string; otherBotId: string; correlation: number }[] = [];

    for (let i = 0; i < botReturns.length; i++) {
      for (let j = i + 1; j < botReturns.length; j++) {
        const r = pearsonCorrelation(aligned[i], aligned[j]);
        matrix.push({ botId: botReturns[i].botId, otherBotId: botReturns[j].botId, correlation: r });
      }
    }

    // 5. Symbol-level correlations
    const symbolMap = new Map<string, Map<string, number>>();
    for (const botRet of botReturns) {
      const existing = symbolMap.get(botRet.symbol);
      if (existing) {
        for (const [date, ret] of botRet.returns) {
          const prev = existing.get(date);
          existing.set(date, prev != null ? (prev + ret) / 2 : ret);
        }
      } else {
        symbolMap.set(botRet.symbol, new Map(botRet.returns));
      }
    }

    const symbolKeys = Array.from(symbolMap.keys());
    const symbolAligned = symbolKeys.map((sym) =>
      allDates.map((d) => symbolMap.get(sym)!.get(d) ?? 0),
    );

    const symbolCorrelations: { symbol1: string; symbol2: string; correlation: number }[] = [];
    for (let i = 0; i < symbolKeys.length; i++) {
      for (let j = i + 1; j < symbolKeys.length; j++) {
        const r = pearsonCorrelation(symbolAligned[i], symbolAligned[j]);
        symbolCorrelations.push({ symbol1: symbolKeys[i], symbol2: symbolKeys[j], correlation: r });
      }
    }

    return {
      bots: bots.map((b) => ({ id: b.id, name: b.name, symbol: b.symbol })),
      matrix,
      symbolCorrelations,
    };
  }
}
