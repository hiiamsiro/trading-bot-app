import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNotEmpty, MaxLength } from 'class-validator';

export class ValidateStrategyCodeDto {
  @ApiProperty({ example: '// Your strategy code here\nsignal("BUY", 0.8, "RSI oversold");' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(65_536) // 64 KB max — prevents memory exhaustion during parsing
  code: string;
}
