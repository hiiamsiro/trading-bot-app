import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { MarketDataModule } from '../market-data/market-data.module';
import { StrategyModule } from '../strategy/strategy.module';
import { BotsModule } from '../bots/bots.module';
import { DemoTradingService } from './demo-trading.service';

@Module({
  imports: [PrismaModule, MarketDataModule, StrategyModule, BotsModule],
  providers: [DemoTradingService],
  exports: [DemoTradingService],
})
export class DemoTradingModule {}
