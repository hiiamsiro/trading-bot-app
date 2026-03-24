'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { Trade } from '@/types'
import { useAuthStore } from '@/store/auth.store'
import { fetchBots, fetchTrades } from '@/lib/api-client'
import { useHandleApiError } from '@/hooks/use-handle-api-error'
import { useTradingSocket } from '@/hooks/use-trading-socket'
import { Skeleton } from '@/components/ui/skeleton'
import { EmptyState } from '@/components/empty-state'
import { Badge } from '@/components/ui/badge'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Label } from '@/components/ui/label'
import { History, ShieldCheck } from 'lucide-react'

export default function TradesPage() {
  const token = useAuthStore((s) => s.token)
  const user = useAuthStore((s) => s.user)
  const handleError = useHandleApiError()
  const [loading, setLoading] = useState(true)
  const [trades, setTrades] = useState<Trade[]>([])
  const [botId, setBotId] = useState<string>('all')
  const [botsLoaded, setBotsLoaded] = useState<{ id: string; name: string }[]>(
    [],
  )
  const formatTradeTime = (value: string) =>
    new Date(value).toLocaleString([], {
      month: 'short',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    })

  useEffect(() => {
    if (!token) return
    let cancelled = false
    ;(async () => {
      try {
        const bots = await fetchBots(token)
        if (!cancelled) {
          setBotsLoaded(bots.map((b) => ({ id: b.id, name: b.name })))
        }
      } catch {
        /* optional */
      }
    })()
    return () => {
      cancelled = true
    }
  }, [token])

  const reloadTrades = useCallback(() => {
    if (!token) return
    ;(async () => {
      try {
        const data = await fetchTrades(
          token,
          botId === 'all' ? undefined : botId,
        )
        setTrades(data)
      } catch (e) {
        handleError(e)
      }
    })()
  }, [token, botId, handleError])

  useEffect(() => {
    if (!token) return
    let cancelled = false
    ;(async () => {
      setLoading(true)
      try {
        const data = await fetchTrades(
          token,
          botId === 'all' ? undefined : botId,
        )
        if (!cancelled) setTrades(data)
      } catch (e) {
        if (!cancelled) {
          handleError(e)
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [token, botId, handleError])

  useTradingSocket({
    userId: user?.id,
    onRefresh: reloadTrades,
  })

  if (loading && trades.length === 0) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-9 w-56" />
        <Skeleton className="h-12 w-full max-w-sm" />
        <Skeleton className="h-72 rounded-lg" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-border/70 bg-card/70 p-6">
        <h1 className="text-3xl font-semibold tracking-tight">Trade history</h1>
        <p className="text-muted-foreground">
          Trades for bots you own (live data from the API).
        </p>
        <p className="mt-2 inline-flex items-center gap-1 text-xs text-amber-300">
          <ShieldCheck className="h-3.5 w-3.5" />
          Verified records for audit-friendly review
        </p>
      </div>

      <div className="flex max-w-sm flex-col gap-2 rounded-lg border border-border/70 bg-card/70 p-4">
        <Label>Filter by bot</Label>
        <Select value={botId} onValueChange={setBotId}>
          <SelectTrigger className="cursor-pointer">
            <SelectValue placeholder="All bots" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All bots</SelectItem>
            {botsLoaded.map((b) => (
              <SelectItem key={b.id} value={b.id}>
                {b.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {trades.length === 0 && !loading ? (
        <EmptyState
          icon={History}
          title="No trades"
          description="Trades appear when your running bot executes demo signals."
        >
          <Link
            href="/bots"
            className="cursor-pointer text-sm font-medium text-primary underline-offset-4 hover:underline"
          >
            Go to bots
          </Link>
        </EmptyState>
      ) : (
        <div className="rounded-md border border-border/70 bg-card/80 backdrop-blur-xl">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead>Created</TableHead>
                <TableHead>Bot</TableHead>
                <TableHead>Symbol</TableHead>
                <TableHead>Side</TableHead>
                <TableHead>Qty</TableHead>
                <TableHead>Price</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>P/L</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {trades.map((t) => (
                <TableRow key={t.id} className="transition-colors duration-200 hover:bg-muted/40">
                  <TableCell className="whitespace-nowrap font-mono text-xs text-muted-foreground">
                    {formatTradeTime(t.createdAt)}
                  </TableCell>
                  <TableCell>{t.bot?.name ?? '—'}</TableCell>
                  <TableCell className="font-mono">{t.symbol}</TableCell>
                  <TableCell>
                    <Badge
                      variant="outline"
                      className={
                        t.side === 'BUY'
                          ? 'border-emerald-500/40 bg-emerald-500/15 text-emerald-300'
                          : 'border-rose-500/40 bg-rose-500/15 text-rose-300'
                      }
                    >
                      {t.side}
                    </Badge>
                  </TableCell>
                  <TableCell className="font-mono">{t.quantity}</TableCell>
                  <TableCell className="font-mono">{t.price.toFixed(4)}</TableCell>
                  <TableCell className="text-muted-foreground">{t.status}</TableCell>
                  <TableCell className="font-mono">
                    {t.realizedPnl != null ? t.realizedPnl.toFixed(2) : '—'}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  )
}
