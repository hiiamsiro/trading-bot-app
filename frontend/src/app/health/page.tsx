'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { HeartPulse, AlertTriangle, CheckCircle2, Clock, RefreshCw, Bot as BotIcon } from 'lucide-react'
import { useAuthStore } from '@/store/auth.store'
import { fetchBotHealthReport } from '@/lib/api-client'
import { useHandleApiError } from '@/hooks/use-handle-api-error'
import { useTradingSocket } from '@/hooks/use-trading-socket'
import { BotHealthReport, BotHealthIssue, HealthyBot } from '@/types'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { EmptyState } from '@/components/empty-state'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { cn } from '@/lib/utils'

function formatDuration(ms: number): string {
  const totalSeconds = Math.round(ms / 1000)
  if (totalSeconds < 60) return `${totalSeconds}s`
  const totalMinutes = Math.round(totalSeconds / 60)
  if (totalMinutes < 60) return `${totalMinutes}m`
  const totalHours = Math.round(totalMinutes / 60)
  return `${totalHours}h`
}

function formatLocal(iso: string | null | undefined): string {
  if (!iso) return '—'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '—'
  return d.toLocaleString()
}

function HealthIssueRow({ issue }: { issue: BotHealthIssue }) {
  return (
    <TableRow className="hover:bg-muted/40">
      <TableCell className="font-medium">
        <div className="flex flex-col gap-0.5">
          <Link href={`/bots/${issue.botId}`} className="hover:underline">
            {issue.botName}
          </Link>
          <span className="font-mono text-xs text-muted-foreground">{issue.symbol}</span>
        </div>
      </TableCell>
      <TableCell>
        <Badge
          variant="outline"
          className={cn(
            'gap-1',
            issue.issue === 'stuck'
              ? 'border-orange-500/60 text-orange-400'
              : 'border-blue-500/60 text-blue-400',
          )}
        >
          {issue.issue === 'stuck' ? (
            <AlertTriangle className="h-3 w-3" />
          ) : (
            <Clock className="h-3 w-3" />
          )}
          {issue.issue === 'stuck' ? 'Stuck' : 'No data'}
        </Badge>
      </TableCell>
      <TableCell className="text-sm text-muted-foreground">{issue.detail}</TableCell>
      <TableCell className="whitespace-nowrap text-xs text-muted-foreground">
        {formatLocal(issue.lastRunAt)}
      </TableCell>
      <TableCell className="whitespace-nowrap text-xs text-muted-foreground">
        {formatLocal(issue.lastSignalAt)}
      </TableCell>
      <TableCell className="text-right">
        <Button variant="ghost" size="sm" asChild className="cursor-pointer">
          <Link href={`/bots/${issue.botId}`}>Open</Link>
        </Button>
      </TableCell>
    </TableRow>
  )
}

function HealthyRow({ bot }: { bot: HealthyBot }) {
  return (
    <TableRow className="hover:bg-muted/40">
      <TableCell className="font-medium">
        <div className="flex flex-col gap-0.5">
          <Link href={`/bots/${bot.botId}`} className="hover:underline">
            {bot.botName}
          </Link>
          <span className="font-mono text-xs text-muted-foreground">{bot.symbol}</span>
        </div>
      </TableCell>
      <TableCell>
        <Badge className="gap-1 border-green-500/40 bg-green-500/10 text-green-400">
          <CheckCircle2 className="h-3 w-3" />
          Healthy
        </Badge>
      </TableCell>
      <TableCell className="text-sm text-muted-foreground">All systems operational</TableCell>
      <TableCell colSpan={2} />
      <TableCell className="text-right">
        <Button variant="ghost" size="sm" asChild className="cursor-pointer">
          <Link href={`/bots/${bot.botId}`}>Open</Link>
        </Button>
      </TableCell>
    </TableRow>
  )
}

