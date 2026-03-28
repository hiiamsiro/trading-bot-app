import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

function generateSlug(name: string): string {
  const base = name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .slice(0, 40);
  const suffix = Math.random().toString(36).slice(2, 7);
  return `${base}-${suffix}`;
}

@Injectable()
export class ShareService {
  constructor(private readonly prisma: PrismaService) {}

  async publishBot(botId: string): Promise<{ shareSlug: string }> {
    const slug = generateSlug(
      (
        await this.prisma.bot.findUniqueOrThrow({
          where: { id: botId },
          select: { name: true },
        })
      ).name,
    );

    await this.prisma.bot.update({
      where: { id: botId },
      data: { isPublic: true, shareSlug: slug },
    });

    return { shareSlug: slug };
  }

  async unpublishBot(botId: string): Promise<void> {
    await this.prisma.bot.update({
      where: { id: botId },
      data: { isPublic: false, shareSlug: null },
    });
  }

  async browsePublic(
    query: { take?: number; skip?: number; search?: string; strategy?: string },
  ): Promise<{
    items: Array<{
      id: string
      name: string
      description: string | null
      symbol: string
      strategy: string
      userName: string | null
      createdAt: Date
      shareSlug: string
    }>
    total: number
    take: number
    skip: number
  }> {
    const take = Math.min(query.take ?? 24, 50)
    const skip = query.skip ?? 0

    const where = {
      isPublic: true,
      ...(query.search?.trim()
        ? {
            OR: [
              { name: { contains: query.search.trim(), mode: 'insensitive' as const } },
              { description: { contains: query.search.trim(), mode: 'insensitive' as const } },
              { symbol: { contains: query.search.trim(), mode: 'insensitive' as const } },
            ],
          }
        : {}),
      ...(query.strategy
        ? { strategyConfig: { strategy: { equals: query.strategy } } }
        : {}),
    }

    const [total, items] = await this.prisma.$transaction([
      this.prisma.bot.count({ where }),
      this.prisma.bot.findMany({
        where,
        select: {
          id: true,
          name: true,
          description: true,
          symbol: true,
          createdAt: true,
          shareSlug: true,
          strategyConfig: { select: { strategy: true } },
          user: { select: { name: true } },
        },
        orderBy: { createdAt: 'desc' },
        take,
        skip,
      }),
    ])

    return {
      items: items.map((b) => ({
        id: b.id,
        name: b.name,
        description: b.description,
        symbol: b.symbol,
        strategy: b.strategyConfig?.strategy ?? 'unknown',
        userName: b.user.name,
        createdAt: b.createdAt,
        shareSlug: b.shareSlug ?? b.id,
      })),
      total,
      take,
      skip,
    }
  }

  async getBySlug(
    slug: string,
  ): Promise<{
    id: string
    name: string
    description: string | null
    symbol: string
    strategy: string
    params: Record<string, unknown>
    builderConfig: Record<string, unknown> | null
    userName: string | null
    userEmail: string
  } | null> {
    const bot = await this.prisma.bot.findUnique({
      where: { shareSlug: slug, isPublic: true },
      select: {
        id: true,
        name: true,
        description: true,
        symbol: true,
        strategyConfig: { select: { strategy: true, params: true, builderConfig: true } },
        user: { select: { name: true, email: true } },
      },
    })

    if (!bot) return null

    return {
      id: bot.id,
      name: bot.name,
      description: bot.description,
      symbol: bot.symbol,
      strategy: bot.strategyConfig?.strategy ?? 'unknown',
      params: (bot.strategyConfig?.params as Record<string, unknown>) ?? {},
      builderConfig: (bot.strategyConfig?.builderConfig as Record<string, unknown>) ?? null,
      userName: bot.user.name,
      userEmail: bot.user.email,
    }
  }
}
