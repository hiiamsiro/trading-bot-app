import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsOptional, IsEnum, MaxLength, MinLength } from 'class-validator';
import { BotStatus } from '@prisma/client';

export class UpdateBotDto {
  @ApiPropertyOptional({ example: 'My Trading Bot' })
  @IsString()
  @IsOptional()
  @MinLength(1)
  @MaxLength(200)
  name?: string;

  @ApiPropertyOptional({ example: 'Updated description' })
  @IsString()
  @IsOptional()
  @MaxLength(2000)
  description?: string;

  @ApiPropertyOptional({ example: 'BTCUSD' })
  @IsString()
  @IsOptional()
  @MinLength(1)
  @MaxLength(64)
  symbol?: string;

  @ApiPropertyOptional({ enum: BotStatus })
  @IsEnum(BotStatus)
  @IsOptional()
  status?: BotStatus;
}
