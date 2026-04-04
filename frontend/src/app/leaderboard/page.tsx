'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { getLeaderboard, type LeaderboardItem } from '@/lib/api-client'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { ArrowUpDown, TrendingUp, Target, BarChart2 } from 'lucide-react'

type SortBy = 'pnl' | 'winRate' | 'drawdown'

const SORT_LABELS: Record<SortBy, string> = {
  pnl: 'PnL',
  winRate: 'Win Rate',
  drawdown: 'Drawdown',
}

function fmtPnl(v: number) {
  const abs = Math.abs(v).toFixed(2)
  return v >= 0 ? `+$${abs}` : `-$${abs}`
}

function fmtPct(v: number | null) {
  if (v == null) return '—'
  return `${v.toFixed(1)}%`
}

function rankClass(rank: number) {
  if (rank === 1) return 'text-yellow-400'
  if (rank === 2) return 'text-slate-300'
  if (rank === 3) return 'text-amber-600'
  return ''
}

export default function LeaderboardPage() {
  const [items, setItems] = useState<LeaderboardItem[]>([])
  const [total, setTotal] = useState(0)
  const [sortBy, setSortBy] = useState<SortBy>('pnl')
  const [loading, setLoading] = useState(true)
  const LIMIT = 20

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const data = await getLeaderboard({ sortBy, limit: LIMIT })
      setItems(data.items)
      setTotal(data.total)
    } catch {
      setItems([])
      setTotal(0)
    } finally {
      setLoading(false)
    }
  }, [sortBy])

  useEffect(() => { void load() }, [load])

  const totalPages = Math.ceil(total / LIMIT)

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Leaderboard</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Top-performing bots ranked by P&amp;L, win rate, or drawdown.
        </p>
      </div>

      {/* Sort tabs */}
      <div className="flex flex-wrap gap-2">
        {(Object.keys(SORT_LABELS) as SortBy[]).map((key) => (
          <button
            key={key}
            onClick={() => setSortBy(key)}
            className={`flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-sm transition-colors ${
              sortBy === key
                ? 'border-emerald-500/60 bg-emerald-500/15 text-emerald-300'
                : 'border-border text-muted-foreground hover:border-emerald-500/40 hover:text-foreground'
            }`}
          >
            {key === 'pnl' && <TrendingUp className="h-3.5 w-3.5" />}
            {key === 'winRate' && <Target className="h-3.5 w-3.5" />}
            {key === 'drawdown' && <BarChart2 className="h-3.5 w-3.5" />}
            {SORT_LABELS[key]}
          </button>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            Rankings — {total} public bots
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <div className="space-y-2 p-4">
              {Array.from({ length: 10 }).map((_, i) => (
                <Skeleton key={i} className="h-12 w-full rounded" />
              ))}
            </div>
          ) : items.length === 0 ? (
            <div className="flex items-center justify-center py-12">
              <p className="text-sm text-muted-foreground">
                No bots ranked yet. Publish your bots to the marketplace!
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border/50 text-xs text-muted-foreground">
                    <th className="whitespace-nowrap px-3 py-2 text-left font-medium sm:px-4 sm:py-2">#</th>
                    <th className="whitespace-nowrap px-3 py-2 text-left font-medium sm:px-4 sm:py-2">Bot</th>
                    <th className="whitespace-nowrap px-3 py-2 text-left font-medium sm:px-4 sm:py-2">Symbol</th>
                    <th className="whitespace-nowrap px-3 py-2 text-left font-medium sm:px-4 sm:py-2 hidden lg:table-cell">Strategy</th>
                    <th className="whitespace-nowrap px-3 py-2 text-right font-medium sm:px-4 sm:py-2">Total P&amp;L</th>
                    <th className="whitespace-nowrap px-3 py-2 text-right font-medium sm:px-4 sm:py-2 hidden sm:table-cell">Win Rate</th>
                    <th className="whitespace-nowrap px-3 py-2 text-right font-medium sm:px-4 sm:py-2 hidden md:table-cell">Drawdown</th>
                    <th className="whitespace-nowrap px-3 py-2 text-right font-medium sm:px-4 sm:py-2 hidden lg:table-cell">Trades</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((item) => (
                    <tr
                      key={item.botId}
                      className="border-b border-border/30 transition-colors hover:bg-muted/20"
                    >
                      <td className={`whitespace-nowrap px-3 py-3 font-mono text-sm font-bold sm:px-4 ${rankClass(item.rank)}`}>
                        #{item.rank}
                      </td>
                      <td className="whitespace-nowrap px-3 py-3 sm:px-4">
                        <div className="font-medium">{item.botName}</div>
                        {item.shareSlug && (
                          <Link
                            href={`/marketplace/bot/${item.shareSlug}`}
                            className="text-xs text-emerald-400 hover:underline"
                          >
                            View public →
                          </Link>
                        )}
                      </td>
                      <td className="whitespace-nowrap px-3 py-3 sm:px-4">
                        <Badge variant="outline" className="font-mono text-xs">
                          {item.symbol}
                        </Badge>
                      </td>
                      <td className="whitespace-nowrap px-3 py-3 text-muted-foreground sm:px-4 hidden lg:table-cell">
                        {item.strategy}
                      </td>
                      <td className={`whitespace-nowrap px-3 py-3 text-right font-mono text-sm font-medium sm:px-4 ${
                        item.totalPnl >= 0 ? 'text-emerald-400' : 'text-red-400'
                      }`}>
                        {fmtPnl(item.totalPnl)}
                      </td>
                      <td className="whitespace-nowrap px-3 py-3 text-right font-mono text-sm sm:px-4 hidden sm:table-cell">
                        {fmtPct(item.winRate)}
                      </td>
                      <td className="whitespace-nowrap px-3 py-3 text-right font-mono text-sm text-red-400 sm:px-4 hidden md:table-cell">
                        {fmtPct(item.maxDrawdown)}
                      </td>
                      <td className="whitespace-nowrap px-3 py-3 text-right font-mono text-sm text-muted-foreground sm:px-4 hidden lg:table-cell">
                        {item.totalTrades}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
