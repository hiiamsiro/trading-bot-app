import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { InstrumentsController } from './instruments.controller';
import { InstrumentsService } from './instruments.service';
import { BinanceInstrumentProvider } from './providers/binance-instrument.provider';

@Module({
  imports: [PrismaModule],
  controllers: [InstrumentsController],
  providers: [InstrumentsService, BinanceInstrumentProvider],
  exports: [InstrumentsService],
})
export class InstrumentsModule {}
