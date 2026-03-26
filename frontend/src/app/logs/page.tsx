'use client'

import { Suspense, useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { BotLog } from '@/types'
import { useAuthStore } from '@/store/auth.store'
import { fetchBots, fetchLogs } from '@/lib/api-client'
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
import { Input } from '@/components/ui/input'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { ScrollText, Loader2, ShieldCheck } from 'lucide-react'

const PAGE_SIZE = 50
const ALL = 'all'
const CATEGORY_OPTIONS = [
  'lifecycle',
  'strategy',
  'trade',
  'risk',
  'market_data',
  'execution',
  'system',
] as const

function LogsContent() {
  const searchParams = useSearchParams()
  const botIdFromUrl = searchParams.get('botId')
  const token = useAuthStore((s) => s.token)
  const user = useAuthStore((s) => s.user)
  const handleError = useHandleApiError()
  const [bots, setBots] = useState<{ id: string; name: string }[]>([])
  const [botsLoading, setBotsLoading] = useState(true)
  const [botId, setBotId] = useState<string>(ALL)
  const [level, setLevel] = useState<string>(ALL)
  const [category, setCategory] = useState<string>(ALL)
  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [logs, setLogs] = useState<BotLog[]>([])
  const [recentErrors, setRecentErrors] = useState<BotLog[]>([])
  const [total, setTotal] = useState(0)
  const [logsLoading, setLogsLoading] = useState(false)
  const [errorsLoading, setErrorsLoading] = useState(false)
  const [loadingMore, setLoadingMore] = useState(false)
  const formatLogTime = (value: string) =>
    new Date(value).toLocaleString([], {
      month: 'short',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    })

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
            : ALL
        setBotId((prev) => {
          if (fromQuery !== ALL) return fromQuery
          if (prev !== ALL && mapped.some((b) => b.id === prev)) return prev
          return ALL
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

  useEffect(() => {
    const handle = setTimeout(() => {
      setDebouncedSearch(search.trim())
    }, 300)
    return () => clearTimeout(handle)
  }, [search])

  const query = useMemo(() => {
    return {
      ...(botId !== ALL ? { botId } : {}),
      ...(level !== ALL ? { level } : {}),
      ...(category !== ALL ? { category } : {}),
      ...(debouncedSearch ? { search: debouncedSearch } : {}),
    }
  }, [botId, level, category, debouncedSearch])

  const errorQuery = useMemo(() => {
    return { ...query, level: 'ERROR' }
  }, [query])

  const refreshFirstPage = useCallback(() => {
    if (!token) return
    ;(async () => {
      try {
        const [res, errorRes] = await Promise.all([
          fetchLogs(token, { ...query, take: PAGE_SIZE, skip: 0 }),
          fetchLogs(token, { ...errorQuery, take: 10, skip: 0 }),
        ])
        setLogs(res.items)
        setTotal(res.total)
        setRecentErrors(errorRes.items)
      } catch (e) {
        handleError(e)
      }
    })()
  }, [token, query, errorQuery, handleError])

  useEffect(() => {
    if (!token) return
    setLogs([])
    setRecentErrors([])
    setTotal(0)
    let cancelled = false
    ;(async () => {
      setLogsLoading(true)
      setErrorsLoading(true)
      try {
        const [res, errorRes] = await Promise.all([
          fetchLogs(token, { ...query, take: PAGE_SIZE, skip: 0 }),
          fetchLogs(token, { ...errorQuery, take: 10, skip: 0 }),
        ])
        if (!cancelled) {
          setLogs(res.items)
          setTotal(res.total)
          setRecentErrors(errorRes.items)
        }
      } catch (e) {
        handleError(e)
      } finally {
        if (!cancelled) {
          setLogsLoading(false)
          setErrorsLoading(false)
        }
      }
    })()
    return () => {
      cancelled = true
    }
  }, [token, query, errorQuery, handleError])

  useTradingSocket({ 
    token,
    userId: user?.id, 
    botId: botId !== ALL ? botId : undefined, 
    onRefresh: refreshFirstPage, 
  }) 

  async function loadMore() {
    if (!token || loadingMore || logs.length >= total) return
    setLoadingMore(true)
    try {
      const res = await fetchLogs(token, { ...query, take: PAGE_SIZE, skip: logs.length })
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
      <div className="rounded-xl border border-border/70 bg-card/70 p-6">
        <h1 className="text-3xl font-semibold tracking-tight">Logs</h1>
        <p className="text-muted-foreground">
          Paginated bot logs from the API.
        </p>
        <p className="mt-2 inline-flex items-center gap-1 text-xs text-amber-300">
          <ShieldCheck className="h-3.5 w-3.5" />
          Reliable event trail with realtime refresh
        </p>
      </div>

      <div className="grid gap-4 rounded-lg border border-border/70 bg-card/70 p-4 md:grid-cols-4">
        <div className="flex flex-col gap-2">
          <Label htmlFor="bot">Bot</Label>
          <Select value={botId} onValueChange={setBotId}>
            <SelectTrigger id="bot" className="cursor-pointer">
              <SelectValue placeholder="All bots" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>All bots</SelectItem>
              {bots.map((b) => (
                <SelectItem key={b.id} value={b.id}>
                  {b.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex flex-col gap-2">
          <Label htmlFor="level">Level</Label>
          <Select value={level} onValueChange={setLevel}>
            <SelectTrigger id="level" className="cursor-pointer">
              <SelectValue placeholder="All levels" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>All levels</SelectItem>
              <SelectItem value="DEBUG">DEBUG</SelectItem>
              <SelectItem value="INFO">INFO</SelectItem>
              <SelectItem value="WARNING">WARNING</SelectItem>
              <SelectItem value="ERROR">ERROR</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="flex flex-col gap-2">
          <Label htmlFor="category">Category</Label>
          <Select value={category} onValueChange={setCategory}>
            <SelectTrigger id="category" className="cursor-pointer">
              <SelectValue placeholder="All categories" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>All categories</SelectItem>
              {CATEGORY_OPTIONS.map((c) => (
                <SelectItem key={c} value={c}>
                  {c}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex flex-col gap-2">
          <Label htmlFor="search">Search</Label>
          <Input
            id="search"
            placeholder="Message contains..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

      <div className="rounded-lg border border-border/70 bg-card/70 p-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="text-sm font-medium">Recent errors</h2>
            <p className="text-xs text-muted-foreground">
              Latest ERROR logs in the current filter scope.
            </p>
          </div>
          <Button
            variant="outline"
            size="sm"
            className="cursor-pointer"
            onClick={() => setLevel('ERROR')}
          >
            Show only errors
          </Button>
        </div>

        {errorsLoading ? (
          <Skeleton className="mt-3 h-24 rounded-md" />
        ) : recentErrors.length === 0 ? (
          <p className="mt-3 text-sm text-muted-foreground">No recent errors.</p>
        ) : (
          <div className="mt-3 space-y-2">
            {recentErrors.slice(0, 6).map((row) => (
              <div
                key={row.id}
                className="rounded-md border border-border/70 bg-background/60 px-3 py-2"
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    {botId === ALL ? (
                      <Link
                        href={`/bots/${row.botId}`}
                        className="text-sm text-muted-foreground underline-offset-4 hover:underline"
                      >
                        {row.botName ?? row.botId.slice(0, 8)}
                      </Link>
                    ) : null}
                    <Badge variant="outline" className="text-[10px]">
                      {row.category}
                    </Badge>
                  </div>
                  <span className="whitespace-nowrap font-mono text-xs text-muted-foreground">
                    {formatLogTime(row.createdAt)}
                  </span>
                </div>
                <p className="mt-1 text-sm text-rose-200/90">{row.message}</p>
                {row.metadata ? (
                  <details className="mt-2">
                    <summary className="cursor-pointer text-xs text-muted-foreground">
                      Metadata
                    </summary>
                    <pre className="mt-2 max-h-40 overflow-auto rounded bg-muted p-2 font-mono text-xs">
                      {JSON.stringify(row.metadata, null, 2)}
                    </pre>
                  </details>
                ) : null}
              </div>
            ))}
          </div>
        )}
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
          <div className="rounded-md border border-border/70 bg-card/80 backdrop-blur-xl">
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead>Time</TableHead>
                  {botId === ALL && <TableHead>Bot</TableHead>}
                  <TableHead>Level</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead>Message</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {logs.map((row) => (
                  <TableRow key={row.id} className="transition-colors duration-200 hover:bg-muted/40">
                    <TableCell className="whitespace-nowrap font-mono text-xs text-muted-foreground">
                      {formatLogTime(row.createdAt)}
                    </TableCell>
                    {botId === ALL && (
                      <TableCell className="whitespace-nowrap">
                        <Link
                          href={`/bots/${row.botId}`}
                          className="text-sm text-muted-foreground underline-offset-4 hover:underline"
                        >
                          {row.botName ?? row.botId.slice(0, 8)}
                        </Link>
                      </TableCell>
                    )}
                    <TableCell>
                      <Badge variant="outline">{row.level}</Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">{row.category}</Badge>
                    </TableCell>
                    <TableCell className="max-w-md">
                      <span className="text-sm">{row.message}</span>
                      {row.metadata ? (
                        <details className="mt-2">
                          <summary className="cursor-pointer text-xs text-muted-foreground">
                            Metadata
                          </summary>
                          <pre className="mt-2 max-h-40 overflow-auto rounded bg-muted p-2 font-mono text-xs">
                            {JSON.stringify(row.metadata, null, 2)}
                          </pre>
                        </details>
                      ) : null}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          {logs.length < total && (
            <Button
              variant="outline"
              className="cursor-pointer"
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
