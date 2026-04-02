'use client'

import { useEffect, useState } from 'react'
import { CheckCircle2, XCircle, TrendingUp, TrendingDown } from 'lucide-react'
import { useAuthStore } from '@/store/auth.store'
import type { WalkforwardRecord, WalkforwardMetrics } from '@/lib/api-client'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { EquityCurveChart } from '@/components/charts/equity-curve-chart'

type Props = {
  record: WalkforwardRecord
  onApplyBest: (params: Record<string, unknown>) => void
}

function fmt(value: number, decimals = 2) {
  return value.toLocaleString(undefined, { minimumFractionDigits: decimals, maximumFractionDigits: decimals })
}

function fmtPnl(value: number | null) {
  if (value === null) return '—'
  const abs = Math.abs(value).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  if (value > 0) return `+$${abs}`
  if (value < 0) return `−$${abs}`
  return `$${abs}`
}

function fmtPct(value: number | null) {
  if (value === null) return '—'
  return `${(value * 100).toFixed(1)}%`
}

function MetricsCard({ label, metrics, pnl, drawdown, winRate }: {
  label: string
  metrics: WalkforwardMetrics | null
  pnl: number | null
  drawdown: number | null
  winRate: number | null
}) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium">{label}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-xs text-muted-foreground">PnL</span>
          <span className={`text-sm font-bold tabular-nums ${(pnl ?? 0) >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
            {fmtPnl(pnl)}
          </span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-xs text-muted-foreground">Drawdown</span>
          <span className="text-sm tabular-nums text-red-400">
            {fmtPct(drawdown)}
          </span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-xs text-muted-foreground">Win Rate</span>
          <span className="text-sm tabular-nums">
            {fmtPct(winRate)}
          </span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-xs text-muted-foreground">Trades</span>
          <span className="text-sm tabular-nums">
            {metrics?.totalTrades ?? 0}
          </span>
        </div>
        {metrics && (
          <>
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground">W / L</span>
              <span className="text-xs tabular-nums">
                {metrics.winningTrades}W / {metrics.losingTrades}L
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground">Final Balance</span>
              <span className="text-xs tabular-nums">
                ${fmt(metrics.finalBalance)}
              </span>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  )
}

export function WalkforwardResults({ record: initialRecord, onApplyBest }: Props) {
  const token = useAuthStore((s) => s.token)
  const [liveRecord, setLiveRecord] = useState<WalkforwardRecord>(initialRecord)

  // Poll for updates if still running
  useEffect(() => {
    if (liveRecord.status !== 'RUNNING' && liveRecord.status !== 'PENDING') return

    const interval = setInterval(async () => {
      try {
        const res = await fetch(`/api/walkforward/${liveRecord.id}`, {
          headers: {
            Authorization: `Bearer ${token}`,
            'Cache-Control': 'no-store',
          },
        })
        if (res.ok) {
          const data: WalkforwardRecord = await res.json()
          setLiveRecord(data)
          if (data.status === 'COMPLETED' || data.status === 'FAILED') {
            clearInterval(interval)
          }
        }
      } catch {
        // ignore
      }
    }, 5000)

    return () => clearInterval(interval)
  }, [liveRecord.id, liveRecord.status, token])

  const trainIsPositive = (liveRecord.trainPnl ?? 0) >= 0
  const testIsPositive = (liveRecord.testPnl ?? 0) >= 0

  return (
    <div className="space-y-6">
      {/* ── Status ─────────────────────────── */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base">
              Walk-Forward #{liveRecord.id.slice(0, 8)}
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
          {liveRecord.error && (
            <p className="mt-1 text-xs text-destructive">{liveRecord.error}</p>
          )}
          <div className="mt-2 flex gap-4 text-xs text-muted-foreground">
            <span>Split: {liveRecord.trainSplitPct}% train / {100 - liveRecord.trainSplitPct}% test</span>
            <span>Strategy: {liveRecord.strategy}</span>
          </div>
        </CardHeader>
      </Card>

      {/* ── Train vs Test comparison ─────────── */}
      {liveRecord.status === 'COMPLETED' && liveRecord.trainMetrics && liveRecord.testMetrics && (
        <>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <MetricsCard
              label="Training Data"
              metrics={liveRecord.trainMetrics}
              pnl={liveRecord.trainPnl}
              drawdown={liveRecord.trainDrawdown}
              winRate={liveRecord.trainWinRate}
            />
            <MetricsCard
              label="Testing Data"
              metrics={liveRecord.testMetrics}
              pnl={liveRecord.testPnl}
              drawdown={liveRecord.testDrawdown}
              winRate={liveRecord.testWinRate}
            />
          </div>

          {/* ── Comparison summary ───────────────── */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Train vs Test Comparison</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {/* PnL */}
                <div className="flex items-center gap-3">
                  <span className="w-20 text-xs text-muted-foreground">PnL</span>
                  <div className="flex flex-1 items-center gap-2">
                    <div className={`flex items-center gap-1 flex-1 ${trainIsPositive ? 'text-emerald-400' : 'text-red-400'}`}>
                      {trainIsPositive ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                      <span className="text-xs font-medium">{fmtPnl(liveRecord.trainPnl)}</span>
                    </div>
                    <div className={`flex items-center gap-1 flex-1 ${testIsPositive ? 'text-emerald-400' : 'text-red-400'}`}>
                      {testIsPositive ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                      <span className="text-xs font-medium">{fmtPnl(liveRecord.testPnl)}</span>
                    </div>
                  </div>
                </div>
                {/* Performance drop */}
                {liveRecord.trainPnl !== null && liveRecord.testPnl !== null && liveRecord.trainPnl !== 0 && (
                  <div className="flex items-center gap-3">
                    <span className="w-20 text-xs text-muted-foreground">Degradation</span>
                    <div className="flex-1">
                      {(() => {
                        const deg = ((liveRecord.testPnl! - liveRecord.trainPnl!) / Math.abs(liveRecord.trainPnl!)) * 100
                        const cls = deg > 20 ? 'text-red-400' : deg > 0 ? 'text-emerald-400' : 'text-yellow-400'
                        return <span className={`text-xs font-medium ${cls}`}>{deg >= 0 ? '+' : ''}{deg.toFixed(1)}%</span>
                      })()}
                    </div>
                  </div>
                )}

                {/* Best params */}
                {liveRecord.bestTrainParams && (
                  <div className="flex items-center gap-3">
                    <span className="w-20 text-xs text-muted-foreground">Best params</span>
                    <code className="flex-1 text-xs font-mono text-muted-foreground">
                      {Object.entries(liveRecord.bestTrainParams).map(([k, v]) => `${k}=${v}`).join(' · ')}
                    </code>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* ── Equity curves ──────────────────── */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Training Equity Curve</CardTitle>
              </CardHeader>
              <CardContent>
                {liveRecord.trainEquityCurve && liveRecord.trainEquityCurve.length > 1 ? (
                  <EquityCurveChart
                    points={liveRecord.trainEquityCurve}
                    height={200}
                  />
                ) : (
                  <div className="flex h-40 items-center justify-center text-xs text-muted-foreground">
                    No training equity data
                  </div>
                )}
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Testing Equity Curve</CardTitle>
              </CardHeader>
              <CardContent>
                {liveRecord.testEquityCurve && liveRecord.testEquityCurve.length > 1 ? (
                  <EquityCurveChart
                    points={liveRecord.testEquityCurve}
                    height={200}
                  />
                ) : (
                  <div className="flex h-40 items-center justify-center text-xs text-muted-foreground">
                    No testing equity data
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* ── Apply best config ─────────────── */}
          <Card>
            <CardContent className="pt-4">
              <button
                onClick={() => liveRecord.bestTrainParams && onApplyBest(liveRecord.bestTrainParams)}
                className="w-full rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
              >
                Apply Best Training Config to Bot
              </button>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  )
}
