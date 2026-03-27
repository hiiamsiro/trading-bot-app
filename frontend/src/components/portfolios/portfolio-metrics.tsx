'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { InfoTooltip } from '@/components/ui/info-tooltip'
import type { PortfolioMetrics } from '@/types'
import {
  DollarSign,
  Percent,
  Target,
  TrendingDown,
  TrendingUp,
  Bot as BotIcon,
  History,
} from 'lucide-react'

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

interface Props {
  metrics: PortfolioMetrics
}

export function PortfolioMetricsGrid({ metrics }: Props) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      <Card className="border-border/70 bg-card/80 backdrop-blur-xl">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="flex items-center gap-1.5 text-sm font-medium text-muted-foreground">
            Total PnL
            <InfoTooltip content="Cumulative realized PnL across all closed trades in this portfolio." side="top" />
          </CardTitle>
          <DollarSign className="h-4 w-4 text-primary" />
        </CardHeader>
        <CardContent>
          <p
            className={`text-2xl font-semibold tabular-nums ${
              metrics.totalPnl > 0
                ? 'text-emerald-400'
                : metrics.totalPnl < 0
                  ? 'text-rose-400'
                  : ''
            }`}
          >
            {formatPnl(metrics.totalPnl)}
          </p>
          <p className="text-xs text-muted-foreground">
            {metrics.closedTrades} closed trade{metrics.closedTrades === 1 ? '' : 's'}
          </p>
        </CardContent>
      </Card>

      <Card className="border-border/70 bg-card/80 backdrop-blur-xl">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="flex items-center gap-1.5 text-sm font-medium text-muted-foreground">
            Win rate
            <InfoTooltip content="Percentage of closed trades with positive PnL." side="top" />
          </CardTitle>
          <Percent className="h-4 w-4 text-primary" />
        </CardHeader>
        <CardContent>
          <p className="text-2xl font-semibold tabular-nums">{formatPct(metrics.winRate)}</p>
          <p className="text-xs text-muted-foreground">
            {metrics.winningTrades}W / {metrics.losingTrades}L
          </p>
        </CardContent>
      </Card>

      <Card className="border-border/70 bg-card/80 backdrop-blur-xl">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="flex items-center gap-1.5 text-sm font-medium text-muted-foreground">
            Max drawdown
            <InfoTooltip content="Largest peak-to-trough decline on the portfolio equity curve." side="top" />
          </CardTitle>
          <Target className="h-4 w-4 text-primary" />
        </CardHeader>
        <CardContent>
          <p className="text-2xl font-semibold tabular-nums text-amber-400/90">
            {formatPct(metrics.drawdown * 100)}
          </p>
          <p className="text-xs text-muted-foreground">Peak-to-trough decline</p>
        </CardContent>
      </Card>

      <Card className="border-border/70 bg-card/80 backdrop-blur-xl">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="flex items-center gap-1.5 text-sm font-medium text-muted-foreground">
            Bots
            <InfoTooltip content="Bots assigned to this portfolio." side="top" />
          </CardTitle>
          <BotIcon className="h-4 w-4 text-primary" />
        </CardHeader>
        <CardContent>
          <p className="text-2xl font-semibold tabular-nums">{metrics.totalBots}</p>
          <p className="text-xs text-muted-foreground">
            {metrics.runningBots} running
          </p>
        </CardContent>
      </Card>

      <Card className="border-border/70 bg-card/80 backdrop-blur-xl">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="flex items-center gap-1.5 text-sm font-medium text-muted-foreground">
            Avg win
            <InfoTooltip content="Mean realized PnL on winning trades." side="top" />
          </CardTitle>
          <TrendingUp className="h-4 w-4 text-emerald-500/90" />
        </CardHeader>
        <CardContent>
          <p className="text-2xl font-semibold tabular-nums text-emerald-400/90">
            {metrics.avgWin === null ? '—' : formatPnl(metrics.avgWin)}
          </p>
          <p className="text-xs text-muted-foreground">Mean on winners</p>
        </CardContent>
      </Card>

      <Card className="border-border/70 bg-card/80 backdrop-blur-xl">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="flex items-center gap-1.5 text-sm font-medium text-muted-foreground">
            Avg loss
            <InfoTooltip content="Mean realized PnL on losing trades." side="top" />
          </CardTitle>
          <TrendingDown className="h-4 w-4 text-rose-500/90" />
        </CardHeader>
        <CardContent>
          <p className="text-2xl font-semibold tabular-nums text-rose-400/90">
            {metrics.avgLoss === null ? '—' : formatPnl(metrics.avgLoss)}
          </p>
          <p className="text-xs text-muted-foreground">Mean on losers</p>
        </CardContent>
      </Card>

      <Card className="border-border/70 bg-card/80 backdrop-blur-xl">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="flex items-center gap-1.5 text-sm font-medium text-muted-foreground">
            Balance
            <InfoTooltip content="Total initial vs current balance across all bots in this portfolio." side="top" />
          </CardTitle>
          <DollarSign className="h-4 w-4 text-primary" />
        </CardHeader>
        <CardContent>
          <p className="text-2xl font-semibold tabular-nums">
            {metrics.totalCurrentBalance.toLocaleString(undefined, {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2,
            })}
          </p>
          <p className="text-xs text-muted-foreground">
            Started at {metrics.totalInitialBalance.toLocaleString(undefined, { minimumFractionDigits: 2 })}
          </p>
        </CardContent>
      </Card>

      <Card className="border-border/70 bg-card/80 backdrop-blur-xl">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="flex items-center gap-1.5 text-sm font-medium text-muted-foreground">
            Total trades
            <InfoTooltip content="All closed trades in this portfolio." side="top" />
          </CardTitle>
          <History className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <p className="text-2xl font-semibold tabular-nums">{metrics.closedTrades}</p>
          <p className="text-xs text-muted-foreground">
            {metrics.winningTrades} winners · {metrics.losingTrades} losers
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
