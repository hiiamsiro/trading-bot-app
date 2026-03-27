'use client'

import { useCallback, useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import type { Portfolio, PortfolioMetrics } from '@/types'
import { TradeStatus } from '@/types'
import { useAuthStore } from '@/store/auth.store'
import {
  deletePortfolio,
  fetchPortfolio,
  fetchPortfolioMetrics,
} from '@/lib/api-client'
import { useHandleApiError } from '@/hooks/use-handle-api-error'
import { useTradingSocket } from '@/hooks/use-trading-socket'
import { toast } from '@/hooks/use-toast'
import { PortfolioMetricsGrid } from '@/components/portfolios/portfolio-metrics'
import { PortfolioEditDialog } from '@/components/portfolios/portfolio-form'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { BotStatusBadge } from '@/components/bot-status-badge'
import { TradeStatusBadge } from '@/components/trade-status-badge'
import { EmptyState } from '@/components/empty-state'
import {
  Alert,
  AlertDescription,
  AlertTitle,
} from '@/components/ui/alert'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  ArrowLeft,
  Bot as BotIcon,
  Edit2,
  FolderOpen,
  Plus,
  Trash2,
} from 'lucide-react'

function formatPnl(value: number | null | undefined) {
  if (value == null) return '—'
  const abs = Math.abs(value).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
  if (value > 0) return `+${abs}`
  if (value < 0) return `−${abs}`
  return abs
}

