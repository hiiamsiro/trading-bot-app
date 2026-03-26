import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AdminGuard } from '../auth/guards/admin.guard';
import { AdminMonitoringQueryDto } from './dto/admin-monitoring-query.dto';
import { AdminService } from './admin.service';

@ApiTags('admin')
@Controller('admin/monitoring')
@UseGuards(JwtAuthGuard, AdminGuard)
@ApiBearerAuth()
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  @Get()
  @ApiOperation({ summary: 'Admin monitoring snapshot (platform-wide)' })
  @ApiOkResponse({ description: 'Platform monitoring snapshot' })
  async getMonitoringSnapshot(@Query() query: AdminMonitoringQueryDto) {
    return this.adminService.getMonitoringSnapshot(query);
  }
}
