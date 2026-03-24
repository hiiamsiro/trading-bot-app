import { Module } from '@nestjs/common';
import { MarketDataGateway } from './market-data.gateway';
import { MarketDataService } from './market-data.service';

@Module({
  providers: [MarketDataGateway, MarketDataService],
  exports: [MarketDataService],
})
export class MarketDataModule {}
