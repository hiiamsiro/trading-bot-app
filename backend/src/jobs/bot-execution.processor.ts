import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { LogLevel, NotificationType } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { DemoTradingService } from '../demo-trading/demo-trading.service';
import { BotsService } from '../bots/bots.service';
import { MarketDataGateway } from '../market-data/market-data.gateway';

type BotExecutionJob = { botId: string };

@Processor('bot-execution', { concurrency: 1 })
export class BotExecutionProcessor extends WorkerHost {
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
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown bot execution error';
      const updatedBot = await this.prisma.bot.update({
        where: { id: bot.id },
        data: { status: 'ERROR' },
        select: { id: true, userId: true, symbol: true, status: true },
      });
      await this.botsService.appendLog(
        bot.id,
        LogLevel.ERROR,
        'Bot execution failed',
        {
          botId: bot.id,
          symbol: bot.symbol,
          reason: message,
        },
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
        reason: message,
      });
    }
  }
}
