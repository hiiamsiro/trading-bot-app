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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { BotStatusBadge } from '@/components/bot-status-badge'
import { Plus, Bot as BotIcon, ShieldCheck } from 'lucide-react'

export default function BotsListPage() {
  const token = useAuthStore((s) => s.token)
  const user = useAuthStore((s) => s.user)
  const handleError = useHandleApiError()
  const [loading, setLoading] = useState(true)
  const [bots, setBots] = useState<Bot[]>([])

  const reload = useCallback(() => {
    if (!token) return
    ;(async () => {
      try {
        const data = await fetchBots(token)
        setBots(data)
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
        const data = await fetchBots(token)
        if (!cancelled) setBots(data)
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
    token,
    userId: user?.id,
    events: ['bot-status'],
    minRefreshIntervalMs: 1500,
    onRefresh: reload,
  })

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <Skeleton className="h-9 w-40" />
          <Skeleton className="h-10 w-28" />
        </div>
        <Skeleton className="h-72 rounded-lg" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
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

      {bots.length === 0 ? (
        <EmptyState
          icon={BotIcon}
          title="No bots yet"
          description="Bots run strategies on demo market data. Create one to get started."
        >
          <Button asChild className="cursor-pointer">
            <Link href="/bots/new">Create bot</Link>
          </Button>
        </EmptyState>
      ) : (
        <div className="rounded-md border border-border/70 bg-card/80 backdrop-blur-xl">
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
              {bots.map((b) => (
                <TableRow key={b.id} className="transition-colors duration-200 hover:bg-muted/40">
                  <TableCell className="font-medium">
                    <Link
                      href={`/bots/${b.id}`}
                      className="cursor-pointer hover:underline"
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
                    <Button variant="ghost" size="sm" asChild className="cursor-pointer">
                      <Link href={`/bots/${b.id}`}>Open</Link>
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  )
}
