'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { Bot, BotStatus, Trade, TradeStatus } from '@/types'
import { useAuthStore } from '@/store/auth.store'
import { fetchBots, fetchTrades } from '@/lib/api-client'
import { useHandleApiError } from '@/hooks/use-handle-api-error'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { Activity } from 'lucide-react'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'

export default function AdminMonitoringPage() {
  const token = useAuthStore((s) => s.token)
  const handleError = useHandleApiError()
  const [loading, setLoading] = useState(true)
  const [bots, setBots] = useState<Bot[]>([])
  const [trades, setTrades] = useState<Trade[]>([])

  useEffect(() => {
    if (!token) return
    let cancelled = false
    ;(async () => {
      setLoading(true)
      try {
        const [b, t] = await Promise.all([fetchBots(token), fetchTrades(token)])
        if (!cancelled) {
          setBots(b)
          setTrades(t)
        }
      } catch (e) {
        if (!cancelled) {
          handleError(e)
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [token, handleError])

  const stats = useMemo(() => {
    const running = bots.filter((b) => b.status === BotStatus.RUNNING).length
    const stopped = bots.filter((b) => b.status === BotStatus.STOPPED).length
    const errored = bots.filter((b) => b.status === BotStatus.ERROR).length
    const executed = trades.filter((x) => x.status === TradeStatus.EXECUTED).length
    const closed = trades.filter((x) => x.status === TradeStatus.CLOSED).length
    const openExecuted = trades.filter(
      (x) => x.status === TradeStatus.EXECUTED && !x.closedAt,
    ).length
    const pnlSum = trades.reduce((acc, x) => acc + (x.realizedPnl ?? 0), 0)
    return {
      running,
      stopped,
      errored,
      executed,
      closed,
      openExecuted,
      pnlSum,
    }
  }, [bots, trades])

  if (loading) {
    return (
      <div className="space-y-8">
        <Skeleton className="h-9 w-64" />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-28 rounded-lg" />
          ))}
        </div>
        <Skeleton className="h-64 rounded-lg" />
      </div>
    )
  }

  return (
    <div className="space-y-8">
      <div className="rounded-xl border border-border/70 bg-card/70 p-6">
        <h1 className="flex items-center gap-2 text-3xl font-semibold tracking-tight">
          <Activity className="h-8 w-8 text-primary" />
          Monitoring
        </h1>
        <p className="mt-1 text-muted-foreground">
          Workspace overview from live <code className="text-xs">/bots</code> and{' '}
          <code className="text-xs">/trades</code> responses (your account).
        </p>
        <Badge className="mt-3 border border-amber-400/40 bg-amber-400/15 text-amber-300">
          Trust and authority metrics
        </Badge>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="border-border/70 bg-card/80 backdrop-blur-xl">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Bots</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold">{bots.length}</p>
            <p className="text-xs text-muted-foreground">
              {stats.running} running · {stats.stopped} stopped
              {stats.errored ? ` · ${stats.errored} error` : ''}
            </p>
          </CardContent>
        </Card>
        <Card className="border-border/70 bg-card/80 backdrop-blur-xl">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Trades</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold">{trades.length}</p>
            <p className="text-xs text-muted-foreground">
              {stats.executed} executed · {stats.closed} closed
            </p>
          </CardContent>
        </Card>
        <Card className="border-border/70 bg-card/80 backdrop-blur-xl">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Open positions</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold">{stats.openExecuted}</p>
            <p className="text-xs text-muted-foreground">EXECUTED and not closed</p>
          </CardContent>
        </Card>
        <Card className="border-border/70 bg-card/80 backdrop-blur-xl">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Realized P/L (sum)</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="font-mono text-2xl font-semibold">{stats.pnlSum.toFixed(2)}</p>
            <p className="text-xs text-muted-foreground">From trade records</p>
          </CardContent>
        </Card>
      </div>

      <Card className="border-border/70 bg-card/80 backdrop-blur-xl">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-lg">Bots snapshot</CardTitle>
          <Link
            href="/bots"
            className="cursor-pointer text-sm text-primary underline-offset-4 hover:underline"
          >
            Manage
          </Link>
        </CardHeader>
        <CardContent>
          {bots.length === 0 ? (
            <p className="text-sm text-muted-foreground">No bots.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead>Name</TableHead>
                  <TableHead>Symbol</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Session P/L</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {bots.map((b) => (
                  <TableRow key={b.id} className="transition-colors duration-200 hover:bg-muted/40">
                    <TableCell className="font-medium">
                      <Link href={`/bots/${b.id}`} className="cursor-pointer hover:underline">
                        {b.name}
                      </Link>
                    </TableCell>
                    <TableCell className="font-mono">{b.symbol}</TableCell>
                    <TableCell>
                      <Badge variant="outline">{b.status}</Badge>
                    </TableCell>
                    <TableCell className="font-mono">
                      {b.executionSession
                        ? b.executionSession.profitLoss.toFixed(2)
                        : '—'}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
