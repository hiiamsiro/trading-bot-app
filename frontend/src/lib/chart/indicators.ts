import type { LineData, UTCTimestamp } from 'lightweight-charts'
import type { MarketKline, Trade, TradeExplanation } from '@/types'

// ─── MA calculation ────────────────────────────────────────────────────────────

function calcSma(values: number[], period: number): number {
  if (values.length < period) return NaN
  const slice = values.slice(-period)
  return slice.reduce((a, b) => a + b, 0) / period
}

function calcEma(values: number[], period: number): number {
  if (values.length < period) return NaN
  const k = 2 / (period + 1)
  let ema = calcSma(values.slice(0, period), period)
  for (let i = period; i < values.length; i++) {
    ema = values[i] * k + ema * (1 - k)
  }
  return ema
}

function calcRsi(closes: number[], period: number): number {
  if (closes.length < period + 1) return NaN
  let avgGain = 0
  let avgLoss = 0
  for (let i = 1; i <= period; i++) {
    const diff = closes[i] - closes[i - 1]
    if (diff >= 0) avgGain += diff
    else avgLoss += Math.abs(diff)
  }
  avgGain /= period
  avgLoss /= period
  if (avgLoss === 0) return 100
  const rs = avgGain / avgLoss
  return 100 - 100 / (1 + rs)
}

export type MaConfig = {
  label: string
  period: number
  color: string
  /** 'SMA' or 'EMA' */
  type: 'SMA' | 'EMA'
}

export const DEFAULT_MA_CONFIGS: MaConfig[] = [
  { label: 'MA Short', period: 9, color: '#38bdf8', type: 'SMA' },
  { label: 'MA Long', period: 21, color: '#f59e0b', type: 'SMA' },
]

export const DEFAULT_RSI_PERIOD = 14

export type ChartIndicatorConfig = {
  /** MA lines to overlay on the candlestick chart. */
  mas?: MaConfig[]
  /** Add an RSI sub-pane below the chart. */
  showRsi?: boolean
  rsiPeriod?: number
}

function calcMa(values: number[], period: number, type: 'SMA' | 'EMA'): number {
  return type === 'EMA' ? calcEma(values, period) : calcSma(values, period)
}

/**
 * Compute MA line data for all bars.
 * Returns { label, color, data } per configured MA.
 */
export function computeMaLines(
  bars: MarketKline[],
  config: MaConfig[],
): Array<{ label: string; color: string; data: LineData[] }> {
  const closes = bars.map((b) => b.close)

  return config.map(({ label, period, color, type }) => {
    const data: LineData[] = []
    for (let i = 0; i < closes.length; i++) {
      const val = calcMa(closes.slice(0, i + 1), period, type)
      if (!Number.isNaN(val)) {
        data.push({
          time: Math.floor(bars[i].openTime / 1000) as UTCTimestamp,
          value: val,
        })
      }
    }
    return { label, color, data }
  })
}

/**
 * Compute RSI series data for all bars.
 */
export function computeRsiLine(
  bars: MarketKline[],
  period: number,
): LineData[] {
  const closes = bars.map((b) => b.close)
  const data: LineData[] = []
  for (let i = 0; i < closes.length; i++) {
    const val = calcRsi(closes.slice(0, i + 1), period)
    if (!Number.isNaN(val)) {
      data.push({
        time: Math.floor(bars[i].openTime / 1000) as UTCTimestamp,
        value: val,
      })
    }
  }
  return data
}

// ─── Trade markers ────────────────────────────────────────────────────────────

export type TradeMarkerData = {
  id: string
  time: UTCTimestamp
  position: 'aboveBar' | 'belowBar' | 'inBar'
  color: string
  shape: 'arrowUp' | 'arrowDown' | 'circle'
  text: string
  /** Entry time (for open markers). */
  entryTime?: UTCTimestamp
  /** Entry price (for close markers showing entry reference). */
  entryPrice?: number
  trade: Trade
}

export type MarkerPosition = 'aboveBar' | 'belowBar' | 'inBar'

/**
 * Convert Trade[] into lightweight-charts TradeMarkerData[].
 * Entry markers: BUY = arrowUp belowBar, SELL = arrowDown aboveBar.
 * Exit markers: circle marker.
 */
export function computeTradeMarkers(trades: Trade[]): TradeMarkerData[] {
  const markers: TradeMarkerData[] = []

  for (const trade of trades) {
    const ts = Math.floor(new Date(trade.createdAt).getTime() / 1000) as UTCTimestamp
    const isBuy = trade.side === 'BUY'

    // Entry marker
    markers.push({
      id: `${trade.id}-entry`,
      time: ts,
      position: isBuy ? 'belowBar' : 'aboveBar',
      color: isBuy ? '#22c55e' : '#ef4444',
      shape: isBuy ? 'arrowUp' : 'arrowDown',
      text: isBuy ? 'B' : 'S',
      trade,
    })

    // Exit marker for closed trades
    if (trade.status === 'CLOSED' && trade.closedAt) {
      const closeTs = Math.floor(new Date(trade.closedAt).getTime() / 1000) as UTCTimestamp
      markers.push({
        id: `${trade.id}-exit`,
        time: closeTs,
        position: 'inBar',
        color: trade.realizedPnl != null && trade.realizedPnl >= 0 ? '#22c55e' : '#ef4444',
        shape: 'circle',
        text: trade.realizedPnl != null
          ? `${trade.realizedPnl >= 0 ? '+' : ''}${trade.realizedPnl.toFixed(2)}`
          : 'X',
        entryTime: ts,
        entryPrice: trade.price,
        trade,
      })
    }
  }

  return markers
}

/**
 * Build indicator config from Trade.openExplanation metadata.
 * This allows the chart to reflect the exact strategy params used
 * when this trade was generated.
 */
export function buildIndicatorConfigFromTrade(explanation: TradeExplanation | null | undefined): {
  mas: MaConfig[]
  rsiPeriod: number
} {
  if (!explanation) return { mas: DEFAULT_MA_CONFIGS, rsiPeriod: DEFAULT_RSI_PERIOD }

  const { strategy, shortPeriod, longPeriod, period, oversold, overbought } = explanation

  if (strategy === 'sma_crossover' && shortPeriod && longPeriod) {
    return {
      mas: [
        { label: `MA${shortPeriod}`, period: shortPeriod, color: '#38bdf8', type: 'SMA' },
        { label: `MA${longPeriod}`, period: longPeriod, color: '#f59e0b', type: 'SMA' },
      ],
      rsiPeriod: DEFAULT_RSI_PERIOD,
    }
  }

  if (strategy === 'rsi' && period) {
    return {
      mas: DEFAULT_MA_CONFIGS,
      rsiPeriod: typeof period === 'number' ? period : DEFAULT_RSI_PERIOD,
    }
  }

  return { mas: DEFAULT_MA_CONFIGS, rsiPeriod: DEFAULT_RSI_PERIOD }
}
