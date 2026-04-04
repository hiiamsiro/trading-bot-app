import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsOptional, MaxLength, MinLength } from 'class-validator';

export class UpdateStrategyCodeDto {
  @ApiPropertyOptional({ example: 'My Custom Strategy' })
  @IsString()
  @IsOptional()
  @MaxLength(200)
  name?: string;

  @ApiPropertyOptional({ example: 'Updated description' })
  @IsString()
  @IsOptional()
  @MaxLength(2000)
  description?: string;

  @ApiPropertyOptional({ example: '// Updated strategy code' })
  @IsString()
  @IsOptional()
  @MinLength(1)
  @MaxLength(65_536) // 64 KB max
  code?: string;

  @ApiPropertyOptional({ example: 'javascript' })
  @IsString()
  @IsOptional()
  @MaxLength(32)
  language?: string;
}
