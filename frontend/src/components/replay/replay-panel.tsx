'use client'

import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { Play, Pause, Gauge } from 'lucide-react'
import type { BacktestResult, BacktestTrade, MarketKline } from '@/types'
import { MarketCandlestickChart } from '@/components/charts/market-candlestick-chart'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'

type Props = {
  result: BacktestResult
  candles: MarketKline[]
}

const SPEEDS = [1, 2, 5, 10]

export function ReplayPanel({ result, candles }: Props) {
  const { trades } = result
  const [isPlaying, setIsPlaying] = useState(false)
  const [speed, setSpeed] = useState(1)
  const [currentIndex, setCurrentIndex] = useState(0)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const totalCandles = candles.length

  // Visible candles up to currentIndex
  const visibleCandles = useMemo(
    () => candles.slice(0, currentIndex + 1),
    [candles, currentIndex],
  )

  // Trades that occurred up to currentIndex
  const visibleTrades = useMemo(() => {
    if (currentIndex >= candles.length) return trades
    const cutoffTime = candles[currentIndex]?.closeTime
    if (!cutoffTime) return []
    return trades.filter((t) => t.entryTime <= cutoffTime)
  }, [trades, candles, currentIndex])

  // Map to chart trade format
  const chartTrades = useMemo(
    () =>
      visibleTrades.map((t) => ({
        id: String(t.id),
        createdAt: new Date(t.entryTime).toISOString(),
        side: t.side as 'BUY' | 'SELL',
        status: t.exitTime ? 'CLOSED' : 'OPEN' as const,
        closedAt: t.exitTime ? new Date(t.exitTime).toISOString() : null,
        realizedPnl: t.netPnl ?? t.pnl ?? null,
        price: t.executedEntryPrice ?? t.entryPrice,
        quantity: t.quantity,
      })),
    [visibleTrades],
  )

  const currentTime = useMemo(() => {
    if (!candles[currentIndex]) return null
    return candles[currentIndex].closeTime
  }, [candles, currentIndex])

  const currentPrice = useMemo(() => {
    if (!candles[currentIndex]) return null
    return candles[currentIndex].close
  }, [candles, currentIndex])

  const progressPct = totalCandles > 0 ? (currentIndex / (totalCandles - 1)) * 100 : 0

  // Auto-advance
  useEffect(() => {
    if (isPlaying) {
      const interval = 1000 / speed
      timerRef.current = setInterval(() => {
        setCurrentIndex((prev) => {
          if (prev >= totalCandles - 1) {
            setIsPlaying(false)
            return prev
          }
          return prev + 1
        })
      }, interval)
    } else {
      if (timerRef.current) {
        clearInterval(timerRef.current)
        timerRef.current = null
      }
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current)
    }
  }, [isPlaying, speed, totalCandles])

  const handleSliderChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseInt(e.target.value, 10)
    setCurrentIndex(val)
    setIsPlaying(false)
  }, [])

  const handleReset = useCallback(() => {
    setIsPlaying(false)
    setCurrentIndex(0)
  }, [])

  const cycleSpeed = useCallback(() => {
    setSpeed((prev) => {
      const idx = SPEEDS.indexOf(prev)
      return SPEEDS[(idx + 1) % SPEEDS.length]
    })
  }, [])

  const formatTime = (ts: number) => {
    const d = new Date(ts)
    return d.toLocaleString()
  }

  const closedCount = visibleTrades.filter((t) => t.exitTime).length
  const openCount = visibleTrades.filter((t) => !t.exitTime).length

  return (
    <div className="space-y-4">
      {/* ── Chart ─────────────────────────────── */}
      <MarketCandlestickChart
        bars={visibleCandles}
        trades={chartTrades as any}
        height={400}
        indicatorConfig={{
          mas: [
            { period: 7, color: '#38bdf8', label: 'MA(7)', type: 'SMA' },
            { period: 25, color: '#facc15', label: 'MA(25)', type: 'SMA' },
          ],
          showRsi: false,
        }}
      />

      {/* ── Status bar ───────────────────────── */}
      <div className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-border/60 bg-muted/30 px-3 py-2">
        <div className="flex items-center gap-3 text-xs text-muted-foreground">
          {currentTime != null && (
            <span className="font-mono">{formatTime(currentTime)}</span>
          )}
          {currentPrice != null && (
            <Badge variant="outline" className="font-mono text-xs">
              ${currentPrice.toFixed(2)}
            </Badge>
          )}
          <span>
            {currentIndex + 1} / {totalCandles}
          </span>
          <span>
            {closedCount} closed &middot; {openCount} open
          </span>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleReset}
            className="h-7 px-2 text-xs"
          >
            Reset
          </Button>
          <Button
            variant="default"
            size="sm"
            onClick={() => setIsPlaying((v) => !v)}
            disabled={currentIndex >= totalCandles - 1}
            className="h-7 w-7 p-0"
          >
            {isPlaying ? (
              <Pause className="h-3.5 w-3.5" />
            ) : (
              <Play className="h-3.5 w-3.5" />
            )}
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={cycleSpeed}
            className="h-7 gap-1 px-2 text-xs"
            title="Change speed"
          >
            <Gauge className="h-3.5 w-3.5" />
            {speed}x
          </Button>
        </div>
      </div>

      {/* ── Timeline slider ───────────────────── */}
      <div className="space-y-1">
        <input
          type="range"
          min={0}
          max={totalCandles - 1}
          value={currentIndex}
          onChange={handleSliderChange}
          className="w-full cursor-pointer accent-emerald-500"
          style={{ height: 6 }}
        />
        <div className="flex justify-between text-xs text-muted-foreground">
          <span>{totalCandles > 0 ? formatTime(candles[0]?.closeTime ?? 0) : '—'}</span>
          <span>{totalCandles > 0 ? formatTime(candles[totalCandles - 1]?.closeTime ?? 0) : '—'}</span>
        </div>
      </div>

      {/* ── Speed info ──────────────────────── */}
      {isPlaying && (
        <p className="text-center text-xs text-muted-foreground">
          Playing at {speed}x — {Math.round(1000 / speed)}ms per candle
        </p>
      )}
    </div>
  )
}
