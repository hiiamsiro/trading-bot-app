import { IsEnum } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateCheckoutDto {
  @ApiProperty({ enum: ['PRO', 'PREMIUM'], example: 'PRO' })
  @IsEnum(['PRO', 'PREMIUM'])
  plan!: 'PRO' | 'PREMIUM';
}
