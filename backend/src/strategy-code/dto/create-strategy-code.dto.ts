import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsNotEmpty, IsOptional, MaxLength } from 'class-validator';

export class CreateStrategyCodeDto {
  @ApiProperty({ example: 'My Custom Strategy' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  name: string;

  @ApiPropertyOptional({ example: 'Buy when RSI crosses below 30' })
  @IsString()
  @IsOptional()
  @MaxLength(2000)
  description?: string;

  @ApiProperty({ example: '// Your strategy code here\nsignal("BUY", 0.8, "RSI oversold");' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(65_536) // 64 KB max
  code: string;

  @ApiPropertyOptional({ example: 'javascript' })
  @IsString()
  @IsOptional()
  @MaxLength(32)
  language?: string;
}
