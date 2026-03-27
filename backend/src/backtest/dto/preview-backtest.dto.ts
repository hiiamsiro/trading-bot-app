import { IsNotEmpty, IsOptional, IsPositive, IsString } from 'class-validator';
import { MarketKlineInterval } from '../../market-data/providers/market-data-provider.types';

export class PreviewBacktestDto {
  @IsString()
  @IsNotEmpty()
  symbol!: string;

  @IsString()
  @IsNotEmpty()
  interval!: MarketKlineInterval;

  @IsString()
  @IsNotEmpty()
  strategy!: string;

  @IsOptional()
  params?: Record<string, unknown>;
}
