import { Controller, Get, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { DashboardService } from './dashboard.service';

type AuthUserPayload = { userId: string; email: string };

@ApiTags('dashboard')
@Controller('dashboard')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  @Get()
  @ApiOperation({ summary: 'Aggregated dashboard metrics, equity curve, and recent activity' })
  @ApiOkResponse({ description: 'Dashboard snapshot for the current user' })
  async getSnapshot(@CurrentUser() user: AuthUserPayload) {
    return this.dashboardService.getSnapshot(user.userId);
  }
}
