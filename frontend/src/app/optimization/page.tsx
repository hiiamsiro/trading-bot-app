'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuthStore } from '@/store/auth.store'
import { useHandleApiError } from '@/hooks/use-handle-api-error'
import { toast } from '@/hooks/use-toast'
import {
  startOptimization,
  fetchOptimization,
  applyBestConfigToBot,
  type OptimizationRecord,
} from '@/lib/api-client'
import type { OptimizationFormValues } from '@/components/optimization/optimization-form'
import { OptimizationForm } from '@/components/optimization/optimization-form'
import { OptimizationResults, type OptimizationResult } from '@/components/optimization/optimization-results'
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
import { optimizationTooltips } from '@/lib/tooltip-content'

export default function OptimizationPage() {
  const token = useAuthStore((s) => s.token)
  const isAdmin = useAuthStore((s) => s.isAdmin())
  const handleError = useHandleApiError()
  const router = useRouter()

  const [submitting, setSubmitting] = useState(false)
  const [currentRecord, setCurrentRecord] = useState<OptimizationRecord | null>(null)
  const [bots, setBots] = useState<Bot[]>([])
  const [targetBotId, setTargetBotId] = useState('')

  async function handleSubmit(values: OptimizationFormValues) {
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

    // Filter out empty ranges
    const validRanges = paramRanges.filter((r) => r.values.length > 0)
    if (validRanges.length === 0) {
      toast({ title: 'Error', description: 'At least one parameter range with values is required.' })
      setSubmitting(false)
      return
    }

    try {
      const res = await startOptimization(token, {
        symbol: values.symbol,
        interval: values.interval,
        strategy: values.strategy,
        paramRanges: validRanges,
        fromDate: values.fromDate,
        toDate: values.toDate,
        initialBalance: parseFloat(values.initialBalance) || 10000,
      })

      // Fetch initial record
      const record = await fetchOptimization(token, res.id)
      setCurrentRecord(record)

      // Load bots for "apply to bot"
      const allBots = await fetchBots(token)
      setBots(allBots.filter((b) => b.status === 'STOPPED'))

      toast({
        title: 'Optimization started',
        description: `${record.totalCombinations} combinations queued. Results will appear shortly.`,
      })
    } catch (err) {
      handleError(err, 'Failed to start optimization')
    } finally {
      setSubmitting(false)
    }
  }

  async function handleApplyBest(params: Record<string, unknown>) {
    if (!token || !currentRecord) return

    const botId = targetBotId
    if (!botId) {
      toast({ title: 'Select a bot', description: 'Choose a bot to apply this configuration.' })
      return
    }

    try {
      await applyBestConfigToBot(token, botId, currentRecord.strategy, params)
      toast({ title: 'Configuration applied', description: 'The best configuration has been applied to your bot.' })
      router.push(`/bots/${botId}`)
    } catch (err) {
      handleError(err, 'Failed to apply configuration')
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight flex items-center gap-1.5">
          Strategy Optimization
          <InfoTooltip content={optimizationTooltips.pageTitle} side="right" />
        </h1>
        <p className="text-sm text-muted-foreground">
          Automatically test hundreds of parameter combinations to find the best configuration.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-4">
        {/* ── Form ──────────────────────────────── */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-1.5">
              Parameter Ranges
              <span className="ml-1">
                <InfoTooltip content={optimizationTooltips.parameterRangesCard} side="top" />
              </span>
            </CardTitle>
            <CardDescription>
              Define ranges for each parameter. All combinations will be grid-searched.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <OptimizationForm onSubmit={handleSubmit} submitting={submitting} adminOnly={isAdmin} />
          </CardContent>
        </Card>

        {/* ── Results ─────────────────────────── */}
        <div className="lg:col-span-2 space-y-4">
          {currentRecord ? (
            <>
              {/* Bot selector for "apply to bot" */}
              {currentRecord.status === 'COMPLETED' && (
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm flex items-center gap-1">
                      Apply Best Configuration
                      <InfoTooltip content={optimizationTooltips.applyToBot} side="top" />
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="flex gap-2">
                    <div className="flex-1 space-y-1.5">
                      <Label htmlFor="target-bot" className="text-xs">Select bot</Label>
                      {bots.length === 0 ? (
                        <p className="text-xs text-muted-foreground">
                          No stopped bots available. Stop a running bot first to apply this configuration.
                        </p>
                      ) : (
                        <Select value={targetBotId} onValueChange={setTargetBotId}>
                          <SelectTrigger id="target-bot">
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
              <OptimizationResults record={currentRecord} onApplyBest={handleApplyBest} />
            </>
          ) : (
            <Card className="flex h-full min-h-96 items-center justify-center">
              <CardContent className="text-center text-sm text-muted-foreground">
                Define parameter ranges and click <strong>Run Optimization</strong> to start grid search.
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  )
}
