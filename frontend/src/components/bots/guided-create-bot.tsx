'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Bot, Instrument, MARKET_KLINE_INTERVALS, type Bot as BotType } from '@/types'
import { useAuthStore } from '@/store/auth.store'
import { createBot, fetchInstruments, startBot } from '@/lib/api-client'
import { useHandleApiError } from '@/hooks/use-handle-api-error'
import { toast } from '@/hooks/use-toast'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { InfoTooltip } from '@/components/ui/info-tooltip'
import { StrategyPreview } from '@/components/bots/strategy-preview'
import { BotStatusBadge } from '@/components/bot-status-badge'
import { EmptyState } from '@/components/empty-state'
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
  ArrowRight,
  Bot as BotIcon,
  CheckCircle2,
  Loader2,
  Play,
  ShieldCheck,
  Sparkles,
  Zap,
} from 'lucide-react'

type StrategyKey = 'sma_crossover' | 'rsi'
type Step = 1 | 2 | 3

const STEP_LABELS = [
  { n: 1 as Step, label: 'Configure' },
  { n: 2 as Step, label: 'Preview' },
  { n: 3 as Step, label: 'Launch' },
]

// ─── Step 1: form ──────────────────────────────────────────────────────────

interface FormValues {
  name: string
  description: string
  symbol: string
  strategy: StrategyKey
  shortPeriod: string
  longPeriod: string
  rsiPeriod: string
  interval: string
  trendInterval: string
  initialBalance: string
  orderQuantity: string
}

interface FormErrors {
  name?: string
  symbol?: string
  shortPeriod?: string
  longPeriod?: string
  rsiPeriod?: string
  initialBalance?: string
  orderQuantity?: string
}

function validateStep1(values: FormValues): FormErrors {
  const errs: FormErrors = {}
  if (!values.name.trim()) errs.name = 'Bot name is required.'
  if (!values.symbol) errs.symbol = 'Please select an instrument.'
  const ib = Number(values.initialBalance)
  const qty = Number(values.orderQuantity)
  if (!Number.isFinite(ib) || ib <= 0) errs.initialBalance = 'Initial balance must be greater than 0.'
  if (!Number.isFinite(qty) || qty <= 0) errs.orderQuantity = 'Order quantity must be greater than 0.'

  if (values.strategy === 'sma_crossover') {
    const short = Number(values.shortPeriod)
    const long = Number(values.longPeriod)
    if (!Number.isInteger(short) || short < 1) errs.shortPeriod = 'Short period must be ≥ 1.'
    if (!Number.isInteger(long) || long < 2) errs.longPeriod = 'Long period must be ≥ 2.'
    if (Number.isInteger(short) && Number.isInteger(long) && short >= long) {
      errs.shortPeriod = 'Short period must be smaller than long period.'
      errs.longPeriod = 'Long period must be greater than short period.'
    }
  } else {
    const period = Number(values.rsiPeriod)
    if (!Number.isInteger(period) || period < 2) errs.rsiPeriod = 'RSI period must be ≥ 2.'
  }
  return errs
}

