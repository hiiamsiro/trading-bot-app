import { Controller, Get, Post, Body, Param, UseGuards, HttpCode, HttpStatus } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { WalkforwardService } from './walkforward.service';
import { StartWalkforwardDto } from './dto/start-walkforward.dto';
import { CurrentUser } from '../common/decorators/current-user.decorator';

type AuthUserPayload = { userId: string; email: string };

@ApiTags('walkforward')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('walkforward')
export class WalkforwardController {
  constructor(private readonly walkforwardService: WalkforwardService) {}

  @Post()
  @HttpCode(HttpStatus.ACCEPTED)
  async startWalkforward(
    @Body() dto: StartWalkforwardDto,
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

    const result = await this.walkforwardService.startWalkforward(user.userId, {
      symbol: dto.symbol,
      interval: dto.interval,
      strategy: dto.strategy,
      paramRanges: dto.paramRanges,
      fromDate: dto.fromDate,
      toDate: dto.toDate,
      initialBalance: dto.initialBalance ?? 10000,
      trainSplitPct: dto.trainSplitPct ?? 70,
    });

    return { id: result.id, message: 'Walk-forward analysis started' };
  }

  @Get(':id')
  async getWalkforward(
    @Param('id') id: string,
    @CurrentUser() user: AuthUserPayload,
  ) {
    const record = await this.walkforwardService.getWalkforward(user.userId, id);
    if (!record) {
      throw new Error('Walk-forward analysis not found');
    }
    return record;
  }

  @Get()
  async listWalkforwards(
    @CurrentUser() user: AuthUserPayload,
  ) {
    return this.walkforwardService.listWalkforwards(user.userId);
  }
}
