import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsNotEmpty, IsOptional, IsObject, MaxLength, MinLength } from 'class-validator';

export class CreateTemplateDto {
  @ApiProperty({ example: 'BTC SMA Scalper' })
  @IsString()
  @IsNotEmpty()
  @MinLength(1)
  @MaxLength(200)
  name: string;

  @ApiPropertyOptional({ example: 'Short-term SMA crossover for BTC' })
  @IsString()
  @IsOptional()
  @MaxLength(1000)
  description?: string;

  @ApiProperty({ example: 'sma_crossover' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(128)
  strategy: string;

  @ApiProperty({ example: { shortPeriod: 10, longPeriod: 20, initialBalance: 10000 } })
  @IsObject()
  params: Record<string, unknown>;
}
