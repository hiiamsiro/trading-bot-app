import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsObject,
  ValidateNested,
  MaxLength,
  MinLength,
} from 'class-validator';
import { Type } from 'class-transformer';

class StrategyConfigDto {
  @ApiProperty({ example: 'sma_crossover' })
  @IsString()
  @IsNotEmpty()
  @MinLength(1)
  @MaxLength(128)
  strategy: string;

  @ApiProperty({ example: { shortPeriod: 10, longPeriod: 20 } })
  @IsObject()
  params: Record<string, unknown>;
}

export class CreateBotDto {
  @ApiProperty({ example: 'My Trading Bot' })
  @IsString()
  @IsNotEmpty()
  @MinLength(1)
  @MaxLength(200)
  name: string;

  @ApiPropertyOptional({ example: 'Scalps BTC on demo data' })
  @IsString()
  @IsOptional()
  @MaxLength(2000)
  description?: string;

  @ApiProperty({ example: 'BTCUSD' })
  @IsString()
  @IsNotEmpty()
  @MinLength(1)
  @MaxLength(64)
  symbol: string;

  @ApiPropertyOptional({ type: StrategyConfigDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => StrategyConfigDto)
  strategyConfig?: StrategyConfigDto;
}
