'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  type BuilderConfig,
  type BuilderCondition,
  type Condition,
  type IndicatorType,
  type ComparisonOperator,
  type LogicalOperator,
  type CompiledStrategyResult,
  MARKET_KLINE_INTERVALS,
} from '@/types'
import { useAuthStore } from '@/store/auth.store'
import {
  compileBuilderConfig,
  createBotFromBuilder,
  fetchBuilderDefault,
  fetchInstruments,
} from '@/lib/api-client'
import { useHandleApiError } from '@/hooks/use-handle-api-error'
import { toast } from '@/hooks/use-toast'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { InfoTooltip } from '@/components/ui/info-tooltip'
import { StrategyPreview } from '@/components/bots/strategy-preview'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  ArrowLeft,
  Bot as BotIcon,
  CheckCircle2,
  CirclePlus,
  GitBranch,
  Loader2,
  Play,
  Plus,
  Trash2,
} from 'lucide-react'
import type { Instrument } from '@/types'

// ─── ID generation ─────────────────────────────────────────────────────────────

function uid(): string {
  return Math.random().toString(36).slice(2) + Date.now().toString(36)
}

// ─── Default config ───────────────────────────────────────────────────────────

function defaultCondition(): Condition {
  return {
    id: uid(),
    indicator: 'RSI',
    params: { period: 14 },
    comparison: 'CROSSES_BELOW',
    value: 30,
  }
}

function defaultConfig(): BuilderConfig {
  return {
    version: 1,
    entryOperator: 'AND',
    conditions: [{ type: 'CONDITION', condition: defaultCondition() }],
    risk: { quantity: 0.01 },
  }
}

// ─── Indicator label helpers ───────────────────────────────────────────────────

const INDICATOR_LABELS: Record<IndicatorType, string> = {
  RSI: 'RSI',
  MA: 'Moving Average',
}

const COMPARISON_LABELS: Record<ComparisonOperator, string> = {
  CROSSES_ABOVE: 'crosses above',
  CROSSES_BELOW: 'crosses below',
  ABOVE: 'is above',
  BELOW: 'is below',
}

const COMPARISON_HINTS: Record<ComparisonOperator, string> = {
  CROSSES_ABOVE: 'Triggers when the indicator value rises past the threshold',
  CROSSES_BELOW: 'Triggers when the indicator value drops below the threshold',
  ABOVE: 'Triggers while the indicator is above the threshold',
  BELOW: 'Triggers while the indicator is below the threshold',
}

// ─── Condition card ───────────────────────────────────────────────────────────

