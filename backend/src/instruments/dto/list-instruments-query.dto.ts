import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsOptional, Max, Min, MaxLength, IsString } from 'class-validator';

export class ListInstrumentsQueryDto {
  @ApiPropertyOptional({ default: 10, maximum: 200 })
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

  @ApiPropertyOptional({ description: 'Search by symbol, display name, base/quote asset' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  search?: string;
}
