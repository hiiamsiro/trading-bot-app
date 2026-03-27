import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { StrategyService } from '../strategy/strategy.service';
import { CreateTemplateDto } from './dto/create-template.dto';

@Injectable()
export class TemplatesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly strategyService: StrategyService,
  ) {}

  async findAll(userId: string) {
    const [userTemplates, defaults] = await Promise.all([
      this.prisma.botTemplate.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.botTemplate.findMany({
        where: { OR: [{ isDefault: true }, { isSystem: true }] },
        orderBy: { createdAt: 'asc' },
      }),
    ]);
    return { userTemplates, defaults };
  }

  async findOne(id: string, userId: string) {
    const template = await this.prisma.botTemplate.findFirst({
      where: {
        id,
        OR: [{ userId }, { isSystem: true }, { isDefault: true }],
      },
    });
    if (!template) {
      throw new NotFoundException('Template not found');
    }
    return template;
  }

  async create(dto: CreateTemplateDto, userId: string) {
    const validated = this.strategyService.validateConfig(dto.strategy, dto.params);
    return this.prisma.botTemplate.create({
      data: {
        name: dto.name.trim(),
        description: dto.description?.trim() || null,
        strategy: validated.normalizedStrategy,
        params: validated.normalizedParams as object,
        userId,
        isDefault: false,
        isSystem: false,
      },
    });
  }

  async remove(id: string, userId: string) {
    const existing = await this.prisma.botTemplate.findFirst({
      where: { id, userId },
    });
    if (!existing) {
      throw new NotFoundException('Template not found');
    }
    return this.prisma.botTemplate.delete({ where: { id } });
  }
}
