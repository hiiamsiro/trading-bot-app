import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsOptional } from 'class-validator';

export class MarkNotificationReadDto {
  @ApiPropertyOptional({
    description: 'Read state to set. Omit to mark as read.',
    default: true,
  })
  @IsOptional()
  @IsBoolean()
  isRead?: boolean;
}
