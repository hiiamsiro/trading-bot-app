import { Injectable, NotFoundException } from '@nestjs/common';
import {
  InstrumentAssetClass,
  InstrumentMarketType,
  InstrumentStatus,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { BinanceInstrumentProvider } from './providers/binance-instrument.provider';
import { InstrumentProvider } from './providers/instrument-provider.types';

@Injectable()
export class InstrumentsService {
  private readonly providers: Map<string, InstrumentProvider>;

  constructor(
    private readonly prisma: PrismaService,
    private readonly binanceProvider: BinanceInstrumentProvider,
  ) {
    this.providers = new Map<string, InstrumentProvider>([
      [this.binanceProvider.providerKey, this.binanceProvider],
    ]);
  }

  private getProvider(): InstrumentProvider {
    const configured = (process.env.INSTRUMENT_SYNC_PROVIDER || 'binance')
      .trim()
      .toLowerCase();
    const provider = this.providers.get(configured);
    if (!provider) {
      throw new NotFoundException(
        `Unsupported instrument provider: ${configured}`,
      );
    }
    return provider;
  }

  async findActive() {
    return this.prisma.instrument.findMany({
      where: {
        isActive: true,
        status: 'ACTIVE',
      },
      orderBy: [{ assetClass: 'asc' }, { symbol: 'asc' }],
    });
  }

  async findAll(take = 10, skip = 0, query?: string) {
    const keyword = query?.trim();
    const where = keyword
      ? {
          OR: [
            { symbol: { contains: keyword, mode: 'insensitive' as const } },
            { displayName: { contains: keyword, mode: 'insensitive' as const } },
            { baseAsset: { contains: keyword, mode: 'insensitive' as const } },
            { quoteCurrency: { contains: keyword, mode: 'insensitive' as const } },
          ],
        }
      : undefined;

    const [items, total] = await Promise.all([
      this.prisma.instrument.findMany({
        where,
        orderBy: [{ isActive: 'desc' }, { assetClass: 'asc' }, { symbol: 'asc' }],
        take,
        skip,
      }),
      this.prisma.instrument.count({ where }),
    ]);

    return {
      items,
      total,
      take,
      skip,
    };
  }

  async findBySymbol(symbol: string) {
    const normalized = symbol.trim().toUpperCase();
    const instrument = await this.prisma.instrument.findUnique({
      where: { symbol: normalized },
    });

    if (!instrument) {
      throw new NotFoundException('Instrument not found');
    }

    return instrument;
  }

  async assertActiveBySymbol(symbol: string) {
    const normalized = symbol.trim().toUpperCase();
    const instrument = await this.prisma.instrument.findUnique({
      where: { symbol: normalized },
    });

    if (!instrument || !instrument.isActive || instrument.status !== 'ACTIVE') {
      throw new NotFoundException(`Active instrument not found for symbol: ${normalized}`);
    }

    return instrument;
  }

  async setActivationBySymbol(symbol: string, isActive: boolean) {
    const normalized = symbol.trim().toUpperCase();
    const existing = await this.prisma.instrument.findUnique({
      where: { symbol: normalized },
    });
    if (!existing) {
      throw new NotFoundException('Instrument not found');
    }

    const nextStatus: InstrumentStatus = isActive ? 'ACTIVE' : 'DISABLED';
    return this.prisma.instrument.update({
      where: { symbol: normalized },
      data: {
        isActive,
        status: nextStatus,
      },
    });
  }

  async syncFromProvider() {
    const provider = this.getProvider();
    const rows = await provider.fetchInstruments();
    let created = 0;
    let updated = 0;

    for (const row of rows) {
      const existing = await this.prisma.instrument.findUnique({
        where: { symbol: row.symbol },
        select: { id: true, isActive: true },
      });

      await this.prisma.instrument.upsert({
        where: { symbol: row.symbol },
        update: {
          displayName: row.displayName,
          assetClass: InstrumentAssetClass.CRYPTO,
          marketType: InstrumentMarketType.SPOT,
          baseAsset: row.baseAsset,
          quoteCurrency: row.quoteCurrency,
          exchange: row.exchange,
          dataSource: row.dataSource,
          sourceSymbol: row.sourceSymbol,
          supportedIntervals: row.supportedIntervals,
          pricePrecision: row.pricePrecision,
          quantityPrecision: row.quantityPrecision,
          status: row.status,
          isActive: existing?.isActive ?? false,
        },
        create: {
          symbol: row.symbol,
          displayName: row.displayName,
          assetClass: InstrumentAssetClass.CRYPTO,
          marketType: InstrumentMarketType.SPOT,
          baseAsset: row.baseAsset,
          quoteCurrency: row.quoteCurrency,
          exchange: row.exchange,
          dataSource: row.dataSource,
          sourceSymbol: row.sourceSymbol,
          supportedIntervals: row.supportedIntervals,
          pricePrecision: row.pricePrecision,
          quantityPrecision: row.quantityPrecision,
          status: row.status,
          isActive: false,
        },
      });

      if (existing) {
        updated += 1;
      } else {
        created += 1;
      }
    }

    return {
      provider: provider.providerKey,
      totalFetched: rows.length,
      created,
      updated,
    };
  }
}
