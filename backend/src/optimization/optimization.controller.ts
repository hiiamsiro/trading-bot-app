import { Controller, Get, Post, Body, Param, Query, UseGuards, HttpCode, HttpStatus } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { OptimizationService } from './optimization.service';
import { StartOptimizationDto } from './dto/start-optimization.dto';
import { CurrentUser } from '../common/decorators/current-user.decorator';

type AuthUserPayload = { userId: string; email: string };

@ApiTags('optimization')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('optimization')
export class OptimizationController {
  constructor(private readonly optimizationService: OptimizationService) {}

  @Post()
  @HttpCode(HttpStatus.ACCEPTED)
  async startOptimization(
    @Body() dto: StartOptimizationDto,
    @CurrentUser() user: AuthUserPayload,
  ) {
    const fromDate = new Date(dto.fromDate);
    const toDate = new Date(dto.toDate);
    if (isNaN(fromDate.getTime()) || isNaN(toDate.getTime())) {
      throw new Error('Invalid date format. Use ISO 8601 format (e.g. 2024-01-01).');
    }
    if (fromDate >= toDate) {
      throw new Error('fromDate must be before toDate.');
    }

    const result = await this.optimizationService.startOptimization(user.userId, {
      symbol: dto.symbol,
      interval: dto.interval,
      strategy: dto.strategy,
      paramRanges: dto.paramRanges,
      fromDate: dto.fromDate,
      toDate: dto.toDate,
      initialBalance: dto.initialBalance ?? 10000,
      botId: dto.botId,
    });

    return { id: result.id, message: 'Optimization started' };
  }

  @Get(':id')
  async getOptimization(
    @Param('id') id: string,
    @CurrentUser() user: AuthUserPayload,
  ) {
    const record = await this.optimizationService.getOptimization(user.userId, id);
    if (!record) {
      throw new Error('Optimization not found');
    }
    return record;
  }

  @Get()
  async listOptimizations(
    @CurrentUser() user: AuthUserPayload,
    @Query('take') take?: string,
    @Query('skip') skip?: string,
  ) {
    return this.optimizationService.listOptimizations(
      user.userId,
      take ? parseInt(take, 10) : 20,
      skip ? parseInt(skip, 10) : 0,
    );
  }
}
