import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { PrismaService } from '../prisma/prisma.service';
import { DemoTradingService } from '../demo-trading/demo-trading.service';

type BotExecutionJob = { botId: string };

@Processor('bot-execution', { concurrency: 1 })
export class BotExecutionProcessor extends WorkerHost {
  constructor(
    private readonly prisma: PrismaService,
    private readonly demoTrading: DemoTradingService,
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
    await this.demoTrading.processTick(bot);
  }
}
