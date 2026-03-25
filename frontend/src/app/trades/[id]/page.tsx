'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'
import { ApiError } from '@/lib/api'
import type { Trade } from '@/types'
import { useAuthStore } from '@/store/auth.store'
import { fetchTrade } from '@/lib/api-client'
import { useHandleApiError } from '@/hooks/use-handle-api-error'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { EmptyState } from '@/components/empty-state'
import { ArrowLeft, History, ShieldCheck } from 'lucide-react'

export default function TradeDetailPage() {
  const params = useParams()
  const router = useRouter()
  const id = typeof params.id === 'string' ? params.id : ''
  const token = useAuthStore((s) => s.token)
  const handleError = useHandleApiError()
  const [loading, setLoading] = useState(true)
  const [trade, setTrade] = useState<Trade | null>(null)
  const [notFound, setNotFound] = useState(false)

  const load = useCallback(async () => {
    if (!token || !id) return
    setLoading(true)
    setNotFound(false)
    try {
      const row = await fetchTrade(token, id)
      setTrade(row)
    } catch (e) {
      if (e instanceof ApiError && e.status === 404) {
        setNotFound(true)
        setTrade(null)
      } else {
        handleError(e)
      }
    } finally {
      setLoading(false)
    }
  }, [token, id, handleError])

  useEffect(() => {
    void load()
  }, [load])

  const pnlPct = useMemo(() => {
    if (!trade) return null
    if (trade.realizedPnl == null) return null
    const entryValue = trade.price * trade.quantity
    if (entryValue === 0) return null
    return (trade.realizedPnl / entryValue) * 100
  }, [trade])

  if (!token) {
    return (
      <EmptyState
        icon={History}
        title="Sign in required"
        description="Log in to view trade details."
      >
        <Button asChild className="cursor-pointer">
          <Link href="/login">Go to login</Link>
        </Button>
      </EmptyState>
    )
  }

  if (loading && !trade && !notFound) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-9 w-64" />
        <Skeleton className="h-28 rounded-lg" />
        <Skeleton className="h-72 rounded-lg" />
      </div>
    )
  }

  if (notFound) {
    return (
      <EmptyState
        icon={History}
        title="Trade not found"
        description="This trade does not exist or you do not have access."
      >
        <Button asChild className="cursor-pointer">
          <Link href="/trades">Back to trade history</Link>
        </Button>
      </EmptyState>
    )
  }

  if (!trade) return null

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Button
          variant="outline"
          size="sm"
          className="cursor-pointer"
          onClick={() => router.back()}
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back
        </Button>
        <Button asChild variant="outline" size="sm" className="cursor-pointer">
          <Link href="/trades">All trades</Link>
        </Button>
      </div>

      <div className="rounded-xl border border-border/70 bg-card/70 p-6">
        <h1 className="text-3xl font-semibold tracking-tight">Trade detail</h1>
        <p className="mt-1 text-sm text-muted-foreground font-mono">{trade.id}</p>
        <p className="mt-3 inline-flex items-center gap-1 text-xs text-amber-300">
          <ShieldCheck className="h-3.5 w-3.5" />
          Read-only record from the API
        </p>
      </div>

      <Card className="border-border/70 bg-card/80 backdrop-blur-xl">
        <CardHeader>
          <CardTitle className="text-lg">Overview</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <div>
              <p className="text-xs text-muted-foreground">Bot</p>
              <p className="mt-1">{trade.bot?.name ?? trade.botId}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Instrument</p>
              <p className="mt-1 font-mono">{trade.symbol}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Side</p>
              <div className="mt-1">
                <Badge
                  variant="outline"
                  className={
                    trade.side === 'BUY'
                      ? 'border-emerald-500/40 bg-emerald-500/15 text-emerald-300'
                      : 'border-rose-500/40 bg-rose-500/15 text-rose-300'
                  }
                >
                  {trade.side}
                </Badge>
              </div>
            </div>

            <div>
              <p className="text-xs text-muted-foreground">Status</p>
              <p className="mt-1">
                <Badge variant="outline">{trade.status}</Badge>
              </p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Quantity</p>
              <p className="mt-1 font-mono">{trade.quantity}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Entry price</p>
              <p className="mt-1 font-mono">{trade.price.toFixed(4)}</p>
            </div>

            <div>
              <p className="text-xs text-muted-foreground">Exit price</p>
              <p className="mt-1 font-mono">
                {trade.exitPrice != null ? trade.exitPrice.toFixed(4) : '—'}
              </p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Realized PnL</p>
              <p className="mt-1 font-mono">
                {trade.realizedPnl != null ? trade.realizedPnl.toFixed(2) : '—'}
              </p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">PnL %</p>
              <p className="mt-1 font-mono">
                {pnlPct != null ? `${pnlPct.toFixed(2)}%` : '—'}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="border-border/70 bg-card/80 backdrop-blur-xl">
        <CardHeader>
          <CardTitle className="text-lg">Reasons & timestamps</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <p className="text-xs text-muted-foreground">Open reason</p>
              <p className="mt-1">{trade.openReason ?? '—'}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Close reason</p>
              <p className="mt-1">{trade.closeReason ?? '—'}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Created at</p>
              <p className="mt-1 font-mono">
                {new Date(trade.createdAt).toLocaleString()}
              </p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Executed at</p>
              <p className="mt-1 font-mono">
                {trade.executedAt ? new Date(trade.executedAt).toLocaleString() : '—'}
              </p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Closed at</p>
              <p className="mt-1 font-mono">
                {trade.closedAt ? new Date(trade.closedAt).toLocaleString() : '—'}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

