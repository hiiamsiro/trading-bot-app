import { Allow, IsArray, IsEnum, IsNotEmpty, IsNumber, IsOptional, IsPositive, IsString, IsUUID, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { MarketKlineInterval } from '../../market-data/providers/market-data-provider.types';

export class ParamRange {
  @IsString()
  @IsNotEmpty()
  param!: string;

  @IsArray()
  @IsNumber({}, { each: true })
  @Allow()
  values!: number[];
}

export class StartOptimizationDto {
  @IsString()
  @IsNotEmpty()
  symbol!: string;

  @IsEnum(['1m', '5m', '15m', '1h', '4h', '1d'])
  interval!: MarketKlineInterval;

  @IsEnum(['rsi', 'sma_crossover'])
  strategy!: string;

  @ValidateNested({ each: true })
  @Type(() => ParamRange)
  paramRanges!: ParamRange[];

  @IsString()
  @IsNotEmpty()
  fromDate!: string;

  @IsString()
  @IsNotEmpty()
  toDate!: string;

  @IsPositive()
  @IsOptional()
  initialBalance?: number;

  @IsUUID()
  @IsOptional()
  botId?: string;
}
