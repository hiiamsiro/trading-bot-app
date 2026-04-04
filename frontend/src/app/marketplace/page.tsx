'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  Bot as BotIcon,
  Loader2,
  ShieldCheck,
  TrendingUp,
  Zap,
  Sparkles,
  Globe,
} from 'lucide-react'
import type { PublicBot } from '@/types'
import { fetchPublicBots, cloneBot } from '@/lib/api-client'
import { useAuthStore } from '@/store/auth.store'
import { useHandleApiError } from '@/hooks/use-handle-api-error'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { TableSkeleton } from '@/components/table-skeleton'
import { EmptyState } from '@/components/empty-state'
import { toast } from '@/hooks/use-toast'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'

const PAGE_SIZE = 24
const STRATEGIES = ['all', 'sma_crossover', 'rsi'] as const

const STRATEGY_LABELS: Record<string, string> = {
  all: 'All',
  sma_crossover: 'MA Crossover',
  rsi: 'RSI',
}

export default function MarketplacePage() {
  const router = useRouter()
  const token = useAuthStore((s) => s.token)
  const handleError = useHandleApiError()

  const [bots, setBots] = useState<PublicBot[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [searchInput, setSearchInput] = useState('')
  const [activeStrategy, setActiveStrategy] = useState('all')
  const [skip, setSkip] = useState(0)
  const [cloning, setCloning] = useState<string | null>(null)

  const load = useCallback(
    async (s?: string, offset = 0) => {
      if (!token) return
      setLoading(true)
      try {
        const res = await fetchPublicBots(token, {
          search: s,
          skip: offset,
          take: PAGE_SIZE,
          strategy: activeStrategy !== 'all' ? activeStrategy : undefined,
        })
        setBots(offset === 0 ? res.items : (prev) => [...prev, ...res.items])
        setTotal(res.total)
        setSkip(offset)
      } catch (e) {
        handleError(e)
      } finally {
        setLoading(false)
      }
    },
    [token, handleError, activeStrategy],
  )

  useEffect(() => {
    const timer = setTimeout(() => {
      void load(searchInput.trim() || undefined, 0)
    }, 350)
    return () => clearTimeout(timer)
  }, [searchInput, activeStrategy]) // eslint-disable-line react-hooks/exhaustive-deps

  function handleSearch(e: React.ChangeEvent<HTMLInputElement>) {
    setSearchInput(e.target.value)
    setBots([])
    setSkip(0)
  }

  function handleStrategyChange(strategy: string) {
    setActiveStrategy(strategy)
    setBots([])
    setSkip(0)
  }

  async function handleClone(slug: string, botName: string) {
    if (!token) {
      router.replace('/login')
      return
    }
    setCloning(slug)
    try {
      const bot = await cloneBot(token, slug)
      toast({ title: 'Strategy cloned!', description: `"${botName}" is now in your bots.` })
      router.push(`/bots/${bot.id}`)
    } catch (e) {
      handleError(e)
    } finally {
      setCloning(null)
    }
  }

  const hasMore = bots.length < total

  if (loading && bots.length === 0) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <Skeleton className="h-9 w-48" />
        </div>
        <div className="flex gap-3">
          <Skeleton className="h-10 flex-1" />
          <Skeleton className="h-10 w-32" />
        </div>
        <TableSkeleton columns={5} rows={6} />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Page header — matches other pages */}
      <div className="flex flex-col gap-4 rounded-xl border border-border/70 bg-card/70 p-6 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <Globe className="h-5 w-5 text-emerald-400" />
            <h1 className="text-3xl font-semibold tracking-tight">Strategy Marketplace</h1>
          </div>
          <p className="mt-1 text-muted-foreground">
            Discover and clone trading strategies shared by the community.
          </p>
          <p className="mt-2 inline-flex items-center gap-1 text-xs text-amber-300">
            <ShieldCheck className="h-3.5 w-3.5" />
            All strategies run in paper-trading mode
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
          <span className="font-medium text-foreground">{total}</span>
          <span>strategies shared</span>
        </div>
      </div>

      {/* Filters — search + strategy chips */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <Input
          type="text"
          value={searchInput}
          onChange={handleSearch}
          placeholder="Search by name, symbol, description…"
          className="sm:max-w-xs"
        />
        <div className="flex flex-wrap items-center gap-1.5">
          {STRATEGIES.map((s) => {
            const isActive = activeStrategy === s
            const isRsi = s === 'rsi'
            const isSma = s === 'sma_crossover'
            return (
              <Button
                key={s}
                size="sm"
                variant={isActive ? 'default' : 'outline'}
                className={`gap-1.5 cursor-pointer ${isActive && isRsi ? 'bg-violet-600 hover:bg-violet-500' : isActive && isSma ? 'bg-sky-600 hover:bg-sky-500' : ''}`}
                onClick={() => handleStrategyChange(s)}
              >
                {s === 'rsi' ? <Zap className="h-3 w-3" /> : s === 'sma_crossover' ? <TrendingUp className="h-3 w-3" /> : <Sparkles className="h-3 w-3" />}
                {STRATEGY_LABELS[s]}
              </Button>
            )
          })}
        </div>
      </div>

      {/* Table */}
      {bots.length === 0 ? (
        <EmptyState
          icon={Globe}
          title="No strategies found"
          description={
            searchInput || activeStrategy !== 'all'
              ? 'Try clearing the search or filters.'
              : 'No public strategies yet. Be the first to share one!'
          }
        >
          {(searchInput || activeStrategy !== 'all') && (
            <Button
              variant="outline"
              className="cursor-pointer"
              onClick={() => {
                setSearchInput('')
                handleStrategyChange('all')
              }}
            >
              Clear filters
            </Button>
          )}
        </EmptyState>
      ) : (
        <>
          <div className="overflow-x-auto rounded-md border border-border/70 bg-card/80 backdrop-blur-xl">
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead className="whitespace-nowrap">Name</TableHead>
                  <TableHead className="whitespace-nowrap">Symbol</TableHead>
                  <TableHead className="whitespace-nowrap hidden sm:table-cell">Strategy</TableHead>
                  <TableHead className="whitespace-nowrap hidden lg:table-cell">Author</TableHead>
                  <TableHead className="whitespace-nowrap hidden lg:table-cell">Added</TableHead>
                  <TableHead className="text-right whitespace-nowrap">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {bots.map((bot) => {
                  const isRsi = bot.strategy === 'rsi'
                  return (
                    <TableRow
                      key={bot.shareSlug}
                      className="transition-colors duration-200 hover:bg-muted/40"
                    >
                      <TableCell className="font-medium">
                        <Link
                          href={`/marketplace/bot/${bot.shareSlug}`}
                          className="cursor-pointer hover:underline"
                        >
                          {bot.name}
                        </Link>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="font-mono text-xs">
                          {bot.symbol}
                        </Badge>
                      </TableCell>
                      <TableCell className="hidden sm:table-cell">
                        <Badge
                          variant="outline"
                          className={`text-xs ${isRsi ? 'border-violet-500/40 bg-violet-500/10 text-violet-300' : 'border-sky-500/40 bg-sky-500/10 text-sky-300'}`}
                        >
                          {isRsi ? <Zap className="mr-1 h-3 w-3" /> : <TrendingUp className="mr-1 h-3 w-3" />}
                          {isRsi ? 'RSI' : 'MA Crossover'}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-muted-foreground hidden lg:table-cell">
                        {bot.userName ?? 'Anonymous'}
                      </TableCell>
                      <TableCell className="text-muted-foreground hidden lg:table-cell">
                        {new Date(bot.createdAt).toLocaleDateString()}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          <Button
                            size="sm"
                            className="cursor-pointer"
                            disabled={cloning === bot.shareSlug}
                            onClick={() => handleClone(bot.shareSlug, bot.name)}
                          >
                            {cloning === bot.shareSlug ? (
                              <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />
                            ) : (
                              <Sparkles className="mr-1 h-3.5 w-3.5" />
                            )}
                            <span className="hidden sm:inline">Clone</span>
                          </Button>
                          <Button size="sm" variant="ghost" asChild className="cursor-pointer">
                            <Link href={`/marketplace/bot/${bot.shareSlug}`}>View</Link>
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          </div>

          {hasMore && (
            <div className="flex justify-center">
              <Button
                variant="outline"
                className="cursor-pointer"
                disabled={loading}
                onClick={() => void load(searchInput.trim() || undefined, skip + PAGE_SIZE)}
              >
                {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                Load more
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  )
}
