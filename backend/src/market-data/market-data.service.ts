import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { BinanceMarketDataAdapter } from './providers/binance-market-data.adapter';
import {
  MarketDataAdapter,
  MarketDataAdapterSnapshot,
  MarketKline,
  MarketKlineInterval,
  MarketSnapshot,
} from './providers/market-data-provider.types';

type SymbolState = {
  latestPrice: number | null;
  closesByInterval: Map<MarketKlineInterval, number[]>;
  maxHistory: number;
  subscribedIntervals: Set<MarketKlineInterval>;
  latestTimestamp?: string;
};

@Injectable()
export class MarketDataService implements OnModuleDestroy {
  private readonly logger = new Logger(MarketDataService.name);
  private readonly providers: Map<string, MarketDataAdapter>;
  private readonly states = new Map<string, SymbolState>();
  private readonly sourceSymbolCache = new Map<string, string>();
  private readonly defaultInterval: MarketKlineInterval = '1m';

  constructor(
    private readonly prisma: PrismaService,
    private readonly binanceAdapter: BinanceMarketDataAdapter,
  ) {
    this.providers = new Map<string, MarketDataAdapter>([
      [this.binanceAdapter.providerKey, this.binanceAdapter],
    ]);
  }

  async onModuleDestroy(): Promise<void> {
    await Promise.all(Array.from(this.providers.values()).map((provider) => provider.close()));
  }

  private getMaxHistory(): number {
    const parsed = parseInt(process.env.MARKET_DATA_HISTORY || '250', 10);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : 250;
  }

  private getState(instrument: string): SymbolState {
    let state = this.states.get(instrument);
    if (!state) {
      state = {
        latestPrice: null,
        closesByInterval: new Map<MarketKlineInterval, number[]>(),
        maxHistory: this.getMaxHistory(),
        subscribedIntervals: new Set<MarketKlineInterval>(),
      };
      this.states.set(instrument, state);
    }
    return state;
  }

  private pushClose(instrument: string, interval: MarketKlineInterval, closePrice: number): void {
    const state = this.getState(instrument);
    const closes = state.closesByInterval.get(interval) ?? [];
    closes.push(closePrice);
    if (closes.length > state.maxHistory) {
      closes.splice(0, closes.length - state.maxHistory);
    }
    state.closesByInterval.set(interval, closes);
  }

  private applySnapshot(instrument: string, snapshot: MarketDataAdapterSnapshot): void {
    const state = this.getState(instrument);
    state.latestPrice = snapshot.price;
    state.latestTimestamp = snapshot.timestamp;
    if (snapshot.close !== undefined) {
      this.pushClose(instrument, snapshot.interval, snapshot.close);
    }
  }

  private getProvider(): MarketDataAdapter {
    const configured = (process.env.MARKET_DATA_PROVIDER || 'binance').trim().toLowerCase();
    const provider = this.providers.get(configured);
    if (!provider) {
      throw new Error(`Unsupported market data provider: ${configured}`);
    }
    return provider;
  }

  private async resolveSourceSymbol(instrument: string): Promise<string> {
    const normalized = instrument.trim().toUpperCase();
    const cached = this.sourceSymbolCache.get(normalized);
    if (cached) {
      return cached;
    }

    const row = await this.prisma.instrument.findUnique({
      where: { symbol: normalized },
      select: { sourceSymbol: true },
    });
    const source = (row?.sourceSymbol || normalized).replace('/', '').toUpperCase();
    this.sourceSymbolCache.set(normalized, source);
    return source;
  }

