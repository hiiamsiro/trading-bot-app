import { Controller, Get, ServiceUnavailableException } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { PrismaService } from '../prisma/prisma.service';
import { BotHealthService } from './bot-health.service';
import { BotHealthReportResponseDto } from './dto/bot-health-report-response.dto';
import { CurrentUser } from '../common/decorators/current-user.decorator';

@ApiTags('health')
@Controller('health')
export class HealthController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly botHealth: BotHealthService,
  ) {}

  @Get()
  @ApiOperation({ summary: 'Basic health check (DB connectivity)' })
  @ApiOkResponse({ description: 'Service is healthy' })
  async getHealth() {
    const startedAt = Date.now();
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      return {
        status: 'ok',
        time: new Date().toISOString(),
        uptimeSeconds: Math.round(process.uptime()),
        checks: {
          database: 'ok',
        },
        latencyMs: Date.now() - startedAt,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Database unreachable';
      throw new ServiceUnavailableException({
        status: 'error',
        time: new Date().toISOString(),
        uptimeSeconds: Math.round(process.uptime()),
        checks: {
          database: 'error',
        },
        latencyMs: Date.now() - startedAt,
        error: message,
      });
    }
  }

  @Get('bots')
  @ApiOperation({ summary: 'Bot health report: detect stuck bots and missing market data' })
  @ApiOkResponse({ type: BotHealthReportResponseDto })
  async getBotHealth(
    @CurrentUser('id') userId: string,
  ): Promise<BotHealthReportResponseDto> {
    return this.botHealth.getReport(userId);
  }
}

