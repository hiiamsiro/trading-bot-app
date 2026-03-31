'use client'

import { useState } from 'react'
import { useAuthStore } from '@/store/auth.store'
import { runBacktest } from '@/lib/api-client'
import { useHandleApiError } from '@/hooks/use-handle-api-error'
import { toast } from '@/hooks/use-toast'
import { BacktestForm } from '@/components/backtest/backtest-form'
import { BacktestResults } from '@/components/backtest/backtest-results'
import type { BacktestResult } from '@/types'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'

export default function BacktestPage() {
  const token = useAuthStore((s) => s.token)
  const handleError = useHandleApiError()
  const [result, setResult] = useState<BacktestResult | null>(null)
  const [backtestId, setBacktestId] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  async function handleSubmit(values: {
    symbol: string
    interval: string
    strategy: string
    fromDate: string
    toDate: string
    initialBalance: string
    shortPeriod: string
    longPeriod: string
    rsiPeriod: string
    oversold: string
    overbought: string
    quantity: string
    stopLossPercent: string
    takeProfitPercent: string
    maxDailyLoss: string
  }) {
    if (!token) return
    setSubmitting(true)
    setResult(null)

    const params: Record<string, unknown> = {}
    if (values.strategy === 'sma_crossover') {
      Object.assign(params, {
        shortPeriod: parseInt(values.shortPeriod, 10),
        longPeriod: parseInt(values.longPeriod, 10),
        quantity: parseFloat(values.quantity) || 0.01,
      })
    } else {
      Object.assign(params, {
        period: parseInt(values.rsiPeriod, 10),
        oversold: parseFloat(values.oversold),
        overbought: parseFloat(values.overbought),
        quantity: parseFloat(values.quantity) || 0.01,
      })
    }

    if (values.stopLossPercent) params.stopLossPercent = parseFloat(values.stopLossPercent)
    if (values.takeProfitPercent) params.takeProfitPercent = parseFloat(values.takeProfitPercent)
    if (values.maxDailyLoss) params.maxDailyLoss = parseFloat(values.maxDailyLoss)

    const payload = {
      symbol: values.symbol,
      interval: values.interval,
      strategy: values.strategy,
      params,
      fromDate: values.fromDate,
      toDate: values.toDate,
      initialBalance: parseFloat(values.initialBalance) || 10000,
    }

    try {
      const res = await runBacktest(token, payload)
      setBacktestId(res.id)
      setResult(res.result)
      const pnl = res.result.metrics.totalPnl
      toast({
        title: 'Backtest complete',
        description: `${res.result.metrics.totalTrades} trades · ${pnl >= 0 ? '+' : '−'}$${Math.abs(pnl).toFixed(2)} P&L`,
      })
    } catch (err) {
      handleError(err, 'Backtest failed')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Backtest</h1>
        <p className="text-sm text-muted-foreground">
          Simulate a strategy against historical market data before running it live.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* ── Form ──────────────────────────────── */}
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle>Configuration</CardTitle>
            <CardDescription>Select instrument, strategy, and date range.</CardDescription>
          </CardHeader>
          <CardContent>
            <BacktestForm onSubmit={handleSubmit} submitting={submitting} />
          </CardContent>
        </Card>

        {/* ── Results ───────────────────────────── */}
        <div className="lg:col-span-2">
          {result ? (
            <BacktestResults result={result} backtestId={backtestId ?? undefined} token={token ?? undefined} />
          ) : (
            <Card className="flex h-full min-h-96 items-center justify-center">
              <CardContent className="text-center text-sm text-muted-foreground">
                Configure your backtest and click <strong>Run Backtest</strong> to see results.
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  )
}
