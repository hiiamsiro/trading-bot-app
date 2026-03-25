'use client'

import { useEffect, useState, useCallback, useMemo } from 'react'
import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'
import { Loader2, Play, Square, Trash2, Pencil, ShieldCheck } from 'lucide-react'
import { ApiError } from '@/lib/api'
import { Bot, BotStatus, Instrument } from '@/types'
import { useAuthStore } from '@/store/auth.store'
import {
  deleteBot,
  fetchBot,
  fetchInstruments,
  startBot,
  stopBot,
} from '@/lib/api-client'
import { useHandleApiError } from '@/hooks/use-handle-api-error'
import { useTradingSocket } from '@/hooks/use-trading-socket'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { BotStatusBadge } from '@/components/bot-status-badge'
import { toast } from '@/hooks/use-toast'
import { LiveMarketChartPanel } from '@/components/charts/live-market-chart-panel'

export default function BotDetailPage() {
  const params = useParams()
  const router = useRouter()
  const id = typeof params.id === 'string' ? params.id : ''
  const token = useAuthStore((s) => s.token)
  const user = useAuthStore((s) => s.user)
  const handleError = useHandleApiError()
  const [loading, setLoading] = useState(true)
  const [bot, setBot] = useState<Bot | null>(null)
  const [notFound, setNotFound] = useState(false)
  const [actionLoading, setActionLoading] = useState<string | null>(null)
  const [instruments, setInstruments] = useState<Instrument[]>([])

  const load = useCallback(async () => {
    if (!token || !id) return
    setLoading(true)
    setNotFound(false)
    try {
      const b = await fetchBot(token, id)
      setBot(b)
    } catch (e) {
      if (e instanceof ApiError && e.status === 404) {
        setNotFound(true)
        setBot(null)
      } else {
        handleError(e)
      }
    } finally {
      setLoading(false)
    }
  }, [token, id, handleError])

  useEffect(() => {
    load()
  }, [load])

  useEffect(() => {
    if (!token) return
    let cancelled = false
    void (async () => {
      try {
        const list = await fetchInstruments(token)
        if (!cancelled) setInstruments(list)
      } catch {
        if (!cancelled) setInstruments([])
      }
    })()
    return () => {
      cancelled = true
    }
  }, [token])

  useTradingSocket({
    userId: user?.id,
    botId: id || undefined,
    onRefresh: load,
  })

  const chartInstrumentSymbols = useMemo(() => {
    const s = new Set(instruments.map((i) => i.symbol))
    if (bot) {
      s.add(bot.symbol)
    }
    return Array.from(s)
  }, [instruments, bot])

  async function onStart() {
    if (!token || !id) return
    setActionLoading('start')
    try {
      const b = await startBot(token, id)
      setBot(b)
      toast({ title: 'Bot started' })
    } catch (e) {
      handleError(e)
    } finally {
      setActionLoading(null)
    }
  }

  async function onStop() {
    if (!token || !id) return
    setActionLoading('stop')
    try {
      const b = await stopBot(token, id)
      setBot(b)
      toast({ title: 'Bot stopped' })
    } catch (e) {
      handleError(e)
    } finally {
      setActionLoading(null)
    }
  }

  async function onDelete() {
    if (!token || !id) return
    if (!confirm('Delete this bot permanently?')) return
    setActionLoading('delete')
    try {
      await deleteBot(token, id)
      toast({ title: 'Bot deleted' })
      router.replace('/bots')
    } catch (e) {
      handleError(e)
    } finally {
      setActionLoading(null)
    }
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-64 rounded-lg" />
      </div>
    )
  }

  if (notFound || !bot) {
    return (
      <div className="space-y-4">
        <Alert variant="destructive">
          <AlertTitle>Not found</AlertTitle>
          <AlertDescription>
            This bot does not exist or you do not have access.
          </AlertDescription>
        </Alert>
        <Button asChild variant="outline">
          <Link href="/bots">Back to bots</Link>
        </Button>
      </div>
    )
  }

  const session = bot.executionSession

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <Button variant="ghost" size="sm" asChild className="mb-2 -ml-2 cursor-pointer">
            <Link href="/bots">← Bots</Link>
          </Button>
          <h1 className="text-3xl font-semibold tracking-tight">{bot.name}</h1>
          <div className="mt-1 flex flex-wrap items-center gap-2 text-muted-foreground">
            <BotStatusBadge status={bot.status} />
            <span className="font-mono">{bot.symbol}</span>
          </div>
          <p className="mt-2 inline-flex items-center gap-1 text-xs text-amber-300">
            <ShieldCheck className="h-3.5 w-3.5" />
            Controlled execution and full session visibility
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {bot.status === BotStatus.RUNNING ? (
            <Button
              variant="secondary"
              className="cursor-pointer"
              onClick={onStop}
              disabled={!!actionLoading}
            >
              {actionLoading === 'stop' ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Square className="mr-2 h-4 w-4" />
              )}
              Stop
            </Button>
          ) : (
            <Button onClick={onStart} disabled={!!actionLoading} className="cursor-pointer">
              {actionLoading === 'start' ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Play className="mr-2 h-4 w-4" />
              )}
              Start
            </Button>
          )}
          <Button variant="outline" asChild className="cursor-pointer">
            <Link href={`/bots/${id}/edit`}>
              <Pencil className="mr-2 h-4 w-4" />
              Edit
            </Link>
          </Button>
          <Button variant="outline" asChild className="cursor-pointer">
            <Link href={`/logs?botId=${id}`}>Logs</Link>
          </Button>
          <Button
            variant="destructive"
            className="cursor-pointer"
            onClick={onDelete}
            disabled={!!actionLoading}
          >
            {actionLoading === 'delete' ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Trash2 className="mr-2 h-4 w-4" />
            )}
            Delete
          </Button>
        </div>
      </div>

      {bot.description && (
        <p className="text-sm text-muted-foreground">{bot.description}</p>
      )}

      <LiveMarketChartPanel
        token={token ?? undefined}
        instrumentSymbols={chartInstrumentSymbols}
        activeSymbol={bot.symbol}
        title="Price action"
      />

      <div className="grid gap-4 md:grid-cols-2">
        <Card className="border-border/70 bg-card/80 backdrop-blur-xl">
          <CardHeader>
            <CardTitle className="text-lg">Strategy</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            {bot.strategyConfig ? (
              <>
                <p>
                  <span className="text-muted-foreground">Key: </span>
                  {bot.strategyConfig.strategy}
                </p>
                <pre className="mt-2 max-h-40 overflow-auto rounded-md bg-muted p-3 font-mono text-xs">
                  {JSON.stringify(bot.strategyConfig.params, null, 2)}
                </pre>
              </>
            ) : (
              <p className="text-muted-foreground">
                No strategy configured. Add one via API or recreate the bot — starting requires a strategy.
              </p>
            )}
          </CardContent>
        </Card>
        <Card className="border-border/70 bg-card/80 backdrop-blur-xl">
          <CardHeader>
            <CardTitle className="text-lg">Execution session</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            {session ? (
              <>
                <p>
                  <span className="text-muted-foreground">Total trades: </span>
                  {session.totalTrades}
                </p>
                <p>
                  <span className="text-muted-foreground">P/L: </span>
                  <span className="font-mono">{session.profitLoss.toFixed(2)}</span>
                </p>
                <p>
                  <span className="text-muted-foreground">Balance: </span>
                  <span className="font-mono">
                    {session.currentBalance.toFixed(2)} / {session.initialBalance.toFixed(2)}
                  </span>
                </p>
                <p className="text-xs text-muted-foreground">
                  Started {new Date(session.startedAt).toLocaleString()}
                  {session.endedAt
                    ? ` · Ended ${new Date(session.endedAt).toLocaleString()}`
                    : ''}
                </p>
              </>
            ) : (
              <p className="text-muted-foreground">No session until the bot runs.</p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
