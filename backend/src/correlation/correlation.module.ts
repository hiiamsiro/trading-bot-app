import { Module } from '@nestjs/common';
import { CorrelationController } from './correlation.controller';
import { CorrelationService } from './correlation.service';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [CorrelationController],
  providers: [CorrelationService],
})
export class CorrelationModule {}