function ConditionCard({
  condition,
  onChange,
  onRemove,
  canRemove,
  index,
  totalConditions,
  operator,
  onOperatorChange,
  showOperator,
}: {
  condition: Condition
  onChange: (c: Condition) => void
  onRemove: () => void
  canRemove: boolean
  index: number
  totalConditions: number
  operator: LogicalOperator
  onOperatorChange: (op: LogicalOperator) => void
  showOperator: boolean
}) {
  const isRsi = condition.indicator === 'RSI'

  function updateParam<K extends keyof Condition['params']>(
    key: K,
    value: Condition['params'][K],
  ) {
    onChange({ ...condition, params: { ...condition.params, [key]: value } })
  }

  function updateIndicator(ind: IndicatorType) {
    const newParams: Condition['params'] =
      ind === 'RSI' ? { period: 14 } : { shortPeriod: 10, longPeriod: 20 }
    onChange({ ...condition, indicator: ind, params: newParams, comparison: 'CROSSES_ABOVE', value: 50 })
  }

  return (
    <div className="rounded-lg border border-border/60 bg-card">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border/50 px-4 py-2.5">
        <div className="flex items-center gap-2">
          <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary/20 text-xs font-semibold text-primary">
            {index + 1}
          </span>
          <span className="text-sm font-medium text-foreground">
            {INDICATOR_LABELS[condition.indicator]}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <Select
            value={condition.indicator}
            onValueChange={(v) => updateIndicator(v as IndicatorType)}
          >
            <SelectTrigger className="h-7 w-32 cursor-pointer bg-muted/60 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="RSI">RSI</SelectItem>
              <SelectItem value="MA">Moving Average</SelectItem>
            </SelectContent>
          </Select>
          {canRemove && (
            <button
              onClick={onRemove}
              className="cursor-pointer text-muted-foreground transition-colors hover:text-destructive"
              aria-label="Remove condition"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>

      {/* Body */}
      <div className="space-y-3 p-4">
        {/* Comparison operator */}
        <div className="space-y-1.5">
          <Label className="text-xs">Signal rule</Label>
          <Select
            value={condition.comparison}
            onValueChange={(v) =>
              onChange({ ...condition, comparison: v as ComparisonOperator })
            }
          >
            <SelectTrigger className="cursor-pointer text-sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {(isRsi
                ? ['CROSSES_ABOVE', 'CROSSES_BELOW', 'ABOVE', 'BELOW']
                : ['CROSSES_ABOVE', 'CROSSES_BELOW', 'ABOVE', 'BELOW']
              ).map((op) => (
                <SelectItem key={op} value={op}>
                  {COMPARISON_LABELS[op as ComparisonOperator]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground">
            {COMPARISON_HINTS[condition.comparison]}
          </p>
        </div>

        {/* Indicator-specific params */}
        {isRsi ? (
          <div className="space-y-1.5">
            <div className="flex items-center gap-1.5">
              <Label htmlFor={`rsi-period-${condition.id}`} className="text-xs">
                Period
              </Label>
              <InfoTooltip
                content="Number of candles for the RSI calculation. Standard is 14."
                side="right"
              />
            </div>
            <Input
              id={`rsi-period-${condition.id}`}
              type="number"
              min={2}
              value={condition.params.period ?? 14}
              onChange={(e) => updateParam('period', parseInt(e.target.value) || 14)}
              className="text-sm"
            />
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <div className="flex items-center gap-1.5">
                <Label htmlFor={`ma-short-${condition.id}`} className="text-xs">
                  Short period
                </Label>
                <InfoTooltip content="Fast MA candle count." side="right" />
              </div>
              <Input
                id={`ma-short-${condition.id}`}
                type="number"
                min={1}
                value={condition.params.shortPeriod ?? 10}
                onChange={(e) =>
                  updateParam('shortPeriod', parseInt(e.target.value) || 10)
                }
                className="text-sm"
              />
            </div>
            <div className="space-y-1.5">
              <div className="flex items-center gap-1.5">
                <Label htmlFor={`ma-long-${condition.id}`} className="text-xs">
                  Long period
                </Label>
                <InfoTooltip content="Slow MA candle count." side="right" />
              </div>
              <Input
                id={`ma-long-${condition.id}`}
                type="number"
                min={2}
                value={condition.params.longPeriod ?? 20}
                onChange={(e) => updateParam('longPeriod', parseInt(e.target.value) || 20)
                }
                className="text-sm"
              />
            </div>
          </div>
        )}

        {/* Threshold value */}
        <div className="space-y-1.5">
          <div className="flex items-center gap-1.5">
            <Label htmlFor={`threshold-${condition.id}`} className="text-xs">
              {isRsi ? 'RSI threshold (0–100)' : 'Price threshold'}
            </Label>
            <InfoTooltip
              content={
                isRsi
                  ? 'For BUY signals use low values (e.g. 30). For SELL signals use high values (e.g. 70).'
                  : 'Absolute price value to compare against.'
              }
              side="right"
            />
          </div>
          <Input
            id={`threshold-${condition.id}`}
            type="number"
            min={isRsi ? 0 : 0.00000001}
            max={isRsi ? 100 : undefined}
            step="any"
            value={condition.value}
            onChange={(e) =>
              onChange({ ...condition, value: parseFloat(e.target.value) || 0 })
            }
            className="text-sm"
          />
        </div>

        {/* Human-readable description */}
        <div className="rounded-md bg-muted/50 px-3 py-2 text-xs text-muted-foreground">
          {isRsi
            ? `RSI(${condition.params.period ?? 14}) ${COMPARISON_LABELS[condition.comparison]} ${condition.value}`
            : `MA(${condition.params.shortPeriod ?? 10}) ${COMPARISON_LABELS[condition.comparison]} MA(${condition.params.longPeriod ?? 20})`}
        </div>
      </div>
    </div>
  )
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function StrategyBuilderPage() {
  const router = useRouter()
  const token = useAuthStore((s) => s.token)
  const handleError = useHandleApiError()

  const [config, setConfig] = useState<BuilderConfig | null>(null)
  const [compiled, setCompiled] = useState<CompiledStrategyResult | null>(null)
  const [compileError, setCompileError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [compiling, setCompiling] = useState(false)
  const [creating, setCreating] = useState(false)
  const [instruments, setInstruments] = useState<Instrument[]>([])
  const [loadingInstruments, setLoadingInstruments] = useState(true)

  // Form state
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [symbol, setSymbol] = useState('')
  const [interval, setInterval] = useState<string>('1m')
  const [initialBalance, setInitialBalance] = useState('10000')
  const [orderQuantity, setOrderQuantity] = useState('0.01')
  const [stopLoss, setStopLoss] = useState('')
  const [takeProfit, setTakeProfit] = useState('')
  const [maxDailyLoss, setMaxDailyLoss] = useState('')
  const [showJson, setShowJson] = useState(false)
  const [createdBotId, setCreatedBotId] = useState<string | null>(null)

  // Load default config
  useEffect(() => {
    if (!token) return
    ;(async () => {
      try {
        const defaultCfg = await fetchBuilderDefault(token)
        setConfig(defaultCfg)
        setOrderQuantity(String(defaultCfg.risk.quantity))
      } catch {
        setConfig(defaultConfig())
      } finally {
        setLoading(false)
      }
    })()
  }, [token])

  // Load instruments
  useEffect(() => {
    if (!token) return
    ;(async () => {
      try {
        const items = await fetchInstruments(token)
        setInstruments(items)
        if (items.length > 0 && !symbol) {
          setSymbol(items[0].symbol)
        }
      } catch {
        /* silent */
      } finally {
        setLoadingInstruments(false)
      }
    })()
  }, [token])

  // Compile whenever conditions change
  const recompile = useCallback(
    async (cfg: BuilderConfig) => {
      if (!token) return
      setCompiling(true)
      setCompileError(null)
      try {
        const result = await compileBuilderConfig(token, cfg)
        setCompiled(result)
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : 'Compilation failed'
        setCompileError(msg)
        setCompiled(null)
      } finally {
        setCompiling(false)
      }
    },
    [token],
  )

  useEffect(() => {
    if (!config) return
    const timeout = setTimeout(() => recompile(config), 500)
    return () => clearTimeout(timeout)
  }, [config, recompile])

  // Update conditions
  function updateCondition(index: number, updated: Condition) {
    if (!config) return
    const conditions = [...config.conditions]
    conditions[index] = { type: 'CONDITION', condition: updated }
    setConfig({ ...config, conditions })
  }

  function removeCondition(index: number) {
    if (!config) return
    const conditions = config.conditions.filter((_, i) => i !== index)
    if (conditions.length === 0) {
      conditions.push({ type: 'CONDITION', condition: defaultCondition() })
    }
    setConfig({ ...config, conditions })
  }

  function addCondition() {
    if (!config) return
    setConfig({
      ...config,
      conditions: [...config.conditions, { type: 'CONDITION', condition: defaultCondition() }],
    })
  }

  function updateRisk(field: string, value: string) {
    if (!config) return
    const num = parseFloat(value)
    setConfig({
      ...config,
      risk: {
        ...config.risk,
        [field]: value === '' ? undefined : num,
      },
    })
  }

  function updateEntryOperator(op: LogicalOperator) {
    if (!config) return
    setConfig({ ...config, entryOperator: op })
  }

  async function handleCreate() {
    if (!token || !config || !name.trim() || !symbol) return
    setCreating(true)
    try {
      const bot = await createBotFromBuilder(token, {
        name: name.trim(),
        description: description.trim() || undefined,
        symbol,
        initialBalance: parseFloat(initialBalance) || 10000,
        builderConfig: {
          ...config,
          risk: {
            ...config.risk,
            quantity: parseFloat(orderQuantity) || 0.01,
            ...(stopLoss ? { stopLossPercent: parseFloat(stopLoss) } : {}),
            ...(takeProfit ? { takeProfitPercent: parseFloat(takeProfit) } : {}),
            ...(maxDailyLoss ? { maxDailyLoss: parseFloat(maxDailyLoss) } : {}),
          },
        },
      })
      setCreatedBotId(bot.id)
      toast({ title: 'Bot created', description: `${bot.name} is ready to configure.` })
    } catch (err) {
      handleError(err, 'Could not create bot')
    } finally {
      setCreating(false)
    }
  }

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (createdBotId) {
    return (
      <div className="mx-auto max-w-2xl space-y-6">
        <Card className="border-emerald-500/30 bg-emerald-500/5">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg text-emerald-300">
              <CheckCircle2 className="h-5 w-5" />
              Strategy saved!
            </CardTitle>
            <CardDescription>
              Your bot <strong>{name}</strong> was created from the visual builder.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-3">
            <Button asChild className="cursor-pointer">
              <Link href={`/bots/${createdBotId}`}>View bot</Link>
            </Button>
            <Button
              variant="outline"
              onClick={() => router.push('/bots')}
              className="cursor-pointer"
            >
              Back to bots
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  if (!config) return null

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <Button variant="ghost" size="sm" asChild className="mb-2 -ml-2 cursor-pointer">
          <Link href="/bots">← Back to bots</Link>
        </Button>
        <h1 className="text-3xl font-semibold tracking-tight">Strategy Builder</h1>
        <p className="text-muted-foreground">
          Build strategies visually — no code required.
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-5">
        {/* Left: builder form */}
        <div className="space-y-5 lg:col-span-3">
          {/* Bot meta */}
          <Card className="border-border/70 bg-card/80">
            <CardHeader>
              <CardTitle className="text-base">Bot details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="sb-name">Bot name</Label>
                  <Input
                    id="sb-name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="BTC momentum bot"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Trading pair</Label>
                  <Select value={symbol} onValueChange={setSymbol} disabled={loadingInstruments}>
                    <SelectTrigger className="cursor-pointer">
                      <SelectValue placeholder={loadingInstruments ? 'Loading…' : 'Select pair'} />
                    </SelectTrigger>
                    <SelectContent>
                      {instruments.map((i) => (
                        <SelectItem key={i.symbol} value={i.symbol}>
                          {i.symbol}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label>Entry timeframe</Label>
                  <Select value={interval} onValueChange={setInterval}>
                    <SelectTrigger className="cursor-pointer">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {MARKET_KLINE_INTERVALS.map((iv) => (
                        <SelectItem key={iv} value={iv}>{iv}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="sb-bal">Initial balance</Label>
                  <Input
                    id="sb-bal"
                    type="number"
                    min={1}
                    step="any"
                    value={initialBalance}
                    onChange={(e) => setInitialBalance(e.target.value)}
                    placeholder="10000"
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Conditions */}
          <Card className="border-border/70 bg-card/80">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <GitBranch className="h-4 w-4 text-primary" />
                Entry conditions
              </CardTitle>
              <CardDescription>
                Define when the bot opens a position. Combine conditions with AND/OR.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Logic operator between conditions */}
              {config.conditions.length > 1 && (
                <div className="flex items-center gap-3">
                  <div className="h-px flex-1 bg-border/50" />
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground">Combine with</span>
                    <Select
                      value={config.entryOperator}
                      onValueChange={(v) => updateEntryOperator(v as LogicalOperator)}
                    >
                      <SelectTrigger className="h-7 w-20 cursor-pointer bg-muted/60 text-xs font-medium">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="AND">AND</SelectItem>
                        <SelectItem value="OR">OR</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="h-px flex-1 bg-border/50" />
                </div>
              )}

              {/* Condition cards */}
              {config.conditions.map((condWrapper, i) => {
                if (condWrapper.type !== 'CONDITION') return null
                const cond = condWrapper.condition
                return (
                  <ConditionCard
                    key={cond.id}
                    condition={cond}
                    onChange={(updated) => updateCondition(i, updated)}
                    onRemove={() => removeCondition(i)}
                    canRemove={config.conditions.length > 1}
                    index={i}
                    totalConditions={config.conditions.length}
                    operator={config.entryOperator}
                    onOperatorChange={updateEntryOperator}
                    showOperator={config.conditions.length > 1}
                  />
                )
              })}

              <Button
                variant="outline"
                size="sm"
                onClick={addCondition}
                className="w-full cursor-pointer border-dashed"
              >
                <Plus className="mr-2 h-4 w-4" />
                Add condition
              </Button>
            </CardContent>
          </Card>

          {/* Risk */}
          <Card className="border-border/70 bg-card/80">
            <CardHeader>
              <CardTitle className="text-base">Risk management</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-3">
                <div className="space-y-2">
                  <Label htmlFor="sb-qty">Order quantity</Label>
                  <Input
                    id="sb-qty"
                    type="number"
                    min={0.00000001}
                    step="any"
                    value={orderQuantity}
                    onChange={(e) => {
                      setOrderQuantity(e.target.value)
                      updateRisk('quantity', e.target.value)
                    }}
                  />
                </div>
                <div className="space-y-2">
                  <div className="flex items-center gap-1.5">
                    <Label htmlFor="sb-sl">Stop loss %</Label>
                    <InfoTooltip content="Optional. Exit price buffer." side="right" />
                  </div>
                  <Input
                    id="sb-sl"
                    type="number"
                    min={0.01}
                    max={99.99}
                    step="any"
                    value={stopLoss}
                    onChange={(e) => {
                      setStopLoss(e.target.value)
                      updateRisk('stopLossPercent', e.target.value)
                    }}
                    placeholder="Optional"
                  />
                </div>
                <div className="space-y-2">
                  <div className="flex items-center gap-1.5">
                    <Label htmlFor="sb-tp">Take profit %</Label>
                    <InfoTooltip content="Optional. Target profit buffer." side="right" />
                  </div>
                  <Input
                    id="sb-tp"
                    type="number"
                    min={0.01}
                    max={99.99}
                    step="any"
                    value={takeProfit}
                    onChange={(e) => {
                      setTakeProfit(e.target.value)
                      updateRisk('takeProfitPercent', e.target.value)
                    }}
                    placeholder="Optional"
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* JSON toggle */}
          <details className="cursor-pointer rounded-md border border-border/50">
            <summary className="px-4 py-2.5 text-sm text-muted-foreground hover:text-foreground">
              Show generated JSON config
            </summary>
            <pre className="overflow-x-auto rounded-b-md border-t border-border/50 bg-muted/40 p-4 text-xs text-muted-foreground">
              {JSON.stringify(
                {
                  ...config,
                  risk: {
                    ...config.risk,
                    quantity: parseFloat(orderQuantity) || 0.01,
                    ...(stopLoss ? { stopLossPercent: parseFloat(stopLoss) } : {}),
                    ...(takeProfit ? { takeProfitPercent: parseFloat(takeProfit) } : {}),
                    ...(maxDailyLoss ? { maxDailyLoss: parseFloat(maxDailyLoss) } : {}),
                  },
                },
                null,
                2,
              )}
            </pre>
          </details>
        </div>

        {/* Right: preview panel */}
        <div className="space-y-5 lg:col-span-2">
          {/* Compiled strategy summary */}
          <Card className="border-border/70 bg-card/80">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <BotIcon className="h-4 w-4 text-primary" />
                Compiled strategy
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {compiling ? (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Compiling…
                </div>
              ) : compileError ? (
                <div className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
                  {compileError}
                </div>
              ) : compiled ? (
                <div className="space-y-2 text-sm">
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Strategy</span>
                    <span className="font-medium capitalize">
                      {compiled.strategy.replace('_', ' ')}
                    </span>
                  </div>
                  {Object.entries(compiled.params)
                    .filter(([k]) => k !== 'config')
                    .map(([k, v]) => (
                      <div key={k} className="flex items-center justify-between">
                        <span className="text-muted-foreground">{k}</span>
                        <span className="font-mono font-medium">{String(v)}</span>
                      </div>
                    ))}
                </div>
              ) : null}
            </CardContent>
          </Card>

          {/* Live preview */}
          {compiled && symbol && (
            <Card className="border-border/70 bg-card/80">
              <CardHeader>
                <CardTitle className="text-base">Strategy preview</CardTitle>
                <CardDescription>
                  Simulated performance on last 100 candles.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <StrategyPreview
                  symbol={symbol}
                  interval={interval}
                  strategy={compiled.strategy}
                  params={compiled.params}
                />
              </CardContent>
            </Card>
          )}

          {/* Create */}
          <Card className="border-border/70 bg-card/80">
            <CardContent className="pt-6">
              <Button
                onClick={handleCreate}
                disabled={creating || !name.trim() || !symbol || !!compileError}
                className="w-full cursor-pointer"
              >
                {creating ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <CirclePlus className="mr-2 h-4 w-4" />
                )}
                {creating ? 'Creating bot…' : 'Create bot from strategy'}
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
