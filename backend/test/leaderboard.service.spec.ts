import { test, describe, beforeEach } from 'node:test'
import assert from 'node:assert'
import { LeaderboardService } from '../src/leaderboard/leaderboard.service'

function makeService(mockPrisma: any): LeaderboardService {
  // @ts-ignore — constructor is public on the class
  return new LeaderboardService(mockPrisma)
}

describe('LeaderboardService', () => {
  describe('getLeaderboard', () => {
    test('returns empty items and total 0 when no public bots exist', async () => {
      const prisma = {
        bot: {
          findMany: async () => [],
        },
      }
      const svc = makeService(prisma)
      const result = await svc.getLeaderboard({ sortBy: 'pnl' })

      assert.deepStrictEqual(result.items, [])
      assert.strictEqual(result.total, 0)
    })

    test('sorts by PnL descending', async () => {
      const prisma = {
        bot: {
          findMany: async () => [
            {
              id: 'bot-a',
              name: 'Bot A',
              symbol: 'BTCUSDT',
              shareSlug: null,
              strategyConfig: null,
              _count: { trades: 3 },
              trades: [
                { netPnl: -500, closedAt: new Date('2024-01-01') },
                { netPnl: 200, closedAt: new Date('2024-01-02') },
                { netPnl: 300, closedAt: new Date('2024-01-03') },
              ],
            },
            {
              id: 'bot-b',
              name: 'Bot B',
              symbol: 'ETHUSDT',
              shareSlug: 'bot-b-slug',
              strategyConfig: { strategy: 'ma_crossover' },
              _count: { trades: 2 },
              trades: [
                { netPnl: 1000, closedAt: new Date('2024-01-01') },
                { netPnl: 500, closedAt: new Date('2024-01-02') },
              ],
            },
          ],
        },
      }
      const svc = makeService(prisma)
      const result = await svc.getLeaderboard({ sortBy: 'pnl' })

      assert.strictEqual(result.items.length, 2)
      assert.strictEqual(result.items[0].botId, 'bot-b')
      assert.strictEqual(result.items[0].totalPnl, 1500)
      assert.strictEqual(result.items[1].botId, 'bot-a')
      assert.strictEqual(result.items[1].totalPnl, 0)
    })

    test('sorts by winRate descending', async () => {
      const prisma = {
        bot: {
          findMany: async () => [
            {
              id: 'bot-a',
              name: 'Bot A',
              symbol: 'BTCUSDT',
              shareSlug: null,
              strategyConfig: null,
              _count: { trades: 2 },
              trades: [
                { netPnl: 100, closedAt: new Date('2024-01-01') },
                { netPnl: -50, closedAt: new Date('2024-01-02') },
              ],
            },
            {
              id: 'bot-b',
              name: 'Bot B',
              symbol: 'ETHUSDT',
              shareSlug: null,
              strategyConfig: null,
              _count: { trades: 2 },
              trades: [
                { netPnl: 100, closedAt: new Date('2024-01-01') },
                { netPnl: 200, closedAt: new Date('2024-01-02') },
              ],
            },
          ],
        },
      }
      const svc = makeService(prisma)
      const result = await svc.getLeaderboard({ sortBy: 'winRate' })

      assert.strictEqual(result.items[0].botId, 'bot-b')
      assert.strictEqual(result.items[0].winRate, 100)
      assert.strictEqual(result.items[1].botId, 'bot-a')
      assert.strictEqual(result.items[1].winRate, 50)
    })

    test('computes maxDrawdown correctly', async () => {
      // Equity curve: +100, +50, -200 → peak=150, drawdown from peak=(150-(-50))/150 = 133%
      // Net PnL series per trade: +100, +50, -200
      const prisma = {
        bot: {
          findMany: async () => [
            {
              id: 'bot-x',
              name: 'Bot X',
              symbol: 'BTCUSDT',
              shareSlug: null,
              strategyConfig: null,
              _count: { trades: 3 },
              trades: [
                { netPnl: 100, closedAt: new Date('2024-01-01T00:00:00Z') },
                { netPnl: 50, closedAt: new Date('2024-01-02T00:00:00Z') },
                { netPnl: -200, closedAt: new Date('2024-01-03T00:00:00Z') },
              ],
            },
          ],
        },
      }
      const svc = makeService(prisma)
      const result = await svc.getLeaderboard({ sortBy: 'pnl' })

      assert.strictEqual(result.items.length, 1)
      // Peak = 150 (100+50). After -200 → cumulative = -50.
      // Drawdown = (150 - (-50)) / 150 = 200/150 = 1.333... = 133.33%
      assert.ok(result.items[0].maxDrawdown > 130)
    })

    test('ranks start at 1 for the first page', async () => {
      const prisma = {
        bot: {
          findMany: async () => [
            { id: 'bot-1', name: 'B1', symbol: 'BTCUSDT', shareSlug: null, strategyConfig: null, _count: { trades: 1 }, trades: [{ netPnl: 1, closedAt: new Date() }] },
            { id: 'bot-2', name: 'B2', symbol: 'ETHUSDT', shareSlug: null, strategyConfig: null, _count: { trades: 1 }, trades: [{ netPnl: 2, closedAt: new Date() }] },
          ],
        },
      }
      const svc = makeService(prisma)
      const result = await svc.getLeaderboard({ sortBy: 'pnl', limit: 10 })

      assert.strictEqual(result.items[0].rank, 1)
      assert.strictEqual(result.items[1].rank, 2)
    })

    test('applies limit and offset correctly', async () => {
      const bots = Array.from({ length: 5 }, (_, i) => ({
        id: `bot-${i}`,
        name: `Bot ${i}`,
        symbol: 'BTCUSDT',
        shareSlug: null,
        strategyConfig: null,
        _count: { trades: 1 },
        trades: [{ netPnl: i * 100, closedAt: new Date() }],
      }))
      const prisma = { bot: { findMany: async () => bots } }
      const svc = makeService(prisma)
      const result = await svc.getLeaderboard({ sortBy: 'pnl', limit: 2, offset: 2 })

      assert.strictEqual(result.items.length, 2)
      assert.strictEqual(result.items[0].botId, 'bot-4')
      assert.strictEqual(result.items[0].rank, 3)
      assert.strictEqual(result.total, 5)
    })

    test('only fetches public bots', async () => {
      let capturedWhere: any
      const prisma = {
        bot: {
          findMany: async (opts: any) => {
            capturedWhere = opts.where
            return []
          },
        },
      }
      const svc = makeService(prisma)
      await svc.getLeaderboard({ sortBy: 'pnl' })

      assert.deepStrictEqual(capturedWhere, {
        isPublic: true,
        trades: { some: { status: 'CLOSED' } },
      })
    })
  })
})
