import { IsOptional, IsUUID } from 'class-validator';

export class GetOptimizationDto {
  @IsUUID()
  @IsOptional()
  id?: string;

  @IsOptional()
  status?: string;

  @IsOptional()
  take?: number;

  @IsOptional()
  skip?: number;
}
