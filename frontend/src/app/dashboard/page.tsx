'use client' 
 
import { useCallback, useEffect, useMemo, useState } from 'react' 
import Link from 'next/link' 
import { useRouter } from 'next/navigation'
import { Instrument, TradeStatus, type DashboardSnapshot } from '@/types' 
import { useAuthStore } from '@/store/auth.store' 
import {
  fetchAllInstruments,
  fetchDashboard,
  fetchInstruments,
  setInstrumentActivation,
  syncInstruments,
} from '@/lib/api-client'
import { useHandleApiError } from '@/hooks/use-handle-api-error'
import { useTradingSocket } from '@/hooks/use-trading-socket'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { EmptyState } from '@/components/empty-state'
import {
  Activity,
  AlertCircle,
  BarChart3,
  Bot as BotIcon,
  DollarSign, 
  History, 
  LogOut,
  Percent, 
  Target, 
  TimerReset, 
  TrendingDown, 
  TrendingUp, 
  Zap,
} from 'lucide-react'
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
import { EquityCurveChart } from '@/components/charts/equity-curve-chart'

function formatPnl(value: number) {
  const abs = Math.abs(value).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
  if (value > 0) return `+${abs}`
  if (value < 0) return `−${abs}`
  return abs
}

function formatPct(value: number | null) {
  if (value === null) return '—'
  return `${value.toFixed(1)}%`
}