function formatTime(value: string) {
  return new Date(value).toLocaleString([], {
    month: 'short',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export default function PortfolioDetailPage() {
  const params = useParams()
  const router = useRouter()
  const token = useAuthStore((s) => s.token)
  const user = useAuthStore((s) => s.user)
  const handleError = useHandleApiError()

  const id = params.id as string

  const [loading, setLoading] = useState(true)
  const [portfolio, setPortfolio] = useState<Portfolio | null>(null)
  const [metrics, setMetrics] = useState<PortfolioMetrics | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [editOpen, setEditOpen] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [botSearch, setBotSearch] = useState('')

  const load = useCallback(
    (showLoading = true) => {
      if (!token || !id) return
      ;(async () => {
        if (showLoading) setLoading(true)
        setLoadError(null)
        try {
          const [p, m] = await Promise.all([
            fetchPortfolio(token, id),
            fetchPortfolioMetrics(token, id),
          ])
          setPortfolio(p)
          setMetrics(m)
        } catch (e) {
          setLoadError('Portfolio not found.')
          handleError(e)
        } finally {
          if (showLoading) setLoading(false)
        }
      })()
    },
    [token, id, handleError],
  )

  useEffect(() => {
    void load()
  }, [load])

  useTradingSocket({
    token,
    userId: user?.id,
    events: ['bot-status', 'new-trade'],
    logLevels: ['INFO', 'WARNING', 'ERROR'],
    minRefreshIntervalMs: 3000,
    onRefresh: () => void load(false),
  })

  async function handleDelete() {
    if (!token) return
    setDeleting(true)
    try {
      await deletePortfolio(token, id)
      toast({ title: 'Portfolio deleted' })
      router.replace('/portfolios')
    } catch {
      toast({ title: 'Could not delete portfolio', variant: 'destructive' })
      setDeleting(false)
    }
  }

  function handleEditSuccess() {
    void load(false)
    setEditOpen(false)
  }

  const filteredBots = portfolio?.bots.filter(
    (b) =>
      !botSearch ||
      b.name.toLowerCase().includes(botSearch.toLowerCase()) ||
      b.symbol.toLowerCase().includes(botSearch.toLowerCase()),
  )

  const recentTrades = portfolio?.bots.flatMap((b) =>
    (b as (typeof b) & { trades?: Array<{ id: string; botId: string; symbol: string; side: string; status: string; netPnl?: number | null; createdAt: string; bot?: { name: string } }> }).trades ?? [],
  ).sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()).slice(0, 20) ?? []

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Skeleton className="h-9 w-9" />
          <Skeleton className="h-8 w-48" />
        </div>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-28 rounded-lg" />
          ))}
        </div>
        <Skeleton className="h-48 rounded-lg" />
      </div>
    )
  }

  if (loadError || !portfolio) {
    return (
      <div className="space-y-4">
        <Alert variant="destructive">
          <AlertTitle>Portfolio not found</AlertTitle>
          <AlertDescription>{loadError ?? 'This portfolio may have been deleted.'}</AlertDescription>
        </Alert>
        <Button variant="outline" asChild className="cursor-pointer">
          <Link href="/portfolios">Back to portfolios</Link>
        </Button>
      </div>
    )
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" asChild className="cursor-pointer">
            <Link href="/portfolios">
              <ArrowLeft className="h-4 w-4" />
            </Link>
          </Button>
          <div>
            <h1 className="text-3xl font-semibold tracking-tight">{portfolio.name}</h1>
            <p className="mt-1 text-muted-foreground">
              {portfolio.bots.length} bot{portfolio.bots.length === 1 ? '' : 's'} ·{' '}
              {new Date(portfolio.createdAt).toLocaleDateString()} created
            </p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setEditOpen(true)}
            className="gap-2 cursor-pointer"
          >
            <Edit2 className="h-4 w-4" />
            Edit
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="gap-2 border-rose-500/30 text-rose-400/70 hover:border-rose-500/60 hover:text-rose-400 cursor-pointer"
            onClick={handleDelete}
            disabled={deleting}
          >
            <Trash2 className="h-4 w-4" />
            {deleting ? 'Deleting...' : 'Delete'}
          </Button>
        </div>
      </div>

      {/* Metrics */}
      {metrics ? (
        <PortfolioMetricsGrid metrics={metrics} />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-28 rounded-lg" />
          ))}
        </div>
      )}

      {/* Bots */}
      <div className="rounded-xl border border-border/70 bg-card/70 p-6 shadow-sm backdrop-blur-xl">
        <div className="mb-4 flex items-center justify-between gap-4">
          <h2 className="text-lg font-semibold">Bots</h2>
          <Input
            placeholder="Search bots..."
            value={botSearch}
            onChange={(e) => setBotSearch(e.target.value)}
            className="h-8 w-48 max-w-full text-sm"
          />
        </div>

        {filteredBots?.length === 0 ? (
          <EmptyState
            icon={BotIcon}
            title="No bots in this portfolio"
            description="Edit the portfolio to add bots."
          >
            <Button
              variant="outline"
              size="sm"
              onClick={() => setEditOpen(true)}
              className="gap-2 cursor-pointer"
            >
              <Plus className="h-4 w-4" />
              Add bots
            </Button>
          </EmptyState>
        ) : (
          <div className="space-y-2">
            {filteredBots?.map((bot) => (
              <Link
                key={bot.id}
                href={`/bots/${bot.id}`}
                className="flex items-center justify-between rounded-md border border-border/70 bg-background/60 px-4 py-3 transition-colors duration-200 hover:bg-muted/60"
              >
                <div className="flex items-center gap-3">
                  <BotStatusBadge status={bot.status} />
                  <div>
                    <p className="font-medium">{bot.name}</p>
                    <p className="font-mono text-xs text-muted-foreground">{bot.symbol}</p>
                  </div>
                </div>
                <div className="text-right">
                  {bot.executionSession ? (
                    <>
                      <p
                        className={`text-sm font-semibold tabular-nums ${
                          bot.executionSession.profitLoss > 0
                            ? 'text-emerald-400'
                            : bot.executionSession.profitLoss < 0
                              ? 'text-rose-400'
                              : ''
                        }`}
                      >
                        {formatPnl(bot.executionSession.profitLoss)}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {bot.executionSession.totalTrades} trade
                        {bot.executionSession.totalTrades === 1 ? '' : 's'}
                      </p>
                    </>
                  ) : (
                    <p className="text-sm text-muted-foreground">No session</p>
                  )}
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>

      {/* Recent Trades */}
      <div className="rounded-xl border border-border/70 bg-card/70 p-6 shadow-sm backdrop-blur-xl">
        <h2 className="mb-4 text-lg font-semibold">Recent trades</h2>
        {recentTrades.length === 0 ? (
          <p className="text-sm text-muted-foreground">No trades yet in this portfolio.</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead className="text-muted-foreground">Time</TableHead>
                <TableHead className="text-muted-foreground">Bot</TableHead>
                <TableHead className="text-muted-foreground">Symbol</TableHead>
                <TableHead className="text-muted-foreground">Side</TableHead>
                <TableHead className="text-muted-foreground">Status</TableHead>
                <TableHead className="text-right text-muted-foreground">PnL</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {recentTrades.map((t) => (
                <TableRow
                  key={t.id}
                  className="transition-colors duration-200 hover:bg-muted/40"
                >
                  <TableCell className="whitespace-nowrap font-mono text-xs text-muted-foreground">
                    {formatTime(t.createdAt)}
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
                  <TableCell>
                    <TradeStatusBadge status={t.status as TradeStatus} />
                  </TableCell>
                  <TableCell
                    className={`text-right font-mono text-xs tabular-nums ${
                      t.status === 'CLOSED' && t.netPnl != null
                        ? t.netPnl > 0
                          ? 'text-emerald-400'
                          : t.netPnl < 0
                            ? 'text-rose-400'
                            : 'text-muted-foreground'
                        : 'text-muted-foreground'
                    }`}
                  >
                    {t.status === 'CLOSED' && t.netPnl != null ? formatPnl(t.netPnl) : '—'}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>

      {/* Edit dialog */}
      {editOpen && portfolio && (
        <PortfolioEditDialog
          open={editOpen}
          token={token ?? ''}
          portfolio={portfolio}
          onClose={() => setEditOpen(false)}
          onSuccess={handleEditSuccess}
        />
      )}
    </div>
  )
}
