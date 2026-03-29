import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { PrismaModule } from '../prisma/prisma.module';
import { HealthController } from './health.controller';
import { BotHealthService } from './bot-health.service';
import { QueueHealthService } from './queue-health.service';

@Module({
  imports: [
    PrismaModule,
    BullModule.registerQueue(
      { name: 'bot-execution' },
      { name: 'market-data' },
      { name: 'instrument-sync' },
    ),
  ],
  controllers: [HealthController],
  providers: [BotHealthService, QueueHealthService],
})
export class HealthModule {}