  private async bootstrapCloses(
    instrument: string,
    sourceSymbol: string,
    interval: MarketKlineInterval,
  ): Promise<void> {
    const state = this.getState(instrument);
    if ((state.closesByInterval.get(interval)?.length ?? 0) > 0) {
      return;
    }
    try {
      const candles = await this.getProvider().getKlines(sourceSymbol, interval, state.maxHistory);
      state.closesByInterval.set(
        interval,
        candles.map((k) => k.close),
      );
      const last = candles[candles.length - 1];
      if (last) {
        state.latestPrice = last.close;
        state.latestTimestamp = new Date(last.closeTime).toISOString();
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.warn(
        `Failed to bootstrap klines for ${instrument} (${sourceSymbol}): ${message}`,
      );
    }
  }

  async subscribeToLiveUpdates(
    instrument: string,
    interval: MarketKlineInterval = this.defaultInterval,
  ): Promise<void> {
    const normalized = instrument.trim().toUpperCase();
    const state = this.getState(normalized);
    if (state.subscribedIntervals.has(interval)) {
      return;
    }

    const sourceSymbol = await this.resolveSourceSymbol(normalized);
    await this.bootstrapCloses(normalized, sourceSymbol, interval);
    await this.getProvider().subscribeToLiveUpdates(sourceSymbol, interval, (snapshot) => {
      this.applySnapshot(normalized, snapshot);
    });
    state.subscribedIntervals.add(interval);
  }

  async getLatestPrice(
    instrument: string,
    options?: { forceRefresh?: boolean },
  ): Promise<number | null> {
    const normalized = instrument.trim().toUpperCase();
    const state = this.getState(normalized);
    const forceRefresh = options?.forceRefresh === true;
    if (!forceRefresh && state.latestPrice !== null) {
      return state.latestPrice;
    }
    try {
      const sourceSymbol = await this.resolveSourceSymbol(normalized);
      const latest = await this.getProvider().getLatestPrice(sourceSymbol);
      state.latestPrice = latest;
      state.latestTimestamp = new Date().toISOString();
      return latest;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.warn(`Latest price fetch failed for ${normalized}: ${message}`);
      return state.latestPrice;
    }
  }

  async getKlines(
    instrument: string,
    interval: MarketKlineInterval = this.defaultInterval,
    limit?: number,
  ): Promise<MarketKline[]> {
    const normalized = instrument.trim().toUpperCase();
    const state = this.getState(normalized);
    const sourceSymbol = await this.resolveSourceSymbol(normalized);
    const maxItems = limit && limit > 0 ? limit : state.maxHistory;

    try {
      const candles = await this.getProvider().getKlines(sourceSymbol, interval, maxItems);
      state.closesByInterval.set(
        interval,
        candles.map((k) => k.close),
      );
      const last = candles[candles.length - 1];
      if (last) {
        state.latestPrice = last.close;
        state.latestTimestamp = new Date(last.closeTime).toISOString();
      }
      return candles;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.warn(`Kline fetch failed for ${normalized}: ${message}`);
      const closes = state.closesByInterval.get(interval) ?? [];
      return closes.slice(-maxItems).map((close, index) => ({
        openTime: Date.now() - (maxItems - index) * 60_000,
        open: close,
        high: close,
        low: close,
        close,
        volume: 0,
        closeTime: Date.now(),
      }));
    }
  }

  async getMarketSnapshot(
    instrument: string,
    interval: MarketKlineInterval = this.defaultInterval,
  ): Promise<MarketSnapshot | null> {
    const normalized = instrument.trim().toUpperCase();
    await this.subscribeToLiveUpdates(normalized, interval);
    const price = await this.getLatestPrice(normalized);
    if (price === null) {
      return null;
    }
    const state = this.getState(normalized);
    return {
      symbol: normalized,
      price,
      timestamp: state.latestTimestamp ?? new Date().toISOString(),
      interval,
    };
  }

  async getCloses(
    instrument: string,
    maxPoints: number,
    interval: MarketKlineInterval = this.defaultInterval,
  ): Promise<number[]> {
    const normalized = instrument.trim().toUpperCase();
    await this.subscribeToLiveUpdates(normalized, interval);
    const state = this.getState(normalized);
    let closes = state.closesByInterval.get(interval) ?? [];
    if (closes.length === 0) {
      await this.getKlines(normalized, interval, Math.max(maxPoints, 1));
      closes = state.closesByInterval.get(interval) ?? [];
    }
    if (maxPoints <= 0 || maxPoints >= closes.length) {
      return [...closes];
    }
    return closes.slice(-maxPoints);
  }
}
