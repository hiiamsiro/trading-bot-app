import { ApiPropertyOptional } from '@nestjs/swagger';
import { TradeStatus } from '@prisma/client';
import { Type } from 'class-transformer';
import {
  IsDateString,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

export enum TradeSortBy {
  createdAt = 'createdAt',
  executedAt = 'executedAt',
  closedAt = 'closedAt',
  realizedPnl = 'realizedPnl',
  symbol = 'symbol',
  status = 'status',
  price = 'price',
}

export enum SortDir {
  asc = 'asc',
  desc = 'desc',
}

export class ListTradesQueryDto {
  @ApiPropertyOptional({ description: 'Filter by bot UUID' })
  @IsOptional()
  @IsUUID()
  botId?: string;

  @ApiPropertyOptional({ description: 'Filter by instrument symbol (exact match)' })
  @IsOptional()
  @IsString()
  @MaxLength(64)
  symbol?: string;

  @ApiPropertyOptional({ enum: TradeStatus, description: 'Filter by trade status' })
  @IsOptional()
  @IsEnum(TradeStatus)
  status?: TradeStatus;

  @ApiPropertyOptional({
    description: 'Created-at range start (ISO 8601 date or datetime)',
    example: '2026-03-01',
  })
  @IsOptional()
  @IsDateString()
  from?: string;

  @ApiPropertyOptional({
    description: 'Created-at range end (ISO 8601 date or datetime)',
    example: '2026-03-25',
  })
  @IsOptional()
  @IsDateString()
  to?: string;

  @ApiPropertyOptional({ default: 50, maximum: 200 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(200)
  take?: number;

  @ApiPropertyOptional({ default: 0 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  skip?: number;

  @ApiPropertyOptional({ enum: TradeSortBy, default: TradeSortBy.createdAt })
  @IsOptional()
  @IsEnum(TradeSortBy)
  sortBy?: TradeSortBy;

  @ApiPropertyOptional({ enum: SortDir, default: SortDir.desc })
  @IsOptional()
  @IsEnum(SortDir)
  sortDir?: SortDir;
}

