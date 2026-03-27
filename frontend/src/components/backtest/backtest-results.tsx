'use client'

import { useMemo } from 'react'
import {
  TrendingUp,
  TrendingDown,
  ArrowDown,
  ArrowUp,
  BarChart3,
  DollarSign,
  Target,
  TimerReset,
} from 'lucide-react'
import type { BacktestResult, BacktestTrade } from '@/types'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { EquityCurveChart } from '@/components/charts/equity-curve-chart'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'

type Props = {
  result: BacktestResult
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

export function BacktestResults({ result }: Props) {
  const { metrics, trades, equityCurve } = result

  const equityPoints = useMemo(
    () => equityCurve.map((p) => ({ at: p.at, cumulativePnl: p.cumulativePnl })),
    [equityCurve],
  )

  const closedTrades = useMemo(() => trades.filter((t) => t.exitTime !== null), [trades])

  return (
    <div className="space-y-6">
      {/* ── Metrics grid ─────────────────────────── */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-1">
            <CardTitle className="text-xs font-medium text-muted-foreground">Total P&amp;L</CardTitle>
            <DollarSign className="h-3.5 w-3.5 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <p className={`text-xl font-bold tabular-nums ${metrics.totalPnl >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
              {metrics.totalPnl >= 0 ? '+' : '−'}${fmt(Math.abs(metrics.totalPnl))}
            </p>
            <p className="text-xs text-muted-foreground">
              {metrics.finalBalance >= metrics.initialBalance ? '↑' : '↓'} ${fmt(metrics.finalBalance)} final
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-1">
            <CardTitle className="text-xs font-medium text-muted-foreground">Win Rate</CardTitle>
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
            <CardTitle className="text-xs font-medium text-muted-foreground">Max Drawdown</CardTitle>
            <ArrowDown className="h-3.5 w-3.5 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <p className="text-xl font-bold tabular-nums text-red-400">−{fmt(metrics.maxDrawdown * 100, 1)}%</p>
            <p className="text-xs text-muted-foreground">Peak-to-trough</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-1">
            <CardTitle className="text-xs font-medium text-muted-foreground">Total Trades</CardTitle>
            <BarChart3 className="h-3.5 w-3.5 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <p className="text-xl font-bold tabular-nums">{metrics.totalTrades}</p>
            <p className="text-xs text-muted-foreground">
              Avg win ${fmt(metrics.averageWin ?? 0)} · Avg loss ${fmt(metrics.averageLoss ?? 0)}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* ── Equity curve ─────────────────────────── */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Equity Curve</CardTitle>
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
            <CardTitle className="text-base">Trade Log ({closedTrades.length})</CardTitle>
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
                    <TableHead className="text-right">Entry Price</TableHead>
                    <TableHead className="text-right">Exit Price</TableHead>
                    <TableHead className="text-right">P&amp;L</TableHead>
                    <TableHead>Reason</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {closedTrades.map((trade: BacktestTrade) => {
                    const pnl = trade.pnl ?? 0
                    const pnlClass = pnl > 0 ? 'text-emerald-400' : pnl < 0 ? 'text-red-400' : 'text-muted-foreground'
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
                        <TableCell className="text-right tabular-nums text-xs">${fmt(trade.entryPrice)}</TableCell>
                        <TableCell className="text-right tabular-nums text-xs">
                          {trade.exitPrice != null ? `$${fmt(trade.exitPrice)}` : '—'}
                        </TableCell>
                        <TableCell className={`text-right tabular-nums text-xs font-medium ${pnlClass}`}>
                          {trade.exitPrice != null ? fmtPnl(pnl) : '—'}
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
