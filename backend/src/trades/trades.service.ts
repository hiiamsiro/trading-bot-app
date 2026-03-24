import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class TradesService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(userId: string, botId?: string) {
    const where: any = {
      bot: {
        userId,
      },
    };

    if (botId) {
      where.botId = botId;
    }

    return this.prisma.trade.findMany({
      where,
      include: {
        bot: {
          select: {
            id: true,
            name: true,
            symbol: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
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
