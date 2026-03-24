import { Injectable } from '@nestjs/common';

export type MarketTick = {
  symbol: string;
  price: number;
  timestamp: string;
};

type SymbolState = {
  price: number;
  closes: number[];
  maxHistory: number;
};

@Injectable()
export class MarketDataService {
  private readonly states = new Map<string, SymbolState>();

  private defaultSeedPrice(symbol: string): number {
    let h = 0;
    for (let i = 0; i < symbol.length; i += 1) {
      h = (h * 31 + symbol.charCodeAt(i)) | 0;
    }
    const base = 20000 + (Math.abs(h) % 40000);
    return Math.round(base * 100) / 100;
  }

  private getOrCreateState(symbol: string): SymbolState {
    const maxHistory = parseInt(
      process.env.MARKET_DATA_HISTORY || '200',
      10,
    );
    let state = this.states.get(symbol);
    if (!state) {
      state = {
        price: this.defaultSeedPrice(symbol),
        closes: [],
        maxHistory: Number.isFinite(maxHistory) ? maxHistory : 200,
      };
      this.states.set(symbol, state);
    }
    return state;
  }

  /**
   * Geometric random walk mock tick; updates in-memory close history for strategies.
   */
  nextTick(symbol: string): MarketTick {
    const state = this.getOrCreateState(symbol);
    const volatility = Number(process.env.MARKET_DATA_VOLATILITY) || 0.0015;
    const drift = Number(process.env.MARKET_DATA_DRIFT) || 0.0001;
    const shock = (Math.random() - 0.5) * 2 * volatility;
    const next = state.price * (1 + drift + shock);
    state.price = Math.max(0.01, Math.round(next * 100) / 100);
    state.closes.push(state.price);
    if (state.closes.length > state.maxHistory) {
      state.closes.splice(0, state.closes.length - state.maxHistory);
    }
    const tick: MarketTick = {
      symbol,
      price: state.price,
      timestamp: new Date().toISOString(),
    };
    return tick;
  }

  getLastPrice(symbol: string): number | null {
    const state = this.states.get(symbol);
    return state ? state.price : null;
  }

  getCloses(symbol: string, maxPoints: number): number[] {
    const state = this.states.get(symbol);
    if (!state || state.closes.length === 0) {
      return [];
    }
    if (maxPoints <= 0 || maxPoints >= state.closes.length) {
      return [...state.closes];
    }
    return state.closes.slice(-maxPoints);
  }
}
