'use client'

import { useState } from 'react'
import { useEffect } from 'react'
import { CheckCircle2, XCircle, ExternalLink } from 'lucide-react'
import { useAuthStore } from '@/store/auth.store'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { InfoTooltip } from '@/components/ui/info-tooltip'
import { optimizationTooltips } from '@/lib/tooltip-content'
import { toast } from '@/hooks/use-toast'

export type OptimizationResult = {
  params: Record<string, unknown>
  metrics: {
    totalTrades: number
    winningTrades: number
    losingTrades: number
    winRate: number | null
    totalPnl: number
    maxDrawdown: number
    initialBalance: number
    finalBalance: number
    averageWin: number | null
    averageLoss: number | null
  }
}

export type OptimizationRecord = {
  id: string
  symbol: string
  interval: string
  strategy: string
  paramRanges: { param: string; values: number[] }[]
  status: string
  progress: number
  totalCombinations: number
  completedCombinations: number
  bestByPnl: OptimizationResult | null
  bestByDrawdown: OptimizationResult | null
  bestByWinrate: OptimizationResult | null
  allResults: OptimizationResult[]
  error: string | null
  createdAt: string
}

type Props = {
  record: OptimizationRecord
  onApplyBest: (params: Record<string, unknown>) => void
}

function fmt(value: number, decimals = 2) {
  return value.toLocaleString(undefined, { minimumFractionDigits: decimals, maximumFractionDigits: decimals })
}

function fmtPnl(value: number) {
  const abs = Math.abs(value).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  if (value > 0) return `+$${abs}`
  if (value < 0) return `−$${abs}`
  return `$${abs}`
}

function fmtPct(value: number | null) {
  if (value === null) return '—'
  return `${(value * 100).toFixed(1)}%`
}

function MetricsRow({ label, result, highlight, tooltip }: {
  label: string
  result: OptimizationResult | null
  highlight?: boolean
  tooltip?: string
}) {
  if (!result) return (
    <div className="flex items-center justify-between py-1">
      <span className="text-xs text-muted-foreground flex items-center gap-1">
        {label}
        {tooltip && <InfoTooltip content={tooltip} side="top" />}
      </span>
      <span className="text-xs text-muted-foreground">—</span>
    </div>
  )
  return (
    <div className={`flex items-center justify-between py-1 ${highlight ? 'bg-primary/10 rounded px-2 -mx-2' : ''}`}>
      <span className="text-xs font-medium flex items-center gap-1">
        {label}
        {tooltip && <InfoTooltip content={tooltip} side="top" />}
      </span>
      <div className="flex gap-3 text-xs">
        <span className={result.metrics.totalPnl >= 0 ? 'text-emerald-400' : 'text-red-400'}>
          {fmtPnl(result.metrics.totalPnl)}
        </span>
        <span className="text-muted-foreground">DD {fmtPct(result.metrics.maxDrawdown)}</span>
        <span className="text-muted-foreground">WR {fmtPct(result.metrics.winRate)}</span>
        <span className="text-muted-foreground">#{result.metrics.totalTrades}</span>
      </div>
    </div>
  )
}

