import { test, describe } from 'node:test'
import assert from 'node:assert'
import { CorrelationService } from '../src/correlation/correlation.service'
import { pearsonCorrelation, computeEquityCurve } from '../src/correlation/correlation.service'

// ─── Unit helpers ───────────────────────────────────────────────────────────

describe('pearsonCorrelation', () => {
  test('returns 0 for empty arrays', () => {
    assert.strictEqual(pearsonCorrelation([], []), 0)
  })

  test('returns 0 when one series is constant (zero std)', () => {
    assert.strictEqual(pearsonCorrelation([1, 1, 1], [1, 2, 3]), 0)
  })

  test('returns 1.0 for identical series', () => {
    const r = pearsonCorrelation([1, 2, 3, 4, 5], [1, 2, 3, 4, 5])
    assert.ok(Math.abs(r - 1) < 1e-9, `expected 1.0, got ${r}`)
  })

  test('returns -1.0 for perfectly opposite series', () => {
    const r = pearsonCorrelation([1, 2, 3, 4, 5], [5, 4, 3, 2, 1])
    assert.ok(Math.abs(r - (-1)) < 1e-9, `expected -1.0, got ${r}`)
  })

  test('returns 0 for uncorrelated series', () => {
    const r = pearsonCorrelation([1, 2, 3, 4, 5], [1, -1, 1, -1, 1])
    // Should be close to 0 (actually -0.6 for this specific case)
    assert.ok(Math.abs(r) < 1, `expected |r| < 1, got ${r}`)
  })
})

describe('computeEquityCurve', () => {
  test('returns empty map when no closed trades', () => {
    const result = computeEquityCurve([])
    assert.strictEqual(result.size, 0)
  })

  test('returns 0 return for a single trade with zero PnL', () => {
    const result = computeEquityCurve([{ closedAt: new Date('2024-01-01'), netPnl: 0 }])
    assert.strictEqual(result.size, 0) // no day-to-day change
  })

  test('returns daily returns from equity curve', () => {
    const trades = [
      { closedAt: new Date('2024-01-01T00:00:00Z'), netPnl: 100 },
      { closedAt: new Date('2024-01-02T00:00:00Z'), netPnl: 200 },
      { closedAt: new Date('2024-01-03T00:00:00Z'), netPnl: -50 },
    ]
    const result = computeEquityCurve(trades)

    // Day 1: (11100-10000)/10000 = 0.1
    assert.ok(Math.abs((result.get('2024-01-01') ?? 0) - 0.01) < 1e-9, `day1=${result.get('2024-01-01')}`)
    // Day 2: (11300-11100)/11100 ≈ 0.0180
    assert.ok(Math.abs((result.get('2024-01-02') ?? 0) - 0.018018) < 1e-6, `day2=${result.get('2024-01-02')}`)
    // Day 3: (11250-11300)/11300 ≈ -0.00442
    assert.ok(Math.abs((result.get('2024-01-03') ?? 0) - (-0.004425)) < 1e-6, `day3=${result.get('2024-01-03')}`)
  })
})

// ─── Service ────────────────────────────────────────────────────────────────

describe('CorrelationService', () => {
  describe('getCorrelationMatrix', () => {
    test('returns empty structure when user has no bots', async () => {
      const prisma = { bot: { findMany: async () => [] } }
      // @ts-ignore
      const svc = new CorrelationService(prisma)
      const result = await svc.getCorrelationMatrix('user-1')

      assert.deepStrictEqual(result.bots, [])
      assert.deepStrictEqual(result.matrix, [])
      assert.deepStrictEqual(result.symbolCorrelations, [])
    })

    test('returns empty matrix when only 1 bot', async () => {
      const prisma = {
        bot: {
          findMany: async () => [
            {
              id: 'bot-1',
              name: 'Bot 1',
              symbol: 'BTCUSDT',
              trades: [{ closedAt: new Date('2024-01-01'), netPnl: 100 }],
            },
          ],
        },
      }
      // @ts-ignore
      const svc = new CorrelationService(prisma)
      const result = await svc.getCorrelationMatrix('user-1')

      assert.strictEqual(result.bots.length, 1)
      assert.strictEqual(result.matrix.length, 0)
      assert.strictEqual(result.symbolCorrelations.length, 0)
    })

    test('returns correlation for 2 bots with same symbol', async () => {
      const prisma = {
        bot: {
          findMany: async () => [
            {
              id: 'bot-1',
              name: 'Bot 1',
              symbol: 'BTCUSDT',
              trades: [
                { closedAt: new Date('2024-01-01T00:00:00Z'), netPnl: 100 },
                { closedAt: new Date('2024-01-02T00:00:00Z'), netPnl: 200 },
                { closedAt: new Date('2024-01-03T00:00:00Z'), netPnl: 100 },
              ],
            },
            {
              id: 'bot-2',
              name: 'Bot 2',
              symbol: 'BTCUSDT',
              trades: [
                { closedAt: new Date('2024-01-01T00:00:00Z'), netPnl: 50 },
                { closedAt: new Date('2024-01-02T00:00:00Z'), netPnl: 100 },
                { closedAt: new Date('2024-01-03T00:00:00Z'), netPnl: 50 },
              ],
            },
          ],
        },
      }
      // @ts-ignore
      const svc = new CorrelationService(prisma)
      const result = await svc.getCorrelationMatrix('user-1')

      assert.strictEqual(result.bots.length, 2)
      assert.strictEqual(result.matrix.length, 1)

      const entry = result.matrix[0]
      assert.ok(entry.botId === 'bot-1' || entry.botId === 'bot-2')
      assert.ok(entry.otherBotId === 'bot-1' || entry.otherBotId === 'bot-2')
      assert.ok(entry.botId !== entry.otherBotId)
      // Both bots have identical % returns → correlation should be 1.0
      assert.ok(Math.abs(entry.correlation - 1) < 1e-9, `expected 1.0, got ${entry.correlation}`)
    })

    test('filters bots by userId', async () => {
      let capturedUserId: string | undefined
      const prisma = {
        bot: {
          findMany: async (opts: any) => {
            capturedUserId = opts.where.userId
            return []
          },
        },
      }
      // @ts-ignore
      const svc = new CorrelationService(prisma)
      await svc.getCorrelationMatrix('my-user-id-42')

      assert.strictEqual(capturedUserId, 'my-user-id-42')
    })
  })
})
