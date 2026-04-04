import type { LineData, HistogramData, UTCTimestamp } from 'lightweight-charts'
import type { MarketKline, Trade, TradeExplanation } from '@/types'

// ─── Core helpers ────────────────────────────────────────────────────────────

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

function calcStdDev(values: number[], period: number, mean: number): number {
  if (values.length < period) return NaN
  const slice = values.slice(-period)
  const variance = slice.reduce((acc, v) => acc + Math.pow(v - mean, 2), 0) / period
  return Math.sqrt(variance)
}

function calcAtr(highs: number[], lows: number[], closes: number[], period: number): number {
  if (closes.length < period + 1) return NaN
  const trueRanges: number[] = []
  for (let i = 1; i < closes.length; i++) {
    const tr = Math.max(
      highs[i] - lows[i],
      Math.abs(highs[i] - closes[i - 1]),
      Math.abs(lows[i] - closes[i - 1]),
    )
    trueRanges.push(tr)
  }
  return calcSma(trueRanges, period)
}

function calcVwap(
  highs: number[],
  lows: number[],
  closes: number[],
  volumes: number[],
): number {
  const n = closes.length
  if (n === 0) return NaN
  let cumVolPrice = 0
  let cumVol = 0
  for (let i = 0; i < n; i++) {
    const typical = (highs[i] + lows[i] + closes[i]) / 3
    cumVolPrice += typical * volumes[i]
    cumVol += volumes[i]
  }
  return cumVol === 0 ? NaN : cumVolPrice / cumVol
}

// ─── MA ───────────────────────────────────────────────────────────────────────

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

export type ChartIndicatorConfig = {
  /** MA lines to overlay on the candlestick chart. */
  mas?: MaConfig[]
  /** Show MA overlay by default. */
  showMa?: boolean
  /** Add an RSI sub-pane below the chart. */
  showRsi?: boolean
  rsiPeriod?: number
  /** Add a MACD sub-pane below the chart. */
  showMacd?: boolean
  /** Add a Bollinger Bands overlay on the candlestick chart. */
  showBollingerBands?: boolean
  bollingerPeriod?: number
  bollingerStdDev?: number
  /** Add an ATR sub-pane below the chart. */
  showAtr?: boolean
  atrPeriod?: number
  /** Add a VWAP line on the candlestick chart. */
  showVwap?: boolean
}

/** 
 * Compute MA line data for all bars. 
 * Returns { label, color, data } per configured MA. 
 */ 
export function computeMaLines( 
  bars: MarketKline[], 
  config: MaConfig[], 
): Array<{ label: string; color: string; data: LineData[] }> { 
  if (config.length === 0) return []
  const n = bars.length 
  const closes = bars.map((b) => b.close) 
 
  return config.map(({ label, period, color, type }) => { 
    const data: LineData[] = [] 
    if (period <= 0 || n === 0) return { label, color, data } 
 
    if (type === 'SMA') { 
      let sum = 0 
      for (let i = 0; i < n; i++) { 
        sum += closes[i] 
        if (i >= period) sum -= closes[i - period] 
        if (i >= period - 1) { 
          data.push({ 
            time: Math.floor(bars[i].openTime / 1000) as UTCTimestamp, 
            value: sum / period, 
          }) 
        } 
      } 
      return { label, color, data } 
    } 
 
    // EMA 
    const k = 2 / (period + 1) 
    let sum = 0 
    let ema = NaN 
    for (let i = 0; i < n; i++) { 
      const close = closes[i] 
      if (i < period) sum += close 
      if (i === period - 1) { 
        ema = sum / period 
        data.push({ 
          time: Math.floor(bars[i].openTime / 1000) as UTCTimestamp, 
          value: ema, 
        }) 
      } else if (i >= period) { 
        ema = close * k + ema * (1 - k) 
        data.push({ 
          time: Math.floor(bars[i].openTime / 1000) as UTCTimestamp, 
          value: ema, 
        }) 
      } 
    } 
    return { label, color, data } 
  }) 
} 

// ─── RSI ──────────────────────────────────────────────────────────────────────

