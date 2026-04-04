'use client'

import { useEffect, useState } from 'react'
import { Loader2, Plus, Trash2 } from 'lucide-react'
import { useAuthStore } from '@/store/auth.store'
import { fetchInstruments } from '@/lib/api-client'
import { useHandleApiError } from '@/hooks/use-handle-api-error'
import { Instrument, MARKET_KLINE_INTERVALS } from '@/types'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { InfoTooltip } from '@/components/ui/info-tooltip'
import { optimizationTooltips } from '@/lib/tooltip-content'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

export interface ParamRange {
  param: string
  values: string // comma-separated
}

export interface OptimizationFormValues {
  symbol: string
  interval: string
  strategy: string
  fromDate: string
  toDate: string
  initialBalance: string
  paramRanges: ParamRange[]
  botId?: string
}

type Props = {
  onSubmit: (values: OptimizationFormValues) => Promise<void>
  submitting: boolean
  adminOnly?: boolean
}

const RSI_PARAMS = ['period', 'oversold', 'overbought']
const SMA_PARAMS = ['shortPeriod', 'longPeriod']

export function OptimizationForm({ onSubmit, submitting, adminOnly = false }: Props) {
  const token = useAuthStore((s) => s.token)
  const handleError = useHandleApiError()
  const [instruments, setInstruments] = useState<Instrument[]>([])
  const [loadingInstruments, setLoadingInstruments] = useState(true)

  const [symbol, setSymbol] = useState('')
  const [interval, setInterval] = useState('1h')
  const [strategy, setStrategy] = useState('rsi')
  const [fromDate, setFromDate] = useState(() => {
    const d = new Date()
    d.setDate(d.getDate() - 90)
    return d.toISOString().split('T')[0]
  })
  const [toDate, setToDate] = useState(() => new Date().toISOString().split('T')[0])
  const [initialBalance, setInitialBalance] = useState('10000')
  const [paramRanges, setParamRanges] = useState<ParamRange[]>([
    { param: 'period', values: '10,14,20' },
    { param: 'oversold', values: '20,30,40' },
    { param: 'overbought', values: '60,70,80' },
  ])

  useEffect(() => {
    if (!token || !adminOnly) return
    ;(async () => {
      setLoadingInstruments(true)
      try {
        const items = await fetchInstruments(token)
        setInstruments(items)
        if (items.length > 0 && !symbol) {
          setSymbol(items[0].symbol)
        }
      } catch (err) {
        handleError(err, 'Could not load instruments')
      } finally {
        setLoadingInstruments(false)
      }
    })()
  }, [token, handleError, symbol, adminOnly])

  function handleStrategyChange(s: string) {
    setStrategy(s)
    if (s === 'rsi') {
      setParamRanges([
        { param: 'period', values: '10,14,20' },
        { param: 'oversold', values: '20,30,40' },
        { param: 'overbought', values: '60,70,80' },
      ])
    } else {
      setParamRanges([
        { param: 'shortPeriod', values: '5,10,15' },
        { param: 'longPeriod', values: '20,30,50' },
      ])
    }
  }

  function addParamRange() {
    setParamRanges((prev) => [...prev, { param: 'period', values: '10,14,20' }])
  }

  function removeParamRange(index: number) {
    setParamRanges((prev) => prev.filter((_, i) => i !== index))
  }

  function updateParamRange(index: number, field: 'param' | 'values', value: string) {
    setParamRanges((prev) =>
      prev.map((p, i) => (i === index ? { ...p, [field]: value } : p)),
    )
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const values: OptimizationFormValues = {
      symbol,
      interval,
      strategy,
      fromDate,
      toDate,
      initialBalance,
      paramRanges,
    }
    await onSubmit(values)
  }

  const availableParams = strategy === 'rsi' ? RSI_PARAMS : SMA_PARAMS

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* ── Instrument + Strategy ─────────────────── */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="opt-symbol" className="inline-flex items-center gap-1">
            Instrument
            <InfoTooltip content={optimizationTooltips.instrument} side="top" />
          </Label>
          {adminOnly ? (
            loadingInstruments ? (
              <div className="flex h-10 items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-3.5 w-3.5 animate-spin" /> Loading…
              </div>
            ) : (
              <Select value={symbol} onValueChange={setSymbol}>
                <SelectTrigger id="opt-symbol">
                  <SelectValue placeholder="Select instrument" />
                </SelectTrigger>
                <SelectContent>
                  {instruments.map((inst) => (
                    <SelectItem key={inst.symbol} value={inst.symbol}>
                      {inst.displayName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )
          ) : (
            <Input
              id="opt-symbol"
              value={symbol}
              onChange={(e) => setSymbol(e.target.value.toUpperCase())}
              placeholder="e.g. BTCUSDT"
            />
          )}
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="opt-interval" className="inline-flex items-center gap-1">
            Timeframe
            <InfoTooltip content={optimizationTooltips.timeframe} side="top" />
          </Label>
          <Select value={interval} onValueChange={setInterval}>
            <SelectTrigger id="opt-interval">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {MARKET_KLINE_INTERVALS.map((iv) => (
                <SelectItem key={iv} value={iv}>
                  {iv}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="opt-strategy" className="inline-flex items-center gap-1">
            Strategy
            <InfoTooltip content={optimizationTooltips.strategy} side="top" />
          </Label>
          <Select value={strategy} onValueChange={handleStrategyChange}>
            <SelectTrigger id="opt-strategy">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="rsi">RSI</SelectItem>
              <SelectItem value="sma_crossover">SMA Crossover</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="opt-balance" className="inline-flex items-center gap-1">
            Initial Balance
            <InfoTooltip content={optimizationTooltips.initialBalance} side="top" />
          </Label>
          <Input
            id="opt-balance"
            type="number"
            min="0"
            step="any"
            value={initialBalance}
            onChange={(e) => setInitialBalance(e.target.value)}
          />
        </div>
      </div>

      {/* ── Date range ──────────────────────────── */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="opt-from" className="inline-flex items-center gap-1">
            From
            <InfoTooltip content={optimizationTooltips.fromDate} side="top" />
          </Label>
          <Input
            id="opt-from"
            type="date"
            value={fromDate}
            max={toDate}
            onChange={(e) => setFromDate(e.target.value)}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="opt-to" className="inline-flex items-center gap-1">
            To
            <InfoTooltip content={optimizationTooltips.toDate} side="top" />
          </Label>
          <Input
            id="opt-to"
            type="date"
            value={toDate}
            min={fromDate}
            onChange={(e) => setToDate(e.target.value)}
          />
        </div>
      </div>

      {/* ── Parameter ranges ─────────────────────── */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <Label className="inline-flex items-center gap-1">
            Parameter Ranges
            <InfoTooltip content={optimizationTooltips.parameterRanges} side="top" />
          </Label>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={addParamRange}
            className="gap-1"
          >
            <Plus className="h-3.5 w-3.5" />
            Add param
          </Button>
        </div>

        {paramRanges.map((range, idx) => (
          <div key={idx} className="flex items-center gap-2">
            <Select
              value={range.param}
              onValueChange={(v) => updateParamRange(idx, 'param', v)}
            >
              <SelectTrigger className="w-36">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {availableParams.map((p) => (
                  <SelectItem key={p} value={p}>
                    {p}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Input
              placeholder="e.g. 10,14,20,30"
              value={range.values}
              onChange={(e) => updateParamRange(idx, 'values', e.target.value)}
              className="flex-1"
            />
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={() => removeParamRange(idx)}
              disabled={paramRanges.length <= 1}
            >
              <Trash2 className="h-4 w-4 text-destructive" />
            </Button>
          </div>
        ))}

        <p className="text-xs text-muted-foreground">
          Enter comma-separated values for each parameter. All combinations will be tested.
        </p>
      </div>

      <Button
        type="submit"
        disabled={submitting || loadingInstruments || paramRanges.length === 0}
        className="w-full"
      >
        {submitting ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Optimization queued…
          </>
        ) : (
          <>
            Run Optimization
            <span className="ml-1.5 inline-flex">
              <InfoTooltip content={optimizationTooltips.runOptimization} side="top" />
            </span>
          </>
        )}
      </Button>
    </form>
  )
}
