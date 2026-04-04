import { Module } from '@nestjs/common';
import { BacktestController } from './backtest.controller';
import { BacktestService } from './backtest.service';
import { PrismaModule } from '../prisma/prisma.module';
import { MarketDataModule } from '../market-data/market-data.module';
import { StrategyModule } from '../strategy/strategy.module';
import { StrategyCodeModule } from '../strategy-code/strategy-code.module';

@Module({
  imports: [PrismaModule, MarketDataModule, StrategyModule, StrategyCodeModule],
  controllers: [BacktestController],
  providers: [BacktestService],
  exports: [BacktestService],
})
export class BacktestModule {}
