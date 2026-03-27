'use client'

import { useState } from 'react'
import { Loader2, Zap, X } from 'lucide-react'
import { useAuthStore } from '@/store/auth.store'
import { previewBacktest } from '@/lib/api-client'
import { useHandleApiError } from '@/hooks/use-handle-api-error'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import type { BacktestResult } from '@/types'

type Props = {
  symbol: string
  interval: string
  strategy: string
  params: Record<string, unknown>
}

function fmtPct(value: number | null) {
  if (value === null) return '—'
  return `${(value * 100).toFixed(1)}%`
}

function fmtPnl(value: number) {
  const abs = Math.abs(value).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  if (value > 0) return `+$${abs}`
  if (value < 0) return `−$${abs}`
  return `$${abs}`
}

export function StrategyPreview({ symbol, interval, strategy, params }: Props) {
  const token = useAuthStore((s) => s.token)
  const handleError = useHandleApiError()
  const [previewing, setPreviewing] = useState(false)
  const [result, setResult] = useState<BacktestResult | null>(null)
  const [previewError, setPreviewError] = useState<string | null>(null)

  async function runPreview() {
    if (!token) return
    setPreviewing(true)
    setPreviewError(null)
    setResult(null)
    try {
      const res = await previewBacktest(token, { symbol, interval, strategy, params })
      setResult(res.result)
    } catch (err) {
      setPreviewError(err instanceof Error ? err.message : 'Preview failed')
      handleError(err, 'Strategy preview')
    } finally {
      setPreviewing(false)
    }
  }

  return (
    <div className="relative">
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={runPreview}
        disabled={previewing}
        className="gap-1.5"
      >
        {previewing ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
        ) : (
          <Zap className="h-3.5 w-3.5" />
        )}
        Preview strategy
      </Button>

      {(result || previewError) && (
        <div className="absolute right-0 top-full z-10 mt-2 w-80">
          <Card className="border-border/80 bg-card/95 shadow-xl backdrop-blur-xl">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Strategy Preview</CardTitle>
              <Button
                variant="ghost"
                size="icon"
                className="h-5 w-5"
                onClick={() => { setResult(null); setPreviewError(null) }}
              >
                <X className="h-3.5 w-3.5" />
              </Button>
            </CardHeader>
            <CardContent className="space-y-3">
              {previewError ? (
                <p className="text-xs text-destructive">{previewError}</p>
              ) : result ? (
                <>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="rounded-md bg-muted/50 p-2 text-center">
                      <p className="text-xs text-muted-foreground">Win Rate</p>
                      <p className="text-sm font-semibold tabular-nums">
                        {fmtPct(result.metrics.winRate)}
                      </p>
                    </div>
                    <div className="rounded-md bg-muted/50 p-2 text-center">
                      <p className="text-xs text-muted-foreground">Total P&amp;L</p>
                      <p className={`text-sm font-semibold tabular-nums ${result.metrics.totalPnl >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                        {fmtPnl(result.metrics.totalPnl)}
                      </p>
                    </div>
                    <div className="rounded-md bg-muted/50 p-2 text-center">
                      <p className="text-xs text-muted-foreground">Trades</p>
                      <p className="text-sm font-semibold tabular-nums">{result.metrics.totalTrades}</p>
                    </div>
                    <div className="rounded-md bg-muted/50 p-2 text-center">
                      <p className="text-xs text-muted-foreground">W / L</p>
                      <p className="text-sm font-semibold tabular-nums">
                        {result.metrics.winningTrades}W / {result.metrics.losingTrades}L
                      </p>
                    </div>
                  </div>

                  {result.trades.filter(t => t.exitTime !== null).length > 0 && (
                    <div>
                      <p className="mb-1.5 text-xs font-medium text-muted-foreground">Sample trades (last 5)</p>
                      <div className="space-y-1">
                        {result.trades
                          .filter(t => t.exitTime !== null)
                          .slice(-5)
                          .map((t) => {
                            const pnl = t.pnl ?? 0
                            return (
                              <div key={t.id} className="flex items-center justify-between rounded-md bg-muted/30 px-2 py-1">
                                <span className="text-xs text-muted-foreground">
                                  {new Date(t.entryTime).toLocaleDateString()}
                                </span>
                                <div className="flex items-center gap-2">
                                  <Badge variant="outline" className="text-xs">
                                    {t.closeReason ?? '—'}
                                  </Badge>
                                  <span className={`text-xs font-medium tabular-nums ${pnl >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                                    {fmtPnl(pnl)}
                                  </span>
                                </div>
                              </div>
                            )
                          })}
                      </div>
                    </div>
                  )}

                  {result.metrics.totalTrades === 0 && (
                    <p className="text-xs text-muted-foreground">
                      No trades on last 100 candles — try a longer timeframe.
                    </p>
                  )}
                </>
              ) : null}
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  )
}
