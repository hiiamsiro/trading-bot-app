'use client'

import { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'
import { Loader2, ShieldCheck } from 'lucide-react'
import { ApiError } from '@/lib/api'
import { Bot, BotStatus } from '@/types'
import { useAuthStore } from '@/store/auth.store'
import { fetchBot, updateBot } from '@/lib/api-client'
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
import { Skeleton } from '@/components/ui/skeleton'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'

export default function EditBotPage() {
  const params = useParams()
  const router = useRouter()
  const id = typeof params.id === 'string' ? params.id : ''
  const token = useAuthStore((s) => s.token)
  const handleError = useHandleApiError()
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [symbol, setSymbol] = useState('')
  const [status, setStatus] = useState<BotStatus>(BotStatus.STOPPED)
  const [submitting, setSubmitting] = useState(false)

  const load = useCallback(async () => {
    if (!token || !id) return
    setLoading(true)
    setNotFound(false)
    try {
      const b = await fetchBot(token, id)
      setName(b.name)
      setDescription(b.description ?? '')
      setSymbol(b.symbol)
      setStatus(b.status)
    } catch (e) {
      if (e instanceof ApiError && e.status === 404) {
        setNotFound(true)
      } else {
        handleError(e)
      }
    } finally {
      setLoading(false)
    }
  }, [token, id, handleError])

  useEffect(() => {
    load()
  }, [load])

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!token || !id) return
    setSubmitting(true)
    try {
      await updateBot(token, id, {
        name: name.trim(),
        description: description.trim() || undefined,
        symbol: symbol.trim().toUpperCase(),
        status,
      })
      router.replace(`/bots/${id}`)
    } catch (e) {
      handleError(e, 'Could not update bot')
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) {
    return (
      <div className="mx-auto max-w-xl space-y-6">
        <Skeleton className="h-8 w-40" />
        <Skeleton className="h-96 rounded-lg" />
      </div>
    )
  }

  if (notFound) {
    return (
      <Alert variant="destructive">
        <AlertTitle>Not found</AlertTitle>
        <AlertDescription>Bot missing or access denied.</AlertDescription>
      </Alert>
    )
  }

  return (
    <div className="mx-auto max-w-xl space-y-6">
      <div>
        <Button variant="ghost" size="sm" asChild className="mb-2 -ml-2 cursor-pointer">
          <Link href={id ? `/bots/${id}` : '/bots'}>← Back</Link>
        </Button>
        <h1 className="text-3xl font-semibold tracking-tight">Edit bot</h1>
        <p className="text-muted-foreground">
          Name, symbol, description, and status. Strategy changes are not exposed on this API.
        </p>
        <p className="mt-2 inline-flex items-center gap-1 text-xs text-amber-300">
          <ShieldCheck className="h-3.5 w-3.5" />
          Trusted update flow with strict API validation
        </p>
      </div>

      <Card className="border-border/70 bg-card/80 backdrop-blur-xl">
        <CardHeader>
          <CardTitle>Details</CardTitle>
          <CardDescription>Updates are sent to PUT /bots/:id</CardDescription>
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
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
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
              />
            </div>
            <div className="space-y-2">
              <Label>Status</Label>
              <Select
                value={status}
                onValueChange={(v) => setStatus(v as BotStatus)}
              >
                <SelectTrigger className="cursor-pointer">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.values(BotStatus).map((s) => (
                    <SelectItem key={s} value={s}>
                      {s}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex gap-2 pt-2">
              <Button type="submit" disabled={submitting} className="cursor-pointer">
                {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Save
              </Button>
              <Button type="button" variant="outline" asChild className="cursor-pointer">
                <Link href={`/bots/${id}`}>Cancel</Link>
              </Button>
            </div>
          </CardContent>
        </form>
      </Card>
    </div>
  )
}
