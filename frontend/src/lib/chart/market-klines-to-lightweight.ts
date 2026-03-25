import type { CandlestickData, HistogramData, UTCTimestamp } from 'lightweight-charts'
import type { MarketKline } from '@/types'

export function marketKlinesToCandlestickData(bars: MarketKline[]): CandlestickData[] {
  const byTime = new Map<number, CandlestickData>()
  for (const bar of bars) {
    const sec = Math.floor(bar.openTime / 1000)
    byTime.set(sec, {
      time: sec as UTCTimestamp,
      open: bar.open,
      high: bar.high,
      low: bar.low,
      close: bar.close,
    })
  }
  return Array.from(byTime.values()).sort(
    (a, b) => (a.time as number) - (b.time as number),
  )
}

export function marketKlinesToVolumeHistogramData(bars: MarketKline[]): HistogramData[] {
  const byTime = new Map<number, HistogramData>()
  for (const bar of bars) {
    const sec = Math.floor(bar.openTime / 1000)
    const bullish = bar.close >= bar.open
    byTime.set(sec, {
      time: sec as UTCTimestamp,
      value: bar.volume,
      color: bullish ? 'rgba(38, 166, 154, 0.45)' : 'rgba(239, 83, 80, 0.45)',
    })
  }
  return Array.from(byTime.values()).sort(
    (a, b) => (a.time as number) - (b.time as number),
  )
}
