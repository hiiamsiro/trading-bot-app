import { Module } from '@nestjs/common';
import { MarketDataModule } from '../market-data/market-data.module';
import { InstrumentsModule } from '../instruments/instruments.module';
import { BotsController } from './bots.controller';
import { BotsService } from './bots.service';

@Module({
  imports: [MarketDataModule, InstrumentsModule],
  controllers: [BotsController],
  providers: [BotsService],
  exports: [BotsService],
})
export class BotsModule {}
