import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNotEmpty, IsOptional, IsObject, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

class StrategyConfigDto {
  @ApiProperty({ example: 'sma_crossover' })
  @IsString()
  @IsNotEmpty()
  strategy: string;

  @ApiProperty({ example: { shortPeriod: 10, longPeriod: 20 } })
  @IsObject()
  params: Record<string, any>;
}

export class CreateBotDto {
  @ApiProperty({ example: 'My Trading Bot' })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty({ example: 'BTC/USD', required: false })
  @IsString()
  @IsOptional()
  description?: string;

  @ApiProperty({ example: 'BTCUSD' })
  @IsString()
  @IsNotEmpty()
  symbol: string;

  @ApiProperty({ type: StrategyConfigDto, required: false })
  @IsOptional()
  @ValidateNested()
  @Type(() => StrategyConfigDto)
  strategyConfig?: StrategyConfigDto;
}
