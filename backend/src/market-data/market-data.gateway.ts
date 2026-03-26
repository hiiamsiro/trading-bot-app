import {
  WebSocketGateway,
  WebSocketServer,
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
  MessageBody,
  ConnectedSocket,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { verify } from 'jsonwebtoken';
import { MarketDataService } from './market-data.service';
import {
  MARKET_KLINE_INTERVAL_VALUES,
  type MarketKlineInterval,
} from './providers/market-data-provider.types';

@WebSocketGateway({
  cors: {
    origin: process.env.CORS_ORIGIN || 'http://localhost:3000',
    credentials: true,
  },
})
export class MarketDataGateway implements OnGatewayConnection, OnGatewayDisconnect {
  constructor(private readonly marketData: MarketDataService) {}

  @WebSocketServer()
  server: Server;

  private readonly marketRoomCounts = new Map<string, number>();

  private roomForUser(userId: string) {
    return `user:${userId}`;
  }

  private roomForMarket(symbol: string, interval: MarketKlineInterval) {
    return `market:${symbol}:${interval}`;
  }

  private nowIso(): string {
    return new Date().toISOString();
  }

  private asNonEmptyString(value: unknown): string | null {
    if (typeof value !== 'string') return null;
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : null;
  }

  private normalizeMarketInterval(value: unknown): MarketKlineInterval | null {
    const raw = this.asNonEmptyString(value);
    if (!raw) return null;
    return (MARKET_KLINE_INTERVAL_VALUES as string[]).includes(raw)
      ? (raw as MarketKlineInterval)
      : null;
  }

  private normalizeDate(value: unknown): string | null {
    if (value === null || value === undefined) return null;
    if (value instanceof Date) return value.toISOString();
    if (typeof value === 'string') return value;
    return null;
  }

  private withMeta<T extends Record<string, unknown>>(
    eventName: string,
    payload: T,
    explicitId?: string,
  ): T & { eventId: string; emittedAt: string } {
    const emittedAt = this.nowIso();
    const eventId = explicitId ?? `${eventName}:${emittedAt}`;
    return { ...payload, eventId, emittedAt };
  }

  private extractToken(client: Socket): string | null {
    const authToken = (client.handshake.auth as { token?: unknown } | undefined)?.token;
    if (typeof authToken === 'string' && authToken.trim().length > 0) {
      return authToken.trim();
    }

    const header = client.handshake.headers?.authorization;
    if (typeof header === 'string') {
      const normalized = header.trim();
      if (normalized.toLowerCase().startsWith('bearer ')) {
        const token = normalized.slice(7).trim();
        return token.length > 0 ? token : null;
      }
    }

    return null;
  }

  private authenticate(client: Socket): string | null {
    const token = this.extractToken(client);
    if (!token) {
      return null;
    }

    const secret = process.env.JWT_SECRET;
    if (!secret) {
      return null;
    }

    try {
      const payload = verify(token, secret) as { sub?: unknown };
      const userId = payload?.sub;
      return typeof userId === 'string' && userId.length > 0 ? userId : null;
    } catch {
      return null;
    }
  }

  handleConnection(client: Socket) {
    const userId = this.authenticate(client);
    if (!userId) {
      client.disconnect(true);
      return;
    }
    client.data.userId = userId;
    client.join(this.roomForUser(userId));
  }

  handleDisconnect(client: Socket) {
    for (const room of client.rooms) {
      if (room.startsWith('market:')) {
        const next = (this.marketRoomCounts.get(room) ?? 0) - 1;
        if (next > 0) {
          this.marketRoomCounts.set(room, next);
        } else {
          this.marketRoomCounts.delete(room);
        }
      }
    }
  }

  getActiveMarketSubscriptions(): Array<{ symbol: string; interval: MarketKlineInterval }> {
    const subscriptions: Array<{ symbol: string; interval: MarketKlineInterval }> = [];
    for (const room of this.marketRoomCounts.keys()) {
      const parts = room.split(':');
      if (parts.length !== 3) continue;
      const symbol = parts[1];
      const interval = this.normalizeMarketInterval(parts[2]);
      if (!symbol || !interval) continue;
      subscriptions.push({ symbol, interval });
    }
    return subscriptions;
  }

  @SubscribeMessage('subscribe-market')
  async subscribeMarket(
    @ConnectedSocket() client: Socket,
    @MessageBody() body: { symbol?: unknown; interval?: unknown } | undefined,
  ): Promise<void> {
    const symbol = this.asNonEmptyString(body?.symbol)?.toUpperCase();
    const interval = this.normalizeMarketInterval(body?.interval) ?? '1m';
    if (!symbol) return;
    const room = this.roomForMarket(symbol, interval);
    if (!client.rooms.has(room)) {
      client.join(room);
      this.marketRoomCounts.set(room, (this.marketRoomCounts.get(room) ?? 0) + 1);
    }

    const snapshot = await this.marketData.getMarketSnapshot(symbol, interval);
    if (snapshot) {
      const timestamp = this.asNonEmptyString(snapshot.timestamp) ?? this.nowIso();
      const meta = this.withMeta(
        'market-data',
        snapshot as unknown as Record<string, unknown>,
        `market-data:${symbol}:${interval}:${timestamp}`,
      );
      client.emit('market-data', meta);
    }
  }

  @SubscribeMessage('unsubscribe-market')
  unsubscribeMarket(
    @ConnectedSocket() client: Socket,
    @MessageBody() body: { symbol?: unknown; interval?: unknown } | undefined,
  ): void {
    const symbol = this.asNonEmptyString(body?.symbol)?.toUpperCase();
    const interval = this.normalizeMarketInterval(body?.interval) ?? '1m';
    if (!symbol) return;
    const room = this.roomForMarket(symbol, interval);
    if (!client.rooms.has(room)) return;
    client.leave(room);
    const next = (this.marketRoomCounts.get(room) ?? 0) - 1;
    if (next > 0) {
      this.marketRoomCounts.set(room, next);
    } else {
      this.marketRoomCounts.delete(room);
    }
  }

  emitMarketData(data: Record<string, unknown> & { symbol?: unknown; interval?: unknown }) {
    const symbol = this.asNonEmptyString(data.symbol)?.toUpperCase();
    const interval = this.normalizeMarketInterval(data.interval) ?? '1m';
    const timestamp = this.asNonEmptyString(data.timestamp) ?? this.nowIso();
    const meta = this.withMeta(
      'market-data',
      data as Record<string, unknown>,
      symbol ? `market-data:${symbol}:${interval}:${timestamp}` : undefined,
    );
    if (symbol) {
      this.server.to(this.roomForMarket(symbol, interval)).emit('market-data', meta);
      return;
    }
    this.server.emit('market-data', meta);
  }

  emitBotStatus(data: { botId: string; userId: string; status: string; symbol: string }) {
    const meta = this.withMeta(
      'bot-status',
      data as Record<string, unknown>,
      `bot-status:${data.userId}:${data.botId}:${data.status}`,
    );
    this.server.to(this.roomForUser(data.userId)).emit('bot-status', meta);
  }

  emitNewTrade(data: Record<string, unknown> & { userId: string; botId: string }) {
    const rawId = this.asNonEmptyString((data as Record<string, unknown>).id);
    const createdAt = this.normalizeDate((data as Record<string, unknown>).createdAt);
    const executedAt = this.normalizeDate((data as Record<string, unknown>).executedAt);
    const closedAt = this.normalizeDate((data as Record<string, unknown>).closedAt);

    const payload: Record<string, unknown> = {
      ...data,
      ...(createdAt ? { createdAt } : {}),
      ...(executedAt !== null ? { executedAt } : {}),
      ...(closedAt !== null ? { closedAt } : {}),
    };

    const meta = this.withMeta(
      'new-trade',
      payload,
      rawId ? `new-trade:${data.userId}:${rawId}` : undefined,
    );
    this.server.to(this.roomForUser(data.userId)).emit('new-trade', meta);
  }

  emitBotLog(data: {
    id: string;
    botId: string;
    userId: string;
    level: string;
    category: string;
    message: string;
    metadata: unknown;
    createdAt: string;
  }) {
    const meta = this.withMeta(
      'bot-log',
      data as Record<string, unknown>,
      `bot-log:${data.userId}:${data.id}`,
    );
    this.server.to(this.roomForUser(data.userId)).emit('bot-log', meta);
  }

  emitNotification(data: {
    id: string;
    userId: string;
    botId: string | null;
    tradeId: string | null;
    type: string;
    title: string;
    message: string;
    metadata: unknown;
    isRead: boolean;
    readAt: string | null;
    createdAt: string;
  }) {
    const meta = this.withMeta(
      'notification',
      data as Record<string, unknown>,
      `notification:${data.userId}:${data.id}`,
    );
    this.server.to(this.roomForUser(data.userId)).emit('notification', meta);
  }
}
