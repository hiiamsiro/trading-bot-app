import {
  WebSocketGateway,
  WebSocketServer,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';

@WebSocketGateway({
  cors: {
    origin: process.env.CORS_ORIGIN || 'http://localhost:3000',
    credentials: true,
  },
})
export class MarketDataGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  handleConnection(client: Socket) {
    console.log(`Client connected: ${client.id}`);
  }

  handleDisconnect(client: Socket) {
    console.log(`Client disconnected: ${client.id}`);
  }

  emitMarketData(data: Record<string, unknown>) {
    this.server.emit('market-data', data);
  }

  emitBotStatus(data: { botId: string; userId: string; status: string; symbol: string }) {
    this.server.emit('bot-status', data);
  }

  emitNewTrade(data: Record<string, unknown> & { userId: string; botId: string }) {
    this.server.emit('new-trade', data);
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
    this.server.emit('bot-log', data);
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
    this.server.emit('notification', data);
  }
}
