import {
  WebSocketGateway,
  WebSocketServer,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { verify } from 'jsonwebtoken';

@WebSocketGateway({
  cors: {
    origin: process.env.CORS_ORIGIN || 'http://localhost:3000',
    credentials: true,
  },
})
export class MarketDataGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  private roomForUser(userId: string) {
    return `user:${userId}`;
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
    void client;
  }

  emitMarketData(data: Record<string, unknown>) {
    this.server.emit('market-data', data);
  }

  emitBotStatus(data: { botId: string; userId: string; status: string; symbol: string }) {
    this.server.to(this.roomForUser(data.userId)).emit('bot-status', data);
  }

  emitNewTrade(data: Record<string, unknown> & { userId: string; botId: string }) {
    this.server.to(this.roomForUser(data.userId)).emit('new-trade', data);
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
    this.server.to(this.roomForUser(data.userId)).emit('bot-log', data);
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
    this.server.to(this.roomForUser(data.userId)).emit('notification', data);
  }
}
