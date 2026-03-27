import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class PortfolioService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(userId: string) {
    return this.prisma.portfolio.findMany({
      where: { userId },
      include: {
        bots: {
          include: {
            executionSession: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(id: string, userId: string) {
    const portfolio = await this.prisma.portfolio.findFirst({
      where: { id, userId },
      include: {
        bots: {
          include: {
            executionSession: true,
            trades: {
              orderBy: { createdAt: 'desc' },
              take: 20,
            },
          },
        },
      },
    });
    if (!portfolio) throw new NotFoundException('Portfolio not found');
    return portfolio;
  }

  async create(userId: string, dto: { name: string; botIds?: string[] }) {
    // verify all bots belong to the user
    if (dto.botIds?.length) {
      const count = await this.prisma.bot.count({
        where: { id: { in: dto.botIds }, userId },
      });
      if (count !== dto.botIds.length) {
        throw new BadRequestException('One or more bots not found or not owned by user');
      }
    }

    return this.prisma.portfolio.create({
      data: {
        name: dto.name,
        userId,
        bots: dto.botIds?.length
          ? { connect: dto.botIds.map((id) => ({ id })) }
          : undefined,
      },
      include: { bots: true },
    });
  }

  async update(id: string, userId: string, dto: { name?: string; botIds?: string[] }) {
    const portfolio = await this.prisma.portfolio.findFirst({
      where: { id, userId },
    });
    if (!portfolio) throw new NotFoundException('Portfolio not found');

    if (dto.botIds !== undefined) {
      const count = await this.prisma.bot.count({
        where: { id: { in: dto.botIds }, userId },
      });
      if (count !== dto.botIds.length) {
        throw new BadRequestException('One or more bots not found or not owned by user');
      }
    }

    return this.prisma.portfolio.update({
      where: { id },
      data: {
        name: dto.name,
        bots: dto.botIds ? { set: dto.botIds.map((bid) => ({ id: bid })) } : undefined,
      },
      include: { bots: true },
    });
  }

  async remove(id: string, userId: string) {
    const portfolio = await this.prisma.portfolio.findFirst({
      where: { id, userId },
    });
    if (!portfolio) throw new NotFoundException('Portfolio not found');

    // unlink bots but keep them alive
    await this.prisma.bot.updateMany({
      where: { portfolioId: id },
      data: { portfolioId: null },
    });

    return this.prisma.portfolio.delete({ where: { id } });
  }

  async getMetrics(id: string, userId: string) {
    const portfolio = await this.prisma.portfolio.findFirst({
      where: { id, userId },
      include: {
        bots: {
          include: {
            trades: { where: { status: 'CLOSED' } },
            executionSession: true,
          },
        },
      },
    });
    if (!portfolio) throw new NotFoundException('Portfolio not found');

    const allTrades = portfolio.bots.flatMap((b) => b.trades);
    const totalPnl = allTrades.reduce((sum, t) => sum + (t.netPnl ?? 0), 0);
    const closedCount = allTrades.length;
    const winningTrades = allTrades.filter((t) => (t.netPnl ?? 0) > 0);
    const losingTrades = allTrades.filter((t) => (t.netPnl ?? 0) < 0);

    const totalInitialBalance = portfolio.bots.reduce(
      (sum, b) => sum + (b.executionSession?.initialBalance ?? 0),
      0,
    );
    const totalCurrentBalance = portfolio.bots.reduce(
      (sum, b) => sum + (b.executionSession?.currentBalance ?? 0),
      0,
    );

    // drawdown: peak-to-current as a fraction of peak
    let peakBalance = 0;
    let maxDrawdown = 0;
    // walk trades chronologically per bot, tracking cumulative balance
    for (const bot of portfolio.bots) {
      const sorted = [...bot.trades].sort(
        (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
      );
      let runningBalance = bot.executionSession?.initialBalance ?? 0;
      for (const trade of sorted) {
        runningBalance += trade.netPnl ?? 0;
        if (runningBalance > peakBalance) peakBalance = runningBalance;
        const drawdown = peakBalance > 0 ? (peakBalance - runningBalance) / peakBalance : 0;
        if (drawdown > maxDrawdown) maxDrawdown = drawdown;
      }
    }
    // if no trades yet, compare initial vs current
    if (allTrades.length === 0 && totalInitialBalance > 0) {
      const drawdown = (totalInitialBalance - totalCurrentBalance) / totalInitialBalance;
      maxDrawdown = Math.max(0, drawdown);
    }

    const totalBots = portfolio.bots.length;
    const runningBots = portfolio.bots.filter((b) => b.status === 'RUNNING').length;

    return {
      totalPnl,
      drawdown: maxDrawdown,
      closedTrades: closedCount,
      winningTrades: winningTrades.length,
      losingTrades: losingTrades.length,
      winRate: closedCount > 0 ? winningTrades.length / closedCount : null,
      avgWin: winningTrades.length > 0
        ? winningTrades.reduce((s, t) => s + (t.netPnl ?? 0), 0) / winningTrades.length
        : null,
      avgLoss: losingTrades.length > 0
        ? losingTrades.reduce((s, t) => s + (t.netPnl ?? 0), 0) / losingTrades.length
        : null,
      totalInitialBalance,
      totalCurrentBalance,
      totalBots,
      runningBots,
    };
  }
}
