export type SyncInstrumentRecord = {
  symbol: string;
  displayName: string;
  baseAsset?: string;
  quoteCurrency: string;
  exchange: string;
  dataSource: string;
  sourceSymbol?: string;
  supportedIntervals: string[];
  pricePrecision: number;
  quantityPrecision: number;
  status: 'ACTIVE' | 'MAINTENANCE' | 'DISABLED';
};

export interface InstrumentProvider {
  providerKey: string;
  fetchInstruments(): Promise<SyncInstrumentRecord[]>;
}
