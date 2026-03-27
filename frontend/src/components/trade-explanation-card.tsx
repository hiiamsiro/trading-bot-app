'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { type TradeExplanation } from '@/types'
import { cn } from '@/lib/utils'

interface TradeExplanationCardProps {
  openExplanation?: TradeExplanation | null
  closeExplanation?: TradeExplanation | null
  openReason?: string | null
  closeReason?: string | null
}

function formatValue(key: string, value: unknown): string {
  if (value == null) return '—'
  if (typeof value === 'number') {
    if (key.toLowerCase().includes('rsi') || key.toLowerCase().includes('pct') || key.toLowerCase().includes('percent')) {
      return value.toFixed(1)
    }
    if (key.toLowerCase().includes('price') || key.toLowerCase().includes('sl') || key.toLowerCase().includes('tp') || key.toLowerCase().includes('stop') || key.toLowerCase().includes('take')) {
      return value.toFixed(4)
    }
    return String(value)
  }
  return String(value)
}

function IndicatorRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between rounded px-2 py-1 even:bg-muted/30">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className="font-mono text-xs font-medium">{value}</span>
    </div>
  )
}

function ExplanationPanel({
  title,
  explanation,
  reason,
  variant,
}: {
  title: string
  explanation: TradeExplanation
  reason?: string | null
  variant: 'open' | 'close'
}) {
  const isStrategy = reason?.startsWith('strategy:') ?? false
  const isRisk = reason?.startsWith('risk:') ?? false
  const isBotStopped = reason === 'bot_stopped'

  // SMA crossover
  if ('shortPeriod' in explanation && 'longPeriod' in explanation) {
    const short = explanation.shortPeriod ?? 0
    const long = explanation.longPeriod ?? 0
    return (
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <Badge
            variant="outline"
            className={cn(
              'text-xs',
              variant === 'open'
                ? 'border-emerald-500/40 bg-emerald-500/15 text-emerald-300'
                : 'border-rose-500/40 bg-rose-500/15 text-rose-300',
            )}
          >
            {title}
          </Badge>
          {isStrategy && (
            <Badge variant="outline" className="border-blue-500/40 bg-blue-500/15 text-blue-300 text-xs">
              strategy
            </Badge>
          )}
          {isRisk && (
            <Badge variant="outline" className="border-amber-500/40 bg-amber-500/15 text-amber-300 text-xs">
              risk exit
            </Badge>
          )}
        </div>

        <p className="text-sm font-medium leading-relaxed">
          {reason?.replace(/^(strategy:|risk:)/, '') ?? '—'}
        </p>

        <div className="rounded border border-border/50 bg-muted/20 p-2">
          <p className="mb-1.5 text-xs font-semibold text-muted-foreground">Indicator values</p>
          <div className="space-y-0.5">
            <IndicatorRow label={`MA(${short}) [previous]`} value={formatValue('prevShort', explanation.prevShort)} />
            <IndicatorRow label={`MA(${long}) [previous]`} value={formatValue('prevLong', explanation.prevLong)} />
            <IndicatorRow label={`MA(${short}) [current]`} value={formatValue('currShort', explanation.currShort)} />
            <IndicatorRow label={`MA(${long}) [current]`} value={formatValue('currLong', explanation.currLong)} />
            {explanation.interval && (
              <IndicatorRow label="Interval" value={explanation.interval} />
            )}
            {explanation.instrument && (
              <IndicatorRow label="Instrument" value={explanation.instrument} />
            )}
          </div>
        </div>
      </div>
    )
  }

  // RSI strategy
  if ('period' in explanation && 'currRsi' in explanation) {
    const currRsi = explanation.currRsi ?? 0
    const prevRsi = explanation.prevRsi ?? 0
    const oversold = explanation.oversold ?? 30
    const overbought = explanation.overbought ?? 70
    const isOversold = currRsi <= oversold
    const isOverbought = currRsi >= overbought
    const zoneLabel = isOversold ? 'oversold' : isOverbought ? 'overbought' : 'neutral'

    return (
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <Badge
            variant="outline"
            className={cn(
              'text-xs',
              variant === 'open'
                ? 'border-emerald-500/40 bg-emerald-500/15 text-emerald-300'
                : 'border-rose-500/40 bg-rose-500/15 text-rose-300',
            )}
          >
            {title}
          </Badge>
          {isStrategy && (
            <Badge variant="outline" className="border-blue-500/40 bg-blue-500/15 text-blue-300 text-xs">
              strategy
            </Badge>
          )}
          {isRisk && (
            <Badge variant="outline" className="border-amber-500/40 bg-amber-500/15 text-amber-300 text-xs">
              risk exit
            </Badge>
          )}
        </div>

        <p className="text-sm font-medium leading-relaxed">
          {reason?.replace(/^(strategy:|risk:)/, '') ?? '—'}
        </p>

        <div className="rounded border border-border/50 bg-muted/20 p-2">
          <p className="mb-1.5 text-xs font-semibold text-muted-foreground">Indicator values</p>
          <div className="space-y-0.5">
            <IndicatorRow label="RSI (previous candle)" value={formatValue('prevRsi', prevRsi)} />
            <IndicatorRow label="RSI (current candle)" value={formatValue('currRsi', currRsi)} />
            <IndicatorRow
              label="Zone"
              value={`${zoneLabel} (O:${oversold} / OB:${overbought})`}
            />
            <IndicatorRow label={`Period (${explanation.period})`} value="—" />
            {explanation.interval && (
              <IndicatorRow label="Interval" value={explanation.interval} />
            )}
          </div>
        </div>
      </div>
    )
  }

  // Generic / risk reason
  if (isRisk || isBotStopped) {
    return (
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <Badge
            variant="outline"
            className="border-amber-500/40 bg-amber-500/15 text-amber-300 text-xs"
          >
            {title}
          </Badge>
          <Badge variant="outline" className="border-amber-500/40 bg-amber-500/15 text-amber-300 text-xs">
            risk exit
          </Badge>
        </div>

        <p className="text-sm font-medium leading-relaxed">
          {reason?.replace('risk:', '').replace('bot_stopped', 'bot stopped') ?? '—'}
        </p>

        {Object.keys(explanation).length > 0 && (
          <div className="rounded border border-border/50 bg-muted/20 p-2">
            <p className="mb-1.5 text-xs font-semibold text-muted-foreground">Details</p>
            <div className="space-y-0.5">
              {explanation.trigger && (
                <IndicatorRow label="Trigger" value={String(explanation.trigger)} />
              )}
              {explanation.maxDailyLoss != null && (
                <IndicatorRow label="Max daily loss" value={formatValue('maxDailyLoss', explanation.maxDailyLoss)} />
              )}
              {explanation.checkedPrice != null && (
                <IndicatorRow label="Trigger price" value={formatValue('checkedPrice', explanation.checkedPrice)} />
              )}
              {explanation.stopLoss != null && (
                <IndicatorRow label="Stop loss" value={formatValue('stopLoss', explanation.stopLoss)} />
              )}
              {explanation.takeProfit != null && (
                <IndicatorRow label="Take profit" value={formatValue('takeProfit', explanation.takeProfit)} />
              )}
              {explanation.sessionProfitLossBeforeClose != null && (
                <IndicatorRow label="P/L before close" value={formatValue('pnl', explanation.sessionProfitLossBeforeClose)} />
              )}
            </div>
          </div>
        )}
      </div>
    )
  }

  // Fallback: show reason and raw metadata
  return (
    <div className="space-y-2">
      <Badge variant="outline" className="text-xs">
        {title}
      </Badge>
      <p className="text-sm font-medium leading-relaxed">
        {reason?.replace(/^(strategy:|risk:)/, '') ?? '—'}
      </p>
      {Object.keys(explanation).length > 0 && (
        <details className="rounded border border-border/50">
          <summary className="cursor-pointer px-2 py-1 text-xs text-muted-foreground hover:text-foreground">
            Raw data
          </summary>
          <pre className="overflow-x-auto px-2 py-2 text-xs text-muted-foreground">
            {JSON.stringify(explanation, null, 2)}
          </pre>
        </details>
      )}
    </div>
  )
}

export function TradeExplanationCard({
  openExplanation,
  closeExplanation,
  openReason,
  closeReason,
}: TradeExplanationCardProps) {
  const hasOpen = Boolean(openExplanation) && Object.keys(openExplanation!).length > 0
  const hasClose = Boolean(closeExplanation) && Object.keys(closeExplanation!).length > 0
  const hasAny = hasOpen || hasClose

  if (!hasAny) {
    return (
      <Card className="border-border/70 bg-card/80 backdrop-blur-xl">
        <CardHeader>
          <CardTitle className="text-lg">Explanation</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            {openReason
              ? `Open: ${openReason.replace(/^strategy:/, '')}`
              : 'No explanation recorded for this trade.'}
          </p>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="border-border/70 bg-card/80 backdrop-blur-xl">
      <CardHeader>
        <CardTitle className="text-lg">Explanation</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {hasOpen && (
          <ExplanationPanel
            title="Position opened"
            explanation={openExplanation!}
            reason={openReason}
            variant="open"
          />
        )}
        {hasClose && (
          <ExplanationPanel
            title="Position closed"
            explanation={closeExplanation!}
            reason={closeReason}
            variant="close"
          />
        )}
      </CardContent>
    </Card>
  )
}
