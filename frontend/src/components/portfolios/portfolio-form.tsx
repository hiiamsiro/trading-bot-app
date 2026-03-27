'use client'

import { useCallback, useEffect, useState } from 'react'
import { Bot, BotStatus } from '@/types'
import { createPortfolio, fetchBots, updatePortfolio } from '@/lib/api-client'
import { Button } from '@/components/ui/button'
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
import { toast } from '@/hooks/use-toast'
import { BotStatusBadge } from '@/components/bot-status-badge'
import type { Portfolio } from '@/types'

interface Props {
  open: boolean
  token: string
  onClose: () => void
  onSuccess: () => void
}

export function PortfolioFormDialog({ open, token, onClose, onSuccess }: Props) {
  const [loading, setLoading] = useState(false)
  const [bots, setBots] = useState<Bot[]>([])
  const [name, setName] = useState('')
  const [botIds, setBotIds] = useState<string[]>([])

  useEffect(() => {
    if (open) {
      void fetchBots(token).then(setBots).catch(() => setBots([]))
    }
  }, [open, token])

  const toggleBot = useCallback((id: string) => {
    setBotIds((prev) =>
      prev.includes(id) ? prev.filter((b) => b !== id) : [...prev, id],
    )
  }, [])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim()) {
      toast({ title: 'Name is required', variant: 'destructive' })
      return
    }
    setLoading(true)
    try {
      await createPortfolio(token, { name: name.trim(), botIds })
      toast({ title: 'Portfolio created' })
      onSuccess()
      onClose()
      setName('')
      setBotIds([])
    } catch {
      toast({ title: 'Could not create portfolio', variant: 'destructive' })
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Create portfolio</DialogTitle>
          <DialogDescription>
            Group your bots into a portfolio to track combined performance.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">Portfolio name</Label>
            <Input
              id="name"
              placeholder="e.g. Main Portfolio"
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoFocus
            />
          </div>

          {bots.length > 0 && (
            <div className="space-y-2">
              <Label>Assign bots</Label>
              <div className="max-h-48 space-y-1 overflow-y-auto rounded-md border border-border/70 p-2">
                {bots.map((bot) => (
                  <label
                    key={bot.id}
                    className="flex cursor-pointer items-center gap-2 rounded px-2 py-1.5 text-sm hover:bg-muted/60"
                  >
                    <input
                      type="checkbox"
                      checked={botIds.includes(bot.id)}
                      onChange={() => toggleBot(bot.id)}
                      className="accent-primary"
                    />
                    <span className="font-medium">{bot.name}</span>
                    <span className="ml-auto font-mono text-xs text-muted-foreground">
                      {bot.symbol}
                    </span>
                  </label>
                ))}
              </div>
              <p className="text-xs text-muted-foreground">
                {botIds.length} bot{botIds.length === 1 ? '' : 's'} selected
              </p>
            </div>
          )}

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              className="cursor-pointer"
            >
              Cancel
            </Button>
            <Button type="submit" disabled={loading || !name.trim()} className="cursor-pointer">
              {loading ? 'Creating...' : 'Create portfolio'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

interface EditDialogProps {
  open: boolean
  token: string
  portfolio: Portfolio
  onClose: () => void
  onSuccess: () => void
}

export function PortfolioEditDialog({ open, token, portfolio, onClose, onSuccess }: EditDialogProps) {
  const [name, setName] = useState(portfolio.name)
  const [botIds, setBotIds] = useState<string[]>(portfolio.bots.map((b) => b.id))
  const [loading, setLoading] = useState(false)
  const [botSearch, setBotSearch] = useState('')

  const toggleBot = useCallback((id: string) => {
    setBotIds((prev) =>
      prev.includes(id) ? prev.filter((b) => b !== id) : [...prev, id],
    )
  }, [])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim()) {
      toast({ title: 'Name is required', variant: 'destructive' })
      return
    }
    setLoading(true)
    try {
      await updatePortfolio(token, portfolio.id, { name: name.trim(), botIds })
      toast({ title: 'Portfolio updated' })
      onSuccess()
    } catch {
      toast({ title: 'Could not update portfolio', variant: 'destructive' })
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Edit portfolio</DialogTitle>
          <DialogDescription>Rename or reassign bots to this portfolio.</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="edit-name">Name</Label>
            <Input
              id="edit-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoFocus
            />
          </div>
          <div className="space-y-2">
            <Label>Bots in portfolio</Label>
            <div className="max-h-48 space-y-1 overflow-y-auto rounded-md border border-border/70 p-2">
              {portfolio.bots
                .filter(
                  (b) =>
                    !botSearch ||
                    b.name.toLowerCase().includes(botSearch.toLowerCase()),
                )
                .map((bot) => (
                  <label
                    key={bot.id}
                    className="flex cursor-pointer items-center gap-2 rounded px-2 py-1.5 text-sm hover:bg-muted/60"
                  >
                    <input
                      type="checkbox"
                      checked={botIds.includes(bot.id)}
                      onChange={() => toggleBot(bot.id)}
                      className="accent-primary"
                    />
                    <BotStatusBadge status={bot.status} />
                    <span className="font-medium">{bot.name}</span>
                    <span className="ml-auto font-mono text-xs text-muted-foreground">
                      {bot.symbol}
                    </span>
                  </label>
                ))}
            </div>
            <div className="flex items-center gap-2">
              <Input
                placeholder="Search bots..."
                value={botSearch}
                onChange={(e) => setBotSearch(e.target.value)}
                className="h-8 text-sm"
              />
              <span className="text-xs text-muted-foreground">{botIds.length} selected</span>
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose} className="cursor-pointer">
              Cancel
            </Button>
            <Button type="submit" disabled={loading} className="cursor-pointer">
              {loading ? 'Saving...' : 'Save changes'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
