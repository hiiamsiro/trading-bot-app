import { Injectable } from '@nestjs/common';
import { Bot, BotStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

// How long a running bot can go without a tick before it's considered stuck.
// Demo tick cadence is ~1 minute, so 10 min is a safe threshold.
const STUCK_THRESHOLD_MS = Number(process.env.BOT_STUCK_THRESHOLD_MS) || 10 * 60 * 1000;

// How long a running bot can go without fresh market data before it's
// considered starved of signal.
const NO_DATA_THRESHOLD_MS = Number(process.env.BOT_NO_DATA_THRESHOLD_MS) || 10 * 60 * 1000;

export interface BotHealthIssue {
  botId: string;
  botName: string;
  symbol: string;
  userId: string;
  issue: 'stuck' | 'no_data';
  detail: string;
  lastRunAt: string | null;
  lastSignalAt: string | null;
  sinceMs: number;
}

export interface BotHealthReport {
  totalRunning: number;
  stuck: BotHealthIssue[];
  noData: BotHealthIssue[];
  healthy: { botId: string; botName: string; symbol: string }[];
}

@Injectable()
export class BotHealthService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Full health report for all running bots owned by a user.
   */
  async getReport(userId: string): Promise<BotHealthReport> {
    const now = new Date();
    const stuckCutoff = new Date(now.getTime() - STUCK_THRESHOLD_MS);
    const dataCutoff = new Date(now.getTime() - NO_DATA_THRESHOLD_MS);

    const running = await this.prisma.bot.findMany({
      where: {
        userId,
        status: 'RUNNING' as BotStatus,
      },
      select: {
        id: true,
        name: true,
        symbol: true,
        userId: true,
        lastRunAt: true,
        lastSignalAt: true,
      },
    });

    const stuck: BotHealthIssue[] = [];
    const noData: BotHealthIssue[] = [];
    const healthy: BotHealthReport['healthy'] = [];

    for (const bot of running) {
      if (!bot.lastRunAt || bot.lastRunAt < stuckCutoff) {
        const sinceMs = bot.lastRunAt
          ? now.getTime() - bot.lastRunAt.getTime()
          : (null as unknown as number);
        stuck.push(this.makeIssue(bot, 'stuck', sinceMs));
        continue;
      }

      if (!bot.lastSignalAt || bot.lastSignalAt < dataCutoff) {
        const sinceMs = bot.lastSignalAt
          ? now.getTime() - bot.lastSignalAt.getTime()
          : (null as unknown as number);
        noData.push(this.makeIssue(bot, 'no_data', sinceMs));
        continue;
      }

      healthy.push({ botId: bot.id, botName: bot.name, symbol: bot.symbol });
    }

    return { totalRunning: running.length, stuck, noData, healthy };
  }

  private makeIssue(
    bot: Pick<Bot, 'id' | 'name' | 'symbol' | 'userId' | 'lastRunAt' | 'lastSignalAt'>,
    issue: BotHealthIssue['issue'],
    sinceMs: number | null,
  ): BotHealthIssue {
    const detailMap: Record<BotHealthIssue['issue'], string> = {
      stuck:
        sinceMs != null
          ? `No tick received in ${formatDuration(sinceMs)}`
          : 'Never executed a tick since start',
      no_data:
        sinceMs != null
          ? `No market data signal in ${formatDuration(sinceMs)}`
          : 'No strategy signal received since start',
    };

    return {
      botId: bot.id,
      botName: bot.name,
      symbol: bot.symbol,
      userId: bot.userId,
      issue,
      detail: detailMap[issue],
      lastRunAt: bot.lastRunAt?.toISOString() ?? null,
      lastSignalAt: bot.lastSignalAt?.toISOString() ?? null,
      sinceMs: sinceMs ?? 0,
    };
  }
}

function formatDuration(ms: number): string {
  const totalSeconds = Math.round(ms / 1000);
  if (totalSeconds < 60) return `${totalSeconds}s`;
  const totalMinutes = Math.round(totalSeconds / 60);
  if (totalMinutes < 60) return `${totalMinutes}m`;
  const totalHours = Math.round(totalMinutes / 60);
  return `${totalHours}h`;
}