export default function DashboardPage() { 
  const router = useRouter()
  const token = useAuthStore((s) => s.token) 
  const user = useAuthStore((s) => s.user) 
  const clearAuth = useAuthStore((s) => s.clearAuth)
  const handleError = useHandleApiError() 
  const [loading, setLoading] = useState(true) 
  const [dashboard, setDashboard] = useState<DashboardSnapshot | null>(null) 
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
        const d = await fetchDashboard(token)
        setDashboard(d)
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
        const [d, active] = await Promise.all([
          fetchDashboard(token),
          fetchInstruments(token),
        ])
        if (!cancelled) {
          setDashboard(d)
          setOverviewInstruments(active.slice(0, 8))
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
  }, [token, handleError])

  useTradingSocket({
    token,
    userId: user?.id,
    onRefresh: reloadOverview,
  })

  const m = dashboard?.metrics
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
    dashboard?.botSymbols.forEach((sym) => s.add(sym))
    overviewInstruments.forEach((i) => s.add(i.symbol))
    return Array.from(s)
  }, [overviewInstruments, dashboard?.botSymbols])

  const chartDefaultSymbol = useMemo(() => {
    if (dashboard?.botSymbols[0]) return dashboard.botSymbols[0]
    if (overviewInstruments[0]?.symbol) return overviewInstruments[0].symbol
    return ''
  }, [dashboard?.botSymbols, overviewInstruments])

  async function onSyncInstruments() {
    if (!token) return
    setSyncingInstruments(true)
    try {
      await syncInstruments(token)
      await loadInstrumentsPage(1)
      const active = await fetchInstruments(token)
      setOverviewInstruments(active.slice(0, 8))
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

  if (loading || !dashboard || !m) {
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
        <Skeleton className="h-72 rounded-lg" />
      </div>
    )
  }

  const totalBots = m.totalBots 

  const onSignOut = () => {
    clearAuth()
    router.replace('/login')
  }
 
  return ( 
    <div className="space-y-8"> 
      <div className="rounded-xl border border-border/70 bg-card/70 p-6 shadow-sm backdrop-blur-xl"> 
        <div className="flex flex-wrap items-center justify-between gap-4"> 
          <div>
            <h1 className="text-3xl font-semibold tracking-tight">Dashboard</h1>
            <p className="mt-1 text-muted-foreground"> 
              Welcome back{user?.name ? `, ${user.name}` : ''}. Performance from stored trades; PnL uses closed positions with realized PnL. 
            </p> 
          </div> 
          <div className="flex flex-wrap items-center justify-end gap-2">
            <Badge className="border border-primary/40 bg-primary/15 px-3 py-1 text-primary"> 
              Live monitoring enabled 
            </Badge> 
            <Button variant="outline" size="sm" className="gap-2" onClick={onSignOut}>
              <LogOut className="h-4 w-4" />
              Logout
            </Button>
          </div>
        </div> 
      </div> 

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Card className="border-border/70 bg-card/80 backdrop-blur-xl">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total PnL</CardTitle>
            <DollarSign className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <p
              className={`text-2xl font-semibold tabular-nums ${
                m.totalPnl > 0
                  ? 'text-emerald-400'
                  : m.totalPnl < 0
                    ? 'text-rose-400'
                    : ''
              }`}
            >
              {formatPnl(m.totalPnl)}
            </p>
            <p className="text-xs text-muted-foreground">
              {m.closedTradesWithPnl} closed trade{m.closedTradesWithPnl === 1 ? '' : 's'} with PnL
            </p>
          </CardContent>
        </Card>
        <Card className="border-border/70 bg-card/80 backdrop-blur-xl">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Today (UTC)</CardTitle>
            <TimerReset className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <p
              className={`text-2xl font-semibold tabular-nums ${
                m.dailyPnl > 0
                  ? 'text-emerald-400'
                  : m.dailyPnl < 0
                    ? 'text-rose-400'
                    : ''
              }`}
            >
              {formatPnl(m.dailyPnl)}
            </p>
            <p className="text-xs text-muted-foreground">Realized PnL from closes today</p>
          </CardContent>
        </Card>
        <Card className="border-border/70 bg-card/80 backdrop-blur-xl">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Win rate</CardTitle>
            <Percent className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold tabular-nums">{formatPct(m.winRate)}</p>
            <p className="text-xs text-muted-foreground">
              {m.winningTrades}W / {m.losingTrades}L · {m.totalTrades} total trades
            </p>
          </CardContent>
        </Card>
        <Card className="border-border/70 bg-card/80 backdrop-blur-xl">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Bots</CardTitle>
            <BotIcon className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold tabular-nums">{totalBots}</p>
            <p className="text-xs text-muted-foreground">
              {m.runningBots} running · {m.stoppedBots} stopped · {m.errorBots} error
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Card className="border-border/70 bg-card/80 backdrop-blur-xl">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Avg win</CardTitle>
            <TrendingUp className="h-4 w-4 text-emerald-500/90" />
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold tabular-nums text-emerald-400/90">
              {m.averageWin === null ? '—' : formatPnl(m.averageWin)}
            </p>
            <p className="text-xs text-muted-foreground">Mean realized PnL on winners</p>
          </CardContent>
        </Card>
        <Card className="border-border/70 bg-card/80 backdrop-blur-xl">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Avg loss</CardTitle>
            <TrendingDown className="h-4 w-4 text-rose-500/90" />
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold tabular-nums text-rose-400/90">
              {m.averageLoss === null ? '—' : formatPnl(m.averageLoss)}
            </p>
            <p className="text-xs text-muted-foreground">Mean realized PnL on losers</p>
          </CardContent>
        </Card>
        <Card className="border-border/70 bg-card/80 backdrop-blur-xl">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Max drawdown</CardTitle>
            <Target className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold tabular-nums text-amber-400/90">
              {formatPnl(-m.maxDrawdown)}
            </p>
            <p className="text-xs text-muted-foreground">Peak-to-trough on cumulative PnL</p>
          </CardContent>
        </Card>
        <Card className="border-border/70 bg-card/80 backdrop-blur-xl">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Catalog</CardTitle>
            <BarChart3 className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold tabular-nums">{activeInstruments}</p>
            <p className="text-xs text-muted-foreground">Active instruments on this page</p>
          </CardContent>
        </Card>
      </div>

      <Card className="border-border/70 bg-card/80 backdrop-blur-xl">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-lg">Equity curve</CardTitle>
          <History className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          {dashboard.equityCurve.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No closed trades with realized PnL yet. Curve updates as positions close.
            </p>
          ) : (
            <EquityCurveChart points={dashboard.equityCurve} height={280} />
          )}
        </CardContent>
      </Card>

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
        <Card className="border-border/70 bg-card/80 backdrop-blur-xl lg:col-span-3">
          <CardHeader className="flex flex-row items-center justify-between pb-3">
            <CardTitle className="text-base">Quick actions</CardTitle>
            <Zap className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            <Button asChild size="sm" className="cursor-pointer">
              <Link href="/bots/new">Create bot</Link>
            </Button>
            <Button asChild variant="outline" size="sm" className="cursor-pointer">
              <Link href="/trades">Trade history</Link>
            </Button>
            <Button asChild variant="outline" size="sm" className="cursor-pointer">
              <Link href="/bots">Manage bots</Link>
            </Button>
          </CardContent>
        </Card>
      </div>

      {totalBots === 0 ? (
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
        <div className="grid gap-4 xl:grid-cols-3">
          <Card className="border-border/70 bg-card/80 backdrop-blur-xl xl:col-span-3">
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-lg">Recent trades</CardTitle>
              <Button variant="ghost" size="sm" asChild className="cursor-pointer">
                <Link href="/trades">View all</Link>
              </Button>
            </CardHeader>
            <CardContent>
              {dashboard.recentTrades.length === 0 ? (
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
                      <TableHead className="text-right text-muted-foreground">PnL</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {dashboard.recentTrades.map((t) => (
                      <TableRow
                        key={t.id}
                        className="transition-colors duration-200 hover:bg-muted/40"
                      >
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
                        <TableCell
                          className={`text-right font-mono text-xs tabular-nums ${
                            t.status === TradeStatus.CLOSED && t.realizedPnl != null
                              ? t.realizedPnl > 0
                                ? 'text-emerald-400'
                                : t.realizedPnl < 0
                                  ? 'text-rose-400'
                                  : 'text-muted-foreground'
                              : 'text-muted-foreground'
                          }`}
                        >
                          {t.status === TradeStatus.CLOSED && t.realizedPnl != null
                            ? formatPnl(t.realizedPnl)
                            : '—'}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>

          <Card className="border-border/70 bg-card/80 backdrop-blur-xl">
            <CardHeader className="flex flex-row items-center justify-between pb-3">
              <CardTitle className="text-base">Bot activity</CardTitle>
              <Activity className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent className="max-h-[320px] space-y-3 overflow-y-auto pr-1">
              {dashboard.recentActivities.length === 0 ? (
                <p className="text-sm text-muted-foreground">No recent log entries.</p>
              ) : (
                dashboard.recentActivities.map((row) => (
                  <div
                    key={row.id}
                    className="rounded-md border border-border/70 bg-background/60 px-3 py-2 text-sm"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-medium">{row.botName}</span>
                      <span className="font-mono text-xs text-muted-foreground">
                        {formatTradeTime(row.createdAt)}
                      </span>
                    </div>
                    <Badge variant="outline" className="mt-1 text-[10px]">
                      {row.level}
                    </Badge>
                    <p className="mt-1 text-xs text-muted-foreground">{row.message}</p>
                  </div>
                ))
              )}
            </CardContent>
          </Card>

          <Card className="border-border/70 bg-card/80 backdrop-blur-xl xl:col-span-2">
            <CardHeader className="flex flex-row items-center justify-between pb-3">
              <CardTitle className="text-base">Recent errors</CardTitle>
              <AlertCircle className="h-4 w-4 text-rose-400/90" />
            </CardHeader>
            <CardContent>
              {dashboard.recentErrors.length === 0 ? (
                <p className="text-sm text-muted-foreground">No error logs in the recent window.</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow className="hover:bg-transparent">
                      <TableHead className="text-muted-foreground">Time</TableHead>
                      <TableHead className="text-muted-foreground">Bot</TableHead>
                      <TableHead className="text-muted-foreground">Message</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {dashboard.recentErrors.map((row) => (
                      <TableRow
                        key={row.id}
                        className="transition-colors duration-200 hover:bg-muted/40"
                      >
                        <TableCell className="whitespace-nowrap font-mono text-xs text-muted-foreground">
                          {formatTradeTime(row.createdAt)}
                        </TableCell>
                        <TableCell>{row.botName}</TableCell>
                        <TableCell className="text-sm text-rose-200/90">{row.message}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  )
}
