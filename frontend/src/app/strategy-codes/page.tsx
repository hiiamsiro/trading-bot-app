'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useBotsStore } from '@/store/bots.store'
import { useAuthStore } from '@/store/auth.store'
import { useHandleApiError } from '@/hooks/use-handle-api-error'
import { toast } from '@/hooks/use-toast'
import { EmptyState } from '@/components/empty-state'
import { TableSkeleton } from '@/components/table-skeleton'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import {
  Code2,
  Loader2,
  Pencil,
  Plus,
  Trash2,
} from 'lucide-react'

export default function StrategyCodesPage() {
  const router = useRouter()
  const token = useAuthStore((s) => s.token)
  const handleError = useHandleApiError()

  const {
    strategyCodes,
    isCodesLoading,
    codesError,
    loadStrategyCodes,
    deleteStrategyCode,
  } = useBotsStore()

  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [deleting, setDeleting] = useState(false)

  const load = useCallback(() => {
    void loadStrategyCodes()
  }, [loadStrategyCodes])

  useEffect(() => {
    if (token) {
      load()
    }
  }, [token, load])

  async function handleDelete(id: string) {
    if (!token) return
    setDeleting(true)
    try {
      await deleteStrategyCode(id)
      toast({ title: 'Strategy code deleted' })
      setDeleteId(null)
    } catch (err) {
      handleError(err, 'Could not delete strategy code')
    } finally {
      setDeleting(false)
    }
  }

  if (isCodesLoading && strategyCodes.length === 0) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <Skeleton className="h-9 w-48" />
          <Skeleton className="h-10 w-36" />
        </div>
        <TableSkeleton columns={5} rows={6} />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 rounded-xl border border-border/70 bg-card/70 p-6 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">Strategy Codes</h1>
          <p className="text-muted-foreground">
            Write, save, and manage custom strategy scripts.
          </p>
        </div>
        <Button asChild className="cursor-pointer">
          <Link href="/strategy-codes/new">
            <Plus className="mr-2 h-4 w-4" />
            New strategy
          </Link>
        </Button>
      </div>

      {/* Error */}
      {codesError && strategyCodes.length === 0 ? (
        <Alert variant="destructive">
          <AlertTitle>Could not load strategy codes</AlertTitle>
          <AlertDescription>{codesError}</AlertDescription>
        </Alert>
      ) : null}

      {/* Empty state */}
      {strategyCodes.length === 0 && !isCodesLoading ? (
        <EmptyState
          icon={Code2}
          title="No strategy codes yet"
          description="Write your first custom strategy using the Monaco code editor with autocomplete support."
        >
          <Button asChild className="cursor-pointer">
            <Link href="/strategy-codes/new">Write a strategy</Link>
          </Button>
        </EmptyState>
      ) : (
        /* Table */
        <div className="overflow-x-auto rounded-xl border border-border/70 bg-card/80 backdrop-blur-xl">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead>Name</TableHead>
                <TableHead>Description</TableHead>
                <TableHead>Language</TableHead>
                <TableHead>Valid</TableHead>
                <TableHead>Last validated</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {strategyCodes.map((code) => (
                <TableRow
                  key={code.id}
                  className="transition-colors duration-200 hover:bg-muted/40"
                >
                  <TableCell className="font-medium">
                    <Link
                      href={`/strategy-codes/${code.id}`}
                      className="cursor-pointer transition-colors hover:text-primary"
                    >
                      {code.name}
                    </Link>
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {code.description ?? '—'}
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className="font-mono text-xs">
                      {code.language}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant={code.isValid ? 'default' : 'destructive'}
                      className={code.isValid ? 'bg-emerald-500/20 text-emerald-300' : ''}
                    >
                      {code.isValid ? 'Valid' : 'Invalid'}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {code.lastValidAt
                      ? new Date(code.lastValidAt).toLocaleDateString()
                      : 'Never'}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        asChild
                        className="h-8 w-8 cursor-pointer p-0"
                      >
                        <Link href={`/strategy-codes/${code.id}`} aria-label="Edit">
                          <Pencil className="h-4 w-4" />
                        </Link>
                      </Button>
                      <AlertDialog
                        open={deleteId === code.id}
                        onOpenChange={(open) => {
                          if (!open) setDeleteId(null)
                        }}
                      >
                        <AlertDialogTrigger asChild>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-8 w-8 cursor-pointer p-0 text-muted-foreground hover:text-destructive"
                            onClick={() => setDeleteId(code.id)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Delete strategy code?</AlertDialogTitle>
                            <AlertDialogDescription>
                              <strong>{code.name}</strong> will be permanently deleted. This cannot be undone.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction
                              variant="destructive"
                              onClick={() => void handleDelete(code.id)}
                              disabled={deleting}
                            >
                              {deleting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                              Delete
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
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
