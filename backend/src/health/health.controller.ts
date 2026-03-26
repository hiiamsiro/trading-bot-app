import { Controller, Get, ServiceUnavailableException } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { PrismaService } from '../prisma/prisma.service';

@ApiTags('health')
@Controller('health')
export class HealthController {
  constructor(private readonly prisma: PrismaService) {}

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
}