function StepOneForm({
  values,
  errors,
  instruments,
  loadingInstruments,
  onChange,
}: {
  values: FormValues
  errors: FormErrors
  instruments: Instrument[]
  loadingInstruments: boolean
  onChange: (patch: Partial<FormValues>) => void
}) {
  return (
    <div className="space-y-5">
      {/* Name */}
      <div className="space-y-2">
        <div className="flex items-center gap-1.5">
          <Label htmlFor="g-name">Bot name</Label>
          <InfoTooltip
            content="A friendly name to identify your bot across the app. Choose something descriptive, e.g. &quot;BTC trend follow&quot;."
            side="right"
          />
        </div>
        <Input
          id="g-name"
          value={values.name}
          onChange={(e) => onChange({ name: e.target.value })}
          placeholder="e.g. BTC momentum bot"
        />
        {errors.name && <p className="text-sm text-destructive">{errors.name}</p>}
      </div>

      {/* Description */}
      <div className="space-y-2">
        <div className="flex items-center gap-1.5">
          <Label htmlFor="g-desc">Description (optional)</Label>
        </div>
        <Input
          id="g-desc"
          value={values.description}
          onChange={(e) => onChange({ description: e.target.value })}
          placeholder="Brief note about this bot&apos;s strategy (optional)"
        />
      </div>

      {/* Instrument */}
      <div className="space-y-2">
        <div className="flex items-center gap-1.5">
          <Label>Trading pair</Label>
          <InfoTooltip
            content="The market pair the bot will watch and trade against. Active instruments are synced from the provider."
            side="right"
          />
        </div>
        <Select value={values.symbol} onValueChange={(v) => onChange({ symbol: v })} disabled={loadingInstruments}>
          <SelectTrigger className="cursor-pointer">
            <SelectValue placeholder={loadingInstruments ? 'Loading...' : 'Select pair'} />
          </SelectTrigger>
          <SelectContent>
            {instruments.map((i) => (
              <SelectItem key={i.symbol} value={i.symbol}>
                {i.symbol} — {i.displayName}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {errors.symbol && <p className="text-sm text-destructive">{errors.symbol}</p>}
      </div>

      {/* Strategy */}
      <div className="space-y-2">
        <div className="flex items-center gap-1.5">
          <Label>Strategy</Label>
          <InfoTooltip
            content={
              <span>
                <strong>SMA Crossover:</strong> Buys when the short moving average crosses above the long one, sells on the reverse.
                <br />
                <strong>RSI:</strong> Buys when RSI drops below the oversold threshold, sells when it rises above overbought.
              </span>
            }
            side="right"
          />
        </div>
        <Select
          value={values.strategy}
          onValueChange={(v) => onChange({ strategy: v as StrategyKey })}
        >
          <SelectTrigger className="cursor-pointer">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="sma_crossover">SMA Crossover</SelectItem>
            <SelectItem value="rsi">RSI</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Entry timeframe */}
      <div className="space-y-2">
        <div className="flex items-center gap-1.5">
          <Label>Entry timeframe</Label>
          <InfoTooltip
            content="How often the bot checks for signals. Shorter timeframes (1m, 5m) generate more trades; longer ones (1h, 1d) are more reliable but fewer signals."
            side="right"
          />
        </div>
        <Select value={values.interval} onValueChange={(v) => onChange({ interval: v })}>
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

      {/* Trend timeframe */}
      <div className="space-y-2">
        <div className="flex items-center gap-1.5">
          <Label>Trend filter (optional)</Label>
          <InfoTooltip
            content="Apply a higher timeframe to only trade in the direction of the broader trend. E.g. use 1h to filter 1m entries."
            side="right"
          />
        </div>
        <Select value={values.trendInterval} onValueChange={(v) => onChange({ trendInterval: v })}>
          <SelectTrigger className="cursor-pointer">
            <SelectValue placeholder="None (single TF)" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__none__">None (single TF)</SelectItem>
            {MARKET_KLINE_INTERVALS.map((iv) => (
              <SelectItem key={iv} value={iv}>{iv}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Strategy params */}
      {values.strategy === 'sma_crossover' ? (
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <div className="flex items-center gap-1.5">
              <Label htmlFor="g-short">Short period</Label>
              <InfoTooltip
                content="Number of candles for the fast moving average. Common values: 5–20. Shorter = more signals, more noise."
                side="right"
              />
            </div>
            <Input
              id="g-short"
              type="number"
              min={1}
              value={values.shortPeriod}
              onChange={(e) => onChange({ shortPeriod: e.target.value })}
              placeholder="10"
            />
            {errors.shortPeriod && <p className="text-sm text-destructive">{errors.shortPeriod}</p>}
          </div>
          <div className="space-y-2">
            <div className="flex items-center gap-1.5">
              <Label htmlFor="g-long">Long period</Label>
              <InfoTooltip
                content="Number of candles for the slow moving average. Must be greater than the short period. Common values: 20–200."
                side="right"
              />
            </div>
            <Input
              id="g-long"
              type="number"
              min={2}
              value={values.longPeriod}
              onChange={(e) => onChange({ longPeriod: e.target.value })}
              placeholder="20"
            />
            {errors.longPeriod && <p className="text-sm text-destructive">{errors.longPeriod}</p>}
          </div>
        </div>
      ) : (
        <div className="space-y-2">
          <div className="flex items-center gap-1.5">
            <Label htmlFor="g-rsi">RSI period</Label>
            <InfoTooltip
              content="Number of candles to compute the Relative Strength Index. The default of 14 is the standard. Lower = more sensitive."
              side="right"
            />
          </div>
          <Input
            id="g-rsi"
            type="number"
            min={2}
            value={values.rsiPeriod}
            onChange={(e) => onChange({ rsiPeriod: e.target.value })}
            placeholder="14"
          />
          {errors.rsiPeriod && <p className="text-sm text-destructive">{errors.rsiPeriod}</p>}
        </div>
      )}

      {/* Balance & quantity */}
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <div className="flex items-center gap-1.5">
            <Label htmlFor="g-bal">Initial balance (demo)</Label>
            <InfoTooltip
              content="The simulated account balance the bot starts with. This is paper money — no real funds are used."
              side="right"
            />
          </div>
          <Input
            id="g-bal"
            type="number"
            min={1}
            step="any"
            value={values.initialBalance}
            onChange={(e) => onChange({ initialBalance: e.target.value })}
            placeholder="10000"
          />
          {errors.initialBalance && <p className="text-sm text-destructive">{errors.initialBalance}</p>}
        </div>
        <div className="space-y-2">
          <div className="flex items-center gap-1.5">
            <Label htmlFor="g-qty">Order quantity</Label>
            <InfoTooltip
              content="How much of the base asset to buy/sell per trade. This is a demo quantity — no real assets are traded."
              side="right"
            />
          </div>
          <Input
            id="g-qty"
            type="number"
            min={0.00000001}
            step="any"
            value={values.orderQuantity}
            onChange={(e) => onChange({ orderQuantity: e.target.value })}
            placeholder="0.01"
          />
          {errors.orderQuantity && <p className="text-sm text-destructive">{errors.orderQuantity}</p>}
        </div>
      </div>
    </div>
  )
}

// ─── Step 2: preview ─────────────────────────────────────────────────────────

function StepTwoPreview({
  values,
  instruments,
}: {
  values: FormValues
  instruments: Instrument[]
}) {
  const instrument = instruments.find((i) => i.symbol === values.symbol)
  const symbolLabel = instrument
    ? `${instrument.symbol} — ${instrument.displayName}`
    : values.symbol

  return (
    <div className="space-y-6">
      {/* Bot summary card */}
      <Card className="border-border/70 bg-card/80">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <BotIcon className="h-5 w-5 text-primary" />
            {values.name || 'New bot'}
          </CardTitle>
          {values.description && (
            <CardDescription>{values.description}</CardDescription>
          )}
        </CardHeader>
        <CardContent>
          <dl className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm sm:grid-cols-3">
            <div>
              <dt className="text-xs text-muted-foreground">Pair</dt>
              <dd className="font-mono font-medium">{symbolLabel}</dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">Strategy</dt>
              <dd className="font-medium capitalize">{values.strategy.replace('_', ' ')}</dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">Timeframe</dt>
              <dd className="font-mono font-medium">{values.interval}</dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">Initial balance</dt>
              <dd className="font-mono font-medium">${Number(values.initialBalance).toLocaleString()}</dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">Order qty</dt>
              <dd className="font-mono font-medium">{values.orderQuantity}</dd>
            </div>
            {values.trendInterval && values.trendInterval !== '__none__' ? (
              <div>
                <dt className="text-xs text-muted-foreground">Trend filter</dt>
                <dd className="font-mono font-medium">{values.trendInterval}</dd>
              </div>
            ) : null}
          </dl>
        </CardContent>
      </Card>

      {/* Strategy preview */}
      <Card className="border-border/70 bg-card/80">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Sparkles className="h-5 w-5 text-primary" />
            Strategy preview
          </CardTitle>
          <CardDescription>
            Simulated performance on the last 100 candles. This is not a guarantee of future results.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap items-center gap-3">
            <StrategyPreview
              symbol={values.symbol}
              interval={values.interval}
              strategy={values.strategy}
              params={
                values.strategy === 'sma_crossover'
                  ? { shortPeriod: Number(values.shortPeriod), longPeriod: Number(values.longPeriod) }
                  : { period: Number(values.rsiPeriod) }
              }
            />
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

// ─── Step 3: launch ─────────────────────────────────────────────────────────

function StepThreeLaunch({
  bot,
  onStart,
  starting,
}: {
  bot: BotType
  onStart: () => Promise<void>
  starting: boolean
}) {
  const session = bot.executionSession
  return (
    <div className="space-y-6">
      <Card className="border-emerald-500/30 bg-emerald-500/5">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg text-emerald-300">
            <CheckCircle2 className="h-5 w-5" />
            Bot created successfully!
          </CardTitle>
          <CardDescription>
            Your bot <strong className="text-foreground">{bot.name}</strong> is ready to run.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap items-center gap-3">
            <BotStatusBadge status={bot.status} />
            <span className="font-mono text-sm text-muted-foreground">{bot.symbol}</span>
          </div>
          {session && (
            <p className="text-sm text-muted-foreground">
              Last session: {session.totalTrades} trades · PnL ${session.profitLoss.toFixed(2)}
            </p>
          )}
          <div className="flex flex-wrap gap-3">
            <Button onClick={onStart} disabled={starting} className="cursor-pointer">
              {starting ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Play className="mr-2 h-4 w-4" />
              )}
              {starting ? 'Starting...' : 'Start bot'}
            </Button>
            <Button variant="outline" asChild className="cursor-pointer">
              <Link href={`/bots/${bot.id}`}>View bot</Link>
            </Button>
          </div>
        </CardContent>
      </Card>

      <EmptyState
        icon={Zap}
        title="What happens next?"
        description="Once started, the bot watches live market data and executes simulated trades based on your strategy. Open the bot to watch the live feed and trade log."
      >
        <Button asChild variant="outline" className="cursor-pointer">
          <Link href={`/bots/${bot.id}`}>Open bot dashboard</Link>
        </Button>
      </EmptyState>
    </div>
  )
}

// ─── Step indicator ─────────────────────────────────────────────────────────

function StepIndicator({ current }: { current: Step }) {
  return (
    <div className="mb-6 flex items-center gap-2">
      {STEP_LABELS.map(({ n, label }, idx) => {
        const done = n < current
        const active = n === current
        return (
          <div key={n} className="flex items-center gap-2">
            <div
              className={`flex h-7 w-7 items-center justify-center rounded-full border text-xs font-semibold transition-colors ${
                done
                  ? 'border-emerald-500/60 bg-emerald-500/20 text-emerald-400'
                  : active
                    ? 'border-primary bg-primary/20 text-primary'
                    : 'border-border/50 text-muted-foreground'
              }`}
            >
              {done ? <CheckCircle2 className="h-4 w-4" /> : n}
            </div>
            <span
              className={`text-sm ${active ? 'font-medium' : 'text-muted-foreground'}`}
            >
              {label}
            </span>
            {idx < STEP_LABELS.length - 1 && (
              <div className={`mx-1 h-px w-8 ${done ? 'bg-emerald-500/40' : 'bg-border/40'}`} />
            )}
          </div>
        )
      })}
    </div>
  )
}

// ─── Main component ─────────────────────────────────────────────────────────

const DEFAULT_VALUES: FormValues = {
  name: '',
  description: '',
  symbol: '',
  strategy: 'sma_crossover',
  shortPeriod: '10',
  longPeriod: '20',
  rsiPeriod: '14',
  interval: '1m',
  trendInterval: '',
  initialBalance: '10000',
  orderQuantity: '0.01',
}

export function GuidedCreateBot() {
  const router = useRouter()
  const token = useAuthStore((s) => s.token)
  const handleError = useHandleApiError()

  const [step, setStep] = useState<Step>(1)
  const [values, setValues] = useState<FormValues>(DEFAULT_VALUES)
  const [errors, setErrors] = useState<FormErrors>({})
  const [instruments, setInstruments] = useState<Instrument[]>([])
  const [loadingInstruments, setLoadingInstruments] = useState(true)
  const [creating, setCreating] = useState(false)
  const [starting, setStarting] = useState(false)
  const [createdBot, setCreatedBot] = useState<BotType | null>(null)

  // Load instruments
  useEffect(() => {
    if (!token) return
    ;(async () => {
      setLoadingInstruments(true)
      try {
        const items = await fetchInstruments(token)
        setInstruments(items)
        if (items.length > 0 && !values.symbol) {
          setValues((v) => ({ ...v, symbol: items[0].symbol }))
        }
      } catch {
        /* handled silently */
      } finally {
        setLoadingInstruments(false)
      }
    })()
  }, [token])

  const onChange = useCallback((patch: Partial<FormValues>) => {
    setValues((prev) => ({ ...prev, ...patch }))
    // Clear field errors for changed keys that match FormErrors shape
    const cleared: Partial<FormErrors> = {}
    for (const key of Object.keys(patch) as (keyof FormValues)[]) {
      if (key in validateStep1(DEFAULT_VALUES)) {
        cleared[key as keyof FormErrors] = undefined
      }
    }
    if (Object.keys(cleared).length > 0) {
      setErrors((prev) => ({ ...prev, ...cleared }))
    }
  }, [])

  async function handleNext() {
    if (step === 1) {
      const errs = validateStep1(values)
      if (Object.keys(errs).length > 0) {
        setErrors(errs)
        return
      }
      setStep(2)
    }
  }

  async function handleCreateAndPreview() {
    if (!token) return
    setCreating(true)
    try {
      const params: Record<string, unknown> = {
        initialBalance: Number(values.initialBalance),
      }
      if (values.strategy === 'sma_crossover') {
        params.shortPeriod = Number(values.shortPeriod)
        params.longPeriod = Number(values.longPeriod)
      } else {
        params.period = Number(values.rsiPeriod)
      }
      if (values.interval) params.interval = values.interval
      if (values.trendInterval && values.trendInterval !== '__none__') {
        params.trendInterval = values.trendInterval
      }
      const bot = await createBot(token, {
        name: values.name.trim(),
        description: values.description.trim() || undefined,
        symbol: values.symbol,
        strategyConfig: { strategy: values.strategy, params },
      })
      setCreatedBot(bot)
      toast({ title: 'Bot created', description: `${bot.name} · ${bot.symbol}` })
      setStep(3)
    } catch (err) {
      handleError(err, 'Could not create bot')
    } finally {
      setCreating(false)
    }
  }

  async function handleStart() {
    if (!token || !createdBot) return
    setStarting(true)
    try {
      const b = await startBot(token, createdBot.id)
      setCreatedBot(b)
      toast({ title: 'Bot started', description: `${b.name} is now running.` })
    } catch (err) {
      handleError(err, 'Could not start bot')
    } finally {
      setStarting(false)
    }
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      {/* Header */}
      <div>
        <Button variant="ghost" size="sm" asChild className="mb-2 -ml-2 cursor-pointer">
          <Link href="/bots">← Back to bots</Link>
        </Button>
        <h1 className="text-3xl font-semibold tracking-tight">Create a bot</h1>
        <p className="text-muted-foreground">
          Set up a new demo trading bot in three steps.
        </p>
        <p className="mt-1.5 inline-flex items-center gap-1 text-xs text-amber-300">
          <ShieldCheck className="h-3.5 w-3.5" />
          Demo environment — no real money is ever traded
        </p>
      </div>

      <StepIndicator current={step} />

      {/* Step 1 */}
      {step === 1 && (
        <Card className="border-border/70 bg-card/80">
          <CardHeader>
            <CardTitle>Step 1 — Configure</CardTitle>
            <CardDescription>
              Give your bot a name, pick a market, and tune the strategy parameters.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <StepOneForm
              values={values}
              errors={errors}
              instruments={instruments}
              loadingInstruments={loadingInstruments}
              onChange={onChange}
            />
            <div className="mt-6 flex justify-end">
              <Button
                onClick={handleNext}
                disabled={loadingInstruments || instruments.length === 0}
                className="cursor-pointer"
              >
                Next: Preview
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Step 2 */}
      {step === 2 && (
        <Card className="border-border/70 bg-card/80">
          <CardHeader>
            <CardTitle>Step 2 — Preview</CardTitle>
            <CardDescription>
              Review your bot configuration and run a quick strategy preview before committing.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <StepTwoPreview values={values} instruments={instruments} />
            <div className="mt-6 flex justify-between">
              <Button
                variant="outline"
                onClick={() => setStep(1)}
                className="cursor-pointer"
              >
                <ArrowLeft className="mr-2 h-4 w-4" />
                Back
              </Button>
              <Button
                onClick={handleCreateAndPreview}
                disabled={creating}
                className="cursor-pointer"
              >
                {creating ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Sparkles className="mr-2 h-4 w-4" />
                )}
                {creating ? 'Creating...' : 'Create bot'}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Step 3 */}
      {step === 3 && createdBot && (
        <StepThreeLaunch
          bot={createdBot}
          onStart={handleStart}
          starting={starting}
        />
      )}
    </div>
  )
}
