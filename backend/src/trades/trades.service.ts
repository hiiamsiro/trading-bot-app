import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { ListTradesQueryDto, SortDir, TradeSortBy } from './dto/list-trades-query.dto';

@Injectable()
export class TradesService {
  constructor(private readonly prisma: PrismaService) {}

  private parseRangeDate(value: string, boundary: 'start' | 'end') {
    const trimmed = value.trim();
    if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
      const iso =
        boundary === 'start'
          ? `${trimmed}T00:00:00.000Z`
          : `${trimmed}T23:59:59.999Z`;
      return new Date(iso);
    }
    return new Date(trimmed);
  }

  async findAll(userId: string, query: ListTradesQueryDto) {
    const take = query.take ?? 50;
    const skip = query.skip ?? 0;
    const sortBy = query.sortBy ?? TradeSortBy.createdAt;
    const sortDir = query.sortDir ?? SortDir.desc;

    const where: Prisma.TradeWhereInput = {
      bot: { userId },
      ...(query.botId ? { botId: query.botId } : {}),
    };

    const symbol = query.symbol?.trim();
    if (symbol) {
      where.symbol = { equals: symbol, mode: 'insensitive' };
    }

    if (query.status) {
      where.status = query.status;
    }

    const fromDate = query.from ? this.parseRangeDate(query.from, 'start') : undefined;
    const toDate = query.to ? this.parseRangeDate(query.to, 'end') : undefined;
    if (fromDate || toDate) {
      where.createdAt = {
        ...(fromDate ? { gte: fromDate } : {}),
        ...(toDate ? { lte: toDate } : {}),
      };
    }

    const orderBy = { [sortBy]: sortDir } as Prisma.TradeOrderByWithRelationInput;

    const [total, items] = await this.prisma.$transaction([
      this.prisma.trade.count({ where }),
      this.prisma.trade.findMany({
        where,
        take,
        skip,
        include: {
          bot: {
            select: {
              id: true,
              name: true,
              symbol: true,
            },
          },
        },
        orderBy,
      }),
    ]);

    return { items, total, take, skip };
  }

  async findOne(id: string, userId: string) {
    const trade = await this.prisma.trade.findUnique({
      where: { id },
      include: {
        bot: true,
      },
    });

    if (!trade) {
      throw new NotFoundException('Trade not found');
    }

    if (trade.bot.userId !== userId) {
      throw new ForbiddenException('Access denied');
    }

    return trade;
  }
}