export function OptimizationResults({ record, onApplyBest }: Props) {
  const token = useAuthStore((s) => s.token)
  const [liveRecord, setLiveRecord] = useState<OptimizationRecord>(record)
  const [activeTab, setActiveTab] = useState<'pnl' | 'drawdown' | 'winrate'>('pnl')
  const [applying, setApplying] = useState(false)

  // Poll for updates if still running
  useEffect(() => {
    if (liveRecord.status !== 'RUNNING' && liveRecord.status !== 'PENDING') return
    const interval = setInterval(async () => {
      try {
        const res = await fetch(`/api/optimization/${liveRecord.id}`, {
          headers: {
            Authorization: `Bearer ${token}`,
            'Cache-Control': 'no-store',
          },
        })
        if (res.ok) {
          const data = await res.json()
          setLiveRecord(data)
          if (data.status === 'COMPLETED' || data.status === 'FAILED') {
            clearInterval(interval)
          }
        }
      } catch {
        // ignore
      }
    }, 3000)
    return () => clearInterval(interval)
  }, [liveRecord.id, liveRecord.status, token])

  const bestResult = activeTab === 'pnl'
    ? liveRecord.bestByPnl
    : activeTab === 'drawdown'
      ? liveRecord.bestByDrawdown
      : liveRecord.bestByWinrate

  const sortedResults = liveRecord.allResults
    ? [...liveRecord.allResults].sort((a, b) => {
        if (activeTab === 'pnl') return b.metrics.totalPnl - a.metrics.totalPnl
        if (activeTab === 'drawdown') return a.metrics.maxDrawdown - b.metrics.maxDrawdown
        return (b.metrics.winRate ?? -1) - (a.metrics.winRate ?? -1)
      })
    : []

  function handleApply() {
    if (!bestResult) return
    setApplying(true)
    onApplyBest(bestResult.params)
    setTimeout(() => setApplying(false), 1000)
  }

  return (
    <div className="space-y-6">
      {/* ── Status + Progress ─────────────────────── */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base flex items-center gap-1.5">
              Optimization #{liveRecord.id.slice(0, 8)}
              <InfoTooltip content={optimizationTooltips.optimizationStatus} side="top" />
            </CardTitle>
            <Badge
              variant={
                liveRecord.status === 'COMPLETED' ? 'default' :
                liveRecord.status === 'FAILED' ? 'destructive' :
                'secondary'
              }
            >
              {liveRecord.status === 'COMPLETED' && <CheckCircle2 className="mr-1 h-3 w-3" />}
              {liveRecord.status === 'FAILED' && <XCircle className="mr-1 h-3 w-3" />}
              {liveRecord.status}
            </Badge>
          </div>

          {liveRecord.status === 'RUNNING' || liveRecord.status === 'PENDING' ? (
            <div className="mt-2">
              <div className="flex items-center justify-between text-xs text-muted-foreground mb-1">
                <span className="inline-flex items-center gap-1">
                  {liveRecord.completedCombinations} / {liveRecord.totalCombinations} combinations
                  <InfoTooltip content={optimizationTooltips.progress} side="top" />
                </span>
                <span>{liveRecord.progress}%</span>
              </div>
              <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full bg-primary transition-all duration-500"
                  style={{ width: `${liveRecord.progress}%` }}
                />
              </div>
            </div>
          ) : liveRecord.status === 'FAILED' ? (
            <p className="mt-1 text-xs text-destructive">{liveRecord.error}</p>
          ) : null}
        </CardHeader>
      </Card>

      {/* ── Rank tabs ─────────────────────────── */}
      {liveRecord.status === 'COMPLETED' && liveRecord.allResults && liveRecord.allResults.length > 0 && (
        <>
          <div className="flex gap-1">
            {(['pnl', 'drawdown', 'winrate'] as const).map((tab) => (
              <Button
                key={tab}
                variant={activeTab === tab ? 'default' : 'outline'}
                size="sm"
                onClick={() => setActiveTab(tab)}
              >
                <span className="inline-flex items-center gap-1">
                  Best by {tab === 'pnl' ? 'PnL' : tab === 'drawdown' ? 'Drawdown' : 'Win Rate'}
                  <InfoTooltip
                    content={
                      tab === 'pnl' ? optimizationTooltips.bestByPnl :
                      tab === 'drawdown' ? optimizationTooltips.bestByDrawdown :
                      optimizationTooltips.bestByWinrate
                    }
                    side="top"
                  />
                </span>
              </Button>
            ))}
          </div>

          {/* ── Best config card ──────────────────── */}
          {bestResult && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-1">
                  Best Configuration
                  <InfoTooltip content={optimizationTooltips.bestConfiguration} side="top" />
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="rounded-md bg-muted/50 p-3">
                  <p className="text-xs font-mono leading-relaxed">
                    {Object.entries(bestResult.params)
                      .map(([k, v]) => `${k}=${v}`)
                      .join(' · ')}
                  </p>
                </div>
                <div className="space-y-0.5">
                  <MetricsRow label="Total P&L" result={bestResult} highlight tooltip={optimizationTooltips.totalPnl} />
                  <MetricsRow label="Max Drawdown" result={bestResult} tooltip={optimizationTooltips.maxDrawdown} />
                  <MetricsRow label="Win Rate" result={bestResult} tooltip={optimizationTooltips.winRate} />
                  <MetricsRow label="Total Trades" result={bestResult} tooltip={optimizationTooltips.totalTrades} />
                  <MetricsRow label="Avg Win / Loss" result={bestResult} tooltip={optimizationTooltips.avgWinLoss} />
                </div>
                <div className="flex items-center justify-between">
                  <InfoTooltip content={optimizationTooltips.applyToBot} side="top" />
                  <Button onClick={handleApply} disabled={applying} size="sm" className="gap-1.5">
                    <ExternalLink className="h-3.5 w-3.5" />
                    Apply to Bot
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {/* ── Full results table ────────────────── */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <span>All Results ({sortedResults.length})</span>
                <InfoTooltip content={optimizationTooltips.allResults} side="top" />
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="max-h-96 overflow-auto">
                <table className="w-full caption-bottom text-sm min-w-max">
                  <TableHeader>
                    <TableRow>
                      <TableHead>#</TableHead>
                      <TableHead>Parameters</TableHead>
                      <TableHead className="text-right">
                        <span className="inline-flex items-center gap-1">
                          PnL
                          <InfoTooltip content={optimizationTooltips.pnlColumn} side="top" />
                        </span>
                      </TableHead>
                      <TableHead className="text-right">
                        <span className="inline-flex items-center gap-1">
                          Drawdown
                          <InfoTooltip content={optimizationTooltips.drawdownColumn} side="top" />
                        </span>
                      </TableHead>
                      <TableHead className="text-right">
                        <span className="inline-flex items-center gap-1">
                          Win Rate
                          <InfoTooltip content={optimizationTooltips.winRateColumn} side="top" />
                        </span>
                      </TableHead>
                      <TableHead className="text-right">
                        <span className="inline-flex items-center gap-1">
                          Trades
                          <InfoTooltip content={optimizationTooltips.tradesColumn} side="top" />
                        </span>
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {sortedResults.map((r, i) => (
                      <TableRow
                        key={i}
                        className={i === 0 && activeTab === 'pnl' ? 'bg-emerald-500/10' :
                                  i === 0 && activeTab === 'drawdown' ? 'bg-emerald-500/10' :
                                  i === 0 && activeTab === 'winrate' ? 'bg-emerald-500/10' : ''}
                      >
                        <TableCell>
                          <Badge variant="outline" className="text-xs">{i + 1}</Badge>
                        </TableCell>
                        <TableCell className="text-xs font-mono max-w-48 truncate">
                          {Object.entries(r.params).map(([k, v]) => `${k}:${v}`).join(' · ')}
                        </TableCell>
                        <TableCell className={`text-right tabular-nums text-xs font-medium ${r.metrics.totalPnl >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                          {fmtPnl(r.metrics.totalPnl)}
                        </TableCell>
                        <TableCell className="text-right tabular-nums text-xs text-red-400">
                          {fmtPct(r.metrics.maxDrawdown)}
                        </TableCell>
                        <TableCell className="text-right tabular-nums text-xs">
                          {fmtPct(r.metrics.winRate)}
                        </TableCell>
                        <TableCell className="text-right tabular-nums text-xs">
                          {r.metrics.totalTrades}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </table>
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  )
}
