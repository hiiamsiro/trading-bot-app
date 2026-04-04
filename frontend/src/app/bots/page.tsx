'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { Bot } from '@/types'
import { useAuthStore } from '@/store/auth.store'
import { fetchBots } from '@/lib/api-client'
import { useHandleApiError } from '@/hooks/use-handle-api-error'
import { useTradingSocket } from '@/hooks/use-trading-socket'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { EmptyState } from '@/components/empty-state'
import { TableSkeleton } from '@/components/table-skeleton'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { BotStatusBadge } from '@/components/bot-status-badge'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Plus, Bot as BotIcon, ShieldCheck } from 'lucide-react'
import { FadeInSection } from '@/components/ui/fade-in-section'

const ROW_STAGGER_DELAY_MS = 30

export default function BotsListPage() {
  const token = useAuthStore((s) => s.token)
  const user = useAuthStore((s) => s.user)
  const handleError = useHandleApiError()
  const [loading, setLoading] = useState(true)
  const [bots, setBots] = useState<Bot[]>([])
  const [loadError, setLoadError] = useState<string | null>(null)

  const loadBots = useCallback(
    (showLoading: boolean) => {
      if (!token) return
      ;(async () => {
        if (showLoading) setLoading(true)
        setLoadError(null)
      try {
        const data = await fetchBots(token)
        setBots(data)
      } catch (e) {
        setLoadError('Could not load bots. Please try again.')
        handleError(e)
      } finally {
        if (showLoading) setLoading(false)
      }
      })()
    },
    [token, handleError],
  )

  useEffect(() => {
    loadBots(true)
  }, [loadBots])

  useTradingSocket({
    token,
    userId: user?.id,
    events: ['bot-status'],
    minRefreshIntervalMs: 1500,
    onRefresh: () => loadBots(false),
  })

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="animate-fade-scale flex items-center justify-between">
          <Skeleton className="h-9 w-40" />
          <Skeleton className="h-10 w-28" />
        </div>
        <TableSkeleton columns={5} rows={6} />
      </div>
    )
  }

  if (loadError && bots.length === 0) {
    return (
      <div className="space-y-4">
        <Alert variant="destructive">
          <AlertTitle>Could not load bots</AlertTitle>
          <AlertDescription>{loadError}</AlertDescription>
        </Alert>
        <div className="flex flex-wrap gap-2">
          <Button className="cursor-pointer" onClick={() => loadBots(true)}>
            Retry
          </Button>
          <Button asChild variant="outline" className="cursor-pointer">
            <Link href="/bots/new">Create bot</Link>
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <FadeInSection>
        <div className="flex flex-col gap-4 rounded-xl border border-border/70 bg-card/70 p-6 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-3xl font-semibold tracking-tight">Bots</h1>
            <p className="text-muted-foreground">Create and manage your demo trading bots.</p>
            <p className="mt-2 inline-flex items-center gap-1 text-xs text-amber-300">
              <ShieldCheck className="h-3.5 w-3.5" />
              Authority-grade controls and status tracking
            </p>
          </div>
          <Button asChild className="cursor-pointer">
            <Link href="/bots/new">
              <Plus className="mr-2 h-4 w-4" />
              New bot
            </Link>
          </Button>
        </div>
      </FadeInSection>

      {bots.length === 0 ? (
        <FadeInSection stagger>
          <EmptyState
            icon={BotIcon}
            title="No bots yet"
            description="Bots run strategies on demo market data. Create one to get started."
          >
            <Button asChild className="cursor-pointer">
              <Link href="/bots/new">Create bot</Link>
            </Button>
          </EmptyState>
        </FadeInSection>
      ) : (
        <FadeInSection stagger>
          {/* ── Mobile: card view ─────────────────────────────── */}
          <div className="grid gap-3 sm:hidden">
            {bots.map((b, index) => (
              <div
                key={b.id}
                className="rounded-xl border border-border/70 bg-card/80 p-4 transition-all duration-200"
                style={{ transitionDelay: `${index * ROW_STAGGER_DELAY_MS}ms` }}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <Link
                      href={`/bots/${b.id}`}
                      className="block truncate text-sm font-semibold transition-colors hover:text-primary"
                    >
                      {b.name}
                    </Link>
                    <p className="mt-0.5 font-mono text-xs text-muted-foreground">{b.symbol}</p>
                  </div>
                  <BotStatusBadge status={b.status} />
                </div>
                <div className="mt-3 flex items-center justify-between">
                  <p className="text-xs text-muted-foreground">
                    {b.strategyConfig?.strategy ?? '—'}
                  </p>
                  <Button variant="ghost" size="sm" asChild className="cursor-pointer h-8 px-3">
                    <Link href={`/bots/${b.id}`}>Open</Link>
                  </Button>
                </div>
              </div>
            ))}
          </div>

          {/* ── Tablet+: table view ───────────────────────────── */}
          <div className="hidden sm:block">
            <div className="overflow-x-auto rounded-xl border border-border/70 bg-card/80 backdrop-blur-xl transition-all duration-300">
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead>Name</TableHead>
                    <TableHead>Symbol</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Strategy</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {bots.map((b, index) => (
                    <TableRow
                      key={b.id}
                      className="transition-all duration-200 hover:bg-muted/40"
                      style={{ transitionDelay: `${index * ROW_STAGGER_DELAY_MS}ms` }}
                    >
                      <TableCell className="font-medium">
                        <Link
                          href={`/bots/${b.id}`}
                          className="cursor-pointer transition-colors duration-200 hover:text-primary"
                        >
                          {b.name}
                        </Link>
                      </TableCell>
                      <TableCell className="font-mono">{b.symbol}</TableCell>
                      <TableCell>
                        <BotStatusBadge status={b.status} />
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {b.strategyConfig?.strategy ?? '—'}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button variant="ghost" size="sm" asChild className="cursor-pointer transition-all duration-200 hover:bg-primary/10 hover:text-primary">
                          <Link href={`/bots/${b.id}`}>Open</Link>
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </div>
        </FadeInSection>
      )}
    </div>
  )
}
