'use client'

import { useEffect, useState } from 'react'
import { Loader2 } from 'lucide-react'
import { useMarketKlines } from '@/hooks/use-market-klines'
import { MarketCandlestickChart } from '@/components/charts/market-candlestick-chart'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { MARKET_KLINE_INTERVALS, type MarketKlineInterval } from '@/types'
import { cn } from '@/lib/utils'

type LiveMarketChartPanelProps = {
  token: string | undefined
  /** Symbols available in the instrument selector (e.g. catalog symbols). */
  instrumentSymbols: string[]
  /** Selected / default symbol (e.g. bot.symbol). */
  activeSymbol: string
  /** Default timeframe (e.g. bot strategy interval). */
  defaultInterval?: MarketKlineInterval
  title?: string
  chartHeight?: number
  className?: string
  showInstrumentSelect?: boolean
  showIntervalSelect?: boolean
}

export function LiveMarketChartPanel({
  token,
  instrumentSymbols,
  activeSymbol,
  defaultInterval,
  title = 'Market chart',
  chartHeight = 380,
  className,
  showInstrumentSelect = true,
  showIntervalSelect = true,
}: LiveMarketChartPanelProps) {
  const [symbol, setSymbol] = useState(activeSymbol)
  const [interval, setInterval] = useState<MarketKlineInterval>(defaultInterval ?? '1m')

  useEffect(() => {
    setSymbol(activeSymbol)
  }, [activeSymbol])

  useEffect(() => {
    if (defaultInterval) {
      setInterval(defaultInterval)
    }
  }, [defaultInterval])

  const { bars, loading, error } = useMarketKlines(token, symbol, interval)

  const selectorSymbols =
    instrumentSymbols.length > 0 ? instrumentSymbols : symbol ? [symbol] : []

  return (
    <Card className={cn('border-border/70 bg-card/80 backdrop-blur-xl', className)}>
      <CardHeader className="flex flex-col gap-4 space-y-0 sm:flex-row sm:items-end sm:justify-between">
        <CardTitle className="text-lg">{title}</CardTitle>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
          {showInstrumentSelect && selectorSymbols.length > 0 ? (
            <div className="space-y-1.5">
              <Label htmlFor="chart-instrument" className="text-xs text-muted-foreground">
                Instrument
              </Label>
              <Select value={symbol} onValueChange={setSymbol}>
                <SelectTrigger id="chart-instrument" className="w-[200px]">
                  <SelectValue placeholder="Symbol" />
                </SelectTrigger>
                <SelectContent>
                  {selectorSymbols.map((s) => (
                    <SelectItem key={s} value={s}>
                      {s}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          ) : (
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Instrument</Label>
              <div className="flex h-10 w-[200px] items-center rounded-md border border-border/70 bg-background px-3 font-mono text-sm">
                {symbol}
              </div>
            </div>
          )}

          {showIntervalSelect ? (
            <div className="space-y-1.5">
              <Label htmlFor="chart-interval" className="text-xs text-muted-foreground">
                Timeframe
              </Label>
              <Select
                value={interval}
                onValueChange={(v) => setInterval(v as MarketKlineInterval)}
              >
                <SelectTrigger id="chart-interval" className="w-[120px]">
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
          ) : (
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Timeframe</Label>
              <div className="flex h-10 w-[120px] items-center justify-center rounded-md border border-border/70 bg-background px-3 font-mono text-sm">
                {interval}
              </div>
            </div>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {error ? (
          <Alert variant="destructive">
            <AlertTitle>Chart data</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        ) : null}
        {loading && bars.length === 0 ? (
          <div
            className="flex items-center justify-center rounded-md border border-border/60 bg-muted/20"
            style={{ height: chartHeight }}
          >
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" aria-hidden />
          </div>
        ) : (
          <MarketCandlestickChart bars={bars} height={chartHeight} />
        )}
      </CardContent>
    </Card>
  )
}
