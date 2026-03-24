'use client'

import { Suspense, useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { BotLog } from '@/types'
import { useAuthStore } from '@/store/auth.store'
import { fetchBotLogs, fetchBots } from '@/lib/api-client'
import { useHandleApiError } from '@/hooks/use-handle-api-error'
import { useTradingSocket } from '@/hooks/use-trading-socket'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { EmptyState } from '@/components/empty-state'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { ScrollText, Loader2 } from 'lucide-react'

const PAGE_SIZE = 50

function LogsContent() {
  const searchParams = useSearchParams()
  const botIdFromUrl = searchParams.get('botId')
  const token = useAuthStore((s) => s.token)
  const user = useAuthStore((s) => s.user)
  const handleError = useHandleApiError()
  const [bots, setBots] = useState<{ id: string; name: string }[]>([])
  const [botsLoading, setBotsLoading] = useState(true)
  const [botId, setBotId] = useState<string>('')
  const [logs, setLogs] = useState<BotLog[]>([])
  const [total, setTotal] = useState(0)
  const [logsLoading, setLogsLoading] = useState(false)
  const [loadingMore, setLoadingMore] = useState(false)

  useEffect(() => {
    if (!token) return
    let cancelled = false
    ;(async () => {
      setBotsLoading(true)
      try {
        const list = await fetchBots(token)
        if (cancelled) return
        const mapped = list.map((b) => ({ id: b.id, name: b.name }))
        setBots(mapped)
        const fromQuery =
          botIdFromUrl && mapped.some((b) => b.id === botIdFromUrl)
            ? botIdFromUrl
            : ''
        setBotId((prev) => {
          if (fromQuery) return fromQuery
          if (prev && mapped.some((b) => b.id === prev)) return prev
          return mapped[0]?.id ?? ''
        })
      } catch (e) {
        handleError(e)
      } finally {
        if (!cancelled) setBotsLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [token, botIdFromUrl, handleError])

  const refreshFirstPage = useCallback(() => {
    if (!botId || !token) return
    ;(async () => {
      try {
        const res = await fetchBotLogs(token, botId, PAGE_SIZE, 0)
        setLogs(res.items)
        setTotal(res.total)
      } catch (e) {
        handleError(e)
      }
    })()
  }, [token, botId, handleError])

  useEffect(() => {
    if (!botId || !token) return
    setLogs([])
    setTotal(0)
    let cancelled = false
    ;(async () => {
      setLogsLoading(true)
      try {
        const res = await fetchBotLogs(token, botId, PAGE_SIZE, 0)
        if (!cancelled) {
          setLogs(res.items)
          setTotal(res.total)
        }
      } catch (e) {
        handleError(e)
      } finally {
        if (!cancelled) setLogsLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [token, botId, handleError])

  useTradingSocket({
    userId: botId ? user?.id : undefined,
    botId: botId || undefined,
    onRefresh: refreshFirstPage,
  })

  async function loadMore() {
    if (!token || !botId || loadingMore || logs.length >= total) return
    setLoadingMore(true)
    try {
      const res = await fetchBotLogs(token, botId, PAGE_SIZE, logs.length)
      setLogs((prev) => [...prev, ...res.items])
    } catch (e) {
      handleError(e)
    } finally {
      setLoadingMore(false)
    }
  }

  if (botsLoading) {
    return <LogsFallback />
  }

  if (bots.length === 0) {
    return (
      <EmptyState
        icon={ScrollText}
        title="No bots"
        description="Create a bot to view execution logs."
      >
        <Button asChild>
          <Link href="/bots/new">Create bot</Link>
        </Button>
      </EmptyState>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Logs</h1>
        <p className="text-muted-foreground">
          Paginated bot logs from the API.
        </p>
      </div>

      <div className="flex max-w-sm flex-col gap-2">
        <Label htmlFor="bot">Bot</Label>
        <Select value={botId} onValueChange={setBotId}>
          <SelectTrigger id="bot">
            <SelectValue placeholder="Select bot" />
          </SelectTrigger>
          <SelectContent>
            {bots.map((b) => (
              <SelectItem key={b.id} value={b.id}>
                {b.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {logsLoading ? (
        <Skeleton className="h-80 rounded-lg" />
      ) : logs.length === 0 ? (
        <EmptyState
          icon={ScrollText}
          title="No log entries"
          description="Start the bot or wait for activity to produce logs."
        />
      ) : (
        <>
          <p className="text-sm text-muted-foreground">
            Showing {logs.length} of {total}
          </p>
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Time</TableHead>
                  <TableHead>Level</TableHead>
                  <TableHead>Message</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {logs.map((row) => (
                  <TableRow key={row.id}>
                    <TableCell className="whitespace-nowrap text-xs text-muted-foreground">
                      {new Date(row.createdAt).toLocaleString()}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">{row.level}</Badge>
                    </TableCell>
                    <TableCell className="max-w-md">
                      <span className="text-sm">{row.message}</span>
                      {row.metadata && (
                        <pre className="mt-1 max-h-24 overflow-auto rounded bg-muted p-2 text-xs">
                          {JSON.stringify(row.metadata, null, 2)}
                        </pre>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          {logs.length < total && (
            <Button
              variant="outline"
              onClick={loadMore}
              disabled={loadingMore}
            >
              {loadingMore && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              )}
              Load more
            </Button>
          )}
        </>
      )}
    </div>
  )
}

function LogsFallback() {
  return (
    <div className="space-y-6">
      <Skeleton className="h-9 w-32" />
      <Skeleton className="h-10 w-full max-w-sm" />
      <Skeleton className="h-80 rounded-lg" />
    </div>
  )
}

export default function LogsPage() {
  return (
    <Suspense fallback={<LogsFallback />}>
      <LogsContent />
    </Suspense>
  )
}
