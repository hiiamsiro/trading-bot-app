'use client'

import { useEffect, useState } from 'react'
import { Loader2 } from 'lucide-react'
import { useAuthStore } from '@/store/auth.store'
import { fetchInstruments } from '@/lib/api-client'
import { useHandleApiError } from '@/hooks/use-handle-api-error'
import { Instrument, MARKET_KLINE_INTERVALS } from '@/types'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { FormField } from '@/components/ui/form-field'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { backtestTooltips } from '@/lib/tooltip-content'

export interface BacktestFormValues {
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
  trendInterval: string
  positionSizeMode: 'fixed' | 'balance_percent' | 'risk_based'
  quantity: string
  riskPercent: string
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
    <form onSubmit={handleSubmit} className="space-y-5">
      {/* Row 1: Instrument · Timeframe · Strategy */}
      <div className="grid gap-4 sm:grid-cols-3">
        <FormField label="Instrument" tooltip={backtestTooltips.instrument} id="symbol">
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
        </FormField>

        <FormField label="Timeframe" tooltip={backtestTooltips.timeframe} id="interval">
          <Select value={interval} onValueChange={setInterval}>
            <SelectTrigger id="interval">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {MARKET_KLINE_INTERVALS.map((iv) => (
                <SelectItem key={iv} value={iv}>{iv}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </FormField>

        <FormField label="Strategy" tooltip={backtestTooltips.strategy} id="strategy">
          <Select value={strategy} onValueChange={setStrategy}>
            <SelectTrigger id="strategy">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="sma_crossover">SMA Crossover</SelectItem>
              <SelectItem value="rsi">RSI</SelectItem>
            </SelectContent>
          </Select>
        </FormField>
      </div>

      {/* Row 2: Initial Balance · From · To */}
      <div className="grid gap-4 sm:grid-cols-3">
        <FormField label="Initial Balance" tooltip={backtestTooltips.initialBalance} id="initialBalance">
          <Input
            id="initialBalance"
            type="number"
            min="0"
            step="any"
            value={initialBalance}
            onChange={(e) => setInitialBalance(e.target.value)}
            placeholder="10000"
          />
        </FormField>

        <FormField label="From" tooltip={backtestTooltips.fromDate} id="fromDate">
          <Input
            id="fromDate"
            type="date"
            value={fromDate}
            max={toDate}
            onChange={(e) => setFromDate(e.target.value)}
          />
        </FormField>

        <FormField label="To" tooltip={backtestTooltips.toDate} id="toDate">
          <Input
            id="toDate"
            type="date"
            value={toDate}
            min={fromDate}
            onChange={(e) => setToDate(e.target.value)}
          />
        </FormField>
      </div>

      {/* Row 3: Strategy params */}
      {strategy === 'sma_crossover' ? (
        <div className="grid gap-4 sm:grid-cols-3">
          <FormField label="Short Period" tooltip={backtestTooltips.shortPeriod} id="shortPeriod">
            <Input
              id="shortPeriod"
              type="number"
              min="1"
              value={shortPeriod}
              onChange={(e) => setShortPeriod(e.target.value)}
              placeholder="10"
            />
          </FormField>
          <FormField label="Long Period" tooltip={backtestTooltips.longPeriod} id="longPeriod">
            <Input
              id="longPeriod"
              type="number"
              min="2"
              value={longPeriod}
              onChange={(e) => setLongPeriod(e.target.value)}
              placeholder="20"
            />
          </FormField>
          <FormField label="Quantity" tooltip={backtestTooltips.quantity} id="qty-sma">
            <Input
              id="qty-sma"
              type="number"
              min="0"
              step="any"
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
              placeholder="0.01"
            />
          </FormField>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-4">
          <FormField label="RSI Period" tooltip={backtestTooltips.rsiPeriod} id="rsiPeriod">
            <Input
              id="rsiPeriod"
              type="number"
              min="2"
              value={rsiPeriod}
              onChange={(e) => setRsiPeriod(e.target.value)}
              placeholder="14"
            />
          </FormField>
          <FormField label="Oversold" tooltip={backtestTooltips.oversold} id="oversold">
            <Input
              id="oversold"
              type="number"
              min="1"
              max="99"
              value={oversold}
              onChange={(e) => setOversold(e.target.value)}
              placeholder="30"
            />
          </FormField>
          <FormField label="Overbought" tooltip={backtestTooltips.overbought} id="overbought">
            <Input
              id="overbought"
              type="number"
              min="1"
              max="99"
              value={overbought}
              onChange={(e) => setOverbought(e.target.value)}
              placeholder="70"
            />
          </FormField>
          <FormField label="Quantity" tooltip={backtestTooltips.quantity} id="qty-rsi">
            <Input
              id="qty-rsi"
              type="number"
              min="0"
              step="any"
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
              placeholder="0.01"
            />
          </FormField>
        </div>
      )}

      {/* Row 4: Position sizing */}
      <div className="grid gap-4 sm:grid-cols-3">
        <FormField label="Position Size" tooltip={backtestTooltips.positionSizeMode} id="positionSizeMode">
          <Select
            value={positionSizeMode}
            onValueChange={(v: 'fixed' | 'balance_percent' | 'risk_based') => setPositionSizeMode(v)}
          >
            <SelectTrigger id="positionSizeMode">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="fixed">Fixed qty</SelectItem>
              <SelectItem value="balance_percent">% balance</SelectItem>
              <SelectItem value="risk_based">Risk-based</SelectItem>
            </SelectContent>
          </Select>
        </FormField>

        {positionSizeMode === 'fixed' && (
          <FormField label="Quantity" tooltip={backtestTooltips.quantity} id="qty-fixed">
            <Input
              id="qty-fixed"
              type="number"
              min="0"
              step="any"
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
              placeholder="0.01"
            />
          </FormField>
        )}

        {positionSizeMode === 'balance_percent' && (
          <FormField
            label="Balance %"
            tooltip={backtestTooltips.quantity}
            id="qty-pct"
            description="0.01 = 1%"
          >
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
          </FormField>
        )}

        {positionSizeMode === 'risk_based' && (
          <>
            <FormField label="Risk %" tooltip={backtestTooltips.riskPercent} id="risk-pct">
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
            </FormField>
            <FormField label="Stop Loss %" tooltip={backtestTooltips.stopLoss} id="sl-for-risk">
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
            </FormField>
          </>
        )}
      </div>

      {/* Row 5: Risk params */}
      <div className="grid gap-4 sm:grid-cols-4">
        <FormField label="Stop Loss %" tooltip={backtestTooltips.stopLoss} id="stopLossPercent">
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
        </FormField>
        <FormField label="Take Profit %" tooltip={backtestTooltips.takeProfit} id="takeProfitPercent">
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
        </FormField>
        <FormField label="Max Daily Loss" tooltip={backtestTooltips.maxDailyLoss} id="maxDailyLoss">
          <Input
            id="maxDailyLoss"
            type="number"
            min="0"
            step="any"
            value={maxDailyLoss}
            onChange={(e) => setMaxDailyLoss(e.target.value)}
            placeholder="Optional"
          />
        </FormField>
        <FormField label="Trailing Stop %" tooltip={backtestTooltips.trailingStop} id="trailingStopDistance">
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
        </FormField>
      </div>

      {/* Row 6: Partial TP · Trend TF */}
      <div className="grid gap-4 sm:grid-cols-2">
        <FormField
          label="Partial Take Profit %"
          tooltip={backtestTooltips.partialTp}
          id="partialTpPercent"
          description="Close % of position when TP is hit. Remaining stays open."
        >
          <Input
            id="partialTpPercent"
            type="number"
            min="1"
            max="99"
            step="1"
            value={partialTpPercent}
            onChange={(e) => setPartialTpPercent(e.target.value)}
            placeholder="Optional"
          />
        </FormField>

        <FormField label="Trend Timeframe" tooltip={backtestTooltips.trendTimeframe} id="trendInterval">
          <Select value={trendInterval} onValueChange={setTrendInterval}>
            <SelectTrigger id="trendInterval">
              <SelectValue placeholder="None (single TF)" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__none__">None (single TF)</SelectItem>
              {MARKET_KLINE_INTERVALS.map((iv) => (
                <SelectItem key={iv} value={iv}>{iv}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </FormField>
      </div>

      <Button type="submit" disabled={submitting || loadingInstruments}>
        {submitting ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Running backtest…
          </>
        ) : (
          'Run Backtest'
        )}
      </Button>
    </form>
  )
}
