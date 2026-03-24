'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Loader2 } from 'lucide-react'
import { useAuthStore } from '@/store/auth.store'
import { createBot } from '@/lib/api-client'
import { useHandleApiError } from '@/hooks/use-handle-api-error'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

type StrategyKey = 'sma_crossover' | 'rsi'

export default function CreateBotPage() {
  const router = useRouter()
  const token = useAuthStore((s) => s.token)
  const handleError = useHandleApiError()
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [symbol, setSymbol] = useState('BTCUSD')
  const [strategy, setStrategy] = useState<StrategyKey>('sma_crossover')
  const [shortPeriod, setShortPeriod] = useState('10')
  const [longPeriod, setLongPeriod] = useState('20')
  const [rsiPeriod, setRsiPeriod] = useState('14')
  const [initialBalance, setInitialBalance] = useState('10000')
  const [submitting, setSubmitting] = useState(false)

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!token) return
    setSubmitting(true)
    try {
      const ib = Number(initialBalance)
      const params: Record<string, unknown> = {
        initialBalance: Number.isFinite(ib) && ib > 0 ? ib : 10000,
      }
      if (strategy === 'sma_crossover') {
        params.shortPeriod = Number(shortPeriod) || 10
        params.longPeriod = Number(longPeriod) || 20
      } else {
        params.period = Number(rsiPeriod) || 14
      }
      const bot = await createBot(token, {
        name: name.trim(),
        description: description.trim() || undefined,
        symbol: symbol.trim().toUpperCase(),
        strategyConfig: {
          strategy,
          params,
        },
      })
      router.replace(`/bots/${bot.id}`)
    } catch (err) {
      handleError(err, 'Could not create bot')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="mx-auto max-w-xl space-y-6">
      <div>
        <Button variant="ghost" size="sm" asChild className="mb-2 -ml-2">
          <Link href="/bots">← Back to bots</Link>
        </Button>
        <h1 className="text-3xl font-bold tracking-tight">Create bot</h1>
        <p className="text-muted-foreground">
          Configure a demo bot. Strategy parameters match the backend engine.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Bot details</CardTitle>
          <CardDescription>Required fields are validated by the API.</CardDescription>
        </CardHeader>
        <form onSubmit={onSubmit}>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Name</Label>
              <Input
                id="name"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="My BTC bot"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="description">Description (optional)</Label>
              <Input
                id="description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="symbol">Symbol</Label>
              <Input
                id="symbol"
                required
                value={symbol}
                onChange={(e) => setSymbol(e.target.value)}
                placeholder="BTCUSD"
              />
            </div>
            <div className="space-y-2">
              <Label>Strategy</Label>
              <Select
                value={strategy}
                onValueChange={(v) => setStrategy(v as StrategyKey)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="sma_crossover">SMA crossover</SelectItem>
                  <SelectItem value="rsi">RSI</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {strategy === 'sma_crossover' ? (
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="short">Short period</Label>
                  <Input
                    id="short"
                    type="number"
                    min={1}
                    value={shortPeriod}
                    onChange={(e) => setShortPeriod(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="long">Long period</Label>
                  <Input
                    id="long"
                    type="number"
                    min={2}
                    value={longPeriod}
                    onChange={(e) => setLongPeriod(e.target.value)}
                  />
                </div>
              </div>
            ) : (
              <div className="space-y-2">
                <Label htmlFor="rsi">RSI period</Label>
                <Input
                  id="rsi"
                  type="number"
                  min={2}
                  value={rsiPeriod}
                  onChange={(e) => setRsiPeriod(e.target.value)}
                />
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor="bal">Session initial balance (demo)</Label>
              <Input
                id="bal"
                type="number"
                min={1}
                step="any"
                value={initialBalance}
                onChange={(e) => setInitialBalance(e.target.value)}
              />
            </div>
            <div className="flex gap-2 pt-2">
              <Button type="submit" disabled={submitting}>
                {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Create
              </Button>
              <Button type="button" variant="outline" asChild>
                <Link href="/bots">Cancel</Link>
              </Button>
            </div>
          </CardContent>
        </form>
      </Card>
    </div>
  )
}