export const DEFAULT_RSI_PERIOD = 14

/**
 * Compute RSI series data for all bars.
 */
export function computeRsiLine( 
  bars: MarketKline[], 
  period: number, 
): LineData[] { 
  if (period <= 0 || bars.length < period + 1) return [] 
 
  const closes = bars.map((b) => b.close) 
  const data: LineData[] = [] 
 
  let gainSum = 0 
  let lossSum = 0 
  for (let i = 1; i <= period; i++) { 
    const diff = closes[i] - closes[i - 1] 
    if (diff >= 0) gainSum += diff 
    else lossSum += -diff 
  } 
  let avgGain = gainSum / period 
  let avgLoss = lossSum / period 
  const rsiAt = () => { 
    if (avgLoss === 0) return 100 
    const rs = avgGain / avgLoss 
    return 100 - 100 / (1 + rs) 
  } 
 
  data.push({ 
    time: Math.floor(bars[period].openTime / 1000) as UTCTimestamp, 
    value: rsiAt(), 
  }) 
 
  for (let i = period + 1; i < closes.length; i++) { 
    const diff = closes[i] - closes[i - 1] 
    const gain = diff > 0 ? diff : 0 
    const loss = diff < 0 ? -diff : 0 
    avgGain = (avgGain * (period - 1) + gain) / period 
    avgLoss = (avgLoss * (period - 1) + loss) / period 
    data.push({ 
      time: Math.floor(bars[i].openTime / 1000) as UTCTimestamp, 
      value: rsiAt(), 
    }) 
  } 
 
  return data 
} 

// ─── Bollinger Bands ──────────────────────────────────────────────────────────

export type BollingerBandData = {
  upper: LineData[]
  middle: LineData[]
  lower: LineData[]
}

export function computeBollingerBands( 
  bars: MarketKline[], 
  period: number, 
  stdDev: number, 
): BollingerBandData { 
  if (period <= 0) return { upper: [], middle: [], lower: [] } 
 
  const closes = bars.map((b) => b.close) 
  const upper: LineData[] = [] 
  const middle: LineData[] = [] 
  const lower: LineData[] = [] 
 
  let sum = 0 
  let sumSq = 0 
  for (let i = 0; i < closes.length; i++) { 
    const c = closes[i] 
    sum += c 
    sumSq += c * c 
    if (i >= period) { 
      const old = closes[i - period] 
      sum -= old 
      sumSq -= old * old 
    } 
    if (i >= period - 1) { 
      const mean = sum / period 
      const variance = Math.max(0, sumSq / period - mean * mean) 
      const sd = Math.sqrt(variance) 
      const ts = Math.floor(bars[i].openTime / 1000) as UTCTimestamp 
      upper.push({ time: ts, value: mean + stdDev * sd }) 
      middle.push({ time: ts, value: mean }) 
      lower.push({ time: ts, value: mean - stdDev * sd }) 
    } 
  } 
 
  return { upper, middle, lower } 
} 

// ─── MACD ─────────────────────────────────────────────────────────────────────

export type MacdLineData = {
  macd: LineData[]
  signal: LineData[]
  histogram: HistogramData[]
}

export const DEFAULT_MACD_FAST = 12 
export const DEFAULT_MACD_SLOW = 26 
export const DEFAULT_MACD_SIGNAL = 9 
 
function emaSeries(values: number[], period: number): number[] { 
  const out = new Array<number>(values.length).fill(NaN) 
  if (period <= 0 || values.length < period) return out 
 
  const k = 2 / (period + 1) 
  let sum = 0 
  for (let i = 0; i < period; i++) sum += values[i] 
  let ema = sum / period 
  out[period - 1] = ema 
  for (let i = period; i < values.length; i++) { 
    ema = values[i] * k + ema * (1 - k) 
    out[i] = ema 
  } 
  return out 
} 
 
