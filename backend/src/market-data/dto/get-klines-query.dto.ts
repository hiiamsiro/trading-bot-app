import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';
import { MARKET_KLINE_INTERVAL_VALUES } from '../providers/market-data-provider.types';
import type { MarketKlineInterval } from '../providers/market-data-provider.types';

export class GetKlinesQueryDto {
  @ApiProperty({ example: 'BTC/USDT', description: 'Instrument symbol (catalog format)' })
  @IsString()
  @MaxLength(32)
  symbol!: string;

  @ApiPropertyOptional({
    enum: MARKET_KLINE_INTERVAL_VALUES,
    default: '1m',
    description: 'Candle interval',
  })
  @IsOptional()
  @IsIn(MARKET_KLINE_INTERVAL_VALUES)
  interval?: MarketKlineInterval;

  @ApiPropertyOptional({ default: 250, minimum: 10, maximum: 500 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(10)
  @Max(500)
  limit?: number;
}
