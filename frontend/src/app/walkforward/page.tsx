'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuthStore } from '@/store/auth.store'
import { useHandleApiError } from '@/hooks/use-handle-api-error'
import { toast } from '@/hooks/use-toast'
import {
  startWalkforward,
  fetchWalkforward,
  applyBestConfigToBot,
  type WalkforwardRecord,
} from '@/lib/api-client'
import { OptimizationForm } from '@/components/optimization/optimization-form'
import { WalkforwardResults } from '@/components/walkforward/walkforward-results'
import { fetchBots } from '@/lib/api-client'
import { Bot } from '@/types'
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
import { Label } from '@/components/ui/label'
import { InfoTooltip } from '@/components/ui/info-tooltip'
import { walkforwardTooltips } from '@/lib/tooltip-content'

export default function WalkforwardPage() {
  const token = useAuthStore((s) => s.token)
  const isAdmin = useAuthStore((s) => s.isAdmin())
  const handleError = useHandleApiError()
  const router = useRouter()

  const [submitting, setSubmitting] = useState(false)
  const [currentRecord, setCurrentRecord] = useState<WalkforwardRecord | null>(null)
  const [bots, setBots] = useState<Bot[]>([])
  const [targetBotId, setTargetBotId] = useState('')
  const [trainSplitPct, setTrainSplitPct] = useState('70')

  async function handleSubmit(values: {
    symbol: string
    interval: string
    strategy: string
    fromDate: string
    toDate: string
    initialBalance: string
    paramRanges: { param: string; values: string }[]
  }) {
    if (!token) return
    setSubmitting(true)
    setCurrentRecord(null)

    const paramRanges = values.paramRanges.map((r) => ({
      param: r.param,
      values: r.values
        .split(',')
        .map((v) => parseFloat(v.trim()))
        .filter((v) => !isNaN(v)),
    }))

    const validRanges = paramRanges.filter((r) => r.values.length > 0)
    if (validRanges.length === 0) {
      toast({ title: 'Error', description: 'At least one parameter range with values is required.' })
      setSubmitting(false)
      return
    }

    try {
      const res = await startWalkforward(token, {
        symbol: values.symbol,
        interval: values.interval,
        strategy: values.strategy,
        paramRanges: validRanges,
        fromDate: values.fromDate,
        toDate: values.toDate,
        initialBalance: parseFloat(values.initialBalance) || 10000,
        trainSplitPct: parseInt(trainSplitPct, 10) || 70,
      })

      const record = await fetchWalkforward(token, res.id)
      setCurrentRecord(record)

      const allBots = await fetchBots(token)
      setBots(allBots.filter((b) => b.status === 'STOPPED'))

      toast({
        title: 'Walk-forward analysis started',
        description: 'Training on first portion, evaluating on the rest. Results appear when done.',
      })
    } catch (err) {
      handleError(err, 'Failed to start walk-forward analysis')
    } finally {
      setSubmitting(false)
    }
  }

  async function handleApplyBest(params: Record<string, unknown>) {
    if (!token || !currentRecord) return

    const botId = targetBotId
    if (!botId) {
      toast({ title: 'Select a bot', description: 'Choose a bot to apply the best training config.' })
      return
    }

    try {
      await applyBestConfigToBot(token, botId, currentRecord.strategy, params)
      toast({ title: 'Configuration applied', description: 'Best training configuration applied to your bot.' })
      router.push(`/bots/${botId}`)
    } catch (err) {
      handleError(err, 'Failed to apply configuration')
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight flex items-center gap-1.5">
          Walk-Forward Testing
          <InfoTooltip content={walkforwardTooltips.pageTitle} side="right" />
        </h1>
        <p className="text-sm text-muted-foreground">
          Optimize on training data, validate on unseen test data — avoid overfitting.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-4">
        {/* ── Form ──────────────────────────────── */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-1.5">
              Walk-Forward Configuration
              <InfoTooltip content={walkforwardTooltips.configurationTitle} side="top" />
            </CardTitle>
            <CardDescription className="flex items-start gap-1.5">
              Define parameter ranges. System splits data 70/30 by default.
              <InfoTooltip content={walkforwardTooltips.defaultSplitDescription} side="top" />
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="train-split" className="inline-flex items-center gap-1">
                Train / Test Split
                <InfoTooltip content={walkforwardTooltips.trainTestSplit} side="top" />
              </Label>
              <Select value={trainSplitPct} onValueChange={setTrainSplitPct}>
                <SelectTrigger id="train-split">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="60">60% train / 40% test</SelectItem>
                  <SelectItem value="70">70% train / 30% test</SelectItem>
                  <SelectItem value="80">80% train / 20% test</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <OptimizationForm onSubmit={handleSubmit} submitting={submitting} adminOnly={isAdmin} />
          </CardContent>
        </Card>

        {/* ── Results ─────────────────────────── */}
        <div className="lg:col-span-2 space-y-4">
          {currentRecord ? (
            <>
              {currentRecord.status === 'COMPLETED' && (
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm flex items-center gap-1">
                      Apply Best Config
                      <InfoTooltip content={walkforwardTooltips.applyBestConfig} side="top" />
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="flex gap-2">
                    <div className="flex-1 space-y-1.5">
                      <Label htmlFor="target-bot-wf" className="text-xs">Select bot</Label>
                      {bots.length === 0 ? (
                        <p className="text-xs text-muted-foreground">
                          No stopped bots available. Stop a running bot first to apply this configuration.
                        </p>
                      ) : (
                        <Select value={targetBotId} onValueChange={setTargetBotId}>
                          <SelectTrigger id="target-bot-wf">
                            <SelectValue placeholder="Choose a stopped bot…" />
                          </SelectTrigger>
                          <SelectContent>
                            {bots.map((bot) => (
                              <SelectItem key={bot.id} value={bot.id}>
                                {bot.name} ({bot.symbol})
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      )}
                    </div>
                  </CardContent>
                </Card>
              )}
              <WalkforwardResults record={currentRecord} onApplyBest={handleApplyBest} />
            </>
          ) : (
            <Card className="flex h-full min-h-96 items-center justify-center">
              <CardContent className="text-center text-sm text-muted-foreground">
                Configure your analysis and click <strong>Run Walk-Forward</strong> to see train vs test results.
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  )
}
