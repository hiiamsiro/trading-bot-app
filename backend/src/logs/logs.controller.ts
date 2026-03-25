import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { ListLogsQueryDto } from './dto/list-logs-query.dto';
import { LogsService } from './logs.service';

type AuthUserPayload = { userId: string; email: string };

@ApiTags('logs')
@Controller('logs')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class LogsController {
  constructor(private readonly logsService: LogsService) {}

  @Get()
  @ApiOperation({ summary: 'List bot logs for the current user (newest first)' })
  @ApiOkResponse({ description: 'Paginated log entries across owned bots' })
  async findAll(@CurrentUser() user: AuthUserPayload, @Query() query: ListLogsQueryDto) {
    return this.logsService.findAll(user.userId, query);
  }
}

