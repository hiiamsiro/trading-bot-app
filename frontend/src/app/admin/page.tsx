'use client'

import { useEffect, useMemo, useState } from 'react'
import { Activity } from 'lucide-react'
import { ApiError } from '@/lib/api'
import { fetchAdminMonitoringSnapshot } from '@/lib/api-client'
import { useHandleApiError } from '@/hooks/use-handle-api-error'
import { useAuthStore } from '@/store/auth.store'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  AdminMonitoringSnapshot,
  AdminRecentError,
  BotStatus,
} from '@/types'

function formatLocal(iso: string | null | undefined) {
  if (!iso) return '—'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '—'
  return d.toLocaleString()
}

export default function AdminMonitoringPage() {
  const token = useAuthStore((s) => s.token)
  const handleError = useHandleApiError()
  const [loading, setLoading] = useState(true)
  const [forbidden, setForbidden] = useState(false)
  const [snapshot, setSnapshot] = useState<AdminMonitoringSnapshot | null>(null)

  useEffect(() => {
    if (!token) return
    let cancelled = false
    ;(async () => {
      setLoading(true)
      setForbidden(false)
      try {
        const s = await fetchAdminMonitoringSnapshot(token, {
          recentErrorsTake: 15,
          recentTradesTake: 25,
          topTake: 5,
          windowHours: 24,
        })
        if (!cancelled) setSnapshot(s)
      } catch (e: unknown) {
        if (!cancelled) {
          if (e instanceof ApiError && e.status === 403) {
            setForbidden(true)
            setSnapshot(null)
            return
          }
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

  const botCounts = snapshot?.botStatusCounts
  const runningBots = botCounts?.[BotStatus.RUNNING] ?? 0
  const stoppedBots = botCounts?.[BotStatus.STOPPED] ?? 0
  const pausedBots = botCounts?.[BotStatus.PAUSED] ?? 0
  const errorBots = botCounts?.[BotStatus.ERROR] ?? 0

  const recentActivity = useMemo(() => {
    if (!snapshot) return []

    const trades = snapshot.recentTrades.map((t) => ({
      id: `trade:${t.id}`,
      kind: 'trade' as const,
      at: t.executedAt ?? t.createdAt,
      userEmail: t.userEmail,
      botName: t.botName,
      botSymbol: t.botSymbol,
      detail: `${t.side} ${t.quantity} ${t.symbol} @ ${t.price}`,
      status: t.status,
    }))

    const errors = snapshot.recentErrors.map((e) => ({
      id: `error:${e.id}`,
      kind: 'error' as const,
      at: e.createdAt,
      userEmail: e.userEmail,
      botName: e.botName,
      botSymbol: e.botSymbol,
      detail: e.message,
      status: e.level,
    }))

    return [...errors, ...trades]
      .sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime())
      .slice(0, 20)
  }, [snapshot])

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

  if (forbidden) {
    return (
      <Card className="border-border/70 bg-card/80 backdrop-blur-xl">
        <CardHeader>
          <CardTitle className="text-lg">Access denied</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <p className="text-sm text-muted-foreground">
            Your account is not allowed to access platform monitoring. Contact an administrator to grant your account elevated access.
          </p>
        </CardContent>
      </Card>
    )
  }

  if (!snapshot) {
    return (
      <Card className="border-border/70 bg-card/80 backdrop-blur-xl">
        <CardHeader>
          <CardTitle className="text-lg">Monitoring</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">No data available.</p>
        </CardContent>
      </Card>
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
          Platform-wide monitoring snapshot (last {snapshot.windowHours}h activity window).
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          <Badge variant="outline">Admin only</Badge>
          <Badge className="border border-border/60 bg-muted/40 text-muted-foreground">
            users: {snapshot.totals.users}
          </Badge>
          <Badge className="border border-border/60 bg-muted/40 text-muted-foreground">
            bots: {snapshot.totals.bots}
          </Badge>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="border-border/70 bg-card/80 backdrop-blur-xl">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Total users</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold">{snapshot.totals.users}</p>
            <p className="text-xs text-muted-foreground">All registered accounts</p>
          </CardContent>
        </Card>
        <Card className="border-border/70 bg-card/80 backdrop-blur-xl">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Total bots</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold">{snapshot.totals.bots}</p>
            <p className="text-xs text-muted-foreground">
              {runningBots} running · {stoppedBots} stopped · {pausedBots} paused · {errorBots}{' '}
              error
            </p>
          </CardContent>
        </Card>
        <Card className="border-border/70 bg-card/80 backdrop-blur-xl">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Running bots</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold">{runningBots}</p>
            <p className="text-xs text-muted-foreground">Current RUNNING state</p>
          </CardContent>
        </Card>
        <Card className="border-border/70 bg-card/80 backdrop-blur-xl">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Error bots</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold">{errorBots}</p>
            <p className="text-xs text-muted-foreground">Current ERROR state</p>
          </CardContent>
        </Card>
      </div>

      <Card className="border-border/70 bg-card/80 backdrop-blur-xl">
        <CardHeader>
          <CardTitle className="text-lg">Bot status summary</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2">
            <Badge variant="outline">RUNNING: {runningBots}</Badge>
            <Badge variant="outline">STOPPED: {stoppedBots}</Badge>
            <Badge variant="outline">PAUSED: {pausedBots}</Badge>
            <Badge variant="outline">ERROR: {errorBots}</Badge>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 grid-cols-1 lg:grid-cols-2">
        <Card className="border-border/70 bg-card/80 backdrop-blur-xl">
          <CardHeader>
            <CardTitle className="text-lg">Recent errors</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {snapshot.recentErrors.length === 0 ? (
              <p className="px-4 py-3 text-sm text-muted-foreground">No errors in the recent window.</p>
            ) : (
              <div className="overflow-x-auto">
                <ErrorsTable items={snapshot.recentErrors} />
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="border-border/70 bg-card/80 backdrop-blur-xl">
          <CardHeader>
            <CardTitle className="text-lg">Recent activity</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {recentActivity.length === 0 ? (
              <p className="px-4 py-3 text-sm text-muted-foreground">No recent activity.</p>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="hover:bg-transparent">
                      <TableHead className="whitespace-nowrap">When</TableHead>
                      <TableHead className="whitespace-nowrap">Type</TableHead>
                      <TableHead className="whitespace-nowrap hidden sm:table-cell">User</TableHead>
                      <TableHead className="whitespace-nowrap">Bot</TableHead>
                      <TableHead className="whitespace-nowrap hidden md:table-cell">Detail</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {recentActivity.map((row) => (
                      <TableRow key={row.id} className="hover:bg-muted/40">
                        <TableCell className="whitespace-nowrap text-xs text-muted-foreground">
                          {formatLocal(row.at)}
                        </TableCell>
                        <TableCell>
                          <Badge variant={row.kind === 'error' ? 'destructive' : 'outline'}>
                            {row.kind}
                          </Badge>
                        </TableCell>
                        <TableCell className="max-w-[160px] truncate text-xs hidden sm:table-cell">{row.userEmail}</TableCell>
                        <TableCell className="max-w-[180px] truncate text-xs">
                          {row.botName}{' '}
                          <span className="text-muted-foreground">({row.botSymbol})</span>
                        </TableCell>
                        <TableCell className="max-w-[320px] truncate text-xs hidden md:table-cell">
                          {row.detail}{' '}
                          <span className="text-muted-foreground">({row.status})</span>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 grid-cols-1 lg:grid-cols-2">
        <Card className="border-border/70 bg-card/80 backdrop-blur-xl">
          <CardHeader>
            <CardTitle className="text-lg">Top active bots (last {snapshot.windowHours}h)</CardTitle>
          </CardHeader>
          <CardContent>
            {snapshot.topActiveBots.length === 0 ? (
              <p className="text-sm text-muted-foreground">No bot activity.</p>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="hover:bg-transparent">
                      <TableHead className="whitespace-nowrap">Bot</TableHead>
                      <TableHead className="whitespace-nowrap hidden lg:table-cell">User</TableHead>
                      <TableHead className="whitespace-nowrap">Status</TableHead>
                      <TableHead className="whitespace-nowrap text-right">Trades</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {snapshot.topActiveBots.map((b) => (
                      <TableRow key={b.botId} className="hover:bg-muted/40">
                        <TableCell className="text-sm">
                          {b.botName}{' '}
                          <span className="font-mono text-xs text-muted-foreground">{b.symbol}</span>
                        </TableCell>
                        <TableCell className="max-w-[220px] truncate text-xs hidden lg:table-cell">{b.userEmail}</TableCell>
                        <TableCell>
                          <Badge variant="outline">{b.status}</Badge>
                        </TableCell>
                        <TableCell className="text-right font-mono text-sm">{b.tradeCount}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="border-border/70 bg-card/80 backdrop-blur-xl">
          <CardHeader>
            <CardTitle className="text-lg">Top active users (last {snapshot.windowHours}h)</CardTitle>
          </CardHeader>
          <CardContent>
            {snapshot.topActiveUsers.length === 0 ? (
              <p className="text-sm text-muted-foreground">No user activity.</p>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="hover:bg-transparent">
                      <TableHead className="whitespace-nowrap">User</TableHead>
                      <TableHead className="whitespace-nowrap text-right">Active bots</TableHead>
                      <TableHead className="whitespace-nowrap text-right">Trades</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {snapshot.topActiveUsers.map((u) => (
                      <TableRow key={u.userId} className="hover:bg-muted/40">
                        <TableCell className="max-w-[260px] truncate text-sm">{u.email}</TableCell>
                        <TableCell className="text-right font-mono text-sm">{u.activeBotCount}</TableCell>
                        <TableCell className="text-right font-mono text-sm">{u.tradeCount}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

function ErrorsTable({ items }: { items: AdminRecentError[] }) {
  return (
    <Table>
      <TableHeader>
        <TableRow className="hover:bg-transparent">
          <TableHead className="whitespace-nowrap">When</TableHead>
          <TableHead className="whitespace-nowrap hidden sm:table-cell">User</TableHead>
          <TableHead className="whitespace-nowrap">Bot</TableHead>
          <TableHead className="whitespace-nowrap hidden md:table-cell">Message</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {items.map((e) => (
          <TableRow key={e.id} className="hover:bg-muted/40">
            <TableCell className="whitespace-nowrap text-xs text-muted-foreground">
              {formatLocal(e.createdAt)}
            </TableCell>
            <TableCell className="max-w-[160px] truncate text-xs hidden sm:table-cell">{e.userEmail}</TableCell>
            <TableCell className="max-w-[180px] truncate text-xs">
              {e.botName} <span className="text-muted-foreground">({e.botSymbol})</span>
            </TableCell>
            <TableCell className="max-w-[360px] truncate text-xs hidden md:table-cell">{e.message}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  )
}

