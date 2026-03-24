import { Injectable, Logger } from '@nestjs/common';
import {
  InstrumentProvider,
  SyncInstrumentRecord,
} from './instrument-provider.types';

type BinanceFilter = {
  filterType: string;
  stepSize?: string;
};

type BinanceSymbol = {
  symbol: string;
  status: string;
  baseAsset: string;
  quoteAsset: string;
  baseAssetPrecision: number;
  quotePrecision: number;
  filters?: BinanceFilter[];
  isSpotTradingAllowed?: boolean;
};

type BinanceExchangeInfoResponse = {
  symbols?: BinanceSymbol[];
};

@Injectable()
export class BinanceInstrumentProvider implements InstrumentProvider {
  private readonly logger = new Logger(BinanceInstrumentProvider.name);
  readonly providerKey = 'binance';

  private readonly supportedIntervals = ['1m', '5m', '15m', '1h', '4h', '1d'];

  private getPrecisionFromStepSize(stepSize?: string): number {
    if (!stepSize || !stepSize.includes('.')) {
      return 0;
    }
    const decimals = stepSize.split('.')[1] ?? '';
    return decimals.replace(/0+$/, '').length;
  }

  private mapStatus(status: string): 'ACTIVE' | 'MAINTENANCE' | 'DISABLED' {
    if (status === 'TRADING') {
      return 'ACTIVE';
    }
    if (status === 'BREAK') {
      return 'MAINTENANCE';
    }
    return 'DISABLED';
  }

  async fetchInstruments(): Promise<SyncInstrumentRecord[]> {
    const baseUrl = process.env.BINANCE_METADATA_URL || 'https://api.binance.com';
    const response = await fetch(`${baseUrl}/api/v3/exchangeInfo`);
    if (!response.ok) {
      throw new Error(`Binance exchangeInfo request failed: ${response.status}`);
    }

    const payload = (await response.json()) as BinanceExchangeInfoResponse;
    const symbols = Array.isArray(payload.symbols) ? payload.symbols : [];

    const mapped = symbols
      .filter((row) => row.isSpotTradingAllowed !== false)
      .map((row) => {
        const lotSize = row.filters?.find((f) => f.filterType === 'LOT_SIZE');
        const quantityPrecisionFromStep = this.getPrecisionFromStepSize(
          lotSize?.stepSize,
        );

        return {
          symbol: row.symbol.toUpperCase(),
          displayName: `${row.baseAsset}/${row.quoteAsset}`,
          baseAsset: row.baseAsset.toUpperCase(),
          quoteCurrency: row.quoteAsset.toUpperCase(),
          exchange: 'BINANCE',
          dataSource: 'BINANCE_REST',
          sourceSymbol: row.symbol.toLowerCase(),
          supportedIntervals: this.supportedIntervals,
          pricePrecision: Math.max(0, row.quotePrecision ?? 0),
          quantityPrecision: Math.max(
            0,
            quantityPrecisionFromStep || row.baseAssetPrecision || 0,
          ),
          status: this.mapStatus(row.status),
        } satisfies SyncInstrumentRecord;
      });

    this.logger.log(`Fetched ${mapped.length} symbols from Binance metadata API`);
    return mapped;
  }
}
