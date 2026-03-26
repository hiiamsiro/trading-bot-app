import { Injectable, NotFoundException } from '@nestjs/common';
import { NotificationType, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { ListNotificationsQueryDto } from './dto/list-notifications-query.dto';

export type CreateNotificationInput = {
  userId: string;
  botId?: string;
  tradeId?: string;
  type: NotificationType;
  title: string;
  message: string;
  metadata?: Record<string, unknown>;
};

@Injectable()
export class NotificationsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(input: CreateNotificationInput) {
    return this.prisma.notification.create({
      data: {
        userId: input.userId,
        botId: input.botId,
        tradeId: input.tradeId,
        type: input.type,
        title: input.title,
        message: input.message,
        metadata:
          input.metadata === undefined ? undefined : (input.metadata as Prisma.InputJsonValue),
      },
    });
  }

  async findAll(userId: string, query: ListNotificationsQueryDto) {
    const take = query.take ?? 25;
    const skip = query.skip ?? 0;

    const where: Prisma.NotificationWhereInput = {
      userId,
      ...(query.isRead === undefined ? {} : { isRead: query.isRead }),
    };

    const [total, unreadCount, items] = await this.prisma.$transaction([
      this.prisma.notification.count({ where }),
      this.prisma.notification.count({ where: { userId, isRead: false } }),
      this.prisma.notification.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take,
        skip,
      }),
    ]);

    return {
      items,
      total,
      unreadCount,
      take,
      skip,
    };
  }

  async markOneRead(userId: string, id: string, isRead = true) {
    const existing = await this.prisma.notification.findFirst({
      where: { id, userId },
      select: { id: true },
    });

    if (!existing) {
      throw new NotFoundException('Notification not found');
    }

    return this.prisma.notification.update({
      where: { id },
      data: {
        isRead,
        readAt: isRead ? new Date() : null,
      },
    });
  }

  async markAllRead(userId: string) {
    const result = await this.prisma.notification.updateMany({
      where: { userId, isRead: false },
      data: {
        isRead: true,
        readAt: new Date(),
      },
    });

    return {
      updatedCount: result.count,
    };
  }
}
