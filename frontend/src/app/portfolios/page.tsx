'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import type { Portfolio } from '@/types'
import { useAuthStore } from '@/store/auth.store'
import {
  deletePortfolio,
  fetchPortfolios,
} from '@/lib/api-client'
import { useHandleApiError } from '@/hooks/use-handle-api-error'
import { toast } from '@/hooks/use-toast'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { EmptyState } from '@/components/empty-state'
import { PortfolioFormDialog } from '@/components/portfolios/portfolio-form'
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
import { BotStatusBadge } from '@/components/bot-status-badge'
import { AlertCircle, FolderOpen, Plus, Trash2 } from 'lucide-react'

export default function PortfoliosListPage() {
  const token = useAuthStore((s) => s.token)
  const handleError = useHandleApiError()
  const router = useRouter()

  const [loading, setLoading] = useState(true)
  const [portfolios, setPortfolios] = useState<Portfolio[]>([])
  const [loadError, setLoadError] = useState<string | null>(null)
  const [createOpen, setCreateOpen] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  const load = useCallback(
    (showLoading = true) => {
      if (!token) return
      ;(async () => {
        if (showLoading) setLoading(true)
        setLoadError(null)
        try {
          const data = await fetchPortfolios(token)
          setPortfolios(data)
        } catch (e) {
          setLoadError('Could not load portfolios.')
          handleError(e)
        } finally {
          if (showLoading) setLoading(false)
        }
      })()
    },
    [token, handleError],
  )

  useEffect(() => {
    void load()
  }, [load])

  async function handleDelete(id: string) {
    if (!token) return
    setDeletingId(id)
    try {
      await deletePortfolio(token, id)
      setPortfolios((prev) => prev.filter((p) => p.id !== id))
      toast({ title: 'Portfolio deleted' })
    } catch {
      toast({ title: 'Could not delete portfolio', variant: 'destructive' })
    } finally {
      setDeletingId(null)
    }
  }

  function handleCreateSuccess() {
    void load(false)
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-9 w-36" />
        </div>
        {[1, 2].map((i) => (
          <Skeleton key={i} className="h-20 rounded-lg" />
        ))}
      </div>
    )
  }

  if (loadError) {
    return (
      <div className="space-y-4">
        <Alert variant="destructive">
          <AlertTitle>Could not load portfolios</AlertTitle>
          <AlertDescription>{loadError}</AlertDescription>
        </Alert>
        <Button onClick={() => load()} className="cursor-pointer">
          Retry
        </Button>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">Portfolios</h1>
          <p className="mt-1 text-muted-foreground">
            Group bots to track combined performance metrics.
          </p>
        </div>
        <Button onClick={() => setCreateOpen(true)} className="gap-2 cursor-pointer w-full sm:w-auto justify-center">
          <Plus className="h-4 w-4" />
          New portfolio
        </Button>
      </div>

      {portfolios.length === 0 ? (
        <EmptyState
          icon={FolderOpen}
          title="No portfolios yet"
          description="Create a portfolio to group and monitor multiple bots together."
        >
          <Button onClick={() => setCreateOpen(true)} className="gap-2 cursor-pointer">
            <Plus className="h-4 w-4" />
            Create your first portfolio
          </Button>
        </EmptyState>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-border/70">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead className="text-muted-foreground">Name</TableHead>
                <TableHead className="text-muted-foreground hidden sm:table-cell">Bots</TableHead>
                <TableHead className="text-muted-foreground hidden lg:table-cell">Created</TableHead>
                <TableHead className="text-right text-muted-foreground">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
            {portfolios.map((portfolio) => (
              <TableRow
                key={portfolio.id}
                className="cursor-pointer transition-colors duration-200 hover:bg-muted/40"
                onClick={() => router.push(`/portfolios/${portfolio.id}`)}
              >
                <TableCell className="font-medium">{portfolio.name}</TableCell>
                <TableCell className="hidden sm:table-cell">
                  <div className="flex flex-wrap gap-1">
                    {portfolio.bots.length === 0 ? (
                      <span className="text-xs text-muted-foreground">No bots</span>
                    ) : (
                      portfolio.bots.slice(0, 3).map((b) => (
                        <BotStatusBadge key={b.id} status={b.status} label={b.name} />
                      ))
                    )}
                    {portfolio.bots.length > 3 && (
                      <span className="rounded border border-border/70 bg-muted/40 px-1.5 py-0.5 text-xs text-muted-foreground">
                        +{portfolio.bots.length - 3}
                      </span>
                    )}
                  </div>
                </TableCell>
                <TableCell className="font-mono text-xs text-muted-foreground hidden lg:table-cell">
                  {new Date(portfolio.createdAt).toLocaleDateString()}
                </TableCell>
                <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 gap-1 text-rose-400/70 hover:text-rose-400 cursor-pointer"
                    onClick={() => handleDelete(portfolio.id)}
                    disabled={deletingId === portfolio.id}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    <span className="hidden sm:inline">Delete</span>
                  </Button>
                </TableCell>
              </TableRow>
            ))}
            </TableBody>
          </Table>
        </div>
      )}

      <PortfolioFormDialog
        open={createOpen}
        token={token ?? ''}
        onClose={() => setCreateOpen(false)}
        onSuccess={handleCreateSuccess}
      />
    </div>
  )
}
