import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class InstrumentsService {
  constructor(private readonly prisma: PrismaService) {}

  async findActive() {
    return this.prisma.instrument.findMany({
      where: {
        isActive: true,
        status: 'ACTIVE',
      },
      orderBy: [{ assetClass: 'asc' }, { symbol: 'asc' }],
    });
  }

  async findAll() {
    return this.prisma.instrument.findMany({
      orderBy: [{ isActive: 'desc' }, { assetClass: 'asc' }, { symbol: 'asc' }],
    });
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
}
