import { test, describe, it, beforeEach, afterEach, before, after, mock } from 'node:test';
import * as assert from 'node:assert';
import { NotFoundException } from '@nestjs/common';

const { InstrumentsService } = require('../src/instruments/instruments.service.ts');

const { mockAsyncFn } = require('./helpers.ts');

test('InstrumentsService.assertActiveBySymbol throws when instrument is missing', async () => {
  const prisma = {
    instrument: {
      findUnique: mockAsyncFn(async () => null),
    },
  };
  const binanceProvider = { providerKey: 'binance', fetchInstruments: mockAsyncFn(async () => []) };
  const svc = new InstrumentsService(prisma, binanceProvider);

  await assert.rejects(
    () => svc.assertActiveBySymbol('BTCUSDT'),
    (err: unknown) => {
      const e = err as NotFoundException;
      assert.ok(err instanceof NotFoundException);
      assert.match(e.message, /Active instrument not found/);
      return true;
    },
  );
});

test('InstrumentsService.assertActiveBySymbol returns instrument when active', async () => {
  const instrument = { symbol: 'BTCUSDT', isActive: true, status: 'ACTIVE' };
  const prisma = {
    instrument: {
      findUnique: mockAsyncFn(async () => instrument),
    },
  };
  const binanceProvider = { providerKey: 'binance', fetchInstruments: mockAsyncFn(async () => []) };
  const svc = new InstrumentsService(prisma, binanceProvider);

  const found = await svc.assertActiveBySymbol(' btcusdt ');
  assert.equal(found, instrument);
  assert.equal(prisma.instrument.findUnique.calls.length, 1);
  assert.deepEqual(prisma.instrument.findUnique.calls[0][0], { where: { symbol: 'BTCUSDT' } });
});

export {};