export function computeMacd( 
  bars: MarketKline[], 
  fastPeriod = DEFAULT_MACD_FAST, 
  slowPeriod = DEFAULT_MACD_SLOW, 
  signalPeriod = DEFAULT_MACD_SIGNAL, 
): MacdLineData { 
  const closes = bars.map((b) => b.close) 
  const emaFast = emaSeries(closes, fastPeriod) 
  const emaSlow = emaSeries(closes, slowPeriod) 
  const macdRaw = closes.map((_, i) => { 
    const ef = emaFast[i] 
    const es = emaSlow[i] 
    if (Number.isNaN(ef) || Number.isNaN(es)) return NaN 
    return ef - es 
  }) 
  const signalInput = macdRaw.map((v) => (Number.isNaN(v) ? 0 : v)) 
  const signalRaw = emaSeries(signalInput, signalPeriod) 
 
  const macd: LineData[] = [] 
  const signal: LineData[] = [] 
  const histogram: HistogramData[] = [] 

  for (let i = 0; i < bars.length; i++) {
    const ts = Math.floor(bars[i].openTime / 1000) as UTCTimestamp
    const m = macdRaw[i]
    const s = signalRaw[i]
    if (!Number.isNaN(m)) macd.push({ time: ts, value: m })
    if (!Number.isNaN(s)) signal.push({ time: ts, value: s })
    if (!Number.isNaN(m) && !Number.isNaN(s)) {
      histogram.push({
        time: ts,
        value: m - s,
        color: m - s >= 0 ? 'rgba(34, 197, 94, 0.7)' : 'rgba(239, 68, 68, 0.7)',
      })
    }
  }

  return { macd, signal, histogram }
}

// ─── ATR ──────────────────────────────────────────────────────────────────────

export function computeAtrLine( 
  bars: MarketKline[], 
  period: number, 
): LineData[] { 
  if (period <= 0 || bars.length < period + 1) return [] 
  const data: LineData[] = [] 
 
  const trValues: number[] = [] 
  let sum = 0 
  for (let i = 1; i < bars.length; i++) { 
    const high = bars[i].high 
    const low = bars[i].low 
    const prevClose = bars[i - 1].close 
    const tr = Math.max(high - low, Math.abs(high - prevClose), Math.abs(low - prevClose)) 
    trValues.push(tr) 
    sum += tr 
    if (trValues.length > period) sum -= trValues[trValues.length - period - 1] 
    if (trValues.length >= period) { 
      data.push({ 
        time: Math.floor(bars[i].openTime / 1000) as UTCTimestamp, 
        value: sum / period, 
      }) 
    } 
  } 
 
  return data 
} 

// ─── VWAP ─────────────────────────────────────────────────────────────────────

export function computeVwapLine( 
  bars: MarketKline[], 
): LineData[] { 
  const data: LineData[] = [] 
  let cumVolPrice = 0 
  let cumVol = 0 
 
  for (const bar of bars) { 
    const typical = (bar.high + bar.low + bar.close) / 3 
    cumVolPrice += typical * bar.volume 
    cumVol += bar.volume 
    if (cumVol === 0) continue 
    data.push({ 
      time: Math.floor(bar.openTime / 1000) as UTCTimestamp, 
      value: cumVolPrice / cumVol, 
    }) 
  } 
 
  return data 
} 

// ─── OHLCV helper for tooltip ─────────────────────────────────────────────────

export interface OhlcvPoint {
  time: UTCTimestamp
  open: number
  high: number
  low: number
  close: number
  volume: number
}

export function barsToOhlcv(bars: MarketKline[]): OhlcvPoint[] {
  return bars.map((b) => ({
    time: Math.floor(b.openTime / 1000) as UTCTimestamp,
    open: b.open,
    high: b.high,
    low: b.low,
    close: b.close,
    volume: b.volume,
  }))
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
export function buildIndicatorConfigFromTrade(
  explanation: TradeExplanation | null | undefined,
): {
  mas: MaConfig[]
  rsiPeriod: number
} {
  if (!explanation) return { mas: DEFAULT_MA_CONFIGS, rsiPeriod: DEFAULT_RSI_PERIOD }

  const { strategy, shortPeriod, longPeriod, period } = explanation

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
