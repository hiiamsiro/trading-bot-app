'use client'

import { useState, useMemo, useCallback } from 'react'
import Link from 'next/link'
import {
  TrendingUp,
  ArrowDown,
  DollarSign,
  Target,
  TimerReset,
  Loader2,
  Play,
} from 'lucide-react'
import type { BacktestResult, BacktestTrade, MarketKline } from '@/types'
import { getBacktestCandles } from '@/lib/api-client'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { EquityCurveChart } from '@/components/charts/equity-curve-chart'
import { MarketCandlestickChart } from '@/components/charts/market-candlestick-chart'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { InfoTooltip } from '@/components/ui/info-tooltip'
import { backtestTooltips } from '@/lib/tooltip-content'

type Props = {
  result: BacktestResult
  backtestId?: string
  token?: string
}

function fmt(value: number, decimals = 2) {
  return value.toLocaleString(undefined, { minimumFractionDigits: decimals, maximumFractionDigits: decimals })
}

function fmtPnl(value: number) {
  const abs = Math.abs(value).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  if (value > 0) return `+${abs}`
  if (value < 0) return `−${abs}`
  return abs
}

function fmtPct(value: number | null) {
  if (value === null) return '—'
  return `${(value * 100).toFixed(1)}%`
}

export function BacktestResults({ result, backtestId, token }: Props) {
  const { metrics, trades, equityCurve } = result
  const [showCandlestick, setShowCandlestick] = useState(false)
  const [candles, setCandles] = useState<MarketKline[] | null>(null)
  const [loadingCandles, setLoadingCandles] = useState(false)

  const equityPoints = useMemo(
    () => equityCurve.map((p) => ({ at: p.at, cumulativePnl: p.cumulativePnl })),
    [equityCurve],
  )

  const closedTrades = useMemo(() => trades.filter((t) => t.exitTime !== null), [trades])

  const chartTrades = useMemo(
    () => trades.map((t) => ({
      id: String(t.id),
      createdAt: new Date(t.entryTime).toISOString(),
      side: t.side as 'BUY' | 'SELL',
      status: t.exitTime ? 'CLOSED' : 'OPEN' as const,
      closedAt: t.exitTime ? new Date(t.exitTime).toISOString() : null,
      realizedPnl: t.netPnl ?? t.pnl ?? null,
      price: t.executedEntryPrice ?? t.entryPrice,
      quantity: t.quantity,
    })),
    [trades],
  )

  const loadCandles = useCallback(async () => {
    if (!token || !backtestId) return
    if (candles) return
    setLoadingCandles(true)
    try {
      const data = await getBacktestCandles(token, backtestId)
      setCandles(data.candles)
    } catch {
      // Keep candles null so user can retry
    } finally {
      setLoadingCandles(false)
    }
  }, [token, backtestId])

  const handleToggleChart = useCallback(() => {
    if (!showCandlestick) {
      void loadCandles()
    }
    setShowCandlestick((v) => !v)
  }, [showCandlestick, loadCandles])

  return (
    <div className="space-y-6">
      {/* ── Metrics grid ─────────────────────────── */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-1">
            <CardTitle className="text-xs font-medium text-muted-foreground flex items-center gap-1">
              Net P&amp;L
              <InfoTooltip content={backtestTooltips.netPnl} side="top" />
            </CardTitle>
            <DollarSign className="h-3.5 w-3.5 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <p className={`text-xl font-bold tabular-nums ${(metrics.netPnl ?? metrics.totalPnl) >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
              {(metrics.netPnl ?? metrics.totalPnl) >= 0 ? '+' : '−'}${fmt(Math.abs(metrics.netPnl ?? metrics.totalPnl))}
            </p>
            <p className="text-xs text-muted-foreground">
              {metrics.finalBalance >= metrics.initialBalance ? '↑' : '↓'} ${fmt(metrics.finalBalance)} final
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-1">
            <CardTitle className="text-xs font-medium text-muted-foreground flex items-center gap-1">
              Gross P&amp;L
              <InfoTooltip content={backtestTooltips.grossPnl} side="top" />
            </CardTitle>
            <TrendingUp className="h-3.5 w-3.5 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <p className={`text-xl font-bold tabular-nums ${(metrics.grossPnl ?? metrics.totalPnl) >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
              {(metrics.grossPnl ?? metrics.totalPnl) >= 0 ? '+' : '−'}${fmt(Math.abs(metrics.grossPnl ?? metrics.totalPnl))}
            </p>
            <p className="text-xs text-muted-foreground">Before fees</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-1">
            <CardTitle className="text-xs font-medium text-muted-foreground flex items-center gap-1">
              Fees Paid
              <InfoTooltip content={backtestTooltips.feesPaid} side="top" />
            </CardTitle>
            <TimerReset className="h-3.5 w-3.5 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <p className="text-xl font-bold tabular-nums text-orange-400">
              −${fmt(metrics.totalFees ?? 0)}
            </p>
            <p className="text-xs text-muted-foreground">Total fees + slippage</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-1">
            <CardTitle className="text-xs font-medium text-muted-foreground flex items-center gap-1">
              Win Rate
              <InfoTooltip content={backtestTooltips.winRate} side="top" />
            </CardTitle>
            <Target className="h-3.5 w-3.5 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <p className="text-xl font-bold tabular-nums">{fmtPct(metrics.winRate)}</p>
            <p className="text-xs text-muted-foreground">
              {metrics.winningTrades}W / {metrics.losingTrades}L
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-1">
            <CardTitle className="text-xs font-medium text-muted-foreground flex items-center gap-1">
              Max Drawdown
              <InfoTooltip content={backtestTooltips.maxDrawdown} side="top" />
            </CardTitle>
            <ArrowDown className="h-3.5 w-3.5 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <p className="text-xl font-bold tabular-nums text-red-400">−{fmt(metrics.maxDrawdown * 100, 1)}%</p>
            <p className="text-xs text-muted-foreground">Peak-to-trough</p>
          </CardContent>
        </Card>
      </div>

      {/* ── Chart section ───────────────────────── */}
      {backtestId && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <div className="flex items-center gap-2">
              <CardTitle className="text-base flex items-center gap-1">
                Candlestick Chart
                <InfoTooltip content={backtestTooltips.candlestickChart} side="top" />
              </CardTitle>
              {backtestId && (
                <Button asChild variant="ghost" size="sm" className="h-7 gap-1 text-xs">
                  <Link href={`/backtest/replay/${backtestId}`}>
                    <Play className="h-3 w-3" />
                    Replay
                    <InfoTooltip content={backtestTooltips.sessionReplay} side="top" />
                  </Link>
                </Button>
              )}
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={handleToggleChart}
              disabled={loadingCandles}
            >
              {loadingCandles ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : showCandlestick ? (
                'Hide'
              ) : (
                'Show'
              )}
              &nbsp;Chart
            </Button>
          </CardHeader>
          <CardContent>
            {showCandlestick && (
              candles && candles.length > 0 ? (
                <MarketCandlestickChart
                  bars={candles}
                  trades={chartTrades as any}
                  height={320}
                  indicatorConfig={{
                    mas: [
                      { period: 7, color: '#38bdf8', label: 'MA(7)', type: 'SMA' },
                      { period: 25, color: '#facc15', label: 'MA(25)', type: 'SMA' },
                      { period: 99, color: '#a78bfa', label: 'MA(99)', type: 'SMA' },
                    ],
                    showRsi: true,
                    rsiPeriod: 14,
                  }}
                />
              ) : (
                <div className="flex h-48 items-center justify-center text-sm text-muted-foreground">
                  {loadingCandles ? 'Loading candles…' : 'No candle data available'}
                </div>
              )
            )}
            {!showCandlestick && (
              <div className="flex h-20 items-center justify-center text-sm text-muted-foreground">
                Click &quot;Show Chart&quot; to view candlestick chart with trade markers.
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* ── Equity curve ─────────────────────────── */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-1">
            Equity Curve
            <InfoTooltip content={backtestTooltips.equityCurve} side="top" />
          </CardTitle>
        </CardHeader>
        <CardContent>
          {equityPoints.length > 1 ? (
            <EquityCurveChart points={equityPoints} height={280} />
          ) : (
            <div className="flex h-48 items-center justify-center text-sm text-muted-foreground">
              Not enough data to render equity curve
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── Trade log ─────────────────────────────── */}
      {closedTrades.length > 0 ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-1">
              Trade Log ({closedTrades.length})
              <InfoTooltip content={backtestTooltips.tradeLog} side="top" />
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="max-h-72 overflow-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>#</TableHead>
                    <TableHead>Entry</TableHead>
                    <TableHead>Exit</TableHead>
                    <TableHead className="text-right">Qty</TableHead>
                    <TableHead className="text-right">Exec. Entry</TableHead>
                    <TableHead className="text-right">Exec. Exit</TableHead>
                    <TableHead className="text-right">Gross P&amp;L</TableHead>
                    <TableHead className="text-right">Net P&amp;L</TableHead>
                    <TableHead className="text-right">Fees</TableHead>
                    <TableHead>Reason</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {closedTrades.map((trade: BacktestTrade) => {
                    const netPnl = trade.netPnl ?? trade.pnl ?? 0
                    const grossPnl = trade.grossPnl ?? trade.pnl ?? 0
                    const netClass = netPnl > 0 ? 'text-emerald-400' : netPnl < 0 ? 'text-red-400' : 'text-muted-foreground'
                    const grossClass = grossPnl > 0 ? 'text-emerald-400' : grossPnl < 0 ? 'text-red-400' : 'text-muted-foreground'
                    return (
                      <TableRow key={trade.id}>
                        <TableCell className="font-mono text-xs text-muted-foreground">{trade.id}</TableCell>
                        <TableCell>
                          <div className="text-xs">
                            <div>{new Date(trade.entryTime).toLocaleDateString()}</div>
                            <div className="text-muted-foreground">{new Date(trade.entryTime).toLocaleTimeString()}</div>
                          </div>
                        </TableCell>
                        <TableCell>
                          {trade.exitTime ? (
                            <div className="text-xs">
                              <div>{new Date(trade.exitTime).toLocaleDateString()}</div>
                              <div className="text-muted-foreground">{new Date(trade.exitTime).toLocaleTimeString()}</div>
                            </div>
                          ) : (
                            <span className="text-xs text-muted-foreground">—</span>
                          )}
                        </TableCell>
                        <TableCell className="text-right tabular-nums text-xs">{trade.quantity}</TableCell>
                        <TableCell className="text-right tabular-nums text-xs">
                          ${fmt(trade.executedEntryPrice ?? trade.entryPrice)}
                        </TableCell>
                        <TableCell className="text-right tabular-nums text-xs">
                          {trade.executedExitPrice != null ? `$${fmt(trade.executedExitPrice)}` : '—'}
                        </TableCell>
                        <TableCell className={`text-right tabular-nums text-xs font-medium ${grossClass}`}>
                          {trade.executedExitPrice != null ? fmtPnl(grossPnl) : '—'}
                        </TableCell>
                        <TableCell className={`text-right tabular-nums text-xs font-medium ${netClass}`}>
                          {trade.executedExitPrice != null ? fmtPnl(netPnl) : '—'}
                        </TableCell>
                        <TableCell className="text-right tabular-nums text-xs text-orange-400">
                          −${fmt(trade.totalFees ?? (trade.entryFee ?? 0) + (trade.exitFee ?? 0))}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className="text-xs">
                            {trade.closeReason ?? '—'}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="flex items-center justify-center py-8 text-sm text-muted-foreground">
            No trades executed during this backtest period
          </CardContent>
        </Card>
      )}
    </div>
  )
}
