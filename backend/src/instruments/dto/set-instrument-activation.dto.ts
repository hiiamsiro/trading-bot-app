import { ApiProperty } from '@nestjs/swagger';
import { IsBoolean } from 'class-validator';

export class SetInstrumentActivationDto {
  @ApiProperty({
    example: true,
    description: 'Whether this instrument is available for bot creation',
  })
  @IsBoolean()
  isActive: boolean;
}
