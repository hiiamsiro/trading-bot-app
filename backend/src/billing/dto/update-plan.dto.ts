import { IsEnum } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { Plan } from '@prisma/client';

export class UpdatePlanDto {
  @ApiProperty({ enum: Plan, example: 'PRO' })
  @IsEnum(Plan)
  plan!: Plan;
}
