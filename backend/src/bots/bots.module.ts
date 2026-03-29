import { Module } from '@nestjs/common';
import { MarketDataModule } from '../market-data/market-data.module';
import { InstrumentsModule } from '../instruments/instruments.module';
import { StrategyModule } from '../strategy/strategy.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { BillingModule } from '../billing/billing.module';
import { BotsController } from './bots.controller';
import { BotsService } from './bots.service';

@Module({
  imports: [MarketDataModule, InstrumentsModule, StrategyModule, NotificationsModule, BillingModule],
  controllers: [BotsController],
  providers: [BotsService],
  exports: [BotsService],
})
export class BotsModule {}
