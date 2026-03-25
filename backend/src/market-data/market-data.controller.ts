import { BadGatewayException, Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { GetKlinesQueryDto } from './dto/get-klines-query.dto';
import { MarketDataService } from './market-data.service';
import { MarketKline } from './providers/market-data-provider.types';

@ApiTags('market-data')
@Controller('market-data')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class MarketDataController {
  constructor(private readonly marketDataService: MarketDataService) {}

  @Get('klines')
  @ApiOperation({ summary: 'OHLCV candles from the configured market data provider' })
  @ApiOkResponse({ description: 'Array of candles ordered by open time' })
  async getKlines(@Query() query: GetKlinesQueryDto): Promise<MarketKline[]> {
    const interval = query.interval ?? '1m';
    const limit = query.limit ?? 250;
    try {
      await this.marketDataService.subscribeToLiveUpdates(query.symbol, interval);
      return await this.marketDataService.getKlines(query.symbol, interval, limit, {
        allowSyntheticFallback: false,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      throw new BadGatewayException(`Market data unavailable: ${message}`);
    }
  }
}
