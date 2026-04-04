import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, IsPositive, IsString, IsUUID, MaxLength, MinLength, IsEnum } from 'class-validator';
import { MarketKlineInterval } from '../../market-data/providers/market-data-provider.types';

export class CreateBotFromCodeDto {
  @ApiProperty({ example: 'My Bot From Code' })
  @IsString()
  @IsNotEmpty()
  @MinLength(1)
  @MaxLength(200)
  name!: string;

  @ApiPropertyOptional({ example: 'Runs my custom strategy code' })
  @IsString()
  @IsOptional()
  @MaxLength(2000)
  description?: string;

  @ApiProperty({ example: 'BTCUSDT' })
  @IsString()
  @IsNotEmpty()
  @MinLength(1)
  @MaxLength(64)
  symbol!: string;

  @ApiProperty({ example: '1h', enum: ['1m', '5m', '15m', '1h', '4h', '1d'] })
  @IsEnum(['1m', '5m', '15m', '1h', '4h', '1d'] as const)
  interval!: MarketKlineInterval;

  @ApiPropertyOptional({ example: 10000 })
  @IsPositive()
  @IsOptional()
  initialBalance?: number;

  @ApiProperty({ example: '550e8400-e29b-41d4-a716-446655440000' })
  @IsUUID()
  @IsNotEmpty()
  strategyCodeId!: string;
}

