'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Trade } from '@/types'
import { useAuthStore } from '@/store/auth.store'
import { fetchBots, fetchTrades } from '@/lib/api-client'
import { useHandleApiError } from '@/hooks/use-handle-api-error'
import { Skeleton } from '@/components/ui/skeleton'
import { EmptyState } from '@/components/empty-state'
import { Badge } from '@/components/ui/badge'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Label } from '@/components/ui/label'
import { History } from 'lucide-react'

export default function TradesPage() {
  const token = useAuthStore((s) => s.token)
  const handleError = useHandleApiError()
  const [loading, setLoading] = useState(true)
  const [trades, setTrades] = useState<Trade[]>([])
  const [botId, setBotId] = useState<string>('all')
  const [botsLoaded, setBotsLoaded] = useState<{ id: string; name: string }[]>(
    [],
  )

  useEffect(() => {
    if (!token) return
    let cancelled = false
    ;(async () => {
      try {
        const bots = await fetchBots(token)
        if (!cancelled) {
          setBotsLoaded(bots.map((b) => ({ id: b.id, name: b.name })))
        }
      } catch {
        /* optional */
      }
    })()
    return () => {
      cancelled = true
    }
  }, [token])

  useEffect(() => {
    if (!token) return
    let cancelled = false
    ;(async () => {
      setLoading(true)
      try {
        const data = await fetchTrades(
          token,
          botId === 'all' ? undefined : botId,
        )
        if (!cancelled) setTrades(data)
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
  }, [token, botId, handleError])

  if (loading && trades.length === 0) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-9 w-56" />
        <Skeleton className="h-12 w-full max-w-sm" />
        <Skeleton className="h-72 rounded-lg" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Trade history</h1>
        <p className="text-muted-foreground">
          Trades for bots you own (live data from the API).
        </p>
      </div>

      <div className="flex max-w-sm flex-col gap-2">
        <Label>Filter by bot</Label>
        <Select value={botId} onValueChange={setBotId}>
          <SelectTrigger>
            <SelectValue placeholder="All bots" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All bots</SelectItem>
            {botsLoaded.map((b) => (
              <SelectItem key={b.id} value={b.id}>
                {b.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {trades.length === 0 && !loading ? (
        <EmptyState
          icon={History}
          title="No trades"
          description="Trades appear when your running bot executes demo signals."
        >
          <Link
            href="/bots"
            className="text-sm font-medium text-primary underline-offset-4 hover:underline"
          >
            Go to bots
          </Link>
        </EmptyState>
      ) : (
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Created</TableHead>
                <TableHead>Bot</TableHead>
                <TableHead>Symbol</TableHead>
                <TableHead>Side</TableHead>
                <TableHead>Qty</TableHead>
                <TableHead>Price</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>P/L</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {trades.map((t) => (
                <TableRow key={t.id}>
                  <TableCell className="whitespace-nowrap text-muted-foreground text-xs">
                    {new Date(t.createdAt).toLocaleString()}
                  </TableCell>
                  <TableCell>{t.bot?.name ?? '—'}</TableCell>
                  <TableCell>{t.symbol}</TableCell>
                  <TableCell>
                    <Badge variant={t.side === 'BUY' ? 'default' : 'secondary'}>
                      {t.side}
                    </Badge>
                  </TableCell>
                  <TableCell>{t.quantity}</TableCell>
                  <TableCell>{t.price.toFixed(4)}</TableCell>
                  <TableCell>{t.status}</TableCell>
                  <TableCell>
                    {t.realizedPnl != null ? t.realizedPnl.toFixed(2) : '—'}
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
