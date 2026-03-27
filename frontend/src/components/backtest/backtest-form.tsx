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
  // shared
  quantity: string
  stopLossPercent: string
  takeProfitPercent: string
  maxDailyLoss: string
}

type Props = {
  onSubmit: (values: BacktestFormValues) => Promise<void>
  submitting: boolean
}

export function BacktestForm({ onSubmit, submitting }: Props) {
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
  const [stopLossPercent, setStopLossPercent] = useState('')
  const [takeProfitPercent, setTakeProfitPercent] = useState('')
  const [maxDailyLoss, setMaxDailyLoss] = useState('')

  useEffect(() => {
    if (!token) return
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
  }, [token, handleError, symbol])

  function buildParams(): Record<string, unknown> {
    if (strategy === 'sma_crossover') {
      return {
        shortPeriod: parseInt(shortPeriod, 10),
        longPeriod: parseInt(longPeriod, 10),
        quantity: parseFloat(quantity),
        ...(stopLossPercent ? { stopLossPercent: parseFloat(stopLossPercent) } : {}),
        ...(takeProfitPercent ? { takeProfitPercent: parseFloat(takeProfitPercent) } : {}),
        ...(maxDailyLoss ? { maxDailyLoss: parseFloat(maxDailyLoss) } : {}),
        interval,
      }
    }
    return {
      period: parseInt(rsiPeriod, 10),
      oversold: parseFloat(oversold),
      overbought: parseFloat(overbought),
      quantity: parseFloat(quantity),
      ...(stopLossPercent ? { stopLossPercent: parseFloat(stopLossPercent) } : {}),
      ...(takeProfitPercent ? { takeProfitPercent: parseFloat(takeProfitPercent) } : {}),
      ...(maxDailyLoss ? { maxDailyLoss: parseFloat(maxDailyLoss) } : {}),
      interval,
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
      quantity,
      stopLossPercent,
      takeProfitPercent,
      maxDailyLoss,
    }
    await onSubmit(values)
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* ── Core params ─────────────────────────── */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="symbol">Instrument</Label>
          {loadingInstruments ? (
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
          )}
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="interval">Timeframe</Label>
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
          <Label htmlFor="strategy">Strategy</Label>
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
          <Label htmlFor="initialBalance">Initial Balance</Label>
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
          <Label htmlFor="fromDate">From</Label>
          <Input
            id="fromDate"
            type="date"
            value={fromDate}
            max={toDate}
            onChange={(e) => setFromDate(e.target.value)}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="toDate">To</Label>
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
            <Label htmlFor="shortPeriod">Short Period</Label>
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
            <Label htmlFor="longPeriod">Long Period</Label>
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
            <Label htmlFor="quantity">Quantity</Label>
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
            <Label htmlFor="rsiPeriod">RSI Period</Label>
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
            <Label htmlFor="oversold">Oversold</Label>
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
            <Label htmlFor="overbought">Overbought</Label>
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
            <Label htmlFor="qty">Quantity</Label>
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

      {/* ── Risk params ─────────────────────────── */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="space-y-1.5">
          <Label htmlFor="stopLossPercent">Stop Loss %</Label>
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
          <Label htmlFor="takeProfitPercent">Take Profit %</Label>
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
          <Label htmlFor="maxDailyLoss">Max Daily Loss</Label>
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
      </div>

      <Button type="submit" disabled={submitting || loadingInstruments} className="w-full sm:w-auto">
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
