'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'
import type { BacktestResult } from '@/types'
import { useBotsStore, type StrategyCode } from '@/store/bots.store'
import { useAuthStore } from '@/store/auth.store'
import { previewBacktest } from '@/lib/api-client'
import { useHandleApiError } from '@/hooks/use-handle-api-error'
import { toast } from '@/hooks/use-toast'
import { CodeEditor, type ValidationResult } from '@/components/bots/code-editor'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  ArrowLeft,
  CheckCircle2,
  Code2,
  Loader2,
  Play,
  XCircle,
} from 'lucide-react'

export default function StrategyCodeDetailPage() {
  const params = useParams()
  const router = useRouter()
  const id = typeof params.id === 'string' ? params.id : ''
  const token = useAuthStore((s) => s.token)
  const handleError = useHandleApiError()

  const { loadStrategyCode, updateStrategyCode, validateCode } = useBotsStore()

  const [code, setCode] = useState<StrategyCode | null>(null)
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [editorValue, setEditorValue] = useState('')
  const [isDirty, setIsDirty] = useState(false)

  const [saving, setSaving] = useState(false)
  const [isValidating, setIsValidating] = useState(false)
  const [validationResult, setValidationResult] = useState<ValidationResult | null>(null)

  const [previewLoading, setPreviewLoading] = useState(false)
  const [previewResult, setPreviewResult] = useState<BacktestResult | null>(null)
  const [previewError, setPreviewError] = useState<string | null>(null)

  // Load strategy code
  useEffect(() => {
    if (!id) return
    ;(async () => {
      setLoading(true)
      setNotFound(false)
      try {
        const sc = await loadStrategyCode(id)
        if (!sc) {
          setNotFound(true)
          setCode(null)
        } else {
          setCode(sc)
          setName(sc.name)
          setDescription(sc.description ?? '')
          setEditorValue(sc.code ?? '')
          setValidationResult({ valid: sc.isValid })
        }
      } catch {
        setNotFound(true)
      } finally {
        setLoading(false)
      }
    })()
  }, [id, loadStrategyCode])

  const handleCodeChange = useCallback((newValue: string) => {
    setEditorValue(newValue)
    setIsDirty(true)
    setValidationResult(null)
  }, [])

  async function handleSave() {
    if (!token || !code) return
    setSaving(true)
    try {
      const updated = await updateStrategyCode(code.id, {
        name: name.trim() || code.name,
        description: description.trim() || undefined,
        code: editorValue,
      })
      setCode(updated)
      setIsDirty(false)
      toast({ title: 'Strategy code saved' })
    } catch (err) {
      handleError(err, 'Could not save strategy code')
    } finally {
      setSaving(false)
    }
  }

  async function handleValidate() {
    if (!token) return
    setIsValidating(true)
    setValidationResult(null)
    try {
      const result = await validateCode(editorValue)
      setValidationResult(result)
      if (result.valid) {
        toast({ title: 'Code is valid', description: 'No syntax errors found.' })
      }
    } catch (err) {
      handleError(err, 'Validation failed')
    } finally {
      setIsValidating(false)
    }
  }

  async function handleRunPreview() {
    if (!token || !code) return
    setPreviewLoading(true)
    setPreviewError(null)
    setPreviewResult(null)
    try {
      const res = await previewBacktest(token, {
        symbol: 'BTCUSDT',
        interval: '1h',
        strategy: 'custom_code',
        params: { strategyCodeId: code.id, code: editorValue },
      })
      setPreviewResult(res.result)
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Preview failed'
      setPreviewError(msg)
    } finally {
      setPreviewLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (notFound || !code) {
    return (
      <div className="space-y-4">
        <Alert variant="destructive">
          <AlertTitle>Not found</AlertTitle>
          <AlertDescription>This strategy code does not exist or you do not have access.</AlertDescription>
        </Alert>
        <Button asChild variant="outline">
          <Link href="/strategy-codes">Back to strategy codes</Link>
        </Button>
      </div>
    )
  }

  return (
    <div className="flex h-[calc(100vh-4rem)] flex-col">
      {/* Top bar */}
      <div className="flex flex-shrink-0 items-center justify-between gap-3 border-b border-border/60 bg-muted/30 px-4 py-3">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" asChild className="-ml-2 cursor-pointer">
            <Link href="/strategy-codes">
              <ArrowLeft className="mr-1 h-4 w-4" />
              Back
            </Link>
          </Button>
          <div className="h-4 w-px bg-border/50" />
          <span className="font-medium">{name || code.name}</span>
          <Badge variant="outline" className="text-xs">
            {code.language}
          </Badge>
          {isDirty && (
            <Badge variant="outline" className="text-xs text-amber-400 border-amber-400/40">
              Unsaved
            </Badge>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => void handleValidate()}
            disabled={isValidating}
            className="h-8 cursor-pointer gap-1.5 text-xs"
          >
            {isValidating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
            Validate
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => void handleRunPreview()}
            disabled={previewLoading}
            className="h-8 cursor-pointer gap-1.5 text-xs"
          >
            <Play className="h-3.5 w-3.5" />
            Preview
          </Button>
          <Button
            variant="default"
            size="sm"
            onClick={() => void handleSave()}
            disabled={saving || !isDirty}
            className="h-8 cursor-pointer gap-1.5 text-xs"
          >
            {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
            {saving ? 'Saving…' : 'Save'}
          </Button>
        </div>
      </div>

      {/* Split layout */}
      <div className="flex min-h-0 min-w-0 flex-1">
        {/* Left: editor (60%) */}
        <div className="min-h-0 flex-1 border-r border-border/40">
          <CodeEditor
            value={editorValue}
            onChange={handleCodeChange}
            onSave={handleSave}
            onValidate={handleValidate}
            onRunPreview={handleRunPreview}
            validationResult={validationResult}
            previewResult={previewResult}
            isValidating={isValidating}
            isSaving={saving}
            isPreviewLoading={previewLoading}
            language={code.language}
            name={`${name || code.name}.js`}
          />
        </div>

        {/* Right: results panel (40%) */}
        <div className="flex min-h-0 w-0 min-w-[320px] flex-col overflow-y-auto bg-muted/10">
          <div className="flex-1 space-y-3 p-4">
            {/* Validation summary */}
            <Card className="border-border/70 bg-card/80">
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-sm">
                  <Code2 className="h-4 w-4 text-primary" />
                  Code status
                </CardTitle>
              </CardHeader>
              <CardContent>
                {isValidating ? (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Validating…
                  </div>
                ) : validationResult ? (
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      {validationResult.valid ? (
                        <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                      ) : (
                        <XCircle className="h-4 w-4 text-destructive" />
                      )}
                      <span className={`text-sm font-medium ${validationResult.valid ? 'text-emerald-400' : 'text-destructive'}`}>
                        {validationResult.valid ? 'Valid' : 'Invalid'}
                      </span>
                    </div>
                    {validationResult.error && (
                      <p className="text-xs text-destructive">{validationResult.error}</p>
                    )}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    Click Validate to check for errors.
                  </p>
                )}
              </CardContent>
            </Card>

            {/* Preview button */}
            <Card className="border-border/70 bg-card/80">
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-sm">
                  <Play className="h-4 w-4 text-primary" />
                  Backtest preview
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <p className="text-xs text-muted-foreground">
                  Run a quick backtest to preview performance before creating a bot.
                </p>
                {previewLoading ? (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Running preview…
                  </div>
                ) : previewError ? (
                  <Alert variant="destructive" className="py-2">
                    <AlertDescription className="text-xs">{previewError}</AlertDescription>
                  </Alert>
                ) : previewResult ? (
                  <div className="space-y-2">
                    {/* Metrics grid */}
                    <div className="grid grid-cols-2 gap-2">
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
                        label="Max drawdown"
                        value={`${previewResult.metrics.maxDrawdown.toFixed(2)}%`}
                        danger={previewResult.metrics.maxDrawdown > 20}
                      />
                      <MetricPill
                        label="Final balance"
                        value={previewResult.metrics.finalBalance.toFixed(2)}
                      />
                      <MetricPill
                        label="Avg win"
                        value={previewResult.metrics.averageWin?.toFixed(2) ?? '—'}
                      />
                    </div>

                    {/* Recent trades */}
                    {previewResult.trades.length > 0 && (
                      <div>
                        <p className="mb-1.5 text-xs font-medium text-muted-foreground">
                          Recent trades
                        </p>
                        <div className="rounded-md border border-border/50 bg-muted/30">
                          <Table>
                            <TableHeader>
                              <TableRow className="hover:bg-transparent">
                                <TableHead className="py-1.5">Side</TableHead>
                                <TableHead className="py-1.5 text-right">Entry</TableHead>
                                <TableHead className="py-1.5 text-right">Exit</TableHead>
                                <TableHead className="py-1.5 text-right">P/L</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {previewResult.trades.slice(0, 5).map((t) => (
                                <TableRow key={t.id} className="hover:bg-muted/40">
                                  <TableCell className="py-1.5">
                                    <Badge
                                      variant="outline"
                                      className={
                                        t.side === 'BUY'
                                          ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-300 text-xs'
                                          : 'border-rose-500/40 bg-rose-500/10 text-rose-300 text-xs'
                                      }
                                    >
                                      {t.side}
                                    </Badge>
                                  </TableCell>
                                  <TableCell className="py-1.5 text-right font-mono text-xs">
                                    {t.entryPrice.toFixed(2)}
                                  </TableCell>
                                  <TableCell className="py-1.5 text-right font-mono text-xs">
                                    {t.exitPrice != null ? t.exitPrice.toFixed(2) : '—'}
                                  </TableCell>
                                  <TableCell
                                    className={`py-1.5 text-right font-mono text-xs ${
                                      t.netPnl != null && t.netPnl > 0
                                        ? 'text-emerald-400'
                                        : t.netPnl != null && t.netPnl < 0
                                          ? 'text-rose-400'
                                          : 'text-muted-foreground'
                                    }`}
                                  >
                                    {t.netPnl != null ? t.netPnl.toFixed(2) : '—'}
                                  </TableCell>
                                </TableRow>
                              ))}
                            </TableBody>
                          </Table>
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground">
                    No preview run yet. Click Preview to run a backtest.
                  </p>
                )}
              </CardContent>
            </Card>

            {/* Use in bot */}
            <Button
              variant="outline"
              asChild
              className="w-full cursor-pointer"
            >
              <Link href={`/bots/new/code?strategyCodeId=${code.id}`}>
                <Play className="mr-2 h-4 w-4" />
                Create bot from this code
              </Link>
            </Button>
          </div>
        </div>
      </div>
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
    <div className="rounded-md border border-border/50 bg-muted/30 px-2.5 py-1.5">
      <p className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</p>
      <p
        className={`font-mono text-sm font-semibold ${
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
