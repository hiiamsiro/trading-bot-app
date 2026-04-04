import { Module } from '@nestjs/common';
import { StrategyCodeController } from './strategy-code.controller';
import { StrategyCodeService } from './strategy-code.service';
import { StrategySandboxService } from './strategy-sandbox.service';
import { PrismaModule } from '../prisma/prisma.module';
import { BillingModule } from '../billing/billing.module';

@Module({
  imports: [PrismaModule, BillingModule],
  controllers: [StrategyCodeController],
  providers: [StrategyCodeService, StrategySandboxService],
  exports: [StrategySandboxService, StrategyCodeService],
})
export class StrategyCodeModule {}