export default function HealthPage() {
  const token = useAuthStore((s) => s.token)
  const user = useAuthStore((s) => s.user)
  const handleError = useHandleApiError()
  const [loading, setLoading] = useState(true)
  const [report, setReport] = useState<BotHealthReport | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)

  const loadReport = useCallback(
    (showLoading: boolean) => {
      if (!token) return
      ;(async () => {
        if (showLoading) setLoading(true)
        setLoadError(null)
        try {
          const data = await fetchBotHealthReport(token)
          setReport(data)
        } catch (e) {
          setLoadError('Could not load health report. Please try again.')
          handleError(e)
        } finally {
          if (showLoading) setLoading(false)
        }
      })()
    },
    [token, handleError],
  )

  useEffect(() => {
    loadReport(true)
  }, [loadReport])

  useTradingSocket({
    token,
    userId: user?.id,
    events: ['bot-status'],
    minRefreshIntervalMs: 30_000,
    onRefresh: () => loadReport(false),
  })

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <Skeleton className="h-9 w-48" />
          <Skeleton className="h-10 w-28" />
        </div>
        <div className="grid gap-4 sm:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-28 rounded-lg" />
          ))}
        </div>
        <Skeleton className="h-64 rounded-lg" />
      </div>
    )
  }

  if (loadError && !report) {
    return (
      <div className="space-y-4">
        <Alert variant="destructive">
          <AlertTitle>Health check failed</AlertTitle>
          <AlertDescription>{loadError}</AlertDescription>
        </Alert>
        <Button className="cursor-pointer" onClick={() => loadReport(true)}>
          <RefreshCw className="mr-2 h-4 w-4" />
          Retry
        </Button>
      </div>
    )
  }

  const totalIssues = (report?.stuck.length ?? 0) + (report?.noData.length ?? 0)
  const allHealthy = totalIssues === 0

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 rounded-xl border border-border/70 bg-card/70 p-6 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-3xl font-semibold tracking-tight">
            <HeartPulse className="h-8 w-8 text-primary" />
            Bot Health
          </h1>
          <p className="mt-1 text-muted-foreground">
            Detects stuck bots and missing market data signals.
          </p>
          {report && (
            <p className="mt-1 text-xs text-muted-foreground">
              {report.totalRunning} running bot{report.totalRunning !== 1 ? 's' : ''} monitored
              {report.totalRunning === 0 && ' — start a bot to see its health'}
            </p>
          )}
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => loadReport(false)}
          className="cursor-pointer"
        >
          <RefreshCw className="mr-2 h-4 w-4" />
          Refresh
        </Button>
      </div>

      {/* Summary cards */}
      {report && (
        <div className="grid gap-4 sm:grid-cols-3">
          <Card className="border-border/70 bg-card/80 backdrop-blur-xl">
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-sm font-medium">
                <AlertTriangle className="h-4 w-4 text-orange-400" />
                Stuck bots
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-semibold">{report.stuck.length}</p>
              <p className="text-xs text-muted-foreground">
                No tick received in &ge;10 min
              </p>
            </CardContent>
          </Card>

          <Card className="border-border/70 bg-card/80 backdrop-blur-xl">
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-sm font-medium">
                <Clock className="h-4 w-4 text-blue-400" />
                No market data
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-semibold">{report.noData.length}</p>
              <p className="text-xs text-muted-foreground">
                No signal evaluated in &ge;10 min
              </p>
            </CardContent>
          </Card>

          <Card className="border-border/70 bg-card/80 backdrop-blur-xl">
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-sm font-medium">
                <CheckCircle2 className="h-4 w-4 text-green-400" />
                Healthy
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-semibold">{report.healthy.length}</p>
              <p className="text-xs text-muted-foreground">
                Bots receiving ticks and data
              </p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* All healthy state */}
      {report && allHealthy && report.totalRunning === 0 && (
        <EmptyState
          icon={BotIcon}
          title="No running bots"
          description="Start a bot from the Bots page to see its health status here."
        >
          <Button asChild className="cursor-pointer">
            <Link href="/bots">Go to Bots</Link>
          </Button>
        </EmptyState>
      )}

      {report && allHealthy && report.totalRunning > 0 && (
        <Alert className="border-green-500/30 bg-green-500/5">
          <CheckCircle2 className="h-4 w-4 text-green-400" />
          <AlertTitle>All bots healthy</AlertTitle>
          <AlertDescription>
            Every running bot is receiving ticks and market data signals as expected.
          </AlertDescription>
        </Alert>
      )}

      {/* Issue tables */}
      {(report?.stuck.length ?? 0) > 0 && (
        <Card className="border-orange-500/30 bg-card/80 backdrop-blur-xl">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <AlertTriangle className="h-5 w-5 text-orange-400" />
              Stuck bots ({report!.stuck.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead>Bot</TableHead>
                  <TableHead>Issue</TableHead>
                  <TableHead>Detail</TableHead>
                  <TableHead>Last tick</TableHead>
                  <TableHead>Last signal</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {report!.stuck.map((issue) => (
                  <HealthIssueRow key={issue.botId} issue={issue} />
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {(report?.noData.length ?? 0) > 0 && (
        <Card className="border-blue-500/30 bg-card/80 backdrop-blur-xl">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Clock className="h-5 w-5 text-blue-400" />
              Bots missing market data ({report!.noData.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead>Bot</TableHead>
                  <TableHead>Issue</TableHead>
                  <TableHead>Detail</TableHead>
                  <TableHead>Last tick</TableHead>
                  <TableHead>Last signal</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {report!.noData.map((issue) => (
                  <HealthIssueRow key={issue.botId} issue={issue} />
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* Healthy table (shown when there are issues, to give full context) */}
      {(report?.healthy.length ?? 0) > 0 && totalIssues > 0 && (
        <Card className="border-border/70 bg-card/80 backdrop-blur-xl">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <CheckCircle2 className="h-5 w-5 text-green-400" />
              Healthy bots ({report!.healthy.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead>Bot</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Detail</TableHead>
                  <TableHead colSpan={2} />
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {report!.healthy.map((bot) => (
                  <HealthyRow key={bot.botId} bot={bot} />
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
