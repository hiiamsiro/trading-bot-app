import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';

@Processor('bot-execution')
export class BotExecutionProcessor extends WorkerHost {
  async process(job: Job<any, any, string>): Promise<any> {
    console.log(`Processing bot execution job: ${job.id}`);
    return {};
  }
}
