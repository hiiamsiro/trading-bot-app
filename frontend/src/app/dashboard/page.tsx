'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { Bot, Trade, BotStatus, Instrument } from '@/types'
import { useAuthStore } from '@/store/auth.store'
import {
  fetchAllInstruments,
  fetchBots,
  fetchInstruments,
  fetchTrades,
  setInstrumentActivation,
  syncInstruments,
} from '@/lib/api-client'
import { useHandleApiError } from '@/hooks/use-handle-api-error'
import { useTradingSocket } from '@/hooks/use-trading-socket'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { EmptyState } from '@/components/empty-state'
import { Bot as BotIcon, History, TrendingUp, Zap, ShieldCheck, Cpu, TimerReset } from 'lucide-react'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { LiveMarketChartPanel } from '@/components/charts/live-market-chart-panel'

export default function DashboardPage() {
  const token = useAuthStore((s) => s.token)
  const user = useAuthStore((s) => s.user)
  const handleError = useHandleApiError()
  const [loading, setLoading] = useState(true)
  const [bots, setBots] = useState<Bot[]>([])
  const [trades, setTrades] = useState<Trade[]>([])
  const [tradeTotal, setTradeTotal] = useState(0)
  const [instruments, setInstruments] = useState<Instrument[]>([])
  const [instrumentTotal, setInstrumentTotal] = useState(0)
  const [instrumentPage, setInstrumentPage] = useState(1)
  const [instrumentPageInput, setInstrumentPageInput] = useState('1')
  const [instrumentSearchInput, setInstrumentSearchInput] = useState('')
  const [instrumentSearchQuery, setInstrumentSearchQuery] = useState('')
  const [syncingInstruments, setSyncingInstruments] = useState(false)
  const [togglingSymbol, setTogglingSymbol] = useState<string | null>(null)
  const [overviewInstruments, setOverviewInstruments] = useState<Instrument[]>([])
  const INSTRUMENT_PAGE_SIZE = 10

  const reloadOverview = useCallback(() => {
    if (!token) return
    ;(async () => {
      try {
        const [b, t] = await Promise.all([fetchBots(token), fetchTrades(token)])
        setBots(b)
        setTradeTotal(t.length)
        setTrades(t.slice(0, 8))
      } catch (e) {
        handleError(e)
      }
    })()
  }, [token, handleError])

  const loadInstrumentsPage = useCallback(
    async (page: number, search = instrumentSearchQuery) => {
      if (!token) return
      const skip = (page - 1) * INSTRUMENT_PAGE_SIZE
      const result = await fetchAllInstruments(
        token,
        INSTRUMENT_PAGE_SIZE,
        skip,
        search,
      )
      setInstruments(result.items)
      setInstrumentTotal(result.total)
      setInstrumentPage(page)
      setInstrumentPageInput(String(page))
    },
    [token, instrumentSearchQuery],
  )

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      setInstrumentSearchQuery(instrumentSearchInput.trim())
    }, 300)
    return () => {
      window.clearTimeout(timeoutId)
    }
  }, [instrumentSearchInput])

  useEffect(() => {
    if (!token) return
    void loadInstrumentsPage(1, instrumentSearchQuery)
  }, [token, instrumentSearchQuery, loadInstrumentsPage])

  useEffect(() => {
    if (!token) return
    let cancelled = false
    ;(async () => {
      setLoading(true)
      try {
        const [b, t] = await Promise.all([fetchBots(token), fetchTrades(token)])
        if (!cancelled) {
          setBots(b)
          setTradeTotal(t.length)
          setTrades(t.slice(0, 8))
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
  }, [token, handleError, loadInstrumentsPage])

  useTradingSocket({
    userId: user?.id,
    onRefresh: reloadOverview,
  })

  const running = bots.filter((b) => b.status === BotStatus.RUNNING).length
  const stopped = Math.max(bots.length - running, 0)
  const activeInstruments = instruments.filter((row) => row.isActive).length
  const maxInstrumentPage = Math.max(
    1,
    Math.ceil(instrumentTotal / INSTRUMENT_PAGE_SIZE),
  )
  const hasPrevPage = instrumentPage > 1
  const hasNextPage = instrumentPage * INSTRUMENT_PAGE_SIZE < instrumentTotal
  const formatTradeTime = (value: string) =>
    new Date(value).toLocaleString([], {
      month: 'short',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    })

  const chartInstrumentSymbols = useMemo(() => {
    const s = new Set<string>()
    overviewInstruments.forEach((i) => s.add(i.symbol))
    bots.forEach((b) => s.add(b.symbol))
    return Array.from(s)
  }, [overviewInstruments, bots])

  const chartDefaultSymbol = useMemo(() => {
    const running = bots.find((b) => b.status === BotStatus.RUNNING)?.symbol
    if (running) return running
    if (overviewInstruments[0]?.symbol) return overviewInstruments[0].symbol
    if (bots[0]?.symbol) return bots[0].symbol
    return ''
  }, [bots, overviewInstruments])

  async function onSyncInstruments() {
    if (!token) return
    setSyncingInstruments(true)
    try {
      await syncInstruments(token)
      await loadInstrumentsPage(1)
    } catch (e) {
      handleError(e, 'Could not sync instruments')
    } finally {
      setSyncingInstruments(false)
    }
  }

  async function onToggleInstrument(symbol: string, nextIsActive: boolean) {
    if (!token) return
    setTogglingSymbol(symbol)
    try {
      const updated = await setInstrumentActivation(token, symbol, nextIsActive)
      setInstruments((prev) =>
        prev.map((row) => (row.symbol === updated.symbol ? updated : row)),
      )
    } catch (e) {
      handleError(e, 'Could not update instrument status')
    } finally {
      setTogglingSymbol(null)
    }
  }

  async function onPrevInstrumentsPage() {
    if (!token || !hasPrevPage) return
    const nextPage = instrumentPage - 1
    try {
      await loadInstrumentsPage(nextPage)
    } catch (e) {
      handleError(e, 'Could not load previous instrument page')
    }
  }

  async function onNextInstrumentsPage() {
    if (!token || !hasNextPage) return
    const nextPage = instrumentPage + 1
    try {
      await loadInstrumentsPage(nextPage)
    } catch (e) {
      handleError(e, 'Could not load next instrument page')
    }
  }

  async function onGoToInstrumentPage() {
    if (!token) return
    const parsed = Number(instrumentPageInput)
    if (!Number.isInteger(parsed)) {
      setInstrumentPageInput(String(instrumentPage))
      return
    }
    const target = Math.min(Math.max(parsed, 1), maxInstrumentPage)
    if (target === instrumentPage) {
      setInstrumentPageInput(String(target))
      return
    }
    try {
      await loadInstrumentsPage(target)
    } catch (e) {
      handleError(e, 'Could not load selected instrument page')
    }
  }

  if (loading) {
    return (
      <div className="space-y-8">
        <div>
          <Skeleton className="h-9 w-64" />
          <Skeleton className="mt-2 h-4 w-96" />
        </div>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-28 rounded-lg" />
          ))}
        </div>
        <Skeleton className="h-64 rounded-lg" />
      </div>
    )
  }

  return (
    <div className="space-y-8">
      <div className="rounded-xl border border-border/70 bg-card/70 p-6 shadow-sm backdrop-blur-xl">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-semibold tracking-tight">Dashboard</h1>
            <p className="mt-1 text-muted-foreground">
              Welcome back{user?.name ? `, ${user.name}` : ''}. Demo trading overview.
            </p>
          </div>
          <Badge className="border border-primary/40 bg-primary/15 px-3 py-1 text-primary">
            Live monitoring enabled
          </Badge>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Card className="border-border/70 bg-card/80 backdrop-blur-xl">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Bots</CardTitle>
            <BotIcon className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold">{bots.length}</p>
            <p className="text-xs text-muted-foreground">
              {running} running · {bots.length - running} stopped
            </p>
          </CardContent>
        </Card>
        <Card className="border-border/70 bg-card/80 backdrop-blur-xl">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Trades</CardTitle>
            <History className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold">{tradeTotal}</p>
            <p className="text-xs text-muted-foreground">All trades for your bots</p>
          </CardContent>
        </Card>
        <Card className="border-border/70 bg-card/80 backdrop-blur-xl">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Runtime health</CardTitle>
            <TrendingUp className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold">{activeInstruments}</p>
            <p className="text-xs text-muted-foreground">Active tradable instruments</p>
          </CardContent>
        </Card>
        <Card className="border-border/70 bg-card/80 backdrop-blur-xl">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Quick actions</CardTitle>
            <Zap className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent className="flex flex-col gap-2">
            <Button asChild size="sm" className="cursor-pointer">
              <Link href="/bots/new">Create bot</Link>
            </Button>
            <Button asChild variant="outline" size="sm" className="cursor-pointer">
              <Link href="/trades">View trade history</Link>
            </Button>
          </CardContent>
        </Card>
      </div>

      {chartDefaultSymbol ? (
        <LiveMarketChartPanel
          token={token ?? undefined}
          instrumentSymbols={chartInstrumentSymbols}
          activeSymbol={chartDefaultSymbol}
          title="Market overview"
          chartHeight={320}
        />
      ) : null}

      <Card className="border-border/70 bg-card/80 backdrop-blur-xl">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-lg">Instrument catalog</CardTitle>
          <Button
            size="sm"
            onClick={onSyncInstruments}
            disabled={syncingInstruments}
            className="cursor-pointer"
          >
            {syncingInstruments ? 'Syncing...' : 'Sync from provider'}
          </Button>
        </CardHeader>
        <CardContent className="space-y-2">
          <div className="flex items-center gap-2">
            <input
              type="text"
              value={instrumentSearchInput}
              onChange={(e) => setInstrumentSearchInput(e.target.value)}
              placeholder="Search symbol, name, base/quote..."
              className="h-9 w-full max-w-sm rounded-md border border-border/70 bg-background px-3 text-sm"
              aria-label="Search instruments"
            />
            {instrumentSearchQuery && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setInstrumentSearchInput('')
                  setInstrumentSearchQuery('')
                }}
                className="cursor-pointer"
              >
                Clear
              </Button>
            )}
          </div>
          {instruments.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              {instrumentSearchQuery
                ? `No instruments match "${instrumentSearchQuery}".`
                : 'No instruments in catalog yet. Run sync to import provider symbols.'}
            </p>
          ) : (
            instruments.map((instrument) => (
              <div
                key={instrument.symbol}
                className="flex items-center justify-between rounded-md border border-border/70 bg-background/60 px-3 py-2"
              >
                <div>
                  <p className="font-mono text-sm">{instrument.symbol}</p>
                  <p className="text-xs text-muted-foreground">{instrument.displayName}</p>
                </div>
                <div className="flex items-center gap-2">
                  <Badge
                    variant="outline"
                    className={
                      instrument.isActive
                        ? 'border-emerald-500/40 bg-emerald-500/15 text-emerald-300'
                        : 'border-border/70 bg-background/40 text-muted-foreground'
                    }
                  >
                    {instrument.isActive ? 'Active' : 'Inactive'}
                  </Badge>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => onToggleInstrument(instrument.symbol, !instrument.isActive)}
                    disabled={togglingSymbol === instrument.symbol}
                    className="cursor-pointer"
                  >
                    {instrument.isActive ? 'Deactivate' : 'Activate'}
                  </Button>
                </div>
              </div>
            ))
          )}
          <div className="flex items-center justify-between pt-1">
            <p className="text-xs text-muted-foreground">
              Page {instrumentPage} · Showing {instruments.length} / {instrumentTotal}
            </p>
            <div className="flex items-center gap-2">
              <input
                type="number"
                min={1}
                max={maxInstrumentPage}
                value={instrumentPageInput}
                onChange={(e) => setInstrumentPageInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    void onGoToInstrumentPage()
                  }
                }}
                className="h-8 w-16 rounded-md border border-border/70 bg-background px-2 text-xs"
                aria-label="Instrument page number"
              />
              <Button
                variant="outline"
                size="sm"
                onClick={onGoToInstrumentPage}
                className="cursor-pointer"
              >
                Go
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={onPrevInstrumentsPage}
                disabled={!hasPrevPage}
                className="cursor-pointer"
              >
                Previous
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={onNextInstrumentsPage}
                disabled={!hasNextPage}
                className="cursor-pointer"
              >
                Next
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="border-border/70 bg-card/80 backdrop-blur-xl lg:col-span-2">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">System integrity</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3 sm:grid-cols-3">
            <div className="rounded-lg border border-border/70 bg-background/60 p-3">
              <p className="flex items-center gap-2 text-sm font-medium">
                <ShieldCheck className="h-4 w-4 text-primary" />
                Auth & guards
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                Protected routes with JWT session validation.
              </p>
            </div>
            <div className="rounded-lg border border-border/70 bg-background/60 p-3">
              <p className="flex items-center gap-2 text-sm font-medium">
                <Cpu className="h-4 w-4 text-primary" />
                Bot engine
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                {running > 0
                  ? `${running} strategies active in demo mode.`
                  : 'No active strategy execution right now.'}
              </p>
            </div>
            <div className="rounded-lg border border-border/70 bg-background/60 p-3">
              <p className="flex items-center gap-2 text-sm font-medium">
                <TimerReset className="h-4 w-4 text-primary" />
                Event stream
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                Real-time refresh wired to websocket updates.
              </p>
            </div>
          </CardContent>
        </Card>

        <Card className="border-border/70 bg-card/80 backdrop-blur-xl">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Status snapshot</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div className="flex items-center justify-between rounded-md border border-border/70 bg-background/60 px-3 py-2">
              <span className="text-muted-foreground">Running bots</span>
              <span className="font-mono font-medium">{running}</span>
            </div>
            <div className="flex items-center justify-between rounded-md border border-border/70 bg-background/60 px-3 py-2">
              <span className="text-muted-foreground">Stopped bots</span>
              <span className="font-mono font-medium">{stopped}</span>
            </div>
            <div className="flex items-center justify-between rounded-md border border-border/70 bg-background/60 px-3 py-2">
              <span className="text-muted-foreground">Captured trades</span>
              <span className="font-mono font-medium">{tradeTotal}</span>
            </div>
          </CardContent>
        </Card>
      </div>

      {bots.length === 0 ? (
        <EmptyState
          icon={BotIcon}
          title="No bots yet"
          description="Create a bot to start exploring demo execution and logs."
        >
          <Button asChild className="cursor-pointer">
            <Link href="/bots/new">Create your first bot</Link>
          </Button>
        </EmptyState>
      ) : (
        <Card className="border-border/70 bg-card/80 backdrop-blur-xl">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-lg">Recent activity</CardTitle>
            <Button variant="ghost" size="sm" asChild className="cursor-pointer">
              <Link href="/bots">Manage bots</Link>
            </Button>
          </CardHeader>
          <CardContent>
            {trades.length === 0 ? (
              <p className="text-sm text-muted-foreground">No trades recorded yet.</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead className="text-muted-foreground">Time</TableHead>
                    <TableHead className="text-muted-foreground">Bot</TableHead>
                    <TableHead className="text-muted-foreground">Symbol</TableHead>
                    <TableHead className="text-muted-foreground">Side</TableHead>
                    <TableHead className="text-muted-foreground">Status</TableHead>
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
                      <TableCell className="text-muted-foreground">{t.status}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  )
}
