import { Injectable, Logger } from '@nestjs/common';
import WebSocket from 'ws';
import {
  MarketDataAdapter,
  MarketDataAdapterSnapshot,
  MarketKline,
  MarketKlineInterval,
} from './market-data-provider.types';

type StreamState = {
  ws: WebSocket;
  retries: number;
  reconnectTimer?: NodeJS.Timeout;
  listeners: Set<(snapshot: MarketDataAdapterSnapshot) => void>;
};

type BinanceKlinePayload = {
  e?: string;
  E?: number;
  s?: string;
  k?: {
    i?: string;
    c?: string;
    T?: number;
  };
};

@Injectable()
export class BinanceMarketDataAdapter implements MarketDataAdapter {
  private readonly logger = new Logger(BinanceMarketDataAdapter.name);
  readonly providerKey = 'binance';
  private readonly streamStates = new Map<string, StreamState>();

  private getRestBaseUrl(): string {
    return process.env.BINANCE_MARKET_DATA_URL || 'https://api.binance.com';
  }

  private getWsBaseUrl(): string {
    return process.env.BINANCE_WS_URL || 'wss://stream.binance.com:9443/ws';
  }

  private normalizeSymbol(symbol: string): string {
    return symbol.trim().toUpperCase();
  }

  private parseNumber(value: unknown): number {
    const numeric = Number(value);
    if (!Number.isFinite(numeric)) {
      throw new Error(`Invalid numeric value: ${String(value)}`);
    }
    return numeric;
  }

  private buildStreamKey(symbol: string, interval: MarketKlineInterval): string {
    return `${this.normalizeSymbol(symbol)}:${interval}`;
  }

  private buildWsUrl(symbol: string, interval: MarketKlineInterval): string {
    const stream = `${symbol.toLowerCase()}@kline_${interval}`;
    return `${this.getWsBaseUrl()}/${stream}`;
  }

  private nextReconnectDelay(attempt: number): number {
    const base = 1000;
    const max = 30000;
    return Math.min(max, base * 2 ** attempt);
  }

  private connectStream(symbol: string, interval: MarketKlineInterval): StreamState {
    const streamKey = this.buildStreamKey(symbol, interval);
    const url = this.buildWsUrl(symbol, interval);
    const existing = this.streamStates.get(streamKey);
    const listeners = existing?.listeners ?? new Set<(snapshot: MarketDataAdapterSnapshot) => void>();

    const ws = new WebSocket(url);
    const state: StreamState = {
      ws,
      retries: existing?.retries ?? 0,
      listeners,
    };
    this.streamStates.set(streamKey, state);

    ws.on('open', () => {
      state.retries = 0;
      this.logger.log(`Connected market stream ${streamKey}`);
    });

    ws.on('message', (raw) => {
      try {
        const payload = JSON.parse(raw.toString()) as BinanceKlinePayload;
        if (payload.e !== 'kline' || !payload.k?.c) {
          return;
        }
        const close = this.parseNumber(payload.k.c);
        const snapshot: MarketDataAdapterSnapshot = {
          symbol: this.normalizeSymbol(payload.s || symbol),
          price: close,
          close,
          interval,
          timestamp: new Date(payload.E || payload.k.T || Date.now()).toISOString(),
        };
        state.listeners.forEach((listener) => listener(snapshot));
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        this.logger.warn(`Failed parsing Binance stream payload: ${message}`);
      }
    });

    ws.on('error', (error) => {
      this.logger.warn(`Market stream error (${streamKey}): ${error.message}`);
    });

    ws.on('close', () => {
      this.logger.warn(`Market stream disconnected: ${streamKey}`);
      const current = this.streamStates.get(streamKey);
      if (!current || current.listeners.size === 0) {
        this.streamStates.delete(streamKey);
        return;
      }
      const delay = this.nextReconnectDelay(current.retries);
      current.retries += 1;
      if (current.reconnectTimer) {
        clearTimeout(current.reconnectTimer);
      }
      current.reconnectTimer = setTimeout(() => {
        this.connectStream(symbol, interval);
      }, delay);
      this.streamStates.set(streamKey, current);
    });

    return state;
  }

  async getLatestPrice(symbol: string): Promise<number> {
    const normalized = this.normalizeSymbol(symbol);
    const response = await fetch(
      `${this.getRestBaseUrl()}/api/v3/ticker/price?symbol=${encodeURIComponent(normalized)}`,
    );
    if (!response.ok) {
      throw new Error(`Binance ticker failed for ${normalized}: ${response.status}`);
    }
    const payload = (await response.json()) as { price?: string };
    return this.parseNumber(payload.price);
  }

  async getKlines(
    symbol: string,
    interval: MarketKlineInterval,
    limit: number,
  ): Promise<MarketKline[]> {
    const normalized = this.normalizeSymbol(symbol);
    const boundedLimit = Math.min(1000, Math.max(1, limit));
    const response = await fetch(
      `${this.getRestBaseUrl()}/api/v3/klines?symbol=${encodeURIComponent(normalized)}&interval=${interval}&limit=${boundedLimit}`,
    );
    if (!response.ok) {
      throw new Error(`Binance klines failed for ${normalized}: ${response.status}`);
    }
    const payload = (await response.json()) as unknown[];
    if (!Array.isArray(payload)) {
      throw new Error(`Unexpected kline response for ${normalized}`);
    }
    return payload.map((row) => {
      const item = row as (string | number)[];
      return {
        openTime: this.parseNumber(item[0]),
        open: this.parseNumber(item[1]),
        high: this.parseNumber(item[2]),
        low: this.parseNumber(item[3]),
        close: this.parseNumber(item[4]),
        volume: this.parseNumber(item[5]),
        closeTime: this.parseNumber(item[6]),
      };
    });
  }

  async subscribeToLiveUpdates(
    symbol: string,
    interval: MarketKlineInterval,
    onUpdate: (snapshot: MarketDataAdapterSnapshot) => void,
  ): Promise<void> {
    const streamKey = this.buildStreamKey(symbol, interval);
    const existing = this.streamStates.get(streamKey);
    if (existing) {
      existing.listeners.add(onUpdate);
      return;
    }
    const connected = this.connectStream(symbol, interval);
    connected.listeners.add(onUpdate);
  }

  async close(): Promise<void> {
    this.streamStates.forEach((state) => {
      if (state.reconnectTimer) {
        clearTimeout(state.reconnectTimer);
      }
      if (
        state.ws.readyState === WebSocket.OPEN ||
        state.ws.readyState === WebSocket.CONNECTING
      ) {
        state.ws.close();
      }
    });
    this.streamStates.clear();
  }
}
