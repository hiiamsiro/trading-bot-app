import { Type } from 'class-transformer';
import {
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsPositive,
  IsString,
  ValidateNested,
} from 'class-validator';
import { MarketKlineInterval } from '../../market-data/providers/market-data-provider.types';

export class RunBacktestDto {
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

  @IsString()
  @IsNotEmpty()
  fromDate!: string;

  @IsString()
  @IsNotEmpty()
  toDate!: string;

  @IsPositive()
  @IsOptional()
  initialBalance?: number;
}
