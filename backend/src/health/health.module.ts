import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { HealthController } from './health.controller';
import { BotHealthService } from './bot-health.service';

@Module({
  imports: [PrismaModule],
  controllers: [HealthController],
  providers: [BotHealthService],
})
export class HealthModule {}

