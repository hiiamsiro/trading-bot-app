'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { Bot, Trade, BotStatus } from '@/types'
import { useAuthStore } from '@/store/auth.store'
import { fetchBots, fetchTrades } from '@/lib/api-client'
import { useHandleApiError } from '@/hooks/use-handle-api-error'
import { useTradingSocket } from '@/hooks/use-trading-socket'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { EmptyState } from '@/components/empty-state'
import { Bot as BotIcon, History, TrendingUp, Zap, ShieldCheck, Cpu, TimerReset } from 'lucide-react'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'

export default function DashboardPage() {
  const token = useAuthStore((s) => s.token)
  const user = useAuthStore((s) => s.user)
  const handleError = useHandleApiError()
  const [loading, setLoading] = useState(true)
  const [bots, setBots] = useState<Bot[]>([])
  const [trades, setTrades] = useState<Trade[]>([])
  const [tradeTotal, setTradeTotal] = useState(0)

  const reload = useCallback(() => {
    if (!token) return
    ;(async () => {
      try {
        const [b, t] = await Promise.all([fetchBots(token), fetchTrades(token)])
        setBots(b)
        setTradeTotal(t.length)
        setTrades(t.slice(0, 8))
      } catch (e) {
        handleError(e)
      }
    })()
  }, [token, handleError])

  useEffect(() => {
    if (!token) return
    let cancelled = false
    ;(async () => {
      setLoading(true)
      try {
        const [b, t] = await Promise.all([fetchBots(token), fetchTrades(token)])
        if (!cancelled) {
          setBots(b)
          setTradeTotal(t.length)
          setTrades(t.slice(0, 8))
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

  useTradingSocket({
    userId: user?.id,
    onRefresh: reload,
  })

  const running = bots.filter((b) => b.status === BotStatus.RUNNING).length
  const successRate = tradeTotal === 0 ? 0 : Math.round((running / Math.max(bots.length, 1)) * 100)
  const stopped = Math.max(bots.length - running, 0)
  const formatTradeTime = (value: string) =>
    new Date(value).toLocaleString([], {
      month: 'short',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    })

  if (loading) {
    return (
      <div className="space-y-8">
        <div>
          <Skeleton className="h-9 w-64" />
          <Skeleton className="mt-2 h-4 w-96" />
        </div>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
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
      <div className="rounded-xl border border-border/70 bg-card/70 p-6 shadow-sm backdrop-blur-xl">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-semibold tracking-tight">Dashboard</h1>
            <p className="mt-1 text-muted-foreground">
              Welcome back{user?.name ? `, ${user.name}` : ''}. Demo trading overview.
            </p>
          </div>
          <Badge className="border border-primary/40 bg-primary/15 px-3 py-1 text-primary">
            Live monitoring enabled
          </Badge>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Card className="border-border/70 bg-card/80 backdrop-blur-xl">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Bots</CardTitle>
            <BotIcon className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold">{bots.length}</p>
            <p className="text-xs text-muted-foreground">
              {running} running · {bots.length - running} stopped
            </p>
          </CardContent>
        </Card>
        <Card className="border-border/70 bg-card/80 backdrop-blur-xl">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Trades</CardTitle>
            <History className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold">{tradeTotal}</p>
            <p className="text-xs text-muted-foreground">All trades for your bots</p>
          </CardContent>
        </Card>
        <Card className="border-border/70 bg-card/80 backdrop-blur-xl">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Runtime health</CardTitle>
            <TrendingUp className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold">{successRate}%</p>
            <p className="text-xs text-muted-foreground">Bot runtime utilization</p>
          </CardContent>
        </Card>
        <Card className="border-border/70 bg-card/80 backdrop-blur-xl">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Quick actions</CardTitle>
            <Zap className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent className="flex flex-col gap-2">
            <Button asChild size="sm" className="cursor-pointer">
              <Link href="/bots/new">Create bot</Link>
            </Button>
            <Button asChild variant="outline" size="sm" className="cursor-pointer">
              <Link href="/trades">View trade history</Link>
            </Button>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="border-border/70 bg-card/80 backdrop-blur-xl lg:col-span-2">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">System integrity</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3 sm:grid-cols-3">
            <div className="rounded-lg border border-border/70 bg-background/60 p-3">
              <p className="flex items-center gap-2 text-sm font-medium">
                <ShieldCheck className="h-4 w-4 text-primary" />
                Auth & guards
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                Protected routes with JWT session validation.
              </p>
            </div>
            <div className="rounded-lg border border-border/70 bg-background/60 p-3">
              <p className="flex items-center gap-2 text-sm font-medium">
                <Cpu className="h-4 w-4 text-primary" />
                Bot engine
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                {running > 0
                  ? `${running} strategies active in demo mode.`
                  : 'No active strategy execution right now.'}
              </p>
            </div>
            <div className="rounded-lg border border-border/70 bg-background/60 p-3">
              <p className="flex items-center gap-2 text-sm font-medium">
                <TimerReset className="h-4 w-4 text-primary" />
                Event stream
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                Real-time refresh wired to websocket updates.
              </p>
            </div>
          </CardContent>
        </Card>

        <Card className="border-border/70 bg-card/80 backdrop-blur-xl">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Status snapshot</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div className="flex items-center justify-between rounded-md border border-border/70 bg-background/60 px-3 py-2">
              <span className="text-muted-foreground">Running bots</span>
              <span className="font-mono font-medium">{running}</span>
            </div>
            <div className="flex items-center justify-between rounded-md border border-border/70 bg-background/60 px-3 py-2">
              <span className="text-muted-foreground">Stopped bots</span>
              <span className="font-mono font-medium">{stopped}</span>
            </div>
            <div className="flex items-center justify-between rounded-md border border-border/70 bg-background/60 px-3 py-2">
              <span className="text-muted-foreground">Captured trades</span>
              <span className="font-mono font-medium">{tradeTotal}</span>
            </div>
          </CardContent>
        </Card>
      </div>

      {bots.length === 0 ? (
        <EmptyState
          icon={BotIcon}
          title="No bots yet"
          description="Create a bot to start exploring demo execution and logs."
        >
          <Button asChild className="cursor-pointer">
            <Link href="/bots/new">Create your first bot</Link>
          </Button>
        </EmptyState>
      ) : (
        <Card className="border-border/70 bg-card/80 backdrop-blur-xl">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-lg">Recent activity</CardTitle>
            <Button variant="ghost" size="sm" asChild className="cursor-pointer">
              <Link href="/bots">Manage bots</Link>
            </Button>
          </CardHeader>
          <CardContent>
            {trades.length === 0 ? (
              <p className="text-sm text-muted-foreground">No trades recorded yet.</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead className="text-muted-foreground">Time</TableHead>
                    <TableHead className="text-muted-foreground">Bot</TableHead>
                    <TableHead className="text-muted-foreground">Symbol</TableHead>
                    <TableHead className="text-muted-foreground">Side</TableHead>
                    <TableHead className="text-muted-foreground">Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {trades.map((t) => (
                    <TableRow key={t.id} className="transition-colors duration-200 hover:bg-muted/40">
                      <TableCell className="whitespace-nowrap font-mono text-xs text-muted-foreground">
                        {formatTradeTime(t.createdAt)}
                      </TableCell>
                      <TableCell>{t.bot?.name ?? '—'}</TableCell>
                      <TableCell className="font-mono">{t.symbol}</TableCell>
                      <TableCell>
                        <Badge
                          variant="outline"
                          className={
                            t.side === 'BUY'
                              ? 'border-emerald-500/40 bg-emerald-500/15 text-emerald-300'
                              : 'border-rose-500/40 bg-rose-500/15 text-rose-300'
                          }
                        >
                          {t.side}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-muted-foreground">{t.status}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  )
}
