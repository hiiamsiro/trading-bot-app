import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateBotDto } from './dto/create-bot.dto';
import { UpdateBotDto } from './dto/update-bot.dto';

@Injectable()
export class BotsService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(userId: string) {
    return this.prisma.bot.findMany({
      where: { userId },
      include: {
        strategyConfig: true,
        executionSession: true,
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(id: string, userId: string) {
    const bot = await this.prisma.bot.findUnique({
      where: { id },
      include: {
        strategyConfig: true,
        executionSession: true,
      },
    });

    if (!bot) {
      throw new NotFoundException('Bot not found');
    }

    if (bot.userId !== userId) {
      throw new ForbiddenException('Access denied');
    }

    return bot;
  }

  async create(createBotDto: CreateBotDto, userId: string) {
    return this.prisma.bot.create({
      data: {
        name: createBotDto.name,
        description: createBotDto.description,
        symbol: createBotDto.symbol,
        userId,
        strategyConfig: createBotDto.strategyConfig
          ? {
              create: {
                strategy: createBotDto.strategyConfig.strategy,
                params: createBotDto.strategyConfig.params,
              },
            }
          : undefined,
      },
      include: {
        strategyConfig: true,
      },
    });
  }

  async update(id: string, updateBotDto: UpdateBotDto, userId: string) {
    await this.findOne(id, userId);

    return this.prisma.bot.update({
      where: { id },
      data: {
        name: updateBotDto.name,
        description: updateBotDto.description,
        symbol: updateBotDto.symbol,
        status: updateBotDto.status,
      },
      include: {
        strategyConfig: true,
      },
    });
  }

  async remove(id: string, userId: string) {
    await this.findOne(id, userId);

    return this.prisma.bot.delete({
      where: { id },
    });
  }

  async findLogs(
    botId: string,
    userId: string,
    take: number,
    skip: number,
  ) {
    await this.findOne(botId, userId);

    const [items, total] = await Promise.all([
      this.prisma.botLog.findMany({
        where: { botId },
        orderBy: { createdAt: 'desc' },
        take,
        skip,
      }),
      this.prisma.botLog.count({ where: { botId } }),
    ]);

    return {
      items,
      total,
      take,
      skip,
    };
  }
}
