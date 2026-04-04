// Strategy Sandbox API type definitions
// These types are available in the Monaco editor for code completion

declare const indicators: {
  sma(values: number[], period: number): number
  rsi(closes: number[], period: number): number
  ema(values: number[], period: number): number
  macd(closes: number[]): { macd: number; signal: number; histogram: number }
}

declare const context: {
  symbol: string
  interval: string
  candles: Array<{
    timestamp: number
    open: number
    high: number
    low: number
    close: number
    volume: number
  }>
  position: 'long' | 'short' | null
  balance: number
  entryPrice: number | null
}

declare function signal(action: 'BUY' | 'SELL' | 'HOLD', confidence: number, reason?: string): void
