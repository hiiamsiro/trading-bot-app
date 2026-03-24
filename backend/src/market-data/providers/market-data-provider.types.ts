export type MarketKlineInterval = '1m' | '5m' | '15m' | '1h' | '4h' | '1d';

export type MarketDataAdapterSnapshot = {
  symbol: string;
  price: number;
  timestamp: string;
  interval: MarketKlineInterval;
  close?: number;
};

export type MarketKline = {
  openTime: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  closeTime: number;
};

export type MarketSnapshot = {
  symbol: string;
  price: number;
  timestamp: string;
  interval: MarketKlineInterval;
};

export interface MarketDataAdapter {
  providerKey: string;
  getLatestPrice(symbol: string): Promise<number>;
  getKlines(symbol: string, interval: MarketKlineInterval, limit: number): Promise<MarketKline[]>;
  subscribeToLiveUpdates(
    symbol: string,
    interval: MarketKlineInterval,
    onUpdate: (snapshot: MarketDataAdapterSnapshot) => void,
  ): Promise<void>;
  close(): Promise<void>;
}
