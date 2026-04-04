'use client'

import { Suspense, useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import type { Bot } from '@/types'
import type { StrategyCode } from '@/store/bots.store'
import { useBotsStore } from '@/store/bots.store'
import { useAuthStore } from '@/store/auth.store'
import {
  createBotFromCode,
  fetchInstruments,
  previewBacktest,
} from '@/lib/api-client'
import { useHandleApiError } from '@/hooks/use-handle-api-error'
import { toast } from '@/hooks/use-toast'
import { EmptyState } from '@/components/empty-state'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { InfoTooltip } from '@/components/ui/info-tooltip'
import { Skeleton } from '@/components/ui/skeleton'
import { Badge } from '@/components/ui/badge'
import { BotStatusBadge } from '@/components/bot-status-badge'
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
  CheckCircle2,
  Code2,
  Loader2,
  Play,
  Plus,
  ShieldCheck,
  Sparkles,
} from 'lucide-react'
import type { Instrument } from '@/types'
import type { BacktestResult } from '@/types'

type Step = 1 | 2 | 3

const STEP_LABELS = [
  { n: 1 as Step, label: 'Pick Strategy' },
  { n: 2 as Step, label: 'Configure Bot' },
  { n: 3 as Step, label: 'Preview & Launch' },
]

// ─── Step indicator ─────────────────────────────────────────────────────────

