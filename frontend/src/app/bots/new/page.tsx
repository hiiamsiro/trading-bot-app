'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Loader2, ShieldCheck } from 'lucide-react'
import { useAuthStore } from '@/store/auth.store'
import { createBot, fetchInstruments } from '@/lib/api-client'
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
import { Instrument } from '@/types'

type StrategyKey = 'sma_crossover' | 'rsi'

export default function CreateBotPage() {
  const router = useRouter()
  const token = useAuthStore((s) => s.token)
  const handleError = useHandleApiError()
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [symbol, setSymbol] = useState('')
  const [instruments, setInstruments] = useState<Instrument[]>([])
  const [loadingInstruments, setLoadingInstruments] = useState(true)
  const [strategy, setStrategy] = useState<StrategyKey>('sma_crossover')
  const [shortPeriod, setShortPeriod] = useState('10')
  const [longPeriod, setLongPeriod] = useState('20')
  const [rsiPeriod, setRsiPeriod] = useState('14')
  const [initialBalance, setInitialBalance] = useState('10000')
  const [errors, setErrors] = useState<{
    name?: string
    symbol?: string
    shortPeriod?: string
    longPeriod?: string
    rsiPeriod?: string
    initialBalance?: string
  }>({})
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    async function loadInstruments() {
      if (!token) return
      setLoadingInstruments(true)
      try {
        const items = await fetchInstruments(token)
        setInstruments(items)
        if (items.length > 0) {
          setSymbol(items[0].symbol)
        }
      } catch (err) {
        handleError(err, 'Could not load instruments')
      } finally {
        setLoadingInstruments(false)
      }
    }

    loadInstruments()
  }, [token, handleError])

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!token) return
    setErrors({})

    const trimmedName = name.trim()
    const ib = Number(initialBalance)
    const nextErrors: {
      name?: string
      symbol?: string
      shortPeriod?: string
      longPeriod?: string
      rsiPeriod?: string
      initialBalance?: string
    } = {}

    if (!trimmedName) {
      nextErrors.name = 'Bot name is required.'
    }
    if (!symbol) {
      nextErrors.symbol = 'Please select an instrument.'
    }
    if (!Number.isFinite(ib) || ib <= 0) {
      nextErrors.initialBalance = 'Initial balance must be greater than 0.'
    }

    if (strategy === 'sma_crossover') {
      const short = Number(shortPeriod)
      const long = Number(longPeriod)
      if (!Number.isInteger(short) || short < 1) {
        nextErrors.shortPeriod =
          'Short period must be an integer greater than or equal to 1.'
      }
      if (!Number.isInteger(long) || long < 2) {
        nextErrors.longPeriod = 'Long period must be an integer greater than or equal to 2.'
      }
      if (Number.isInteger(short) && Number.isInteger(long) && short >= long) {
        nextErrors.shortPeriod = 'Short period must be smaller than long period.'
        nextErrors.longPeriod = 'Long period must be greater than short period.'
      }
    } else {
      const period = Number(rsiPeriod)
      if (!Number.isInteger(period) || period < 2) {
        nextErrors.rsiPeriod = 'RSI period must be an integer greater than or equal to 2.'
      }
    }

    if (Object.keys(nextErrors).length > 0) {
      setErrors(nextErrors)
      return
    }

    setSubmitting(true)
    try {
      const params: Record<string, unknown> = {
        initialBalance: ib,
      }
      if (strategy === 'sma_crossover') {
        params.shortPeriod = Number(shortPeriod)
        params.longPeriod = Number(longPeriod)
      } else {
        params.period = Number(rsiPeriod)
      }
      const bot = await createBot(token, {
        name: trimmedName,
        description: description.trim() || undefined,
        symbol,
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
        <Button variant="ghost" size="sm" asChild className="mb-2 -ml-2 cursor-pointer">
          <Link href="/bots">← Back to bots</Link>
        </Button>
        <h1 className="text-3xl font-semibold tracking-tight">Create bot</h1>
        <p className="text-muted-foreground">
          Configure a demo bot. Strategy parameters match the backend engine.
        </p>
        <p className="mt-2 inline-flex items-center gap-1 text-xs text-amber-300">
          <ShieldCheck className="h-3.5 w-3.5" />
          Secure setup with validated parameters
        </p>
      </div>

      <Card className="border-border/70 bg-card/80 backdrop-blur-xl">
        <CardHeader>
          <CardTitle>Bot details</CardTitle>
          <CardDescription>Required fields are validated by the API.</CardDescription>
        </CardHeader>
        <form onSubmit={onSubmit} noValidate>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Name</Label>
              <Input
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="My BTC bot"
              />
              {errors.name && <p className="text-sm text-destructive">{errors.name}</p>}
            </div>
            <div className="space-y-2">
              <Label htmlFor="description">Description (optional)</Label>
              <Input
                id="description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Trend following bot for BTC (optional)"
              />
            </div>
            <div className="space-y-2">
              <Label>Instrument</Label>
              <Select value={symbol} onValueChange={setSymbol} disabled={loadingInstruments}>
                <SelectTrigger className="cursor-pointer">
                  <SelectValue
                    placeholder={loadingInstruments ? 'Loading instruments...' : 'Select instrument'}
                  />
                </SelectTrigger>
                <SelectContent>
                  {instruments.map((instrument) => (
                    <SelectItem key={instrument.symbol} value={instrument.symbol}>
                      {instrument.symbol} - {instrument.displayName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {errors.symbol && <p className="text-sm text-destructive">{errors.symbol}</p>}
            </div>
            <div className="space-y-2">
              <Label>Strategy</Label>
              <Select
                value={strategy}
                onValueChange={(v) => setStrategy(v as StrategyKey)}
              >
                <SelectTrigger className="cursor-pointer">
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
                    placeholder="10"
                  />
                  {errors.shortPeriod && (
                    <p className="text-sm text-destructive">{errors.shortPeriod}</p>
                  )}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="long">Long period</Label>
                  <Input
                    id="long"
                    type="number"
                    min={2}
                    value={longPeriod}
                    onChange={(e) => setLongPeriod(e.target.value)}
                    placeholder="20"
                  />
                  {errors.longPeriod && (
                    <p className="text-sm text-destructive">{errors.longPeriod}</p>
                  )}
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
                  placeholder="14"
                />
                {errors.rsiPeriod && (
                  <p className="text-sm text-destructive">{errors.rsiPeriod}</p>
                )}
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
                placeholder="10000"
              />
              {errors.initialBalance && (
                <p className="text-sm text-destructive">{errors.initialBalance}</p>
              )}
            </div>
            <div className="flex gap-2 pt-2">
              <Button
                type="submit"
                disabled={submitting || loadingInstruments || instruments.length === 0}
                className="cursor-pointer"
              >
                {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Create
              </Button>
              <Button type="button" variant="outline" asChild className="cursor-pointer">
                <Link href="/bots">Cancel</Link>
              </Button>
            </div>
          </CardContent>
        </form>
      </Card>
    </div>
  )
}
