import { Test, TestingModule } from '@nestjs/testing';
import { OptimizationService } from '../src/optimization/optimization.service';
import { PrismaService } from '../src/prisma/prisma.service';
import { BacktestService } from '../src/backtest/backtest.service';
import { getQueueToken } from '@nestjs/bullmq';

describe('OptimizationService', () => {
  let service: OptimizationService;
  let prisma: PrismaService;
  let mockQueue: { add: jest.Mock };

  beforeEach(async () => {
    mockQueue = { add: jest.fn().mockResolvedValue(undefined) };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OptimizationService,
        { provide: PrismaService, useValue: { optimization: { create: jest.fn(), findUnique: jest.fn(), update: jest.fn(), findMany: jest.fn(), count: jest.fn() }, instrument: { findUnique: jest.fn() } } },
        { provide: BacktestService, useValue: { runBacktest: jest.fn() } },
        { provide: getQueueToken('optimization'), useValue: mockQueue },
      ],
    }).compile();

    service = module.get<OptimizationService>(OptimizationService);
    prisma = module.get<PrismaService>(PrismaService);
  });

  describe('generateCombinations', () => {
    it('should return single empty object for empty paramRanges', () => {
      const combos = (service as unknown as { generateCombinations: (ranges: {param: string, values: number[]}[]) => Record<string, unknown>[] }).generateCombinations([]);
      expect(combos).toEqual([{}]);
    });

    it('should generate all combinations for single param', () => {
      const combos = (service as unknown as { generateCombinations: (ranges: {param: string, values: number[]}[]) => Record<string, unknown>[] }).generateCombinations([
        { param: 'period', values: [10, 14, 20] },
      ]);
      expect(combos).toHaveLength(3);
      expect(combos).toContainEqual({ period: 10 });
      expect(combos).toContainEqual({ period: 14 });
      expect(combos).toContainEqual({ period: 20 });
    });

    it('should generate cartesian product for multiple params', () => {
      const combos = (service as unknown as { generateCombinations: (ranges: {param: string, values: number[]}[]) => Record<string, unknown>[] }).generateCombinations([
        { param: 'period', values: [10, 14] },
        { param: 'oversold', values: [20, 30] },
      ]);
      expect(combos).toHaveLength(4);
      expect(combos).toContainEqual({ period: 10, oversold: 20 });
      expect(combos).toContainEqual({ period: 10, oversold: 30 });
      expect(combos).toContainEqual({ period: 14, oversold: 20 });
      expect(combos).toContainEqual({ period: 14, oversold: 30 });
    });
  });

  describe('startOptimization', () => {
    it('should create optimization record and enqueue jobs', async () => {
      const createMock = jest.fn().mockResolvedValue({ id: 'opt-1', status: 'PENDING' });
      const findUniqueMock = jest.fn().mockResolvedValue({ sourceSymbol: 'BTCUSDT' });

      (prisma.optimization.create as jest.Mock) = createMock;
      (prisma.instrument.findUnique as jest.Mock) = findUniqueMock;

      const result = await service.startOptimization('user-1', {
        symbol: 'BTCUSD',
        interval: '1h',
        strategy: 'rsi',
        paramRanges: [{ param: 'period', values: [10, 14] }],
        fromDate: '2024-01-01',
        toDate: '2024-02-01',
        initialBalance: 10000,
      });

      expect(result.id).toBe('opt-1');
      expect(createMock).toHaveBeenCalled();
      expect(mockQueue.add).toHaveBeenCalledTimes(2); // 2 combinations
    });

    it('should throw when no combinations generated', async () => {
      await expect(
        service.startOptimization('user-1', {
          symbol: 'BTCUSD',
          interval: '1h',
          strategy: 'rsi',
          paramRanges: [],
          fromDate: '2024-01-01',
          toDate: '2024-02-01',
          initialBalance: 10000,
        }),
      ).rejects.toThrow('No parameter combinations generated');
    });

    it('should throw when combinations exceed 5000', async () => {
      const hugeRange = { param: 'period', values: Array.from({ length: 100 }, (_, i) => i + 1) };
      await expect(
        service.startOptimization('user-1', {
          symbol: 'BTCUSD',
          interval: '1h',
          strategy: 'rsi',
          paramRanges: [hugeRange],
          fromDate: '2024-01-01',
          toDate: '2024-02-01',
          initialBalance: 10000,
        }),
      ).rejects.toThrow('Too many combinations');
    });
  });

  describe('recordCombinationResult', () => {
    it('should update best by PnL when candidate is better', async () => {
      const findUniqueMock = jest.fn().mockResolvedValue({
        completedCombinations: 0,
        bestByPnl: null,
        bestByDrawdown: null,
        bestByWinrate: null,
        allResults: [],
        status: 'RUNNING',
      });
      const updateMock = jest.fn().mockResolvedValue(undefined);
      (prisma.optimization.findUnique as jest.Mock) = findUniqueMock;
      (prisma.optimization.update as jest.Mock) = updateMock;

      const candidate = {
        params: { period: 14 },
        metrics: {
          totalTrades: 10, winningTrades: 6, losingTrades: 4,
          winRate: 0.6, totalPnl: 500, maxDrawdown: 0.1,
          initialBalance: 10000, finalBalance: 10500,
          averageWin: 100, averageLoss: 50,
        },
      };

      await service.recordCombinationResult('opt-1', candidate, 0, 1);

      expect(updateMock).toHaveBeenCalledWith({
        where: { id: 'opt-1' },
        data: expect.objectContaining({
          completedCombinations: 1,
          progress: 100,
          status: 'COMPLETED',
        }),
      });
    });
  });
});
