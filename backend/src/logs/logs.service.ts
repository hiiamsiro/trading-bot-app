import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { ListLogsQueryDto } from './dto/list-logs-query.dto';

@Injectable()
export class LogsService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(userId: string, query: ListLogsQueryDto) {
    const take = query.take ?? 50;
    const skip = query.skip ?? 0;

    const where: Prisma.BotLogWhereInput = {
      bot: { userId },
      ...(query.botId ? { botId: query.botId } : {}),
      ...(query.level ? { level: query.level } : {}),
    };

    const category = query.category?.trim();
    if (category) {
      where.category = { equals: category, mode: 'insensitive' };
    }

    const search = query.search?.trim();
    if (search) {
      where.message = { contains: search, mode: 'insensitive' };
    }

    const [total, items] = await this.prisma.$transaction([
      this.prisma.botLog.count({ where }),
      this.prisma.botLog.findMany({
        where,
        take,
        skip,
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        include: {
          bot: { select: { name: true } },
        },
      }),
    ]);

    return {
      items: items.map((row) => ({
        id: row.id,
        botId: row.botId,
        botName: row.bot.name,
        level: row.level,
        category: row.category,
        message: row.message,
        metadata: row.metadata,
        createdAt: row.createdAt,
      })),
      total,
      take,
      skip,
    };
  }
}
