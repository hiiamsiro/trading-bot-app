import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsOptional, IsEnum } from 'class-validator';
import { BotStatus } from '@prisma/client';

export class UpdateBotDto {
  @ApiProperty({ example: 'My Trading Bot', required: false })
  @IsString()
  @IsOptional()
  name?: string;

  @ApiProperty({ example: 'Updated description', required: false })
  @IsString()
  @IsOptional()
  description?: string;

  @ApiProperty({ example: 'BTCUSD', required: false })
  @IsString()
  @IsOptional()
  symbol?: string;

  @ApiProperty({ enum: BotStatus, required: false })
  @IsEnum(BotStatus)
  @IsOptional()
  status?: BotStatus;
}
