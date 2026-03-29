import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { Logger } from '@nestjs/common';
import { LogLevel, NotificationType } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { DemoTradingService } from '../demo-trading/demo-trading.service';
import { BotsService } from '../bots/bots.service';
import { MarketDataGateway } from '../market-data/market-data.gateway';
import {
  BOT_EXECUTION_CONCURRENCY,
  BOT_EXECUTION_MAX_RETRIES,
  BOT_EXECUTION_BACKOFF_BASE,
} from './worker.constants';

type BotExecutionJob = { botId: string };

@Processor('bot-execution', {
  concurrency: BOT_EXECUTION_CONCURRENCY,
})
export class BotExecutionProcessor extends WorkerHost {
  private readonly logger = new Logger(BotExecutionProcessor.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly demoTrading: DemoTradingService,
    private readonly botsService: BotsService,
    private readonly marketGateway: MarketDataGateway,
  ) {
    super();
  }

  async process(job: Job<BotExecutionJob, void, string>): Promise<void> {
    const { botId } = job.data;
    const bot = await this.prisma.bot.findUnique({
      where: { id: botId },
      include: {
        strategyConfig: true,
        executionSession: true,
      },
    });
    if (!bot || bot.status !== 'RUNNING') {
      return;
    }
    try {
      await this.demoTrading.processTick(bot);

      // Stamp alive timestamp after every successful tick
      await this.prisma.bot.update({
        where: { id: bot.id },
        data: { lastRunAt: new Date() },
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown bot execution error';

      // Only propagate error state if the bot is still RUNNING.
      // If it is already terminal (e.g. ERROR from a previous attempt),
      // skip the notification storm and just re-throw to satisfy BullMQ.
      if (bot.status === 'RUNNING') {
        await this.handleBotError(bot.id, bot.userId, bot.symbol, message);
      }
      throw error;
    }
  }

  private async handleBotError(
    botId: string,
    userId: string,
    symbol: string,
    reason: string,
  ): Promise<void> {
    try {
      const updatedBot = await this.prisma.bot.update({
        where: { id: botId },
        data: { status: 'ERROR' },
        select: { id: true, userId: true, symbol: true, status: true },
      });
      await this.botsService.appendLog(
        botId,
        LogLevel.ERROR,
        'Bot execution failed',
        { botId, symbol, reason },
        'execution',
      );
      this.marketGateway.emitBotStatus({
        botId: updatedBot.id,
        userId: updatedBot.userId,
        symbol: updatedBot.symbol,
        status: updatedBot.status,
      });
      await this.botsService.notifyBotEvent({
        userId: updatedBot.userId,
        botId: updatedBot.id,
        symbol: updatedBot.symbol,
        type: NotificationType.BOT_ERROR,
        reason,
      });
    } catch (err) {
      try {
        this.logger.error(
          `Failed to notify bot error for botId=${botId}`,
          err instanceof Error ? err.stack : String(err),
        );
      } catch {
        // Swallow — error logging failure must not propagate
      }
    }
  }
}

export { BOT_EXECUTION_MAX_RETRIES, BOT_EXECUTION_BACKOFF_BASE };