function StepIndicator({ current }: { current: Step }) {
  return (
    <div className="mb-6 flex items-center gap-1.5 overflow-x-auto pb-1 sm:gap-2">
      {STEP_LABELS.map(({ n, label }, idx) => {
        const done = n < current
        const active = n === current
        return (
          <div key={n} className="flex shrink-0 items-center gap-1.5 sm:gap-2">
            <div
              className={`flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full border text-xs font-semibold transition-colors ${
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
              className={`hidden text-xs font-medium sm:block sm:text-sm ${active ? 'font-medium' : 'text-muted-foreground'}`}
            >
              {label}
            </span>
            {idx < STEP_LABELS.length - 1 && (
              <div className={`mx-0.5 h-px w-5 sm:mx-1 sm:w-8 ${done ? 'bg-emerald-500/40' : 'bg-border/40'}`} />
            )}
          </div>
        )
      })}
    </div>
  )
}

// ─── Step 1: Pick strategy code ──────────────────────────────────────────────

function StepOnePick({
  codes,
  loadingCodes,
  selectedId,
  onSelect,
  onCreateNew,
}: {
  codes: StrategyCode[]
  loadingCodes: boolean
  selectedId: string | null
  onSelect: (id: string) => void
  onCreateNew: () => void
}) {
  if (loadingCodes) {
    return (
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {[1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-32 rounded-xl" />
        ))}
      </div>
    )
  }

  if (codes.length === 0) {
    return (
      <EmptyState
        icon={Code2}
        title="No saved strategy codes"
        description="Create your first custom strategy to use it in a bot."
      >
        <Button onClick={onCreateNew} className="cursor-pointer">
          <Plus className="mr-2 h-4 w-4" />
          Create strategy code
        </Button>
      </EmptyState>
    )
  }

  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {codes.map((code) => (
        <Card
          key={code.id}
          className={`cursor-pointer transition-all hover:border-primary/50 hover:bg-card ${
            selectedId === code.id
              ? 'border-primary bg-primary/5'
              : 'border-border/60 bg-card/80'
          }`}
          onClick={() => onSelect(code.id)}
        >
          <CardHeader className="pb-2">
            <div className="flex items-start justify-between gap-2">
              <CardTitle className="text-base leading-snug">{code.name}</CardTitle>
              {selectedId === code.id && (
                <CheckCircle2 className="h-4 w-4 flex-shrink-0 text-primary" />
              )}
            </div>
            <Badge
              variant="outline"
              className={`w-fit text-xs ${code.isValid ? 'bg-emerald-500/10 text-emerald-300 border-emerald-500/30' : 'bg-destructive/10 text-destructive border-destructive/30'}`}
            >
              {code.isValid ? 'Valid' : 'Invalid'}
            </Badge>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground">
              {code.description ?? 'No description'}
            </p>
            <p className="mt-2 font-mono text-xs text-muted-foreground">
              {code.language}{code.code ? ` · ${code.code.split('\n').length} lines` : ''}
            </p>
          </CardContent>
        </Card>
      ))}

      {/* Create new card */}
      <Card
        className="cursor-pointer border-dashed transition-all hover:border-primary/40 hover:bg-primary/5"
        onClick={onCreateNew}
      >
        <CardContent className="flex h-full min-h-[100px] flex-col items-center justify-center gap-2 text-muted-foreground">
          <Plus className="h-6 w-6" />
          <span className="text-sm">Create new</span>
        </CardContent>
      </Card>
    </div>
  )
}

// ─── Step 2: Configure bot ───────────────────────────────────────────────────

function StepTwoConfigure({
  values,
  errors,
  instruments,
  loadingInstruments,
  onChange,
}: {
  values: {
    name: string
    symbol: string
    interval: string
    initialBalance: string
  }
  errors: Record<string, string>
  instruments: Instrument[]
  loadingInstruments: boolean
  onChange: (patch: Partial<typeof values>) => void
}) {
  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <div className="flex items-center gap-1.5">
          <Label htmlFor="bc-name">Bot name</Label>
          <InfoTooltip content="A friendly name to identify your bot." side="right" />
        </div>
        <Input
          id="bc-name"
          value={values.name}
          onChange={(e) => onChange({ name: e.target.value })}
          placeholder="e.g. BTC RSI bot"
        />
        {errors.name && <p className="text-sm text-destructive">{errors.name}</p>}
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label>Trading pair</Label>
          <Select value={values.symbol} onValueChange={(v) => onChange({ symbol: v })}>
            <SelectTrigger className="cursor-pointer">
              <SelectValue
                placeholder={loadingInstruments ? 'Loading…' : 'Select pair'}
              />
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

        <div className="space-y-2">
          <Label>Interval</Label>
          <Select value={values.interval} onValueChange={(v) => onChange({ interval: v })}>
            <SelectTrigger className="cursor-pointer">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {['1m', '5m', '15m', '1h', '4h', '1d'].map((iv) => (
                <SelectItem key={iv} value={iv}>
                  {iv}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="space-y-2">
        <div className="flex items-center gap-1.5">
          <Label htmlFor="bc-bal">Initial balance (demo)</Label>
          <InfoTooltip content="Paper money — no real funds are used." side="right" />
        </div>
        <Input
          id="bc-bal"
          type="number"
          min={1}
          step="any"
          value={values.initialBalance}
          onChange={(e) => onChange({ initialBalance: e.target.value })}
          placeholder="10000"
        />
        {errors.initialBalance && (
          <p className="text-sm text-destructive">{errors.initialBalance}</p>
        )}
      </div>
    </div>
  )
}

// ─── Step 3: Preview & Launch ────────────────────────────────────────────────

function StepThreePreview({
  bot,
  previewResult,
  previewLoading,
  previewError,
  strategyName,
  symbol,
  interval,
}: {
  bot: Bot | null
  previewResult: BacktestResult | null
  previewLoading: boolean
  previewError: string | null
  strategyName: string
  symbol: string
  interval: string
}) {
  return (
    <div className="space-y-4">
      {/* Bot summary */}
      {bot && (
        <Card className="border-emerald-500/30 bg-emerald-500/5">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base text-emerald-300">
              <CheckCircle2 className="h-5 w-5" />
              Bot created successfully!
            </CardTitle>
            <CardDescription>
              <strong className="text-foreground">{bot.name}</strong> is ready to launch.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex flex-wrap items-center gap-3">
              <BotStatusBadge status={bot.status} />
              <Badge variant="outline" className="font-mono text-xs">
                {bot.symbol}
              </Badge>
              <Badge variant="outline" className="font-mono text-xs">
                {interval}
              </Badge>
              <span className="text-xs text-muted-foreground">
                {strategyName}
              </span>
            </div>
            <div className="flex gap-3">
              <Button asChild className="cursor-pointer">
                <Link href={`/bots/${bot.id}`}>View bot</Link>
              </Button>
              <Button variant="outline" asChild className="cursor-pointer">
                <Link href="/bots">Back to bots</Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Backtest preview */}
      <Card className="border-border/70 bg-card/80">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Sparkles className="h-4 w-4 text-primary" />
            Backtest preview
          </CardTitle>
          <CardDescription>
            Simulated performance for {symbol} on {interval} timeframe.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {previewLoading ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Running backtest…
            </div>
          ) : previewError ? (
            <p className="text-sm text-destructive">{previewError}</p>
          ) : previewResult ? (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-6 sm:gap-3">
                <MetricPill label="Total trades" value={previewResult.metrics.totalTrades} />
                <MetricPill
                  label="Win rate"
                  value={previewResult.metrics.winRate != null ? `${previewResult.metrics.winRate.toFixed(1)}%` : '—'}
                  highlight={previewResult.metrics.winRate != null && previewResult.metrics.winRate >= 50}
                />
                <MetricPill
                  label="Net P/L"
                  value={previewResult.metrics.netPnl.toFixed(2)}
                  colored
                />
                <MetricPill
                  label="Max DD"
                  value={`${previewResult.metrics.maxDrawdown.toFixed(1)}%`}
                  danger={previewResult.metrics.maxDrawdown > 20}
                />
                <MetricPill
                  label="Init. bal."
                  value={`$${previewResult.metrics.initialBalance.toLocaleString()}`}
                />
                <MetricPill
                  label="Final bal."
                  value={`$${previewResult.metrics.finalBalance.toLocaleString()}`}
                />
              </div>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              No preview data. The backtest runs automatically on this step.
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

function MetricPill({
  label,
  value,
  colored,
  highlight,
  danger,
}: {
  label: string
  value: string | number
  colored?: boolean
  highlight?: boolean
  danger?: boolean
}) {
  const isPositive = typeof value === 'number' && value > 0
  const isNegative = typeof value === 'number' && value < 0
  return (
    <div className="rounded-md border border-border/50 bg-muted/30 px-2.5 py-2 text-center">
      <p className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</p>
      <p
        className={`mt-0.5 font-mono text-sm font-semibold ${
          danger
            ? 'text-rose-400'
            : colored && isPositive
              ? 'text-emerald-400'
              : colored && isNegative
                ? 'text-rose-400'
                : highlight
                  ? 'text-emerald-400'
                  : ''
        }`}
      >
        {value}
      </p>
    </div>
  )
}

// ─── Main page ───────────────────────────────────────────────────────────────

export default function NewBotCodePage() {
  return (
    <Suspense fallback={<div className="flex h-64 items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>}>
      <NewBotCodePageInner />
    </Suspense>
  )
}

function NewBotCodePageInner() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const token = useAuthStore((s) => s.token)
  const handleError = useHandleApiError()

  const {
    strategyCodes,
    isCodesLoading,
    loadStrategyCodes,
  } = useBotsStore()

  const [step, setStep] = useState<Step>(1)
  const [selectedCodeId, setSelectedCodeId] = useState<string | null>(
    searchParams.get('strategyCodeId'),
  )

  const [formValues, setFormValues] = useState({
    name: '',
    symbol: '',
    interval: '1h',
    initialBalance: '10000',
  })
  const [formErrors, setFormErrors] = useState<Record<string, string>>({})

  const [instruments, setInstruments] = useState<Instrument[]>([])
  const [loadingInstruments, setLoadingInstruments] = useState(true)
  const [creating, setCreating] = useState(false)
  const [previewLoading, setPreviewLoading] = useState(false)
  const [previewResult, setPreviewResult] = useState<BacktestResult | null>(null)
  const [previewError, setPreviewError] = useState<string | null>(null)
  const [createdBot, setCreatedBot] = useState<Bot | null>(null)

  const selectedCode = strategyCodes.find((c) => c.id === selectedCodeId)

  // Load strategy codes
  useEffect(() => {
    if (token) {
      void loadStrategyCodes()
    }
  }, [token, loadStrategyCodes])

  // Load instruments
  useEffect(() => {
    if (!token) return
    ;(async () => {
      setLoadingInstruments(true)
      try {
        const items = await fetchInstruments(token)
        setInstruments(items)
        if (items.length > 0 && !formValues.symbol) {
          setFormValues((v) => ({ ...v, symbol: items[0].symbol }))
        }
      } catch { /* silent */ }
      finally { setLoadingInstruments(false) }
    })()
  }, [token])

  function handleFormChange(patch: Partial<typeof formValues>) {
    setFormValues((v) => ({ ...v, ...patch }))
    // Clear errors for changed fields
    const cleared: Record<string, string> = {}
    for (const key of Object.keys(patch)) {
      cleared[key] = ''
    }
    setFormErrors((prev) => ({ ...prev, ...cleared }))
  }

  function validateStep2() {
    const errs: Record<string, string> = {}
    if (!formValues.name.trim()) errs.name = 'Bot name is required.'
    if (!formValues.symbol) errs.symbol = 'Please select a trading pair.'
    const ib = Number(formValues.initialBalance)
    if (!Number.isFinite(ib) || ib <= 0) errs.initialBalance = 'Initial balance must be > 0.'
    return errs
  }

  async function handleNext() {
    if (step === 1) {
      if (!selectedCodeId) return
      setStep(2)
    } else if (step === 2) {
      const errs = validateStep2()
      if (Object.keys(errs).length > 0) {
        setFormErrors(errs)
        return
      }
      setStep(3)
    }
  }

  async function handleCreate() {
    if (!token || !selectedCodeId) return
    setCreating(true)
    try {
      const bot = await createBotFromCode(token, {
        name: formValues.name.trim(),
        symbol: formValues.symbol,
        interval: formValues.interval,
        initialBalance: Number(formValues.initialBalance),
        strategyCodeId: selectedCodeId,
      })
      setCreatedBot(bot)
      toast({ title: 'Bot created', description: `${bot.name} is ready to launch.` })
      // Run preview
      setPreviewLoading(true)
      setPreviewError(null)
      try {
        const res = await previewBacktest(token, {
          symbol: formValues.symbol,
          interval: formValues.interval,
          strategy: 'custom_code',
          params: { strategyCodeId: selectedCodeId },
        })
        setPreviewResult(res.result)
      } catch {
        // Non-fatal: just don't show preview
      } finally {
        setPreviewLoading(false)
      }
    } catch (err) {
      handleError(err, 'Could not create bot')
    } finally {
      setCreating(false)
    }
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      {/* Header */}
      <div>
        <Button variant="ghost" size="sm" asChild className="mb-2 -ml-2 cursor-pointer">
          <Link href="/bots">← Back to bots</Link>
        </Button>
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Create bot from code</h1>
        <p className="text-muted-foreground">
          Pick a saved strategy script and launch it as a trading bot.
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
            <CardTitle>Step 1 — Pick Strategy</CardTitle>
            <CardDescription>
              Choose a saved strategy code to run as a bot, or create a new one.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <StepOnePick
              codes={strategyCodes}
              loadingCodes={isCodesLoading}
              selectedId={selectedCodeId}
              onSelect={setSelectedCodeId}
              onCreateNew={() => router.push('/strategy-codes/new')}
            />
            <div className="flex justify-end">
              <Button
                onClick={() => void handleNext()}
                disabled={!selectedCodeId}
                className="cursor-pointer"
              >
                Next: Configure
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
            <CardTitle>Step 2 — Configure Bot</CardTitle>
            <CardDescription>
              Give your bot a name and pick the market it will trade on.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <StepTwoConfigure
              values={formValues}
              errors={formErrors}
              instruments={instruments}
              loadingInstruments={loadingInstruments}
              onChange={handleFormChange}
            />
            <div className="flex flex-col gap-2 sm:flex-row sm:justify-between">
              <Button
                variant="outline"
                onClick={() => setStep(1)}
                className="cursor-pointer"
              >
                <ArrowLeft className="mr-2 h-4 w-4" />
                Back
              </Button>
              <Button
                onClick={() => void handleNext()}
                disabled={loadingInstruments}
                className="cursor-pointer"
              >
                Next: Preview
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Step 3 */}
      {step === 3 && (
        <Card className="border-border/70 bg-card/80">
          <CardHeader>
            <CardTitle>Step 3 — Preview &amp; Launch</CardTitle>
            <CardDescription>
              Review the backtest preview and launch your bot.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <StepThreePreview
              bot={createdBot}
              previewResult={previewResult}
              previewLoading={previewLoading}
              previewError={previewError}
              strategyName={selectedCode?.name ?? 'Custom code'}
              symbol={formValues.symbol}
              interval={formValues.interval}
            />
            <div className="flex flex-col gap-2 sm:flex-row sm:justify-between">
              <Button
                variant="outline"
                onClick={() => setStep(2)}
                className="cursor-pointer"
              >
                <ArrowLeft className="mr-2 h-4 w-4" />
                Back
              </Button>
              {!createdBot && (
                <Button
                  onClick={() => void handleCreate()}
                  disabled={creating}
                  className="cursor-pointer"
                >
                  {creating ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Play className="mr-2 h-4 w-4" />
                  )}
                  {creating ? 'Creating…' : 'Create bot'}
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
