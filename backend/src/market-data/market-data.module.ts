import { Module } from '@nestjs/common';
import { MarketDataGateway } from './market-data.gateway';
import { MarketDataService } from './market-data.service';
import { BinanceMarketDataAdapter } from './providers/binance-market-data.adapter';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  providers: [MarketDataGateway, MarketDataService, BinanceMarketDataAdapter],
  exports: [MarketDataService, MarketDataGateway],
})
export class MarketDataModule {}
