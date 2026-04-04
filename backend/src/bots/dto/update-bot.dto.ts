import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsOptional, IsEnum, MaxLength, MinLength, IsUUID } from 'class-validator';
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

  /**
   * Re-link the bot to a saved StrategyCode.
   * Pass a UUID string to assign, null to unlink, or omit to leave unchanged.
   */
  @ApiPropertyOptional({ example: '550e8400-e29b-41d4-a716-446655440000', nullable: true })
  @IsUUID()
  @IsOptional()
  sourceCodeId?: string | null;
}
