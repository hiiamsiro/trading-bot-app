'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'
import {
  Activity,
  History,
  Loader2,
  Pencil,
  Play,
  ScrollText,
  ShieldCheck,
  Square,
  Trash2,
} from 'lucide-react'
import { ApiError } from '@/lib/api'
import type { Bot, BotLog, DashboardEquityPoint, Instrument, Trade } from '@/types'
import { BotStatus, MARKET_KLINE_INTERVALS, type MarketKlineInterval } from '@/types'
import { useAuthStore } from '@/store/auth.store'
import {
  deleteBot,
  fetchBot,
  fetchBotLogs,
  fetchInstrumentBySymbol,
  fetchInstruments,
  fetchTrades,
  startBot,
  stopBot,
} from '@/lib/api-client'
import { useHandleApiError } from '@/hooks/use-handle-api-error'
import { useTradingSocket } from '@/hooks/use-trading-socket'
import { connectWebSocket } from '@/lib/websocket'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { BotStatusBadge } from '@/components/bot-status-badge'
import { toast } from '@/hooks/use-toast'
import { LiveMarketChartPanel } from '@/components/charts/live-market-chart-panel'
import { EquityCurveChart } from '@/components/charts/equity-curve-chart'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'

export default function BotDetailPage() {
  const params = useParams()
  const router = useRouter()
  const id = typeof params.id === 'string' ? params.id : ''
  const token = useAuthStore((s) => s.token)
  const user = useAuthStore((s) => s.user)
  const handleError = useHandleApiError()

  const [loading, setLoading] = useState(true)
  const [bot, setBot] = useState<Bot | null>(null)
  const [notFound, setNotFound] = useState(false)
  const [actionLoading, setActionLoading] = useState<string | null>(null)

  const [instruments, setInstruments] = useState<Instrument[]>([])
  const [instrument, setInstrument] = useState<Instrument | null>(null)

  const [logsLoading, setLogsLoading] = useState(false)
  const [logs, setLogs] = useState<BotLog[]>([])

  const [tradesLoading, setTradesLoading] = useState(false)
  const [trades, setTrades] = useState<Trade[]>([])

  const [livePrice, setLivePrice] = useState<number | null>(null)
  const [livePriceAt, setLivePriceAt] = useState<string | null>(null)

  const loadBot = useCallback(async () => {
    if (!token || !id) return
    setLoading(true)
    setNotFound(false)
    try {
      const b = await fetchBot(token, id)
      setBot(b)
    } catch (e) {
      if (e instanceof ApiError && e.status === 404) {
        setNotFound(true)
        setBot(null)
      } else {
        handleError(e)
      }
    } finally {
      setLoading(false)
    }
  }, [token, id, handleError])

  const loadLogs = useCallback(async () => {
    if (!token || !id) return
    setLogsLoading(true)
    try {
      const res = await fetchBotLogs(token, id, 20, 0)
      setLogs(res.items)
    } catch (e) {
      handleError(e)
    } finally {
      setLogsLoading(false)
    }
  }, [token, id, handleError])

  const loadTrades = useCallback(async () => {
    if (!token || !id) return
    setTradesLoading(true)
    try {
      const res = await fetchTrades(token, { botId: id, take: 50, skip: 0 })
      setTrades(res.items)
    } catch (e) {
      handleError(e)
    } finally {
      setTradesLoading(false)
    }
  }, [token, id, handleError])

  useEffect(() => {
    void loadBot()
  }, [loadBot])

  useEffect(() => {
    void loadLogs()
    void loadTrades()
  }, [loadLogs, loadTrades])

  useEffect(() => {
    if (!token) return
    let cancelled = false
    void (async () => {
      try {
        const list = await fetchInstruments(token)
        if (!cancelled) setInstruments(list)
      } catch {
        if (!cancelled) setInstruments([])
      }
    })()
    return () => {
      cancelled = true
    }
  }, [token])

  useEffect(() => {
    if (!token || !bot?.symbol) return
    let cancelled = false
    void (async () => {
      try {
        const row = await fetchInstrumentBySymbol(token, bot.symbol)
        if (!cancelled) setInstrument(row)
      } catch {
        if (!cancelled) setInstrument(null)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [token, bot?.symbol])

  useTradingSocket({
    userId: user?.id,
    botId: id || undefined,
    onRefresh: () => {
      loadBot()
      loadLogs()
      loadTrades()
    },
  })

  const chartInstrumentSymbols = useMemo(() => {
    const s = new Set(instruments.map((i) => i.symbol))
    if (bot) {
      s.add(bot.symbol)
    }
    return Array.from(s)
  }, [instruments, bot])

  const botTimeframe = useMemo<MarketKlineInterval | null>(() => {
    const params = (bot?.strategyConfig?.params ?? {}) as Record<string, unknown>
    const raw = params.interval ?? params.timeframe ?? params.candleInterval
    if (typeof raw !== 'string') return null
    const normalized = raw.trim().toLowerCase()
    const found = MARKET_KLINE_INTERVALS.find((v) => v === normalized)
    return (found as MarketKlineInterval | undefined) ?? null
  }, [bot?.strategyConfig?.params])

  const equityPoints = useMemo<DashboardEquityPoint[]>(() => {
    const closed = trades
      .filter((t) => t.status === 'CLOSED' && t.realizedPnl != null && t.closedAt)
      .sort((a, b) => new Date(a.closedAt!).getTime() - new Date(b.closedAt!).getTime())
    let cumulative = 0
    const points: DashboardEquityPoint[] = []
    for (const t of closed) {
      cumulative += t.realizedPnl ?? 0
      points.push({ at: t.closedAt!, cumulativePnl: cumulative })
    }
    return points.length > 350 ? points.slice(-350) : points
  }, [trades])

  const pnlSummary = useMemo(() => {
    const closedWithPnl = trades.filter(
      (t) => t.status === 'CLOSED' && t.realizedPnl != null && t.closedAt,
    )
    const totalPnl = closedWithPnl.reduce((acc, t) => acc + (t.realizedPnl ?? 0), 0)
    const wins = closedWithPnl.filter((t) => (t.realizedPnl ?? 0) > 0).length
    const losses = closedWithPnl.filter((t) => (t.realizedPnl ?? 0) < 0).length
    const winRate = closedWithPnl.length > 0 ? (wins / closedWithPnl.length) * 100 : null
    return { totalPnl, wins, losses, closedTrades: closedWithPnl.length, winRate }
  }, [trades])

  useEffect(() => {
    if (!token || !bot?.symbol) return

    const symbol = bot.symbol.trim().toUpperCase()
    const socket = connectWebSocket()

    const onMarketData = (data: { symbol?: string; price?: unknown; timestamp?: unknown }) => {
      const incoming = data.symbol?.trim().toUpperCase()
      if (!incoming || incoming !== symbol) return
      if (typeof data.price === 'number' && Number.isFinite(data.price)) {
        setLivePrice(data.price)
      }
      if (typeof data.timestamp === 'string') {
        setLivePriceAt(data.timestamp)
      }
    }

    socket.on('market-data', onMarketData)
    return () => {
      socket.off('market-data', onMarketData)
    }
  }, [token, bot?.symbol])

  async function onStart() {
    if (!token || !id) return
    setActionLoading('start')
    try {
      const b = await startBot(token, id)
      setBot(b)
      toast({ title: 'Bot started' })
    } catch (e) {
      handleError(e)
    } finally {
      setActionLoading(null)
    }
  }

  async function onStop() {
    if (!token || !id) return
    setActionLoading('stop')
    try {
      const b = await stopBot(token, id)
      setBot(b)
      toast({ title: 'Bot stopped' })
    } catch (e) {
      handleError(e)
    } finally {
      setActionLoading(null)
    }
  }

  async function onDelete() {
    if (!token || !id) return
    if (!confirm('Delete this bot permanently?')) return
    setActionLoading('delete')
    try {
      await deleteBot(token, id)
      toast({ title: 'Bot deleted' })
      router.replace('/bots')
    } catch (e) {
      handleError(e)
    } finally {
      setActionLoading(null)
    }
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-64 rounded-lg" />
      </div>
    )
  }

  if (notFound || !bot) {
    return (
      <div className="space-y-4">
        <Alert variant="destructive">
          <AlertTitle>Not found</AlertTitle>
          <AlertDescription>This bot does not exist or you do not have access.</AlertDescription>
        </Alert>
        <Button asChild variant="outline">
          <Link href="/bots">Back to bots</Link>
        </Button>
      </div>
    )
  }

  const session = bot.executionSession

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <Button variant="ghost" size="sm" asChild className="mb-2 -ml-2 cursor-pointer">
            <Link href="/bots">{'<- Bots'}</Link>
          </Button>
          <h1 className="text-3xl font-semibold tracking-tight">{bot.name}</h1>
          <div className="mt-1 flex flex-wrap items-center gap-2 text-muted-foreground">
            <BotStatusBadge status={bot.status} />
            <span className="font-mono">{bot.symbol}</span>
            {botTimeframe ? (
              <Badge variant="outline" className="font-mono text-xs">
                {botTimeframe}
              </Badge>
            ) : null}
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <Badge
              variant="outline"
              className="border-amber-400/40 bg-amber-400/10 text-amber-200"
            >
              Paper Trading Only
            </Badge>
            <Badge
              variant="outline"
              className="border-sky-400/40 bg-sky-400/10 text-sky-200"
            >
              Simulated Execution
            </Badge>
            <span className="inline-flex items-center gap-1 text-xs text-amber-300">
              <ShieldCheck className="h-3.5 w-3.5" />
              Live signals with stored audit trail
            </span>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {bot.status === BotStatus.RUNNING ? (
            <Button
              variant="secondary"
              className="cursor-pointer"
              onClick={onStop}
              disabled={!!actionLoading}
            >
              {actionLoading === 'stop' ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Square className="mr-2 h-4 w-4" />
              )}
              Stop
            </Button>
          ) : (
            <Button onClick={onStart} disabled={!!actionLoading} className="cursor-pointer">
              {actionLoading === 'start' ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Play className="mr-2 h-4 w-4" />
              )}
              Start
            </Button>
          )}
          <Button variant="outline" asChild className="cursor-pointer">
            <Link href={`/bots/${id}/edit`}>
              <Pencil className="mr-2 h-4 w-4" />
              Edit
            </Link>
          </Button>
          <Button variant="outline" asChild className="cursor-pointer">
            <Link href={`/logs?botId=${id}`}>Logs</Link>
          </Button>
          <Button
            variant="destructive"
            className="cursor-pointer"
            onClick={onDelete}
            disabled={!!actionLoading}
          >
            {actionLoading === 'delete' ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Trash2 className="mr-2 h-4 w-4" />
            )}
            Delete
          </Button>
        </div>
      </div>

      {bot.description ? <p className="text-sm text-muted-foreground">{bot.description}</p> : null}

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="border-border/70 bg-card/80 backdrop-blur-xl lg:col-span-2">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-lg">Bot overview</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent className="grid gap-3 sm:grid-cols-2">
            <div>
              <p className="text-xs text-muted-foreground">Bot ID</p>
              <p className="font-mono text-sm">{bot.id}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Created</p>
              <p className="text-sm">{new Date(bot.createdAt).toLocaleString()}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Updated</p>
              <p className="text-sm">{new Date(bot.updatedAt).toLocaleString()}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Instrument</p>
              <p className="font-mono text-sm">{bot.symbol}</p>
              {instrument ? (
                <p className="text-xs text-muted-foreground">
                  {instrument.displayName} | {instrument.exchange} | {instrument.marketType}
                </p>
              ) : null}
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Timeframe</p>
              <p className="font-mono text-sm">{botTimeframe ?? 'Not set in strategy config'}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Strategy</p>
              <p className="text-sm">{bot.strategyConfig?.strategy ?? 'Not configured'}</p>
            </div>
          </CardContent>
        </Card>

        <Card className="border-border/70 bg-card/80 backdrop-blur-xl">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-lg">Live market price</CardTitle>
            <Badge variant="outline" className="text-xs">
              Live Market Data
            </Badge>
          </CardHeader>
          <CardContent className="space-y-2">
            <p className="text-3xl font-semibold tabular-nums">
              {livePrice != null
                ? livePrice.toFixed(Math.min(Math.max(instrument?.pricePrecision ?? 4, 0), 10))
                : 'Unavailable'}
            </p>
            <p className="text-xs text-muted-foreground">
              {livePriceAt ? `Updated ${new Date(livePriceAt).toLocaleString()}` : 'Waiting for feed'}
            </p>
          </CardContent>
        </Card>
      </div>

      <LiveMarketChartPanel
        token={token ?? undefined}
        instrumentSymbols={chartInstrumentSymbols}
        activeSymbol={bot.symbol}
        defaultInterval={botTimeframe ?? undefined}
        title="Live Market Data"
        showInstrumentSelect={false}
        showIntervalSelect={false}
      />

      <div className="grid gap-4 md:grid-cols-2">
        <Card className="border-border/70 bg-card/80 backdrop-blur-xl">
          <CardHeader>
            <CardTitle className="text-lg">Strategy config</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            {bot.strategyConfig ? (
              <>
                <p>
                  <span className="text-muted-foreground">Key: </span>
                  {bot.strategyConfig.strategy}
                </p>
                <pre className="mt-2 max-h-40 overflow-auto rounded-md bg-muted p-3 font-mono text-xs">
                  {JSON.stringify(bot.strategyConfig.params, null, 2)}
                </pre>
              </>
            ) : (
              <p className="text-muted-foreground">
                No strategy configured. Add one via API or recreate the bot - starting requires a strategy.
              </p>
            )}
          </CardContent>
        </Card>

        <Card className="border-border/70 bg-card/80 backdrop-blur-xl">
          <CardHeader>
            <CardTitle className="text-lg">Balances &amp; PnL</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            {session ? (
              <>
                <p>
                  <span className="text-muted-foreground">Total trades: </span>
                  {session.totalTrades}
                </p>
                <p>
                  <span className="text-muted-foreground">Current balance: </span>
                  <span className="font-mono">{session.currentBalance.toFixed(2)}</span>
                </p>
                <p>
                  <span className="text-muted-foreground">Initial balance: </span>
                  <span className="font-mono">{session.initialBalance.toFixed(2)}</span>
                </p>
                <p>
                  <span className="text-muted-foreground">Session PnL: </span>
                  <span className="font-mono">{session.profitLoss.toFixed(2)}</span>
                </p>
                <p className="text-xs text-muted-foreground">
                  Started {new Date(session.startedAt).toLocaleString()}
                  {session.endedAt ? ` - Ended ${new Date(session.endedAt).toLocaleString()}` : ''}
                </p>
              </>
            ) : (
              <p className="text-muted-foreground">No session until the bot runs.</p>
            )}

            <div className="pt-3">
              <p className="text-xs text-muted-foreground">All-time realized performance</p>
              <p className="mt-1 font-mono text-sm">
                PnL {pnlSummary.totalPnl.toFixed(2)} | Closed {pnlSummary.closedTrades} | Wins{' '}
                {pnlSummary.wins} | Losses {pnlSummary.losses}
                {pnlSummary.winRate != null ? ` | Win rate ${pnlSummary.winRate.toFixed(1)}%` : ''}
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="border-border/70 bg-card/80 backdrop-blur-xl">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-lg">Equity / performance</CardTitle>
          <History className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          {tradesLoading && equityPoints.length === 0 ? (
            <Skeleton className="h-72 rounded-lg" />
          ) : equityPoints.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No closed trades with realized PnL yet. The curve updates as positions close.
            </p>
          ) : (
            <EquityCurveChart points={equityPoints} height={280} />
          )}
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="border-border/70 bg-card/80 backdrop-blur-xl">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-lg">Recent trades</CardTitle>
            <Button asChild variant="outline" size="sm" className="cursor-pointer">
              <Link href="/trades">View all</Link>
            </Button>
          </CardHeader>
          <CardContent>
            {tradesLoading && trades.length === 0 ? (
              <Skeleton className="h-64 rounded-lg" />
            ) : trades.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No trades yet. Start the bot to execute demo signals.
              </p>
            ) : (
              <div className="rounded-md border border-border/60">
                <Table>
                  <TableHeader>
                    <TableRow className="hover:bg-transparent">
                      <TableHead>Time</TableHead>
                      <TableHead>Side</TableHead>
                      <TableHead className="text-right">Qty</TableHead>
                      <TableHead className="text-right">Entry</TableHead>
                      <TableHead className="text-right">Exit</TableHead>
                      <TableHead className="text-right">P/L</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {trades.slice(0, 10).map((t) => (
                      <TableRow
                        key={t.id}
                        className="transition-colors duration-200 hover:bg-muted/40"
                      >
                        <TableCell className="whitespace-nowrap font-mono text-xs text-muted-foreground">
                          {new Date(t.createdAt).toLocaleString([], {
                            month: 'short',
                            day: '2-digit',
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
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
                        <TableCell className="text-right font-mono">{t.quantity}</TableCell>
                        <TableCell className="text-right font-mono">{t.price.toFixed(4)}</TableCell>
                        <TableCell className="text-right font-mono">
                          {t.exitPrice != null ? t.exitPrice.toFixed(4) : t.status === 'CLOSED' ? 'N/A' : 'Open'}
                        </TableCell>
                        <TableCell className="text-right font-mono">
                          {t.realizedPnl != null
                            ? t.realizedPnl.toFixed(2)
                            : t.status === 'CLOSED'
                              ? '0.00'
                              : 'Open'}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="border-border/70 bg-card/80 backdrop-blur-xl">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-lg">Recent logs</CardTitle>
            <Button asChild variant="outline" size="sm" className="cursor-pointer">
              <Link href={`/logs?botId=${id}`}>View all</Link>
            </Button>
          </CardHeader>
          <CardContent>
            {logsLoading && logs.length === 0 ? (
              <Skeleton className="h-64 rounded-lg" />
            ) : logs.length === 0 ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <ScrollText className="h-4 w-4" />
                No logs yet. Start the bot or wait for activity.
              </div>
            ) : (
              <div className="rounded-md border border-border/60">
                <Table>
                  <TableHeader>
                    <TableRow className="hover:bg-transparent">
                      <TableHead>Time</TableHead>
                      <TableHead>Level</TableHead>
                      <TableHead>Message</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {logs.slice(0, 10).map((row) => (
                      <TableRow
                        key={row.id}
                        className="transition-colors duration-200 hover:bg-muted/40"
                      >
                        <TableCell className="whitespace-nowrap font-mono text-xs text-muted-foreground">
                          {new Date(row.createdAt).toLocaleString([], {
                            month: 'short',
                            day: '2-digit',
                            hour: '2-digit',
                            minute: '2-digit',
                            second: '2-digit',
                          })}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline">{row.level}</Badge>
                        </TableCell>
                        <TableCell className="max-w-md">
                          <span className="text-sm">{row.message}</span>
                          {row.metadata ? (
                            <pre className="mt-1 max-h-24 overflow-auto rounded bg-muted p-2 font-mono text-xs">
                              {JSON.stringify(row.metadata, null, 2)}
                            </pre>
                          ) : null}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
