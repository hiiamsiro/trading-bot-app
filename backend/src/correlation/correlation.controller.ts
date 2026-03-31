import { Controller, Get, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CorrelationService } from './correlation.service';
import { CurrentUser } from '../common/decorators/current-user.decorator';

type AuthUserPayload = { userId: string };

@ApiTags('correlation')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('correlation')
export class CorrelationController {
  constructor(private readonly correlationService: CorrelationService) {}

  @Get('matrix')
  async getMatrix(@CurrentUser() user: AuthUserPayload) {
    return this.correlationService.getCorrelationMatrix(user.userId);
  }
}
