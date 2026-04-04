import { Module } from '@nestjs/common';
import { MarketDataModule } from '../market-data/market-data.module';
import { InstrumentsModule } from '../instruments/instruments.module';
import { StrategyModule } from '../strategy/strategy.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { BillingModule } from '../billing/billing.module';
import { StrategyCodeModule } from '../strategy-code/strategy-code.module';
import { BotsController } from './bots.controller';
import { BotsService } from './bots.service';
import { StrategySandboxService } from '../strategy-code/strategy-sandbox.service';

@Module({
  imports: [
    MarketDataModule,
    InstrumentsModule,
    StrategyModule,
    NotificationsModule,
    BillingModule,
    StrategyCodeModule,
  ],
  controllers: [BotsController],
  providers: [BotsService, StrategySandboxService],
  exports: [BotsService, StrategySandboxService],
})
export class BotsModule {}
