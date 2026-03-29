import { Controller, Post, Body, UseGuards, HttpCode, HttpStatus } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { BacktestService } from './backtest.service';
import { RunBacktestDto } from './dto/run-backtest.dto';
import { PreviewBacktestDto } from './dto/preview-backtest.dto';
import { PrismaService } from '../prisma/prisma.service';
import { CurrentUser } from '../common/decorators/current-user.decorator';

type AuthUserPayload = { userId: string; email: string };

@ApiTags('backtest')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('backtest')
export class BacktestController {
  constructor(
    private readonly backtestService: BacktestService,
    private readonly prisma: PrismaService,
  ) {}

  /** Quick preview against the last 100 candles — no DB record created. */
  @Post('preview')
  @HttpCode(HttpStatus.OK)
  async preview(@Body() dto: PreviewBacktestDto, @CurrentUser() _user: AuthUserPayload) {
    const symbol = dto.symbol.trim().toUpperCase();

    const instrument = await this.prisma.instrument.findUnique({
      where: { symbol },
      select: { sourceSymbol: true },
    });
    const sourceSymbol = (instrument?.sourceSymbol ?? symbol).replace('/', '').toUpperCase();

    const result = await this.backtestService.preview({
      symbol,
      interval: dto.interval,
      strategyKey: dto.strategy,
      strategyParams: dto.params ?? {},
      sourceSymbol,
    });

    return { result };
  }

  @Post()
  @HttpCode(HttpStatus.OK)
  async runBacktest(@Body() dto: RunBacktestDto, @CurrentUser() user: AuthUserPayload) {
    const userId = user.userId;
    const fromDate = new Date(dto.fromDate);
    const toDate = new Date(dto.toDate);

    if (isNaN(fromDate.getTime()) || isNaN(toDate.getTime())) {
      throw new Error('Invalid date format. Use ISO 8601 format (e.g. 2024-01-01).');
    }
    if (fromDate >= toDate) {
      throw new Error('fromDate must be before toDate.');
    }

    const initialBalance = dto.initialBalance ?? 10000;

    // Resolve source symbol for Binance
    const instrument = await this.prisma.instrument.findUnique({
      where: { symbol: dto.symbol.trim().toUpperCase() },
      select: { sourceSymbol: true },
    });
    const sourceSymbol = (instrument?.sourceSymbol ?? dto.symbol.trim().toUpperCase())
      .replace('/', '')
      .toUpperCase();

    const record = await this.prisma.backtest.create({
      data: {
        userId,
        symbol: dto.symbol.trim().toUpperCase(),
        interval: dto.interval,
        strategy: dto.strategy,
        params: (dto.params ?? {}) as object,
        fromDate,
        toDate,
        status: 'RUNNING',
      },
    });

    try {
      const result = await this.backtestService.runBacktest({
        symbol: dto.symbol.trim().toUpperCase(),
        interval: dto.interval,
        strategyKey: dto.strategy,
        strategyParams: dto.params ?? {},
        fromDate,
        toDate,
        initialBalance,
        sourceSymbol,
      });

      const updated = await this.prisma.backtest.update({
        where: { id: record.id },
        data: {
          status: 'COMPLETED',
          metrics: result.metrics as object,
          trades: result.trades as object,
          equityCurve: result.equityCurve as object,
        },
      });

      return { id: updated.id, status: updated.status, result };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      await this.prisma.backtest.update({
        where: { id: record.id },
        data: { status: 'FAILED', error: message },
      });
      throw error;
    }
  }
}
