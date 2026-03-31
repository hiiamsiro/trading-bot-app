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
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-1">
            <CardTitle className="text-xs font-medium text-muted-foreground">Net P&amp;L</CardTitle>
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
            <CardTitle className="text-xs font-medium text-muted-foreground">Gross P&amp;L</CardTitle>
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
            <CardTitle className="text-xs font-medium text-muted-foreground">Fees Paid</CardTitle>
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
