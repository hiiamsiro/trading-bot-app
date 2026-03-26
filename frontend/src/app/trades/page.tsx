'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { TradeSortBy, TradeStatus, type SortDir, type Trade } from '@/types'
import { useAuthStore } from '@/store/auth.store'
import { fetchBots, fetchInstruments, fetchTrades } from '@/lib/api-client'
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
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { History, ShieldCheck } from 'lucide-react'

export default function TradesPage() {
  const token = useAuthStore((s) => s.token)
  const user = useAuthStore((s) => s.user)
  const handleError = useHandleApiError()
  const [loading, setLoading] = useState(true)
  const [trades, setTrades] = useState<Trade[]>([])
  const [total, setTotal] = useState(0)
  const [take, setTake] = useState(25)
  const [skip, setSkip] = useState(0)
  const [botId, setBotId] = useState<string>('all')
  const [botsLoaded, setBotsLoaded] = useState<{ id: string; name: string }[]>(
    [],
  )
  const [symbol, setSymbol] = useState<string>('all')
  const [symbolsLoaded, setSymbolsLoaded] = useState<string[]>([])
  const [status, setStatus] = useState<string>('all')
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [sortBy, setSortBy] = useState<TradeSortBy>(TradeSortBy.createdAt)
  const [sortDir, setSortDir] = useState<SortDir>('desc')
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
        const [bots, instruments] = await Promise.all([
          fetchBots(token),
          fetchInstruments(token),
        ])
        if (!cancelled) {
          setBotsLoaded(bots.map((b) => ({ id: b.id, name: b.name })))
          setSymbolsLoaded(
            instruments
              .map((i) => i.symbol)
              .sort((a, b) => a.localeCompare(b)),
          )
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
        const res = await fetchTrades(token, {
          ...(botId === 'all' ? {} : { botId }),
          ...(symbol === 'all' ? {} : { symbol }),
          ...(status === 'all' ? {} : { status: status as TradeStatus }),
          ...(from ? { from } : {}),
          ...(to ? { to } : {}),
          take,
          skip,
          sortBy,
          sortDir,
        })
        setTrades(res.items)
        setTotal(res.total)
      } catch (e) {
        handleError(e)
      }
    })()
  }, [
    token,
    botId,
    symbol,
    status,
    from,
    to,
    take,
    skip,
    sortBy,
    sortDir,
    handleError,
  ])

  useEffect(() => {
    if (!token) return
    let cancelled = false
    ;(async () => {
      setLoading(true)
      try {
        const res = await fetchTrades(token, {
          ...(botId === 'all' ? {} : { botId }),
          ...(symbol === 'all' ? {} : { symbol }),
          ...(status === 'all' ? {} : { status: status as TradeStatus }),
          ...(from ? { from } : {}),
          ...(to ? { to } : {}),
          take,
          skip,
          sortBy,
          sortDir,
        })
        if (!cancelled) {
          setTrades(res.items)
          setTotal(res.total)
        }
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
  }, [token, botId, symbol, status, from, to, take, skip, sortBy, sortDir, handleError])

  useTradingSocket({
    token,
    userId: user?.id,
    onRefresh: reloadTrades,
  })

  const setFilter =
    (setter: (v: string) => void) =>
    (v: string) => {
      setter(v)
      setSkip(0)
    }

  const clearFilters = () => {
    setBotId('all')
    setSymbol('all')
    setStatus('all')
    setFrom('')
    setTo('')
    setSortBy(TradeSortBy.createdAt)
    setSortDir('desc')
    setTake(25)
    setSkip(0)
  }

  const canPrev = skip > 0
  const canNext = skip + take < total
  const showingFrom = total === 0 ? 0 : skip + 1
  const showingTo = Math.min(skip + take, total)

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

      <div className="rounded-lg border border-border/70 bg-card/70 p-4">
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-sm font-medium">Filters</h2>
          <Button
            variant="outline"
            size="sm"
            className="cursor-pointer"
            onClick={clearFilters}
          >
            Clear
          </Button>
        </div>

        <div className="mt-3 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="flex flex-col gap-2">
            <Label>Bot</Label>
            <Select value={botId} onValueChange={setFilter(setBotId)}>
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

          <div className="flex flex-col gap-2">
            <Label>Instrument</Label>
            <Select value={symbol} onValueChange={setFilter(setSymbol)}>
              <SelectTrigger className="cursor-pointer">
                <SelectValue placeholder="All instruments" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All instruments</SelectItem>
                {symbolsLoaded.map((s) => (
                  <SelectItem key={s} value={s}>
                    {s}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex flex-col gap-2">
            <Label>Status</Label>
            <Select value={status} onValueChange={setFilter(setStatus)}>
              <SelectTrigger className="cursor-pointer">
                <SelectValue placeholder="All statuses" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All statuses</SelectItem>
                {Object.values(TradeStatus).map((s) => (
                  <SelectItem key={s} value={s}>
                    {s}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex flex-col gap-2">
            <Label>Page size</Label>
            <Select
              value={String(take)}
              onValueChange={(v) => {
                setTake(Number(v))
                setSkip(0)
              }}
            >
              <SelectTrigger className="cursor-pointer">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {[10, 25, 50, 100, 200].map((n) => (
                  <SelectItem key={n} value={String(n)}>
                    {n}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex flex-col gap-2">
            <Label>From</Label>
            <Input
              type="date"
              value={from}
              onChange={(e) => {
                setFrom(e.target.value)
                setSkip(0)
              }}
            />
          </div>

          <div className="flex flex-col gap-2">
            <Label>To</Label>
            <Input
              type="date"
              value={to}
              onChange={(e) => {
                setTo(e.target.value)
                setSkip(0)
              }}
            />
          </div>

          <div className="flex flex-col gap-2">
            <Label>Sort by</Label>
            <Select
              value={sortBy}
              onValueChange={(v) => {
                setSortBy(v as TradeSortBy)
                setSkip(0)
              }}
            >
              <SelectTrigger className="cursor-pointer">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.values(TradeSortBy).map((s) => (
                  <SelectItem key={s} value={s}>
                    {s}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex flex-col gap-2">
            <Label>Order</Label>
            <Select
              value={sortDir}
              onValueChange={(v) => {
                setSortDir(v as SortDir)
                setSkip(0)
              }}
            >
              <SelectTrigger className="cursor-pointer">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="desc">desc</SelectItem>
                <SelectItem value="asc">asc</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
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
        <div className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2 text-sm text-muted-foreground">
            <span>
              Showing {showingFrom}-{showingTo} of {total}
            </span>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                className="cursor-pointer"
                disabled={!canPrev}
                onClick={() => setSkip(Math.max(0, skip - take))}
              >
                Prev
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="cursor-pointer"
                disabled={!canNext}
                onClick={() => setSkip(skip + take)}
              >
                Next
              </Button>
            </div>
          </div>

          <div className="rounded-md border border-border/70 bg-card/80 backdrop-blur-xl">
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead>Created</TableHead>
                  <TableHead>Bot</TableHead>
                  <TableHead>Instrument</TableHead>
                  <TableHead>Side</TableHead>
                  <TableHead className="text-right">Entry</TableHead>
                  <TableHead className="text-right">Exit</TableHead>
                  <TableHead className="text-right">PnL</TableHead>
                  <TableHead className="text-right">PnL %</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Reason</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {trades.map((t) => {
                  const entryValue = t.price * t.quantity
                  const pnlPct =
                    t.realizedPnl != null && entryValue !== 0
                      ? (t.realizedPnl / entryValue) * 100
                      : null

                  return (
                    <TableRow
                      key={t.id}
                      className="transition-colors duration-200 hover:bg-muted/40"
                    >
                      <TableCell className="whitespace-nowrap font-mono text-xs text-muted-foreground">
                        {formatTradeTime(t.createdAt)}
                      </TableCell>
                      <TableCell>{t.bot?.name ?? '—'}</TableCell>
                      <TableCell className="font-mono">
                        <Link
                          href={`/trades/${t.id}`}
                          className="cursor-pointer hover:underline"
                        >
                          {t.symbol}
                        </Link>
                      </TableCell>
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
                      <TableCell className="text-right font-mono">
                        <div>{t.price.toFixed(4)}</div>
                        <div className="text-xs text-muted-foreground">
                          {t.executedAt ? formatTradeTime(t.executedAt) : '—'}
                        </div>
                      </TableCell>
                      <TableCell className="text-right font-mono">
                        <div>{t.exitPrice != null ? t.exitPrice.toFixed(4) : '—'}</div>
                        <div className="text-xs text-muted-foreground">
                          {t.closedAt ? formatTradeTime(t.closedAt) : '—'}
                        </div>
                      </TableCell>
                      <TableCell className="text-right font-mono">
                        {t.realizedPnl != null ? t.realizedPnl.toFixed(2) : '—'}
                      </TableCell>
                      <TableCell className="text-right font-mono">
                        {pnlPct != null ? `${pnlPct.toFixed(2)}%` : '—'}
                      </TableCell>
                      <TableCell className="text-muted-foreground">{t.status}</TableCell>
                      <TableCell className="max-w-[320px]">
                        <div className="truncate text-sm">
                          {t.openReason ? `Open: ${t.openReason}` : '—'}
                        </div>
                        {t.closeReason ? (
                          <div className="truncate text-xs text-muted-foreground">
                            Exit: {t.closeReason}
                          </div>
                        ) : null}
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          </div>
        </div>
      )}
    </div>
  )
}
