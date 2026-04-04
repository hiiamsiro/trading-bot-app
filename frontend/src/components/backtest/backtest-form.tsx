'use client'

import { useEffect, useState } from 'react'
import { Loader2 } from 'lucide-react'
import { useAuthStore } from '@/store/auth.store'
import { fetchInstruments } from '@/lib/api-client'
import { useHandleApiError } from '@/hooks/use-handle-api-error'
import { Instrument, MARKET_KLINE_INTERVALS } from '@/types'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { InfoTooltip } from '@/components/ui/info-tooltip'
import { backtestTooltips } from '@/lib/tooltip-content'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

export interface BacktestFormValues {
  symbol: string
  interval: string
  strategy: string
  fromDate: string
  toDate: string
  initialBalance: string
  // sma params
  shortPeriod: string
  longPeriod: string
  // rsi params
  rsiPeriod: string
  oversold: string
  overbought: string
  // multi-timeframe
  trendInterval: string
  // position sizing
  positionSizeMode: 'fixed' | 'balance_percent' | 'risk_based'
  quantity: string
  riskPercent: string
  // exit strategies
  trailingStopDistance: string
  partialTpPercent: string
  stopLossPercent: string
  takeProfitPercent: string
  maxDailyLoss: string
}

type Props = {
  onSubmit: (values: BacktestFormValues) => Promise<void>
  submitting: boolean
  adminOnly?: boolean
}

