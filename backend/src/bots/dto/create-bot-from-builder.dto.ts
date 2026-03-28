import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsNumber,
  IsPositive,
} from 'class-validator';

// builderConfig is intentionally NOT validated here — forbidNonWhitelisted makes it
// impractical to whitelist all nested builder config properties (indicator, comparison,
// etc. are dynamic union types). Validation is handled by StrategyBuilderService instead.
export class CreateBotFromBuilderDto {
  @ApiProperty({ example: 'BTC momentum bot' })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({ example: 'BTCUSDT' })
  @IsString()
  @IsNotEmpty()
  symbol: string;

  @ApiProperty()
  @IsNumber()
  @IsPositive()
  initialBalance: number;

  @ApiProperty({ description: 'The visual builder JSON config — validated by StrategyBuilderService' })
  builderConfig: Record<string, unknown>;
}
