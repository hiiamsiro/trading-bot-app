'use client'

import { useState, useEffect, useCallback } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Loader2 } from 'lucide-react'
import { useAuthStore } from '@/store/auth.store'
import { fetchBacktest } from '@/lib/api-client'
import { getBacktestReplay } from '@/lib/api-client'
import { useHandleApiError } from '@/hooks/use-handle-api-error'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { EmptyState } from '@/components/empty-state'
import { ReplayPanel } from '@/components/replay/replay-panel'
import type { BacktestResult, MarketKline } from '@/types'

export default function BacktestReplayPage() {
  const params = useParams()
  const id = typeof params.id === 'string' ? params.id : ''
  const token = useAuthStore((s) => s.token)
  const handleError = useHandleApiError()

  const [result, setResult] = useState<BacktestResult | null>(null)
  const [candles, setCandles] = useState<MarketKline[] | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    if (!token || !id) return
    setLoading(true)
    setError(null)
    try {
      const [backtestData, replayData] = await Promise.all([
        fetchBacktest(token, id),
        getBacktestReplay(token, id),
      ])
      setResult(backtestData.result)
      setCandles(replayData.candles)
    } catch (err) {
      handleError(err, 'Failed to load replay data')
      setError(String(err))
    } finally {
      setLoading(false)
    }
  }, [token, id, handleError])

  useEffect(() => {
    void load()
  }, [load])

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-9 w-64" />
        <Skeleton className="h-96 rounded-lg" />
        <Skeleton className="h-20 rounded-lg" />
      </div>
    )
  }

  if (error || !result) {
    return (
      <EmptyState
        icon={ArrowLeft}
        title="Replay unavailable"
        description="Could not load backtest data for replay."
      >
        <Button asChild variant="outline" size="sm">
          <Link href="/backtest">Back to Backtest</Link>
        </Button>
      </EmptyState>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Session Replay</h1>
          <p className="text-sm text-muted-foreground">
            {result.trades.length} trades · {result.metrics.totalTrades} closed
          </p>
        </div>
        <Button asChild variant="outline" size="sm">
          <Link href="/backtest">Back to Backtest</Link>
        </Button>
      </div>

      {candles && candles.length > 0 ? (
        <ReplayPanel result={result} candles={candles} />
      ) : (
        <div className="flex h-96 items-center justify-center rounded-lg border border-border/60 bg-card">
          <p className="text-sm text-muted-foreground">No candle data available for replay.</p>
        </div>
      )}
    </div>
  )
}