export function BacktestForm({ onSubmit, submitting, adminOnly = false }: Props) {
  const token = useAuthStore((s) => s.token)
  const handleError = useHandleApiError()
  const [instruments, setInstruments] = useState<Instrument[]>([])
  const [loadingInstruments, setLoadingInstruments] = useState(true)

  const [symbol, setSymbol] = useState('')
  const [interval, setInterval] = useState('1h')
  const [strategy, setStrategy] = useState('sma_crossover')
  const [fromDate, setFromDate] = useState(() => {
    const d = new Date()
    d.setDate(d.getDate() - 30)
    return d.toISOString().split('T')[0]
  })
  const [toDate, setToDate] = useState(() => new Date().toISOString().split('T')[0])
  const [initialBalance, setInitialBalance] = useState('10000')
  const [shortPeriod, setShortPeriod] = useState('10')
  const [longPeriod, setLongPeriod] = useState('20')
  const [rsiPeriod, setRsiPeriod] = useState('14')
  const [oversold, setOversold] = useState('30')
  const [overbought, setOverbought] = useState('70')
  const [quantity, setQuantity] = useState('0.01')
  const [positionSizeMode, setPositionSizeMode] = useState<'fixed' | 'balance_percent' | 'risk_based'>('fixed')
  const [riskPercent, setRiskPercent] = useState('1')
  const [stopLossPercent, setStopLossPercent] = useState('')
  const [takeProfitPercent, setTakeProfitPercent] = useState('')
  const [maxDailyLoss, setMaxDailyLoss] = useState('')
  const [trendInterval, setTrendInterval] = useState('')
  const [trailingStopDistance, setTrailingStopDistance] = useState('')
  const [partialTpPercent, setPartialTpPercent] = useState('')

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

  function buildParams(): Record<string, unknown> {
    const activeTrend = trendInterval && trendInterval !== '__none__' ? trendInterval : undefined
    const base = {
      positionSizeMode,
      quantity: parseFloat(quantity),
      ...(stopLossPercent ? { stopLossPercent: parseFloat(stopLossPercent) } : {}),
      ...(takeProfitPercent ? { takeProfitPercent: parseFloat(takeProfitPercent) } : {}),
      ...(maxDailyLoss ? { maxDailyLoss: parseFloat(maxDailyLoss) } : {}),
      ...(trailingStopDistance ? { trailingStopDistance: parseFloat(trailingStopDistance) } : {}),
      ...(partialTpPercent ? { partialTpPercent: parseFloat(partialTpPercent) } : {}),
      interval,
      ...(activeTrend ? { trendInterval: activeTrend } : {}),
    }
    if (positionSizeMode === 'risk_based') {
      return { ...base, quantity: parseFloat(riskPercent) }
    }
    if (strategy === 'sma_crossover') {
      return {
        ...base,
        shortPeriod: parseInt(shortPeriod, 10),
        longPeriod: parseInt(longPeriod, 10),
      }
    }
    return {
      ...base,
      period: parseInt(rsiPeriod, 10),
      oversold: parseFloat(oversold),
      overbought: parseFloat(overbought),
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!token) return
    const values: BacktestFormValues = {
      symbol,
      interval,
      strategy,
      fromDate,
      toDate,
      initialBalance,
      shortPeriod,
      longPeriod,
      rsiPeriod,
      oversold,
      overbought,
      trendInterval,
      positionSizeMode,
      quantity,
      riskPercent,
      stopLossPercent,
      takeProfitPercent,
      maxDailyLoss,
      trailingStopDistance,
      partialTpPercent,
    }
    await onSubmit(values)
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* ── Core params ─────────────────────────── */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="symbol" className="inline-flex items-center gap-1">
            Instrument
            <InfoTooltip content={backtestTooltips.instrument} side="top" />
          </Label>
          {adminOnly ? (
            loadingInstruments ? (
              <div className="flex h-10 items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-3.5 w-3.5 animate-spin" /> Loading…
              </div>
            ) : (
              <Select value={symbol} onValueChange={setSymbol}>
                <SelectTrigger id="symbol">
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
              id="symbol"
              value={symbol}
              onChange={(e) => setSymbol(e.target.value.toUpperCase())}
              placeholder="e.g. BTCUSDT"
            />
          )}
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="interval" className="inline-flex items-center gap-1">
            Timeframe
            <InfoTooltip content={backtestTooltips.timeframe} side="top" />
          </Label>
          <Select value={interval} onValueChange={setInterval}>
            <SelectTrigger id="interval">
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
          <Label htmlFor="trendInterval" className="inline-flex items-center gap-1">
            Trend timeframe (optional)
            <InfoTooltip content={backtestTooltips.trendTimeframe} side="top" />
          </Label>
          <Select value={trendInterval} onValueChange={setTrendInterval}>
            <SelectTrigger id="trendInterval">
              <SelectValue placeholder="None (single TF)" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__none__">None (single TF)</SelectItem>
              {MARKET_KLINE_INTERVALS.map((iv) => (
                <SelectItem key={iv} value={iv}>
                  {iv}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="strategy" className="inline-flex items-center gap-1">
            Strategy
            <InfoTooltip content={backtestTooltips.strategy} side="top" />
          </Label>
          <Select value={strategy} onValueChange={setStrategy}>
            <SelectTrigger id="strategy">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="sma_crossover">SMA Crossover</SelectItem>
              <SelectItem value="rsi">RSI</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="initialBalance" className="inline-flex items-center gap-1">
            Initial Balance
            <InfoTooltip content={backtestTooltips.initialBalance} side="top" />
          </Label>
          <Input
            id="initialBalance"
            type="number"
            min="0"
            step="any"
            value={initialBalance}
            onChange={(e) => setInitialBalance(e.target.value)}
            placeholder="10000"
          />
        </div>
      </div>

      {/* ── Date range ──────────────────────────── */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="fromDate" className="inline-flex items-center gap-1">
            From
            <InfoTooltip content={backtestTooltips.fromDate} side="top" />
          </Label>
          <Input
            id="fromDate"
            type="date"
            value={fromDate}
            max={toDate}
            onChange={(e) => setFromDate(e.target.value)}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="toDate" className="inline-flex items-center gap-1">
            To
            <InfoTooltip content={backtestTooltips.toDate} side="top" />
          </Label>
          <Input
            id="toDate"
            type="date"
            value={toDate}
            min={fromDate}
            onChange={(e) => setToDate(e.target.value)}
          />
        </div>
      </div>

      {/* ── Strategy-specific params ───────────── */}
      {strategy === 'sma_crossover' ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div className="space-y-1.5">
            <Label htmlFor="shortPeriod" className="inline-flex items-center gap-1">
              Short Period
              <InfoTooltip content={backtestTooltips.shortPeriod} side="top" />
            </Label>
            <Input
              id="shortPeriod"
              type="number"
              min="1"
              value={shortPeriod}
              onChange={(e) => setShortPeriod(e.target.value)}
              placeholder="10"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="longPeriod" className="inline-flex items-center gap-1">
              Long Period
              <InfoTooltip content={backtestTooltips.longPeriod} side="top" />
            </Label>
            <Input
              id="longPeriod"
              type="number"
              min="2"
              value={longPeriod}
              onChange={(e) => setLongPeriod(e.target.value)}
              placeholder="20"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="quantity" className="inline-flex items-center gap-1">
              Quantity
              <InfoTooltip content={backtestTooltips.quantity} side="top" />
            </Label>
            <Input
              id="quantity"
              type="number"
              min="0"
              step="any"
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
              placeholder="0.01"
            />
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-4">
          <div className="space-y-1.5">
            <Label htmlFor="rsiPeriod" className="inline-flex items-center gap-1">
              RSI Period
              <InfoTooltip content={backtestTooltips.rsiPeriod} side="top" />
            </Label>
            <Input
              id="rsiPeriod"
              type="number"
              min="2"
              value={rsiPeriod}
              onChange={(e) => setRsiPeriod(e.target.value)}
              placeholder="14"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="oversold" className="inline-flex items-center gap-1">
              Oversold
              <InfoTooltip content={backtestTooltips.oversold} side="top" />
            </Label>
            <Input
              id="oversold"
              type="number"
              min="1"
              max="99"
              value={oversold}
              onChange={(e) => setOversold(e.target.value)}
              placeholder="30"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="overbought" className="inline-flex items-center gap-1">
              Overbought
              <InfoTooltip content={backtestTooltips.overbought} side="top" />
            </Label>
            <Input
              id="overbought"
              type="number"
              min="1"
              max="99"
              value={overbought}
              onChange={(e) => setOverbought(e.target.value)}
              placeholder="70"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="qty" className="inline-flex items-center gap-1">
              Quantity
              <InfoTooltip content={backtestTooltips.quantity} side="top" />
            </Label>
            <Input
              id="qty"
              type="number"
              min="0"
              step="any"
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
              placeholder="0.01"
            />
          </div>
        </div>
      )}

      {/* ── Position sizing ───────────────────── */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="space-y-1.5">
          <Label htmlFor="positionSizeMode" className="inline-flex items-center gap-1">
            Position Size Mode
            <InfoTooltip content={backtestTooltips.positionSizeMode} side="top" />
          </Label>
          <Select value={positionSizeMode} onValueChange={(v: 'fixed' | 'balance_percent' | 'risk_based') => setPositionSizeMode(v)}>
            <SelectTrigger id="positionSizeMode">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="fixed">Fixed quantity</SelectItem>
              <SelectItem value="balance_percent">% of balance</SelectItem>
              <SelectItem value="risk_based">Risk-based</SelectItem>
            </SelectContent>
          </Select>
        </div>
        {positionSizeMode === 'fixed' && (
          <div className="space-y-1.5">
            <Label htmlFor="qty-fixed" className="inline-flex items-center gap-1">
              Quantity
              <InfoTooltip content={backtestTooltips.quantity} side="top" />
            </Label>
            <Input
              id="qty-fixed"
              type="number"
              min="0"
              step="any"
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
              placeholder="0.01"
            />
          </div>
        )}
        {positionSizeMode === 'balance_percent' && (
          <div className="space-y-1.5">
            <Label htmlFor="qty-pct" className="inline-flex items-center gap-1">
              Balance % (e.g. 0.01 = 1%)
              <InfoTooltip content={backtestTooltips.quantity} side="top" />
            </Label>
            <Input
              id="qty-pct"
              type="number"
              min="0"
              max="1"
              step="0.001"
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
              placeholder="0.01"
            />
          </div>
        )}
        {positionSizeMode === 'risk_based' && (
          <>
            <div className="space-y-1.5">
              <Label htmlFor="risk-pct" className="inline-flex items-center gap-1">
                Risk % of balance
                <InfoTooltip content={backtestTooltips.riskPercent} side="top" />
              </Label>
              <Input
                id="risk-pct"
                type="number"
                min="0"
                max="100"
                step="0.1"
                value={riskPercent}
                onChange={(e) => setRiskPercent(e.target.value)}
                placeholder="1"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="sl-for-risk" className="inline-flex items-center gap-1">
                Stop Loss % (required)
                <InfoTooltip content={backtestTooltips.stopLoss} side="top" />
              </Label>
              <Input
                id="sl-for-risk"
                type="number"
                min="0.1"
                max="99"
                step="0.1"
                value={stopLossPercent}
                onChange={(e) => setStopLossPercent(e.target.value)}
                placeholder="Required"
              />
            </div>
          </>
        )}
      </div>

      {/* ── Risk params ─────────────────────────── */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-4">
        <div className="space-y-1.5">
          <Label htmlFor="stopLossPercent" className="inline-flex items-center gap-1">
            Stop Loss %
            <InfoTooltip content={backtestTooltips.stopLoss} side="top" />
          </Label>
          <Input
            id="stopLossPercent"
            type="number"
            min="0"
            max="99"
            step="0.1"
            value={stopLossPercent}
            onChange={(e) => setStopLossPercent(e.target.value)}
            placeholder="Optional"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="takeProfitPercent" className="inline-flex items-center gap-1">
            Take Profit %
            <InfoTooltip content={backtestTooltips.takeProfit} side="top" />
          </Label>
          <Input
            id="takeProfitPercent"
            type="number"
            min="0"
            max="99"
            step="0.1"
            value={takeProfitPercent}
            onChange={(e) => setTakeProfitPercent(e.target.value)}
            placeholder="Optional"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="maxDailyLoss" className="inline-flex items-center gap-1">
            Max Daily Loss
            <InfoTooltip content={backtestTooltips.maxDailyLoss} side="top" />
          </Label>
          <Input
            id="maxDailyLoss"
            type="number"
            min="0"
            step="any"
            value={maxDailyLoss}
            onChange={(e) => setMaxDailyLoss(e.target.value)}
            placeholder="Optional"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="trailingStopDistance" className="inline-flex items-center gap-1">
            Trailing Stop %
            <InfoTooltip content={backtestTooltips.trailingStop} side="top" />
          </Label>
          <Input
            id="trailingStopDistance"
            type="number"
            min="0"
            max="99"
            step="0.1"
            value={trailingStopDistance}
            onChange={(e) => setTrailingStopDistance(e.target.value)}
            placeholder="Optional"
          />
        </div>
      </div>

      {/* ── Partial TP ────────────────────────── */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="partialTpPercent" className="inline-flex items-center gap-1">
            Partial Take Profit % (e.g. 50)
            <InfoTooltip content={backtestTooltips.partialTp} side="top" />
          </Label>
          <Input
            id="partialTpPercent"
            type="number"
            min="1"
            max="99"
            step="1"
            value={partialTpPercent}
            onChange={(e) => setPartialTpPercent(e.target.value)}
            placeholder="Optional — close portion at TP"
          />
          <p className="text-xs text-muted-foreground">Close % of position when TP is hit. Remaining stays open.</p>
        </div>
      </div>

      <Button type="submit" disabled={submitting || loadingInstruments} className="w-full sm:w-auto">
        {submitting ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Running backtest…
          </>
        ) : (
          <>
            Run Backtest
            <span className="ml-1.5 inline-flex">
              <InfoTooltip content={backtestTooltips.runBacktest} side="top" />
            </span>
          </>
        )}
      </Button>
    </form>
  )
}
