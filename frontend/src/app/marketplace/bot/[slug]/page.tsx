'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'
import { Globe, Loader2 } from 'lucide-react'
import { ApiError } from '@/lib/api'
import { fetchPublicBots, cloneBot } from '@/lib/api-client'
import { useAuthStore } from '@/store/auth.store'
import { useHandleApiError } from '@/hooks/use-handle-api-error'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { toast } from '@/hooks/use-toast'

interface PublicBotDetail {
  id: string
  name: string
  description: string | null
  symbol: string
  strategy: string
  params: Record<string, unknown>
  builderConfig: Record<string, unknown> | null
  userName: string | null
  userEmail: string
}

export default function PublicBotPage() {
  const params = useParams()
  const router = useRouter()
  const slug = typeof params.slug === 'string' ? params.slug : ''
  const token = useAuthStore((s) => s.token)
  const handleError = useHandleApiError()

  const [bot, setBot] = useState<PublicBotDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)
  const [cloning, setCloning] = useState(false)
  const [cloneName, setCloneName] = useState('')

  useEffect(() => {
    if (!token || !slug) return
    let cancelled = false
    void (async () => {
      try {
        // Fetch via the marketplace endpoint
        const res = await fetch(
          `${process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001'}/marketplace/bot/${encodeURIComponent(slug)}`,
          {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          },
        )
        if (!cancelled) {
          if (!res.ok) {
            setNotFound(true)
          } else {
            const data = await res.json() as PublicBotDetail
            setBot(data)
            setCloneName(`${data.name} (Copy)`)
          }
        }
      } catch {
        if (!cancelled) setNotFound(true)
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, slug])

  async function handleClone() {
    if (!token || !slug) {
      router.replace('/login')
      return
    }
    setCloning(true)
    try {
      const newBot = await cloneBot(token, slug, { name: cloneName || undefined })
      toast({ title: 'Bot cloned', description: `"${newBot.name}" has been added to your bots.` })
      router.push(`/bots/${newBot.id}`)
    } catch (e) {
      handleError(e)
    } finally {
      setCloning(false)
    }
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-64 rounded-lg" />
      </div>
    )
  }

  if (notFound || !bot) {
    return (
      <div className="space-y-4">
        <Alert variant="destructive">
          <AlertTitle>Not found</AlertTitle>
          <AlertDescription>
            This strategy does not exist or has been unpublished.
          </AlertDescription>
        </Alert>
        <Button asChild variant="outline" className="cursor-pointer">
          <Link href="/marketplace">Back to marketplace</Link>
        </Button>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <Button variant="ghost" size="sm" asChild className="mb-2 -ml-2 cursor-pointer">
            <Link href="/marketplace">{'← Marketplace'}</Link>
          </Button>
          <div className="flex items-center gap-2">
            <Globe className="h-5 w-5 text-emerald-400" />
            <h1 className="text-3xl font-semibold tracking-tight">{bot.name}</h1>
          </div>
          <div className="mt-1 flex flex-wrap items-center gap-2">
            <Badge variant="outline" className="font-mono">
              {bot.symbol}
            </Badge>
            <Badge
              variant="outline"
              className="border-sky-400/50 bg-sky-400/10 text-sky-300"
            >
              {bot.strategy}
            </Badge>
            <Badge
              variant="outline"
              className="border-emerald-400/50 bg-emerald-400/10 text-emerald-300"
            >
              <Globe className="mr-1 h-3 w-3" />
              Public
            </Badge>
          </div>
          {bot.userName ? (
            <p className="mt-2 text-sm text-muted-foreground">By {bot.userName}</p>
          ) : null}
        </div>
        <Button
          className="cursor-pointer"
          onClick={handleClone}
          disabled={cloning}
        >
          {cloning ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : null}
          Clone strategy
        </Button>
      </div>

      {bot.description ? (
        <p className="text-sm text-muted-foreground">{bot.description}</p>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="border-border/70 bg-card/80 backdrop-blur-xl">
          <CardHeader>
            <CardTitle className="text-lg">Strategy parameters</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div>
              <p className="text-xs text-muted-foreground">Strategy type</p>
              <p className="text-sm font-medium">{bot.strategy}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Trading symbol</p>
              <p className="font-mono text-sm">{bot.symbol}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Parameters</p>
              <pre className="mt-1 max-h-60 overflow-auto rounded-md bg-muted p-3 font-mono text-xs">
                {JSON.stringify(bot.params, null, 2)}
              </pre>
            </div>
          </CardContent>
        </Card>

        <Card className="border-border/70 bg-card/80 backdrop-blur-xl">
          <CardHeader>
            <CardTitle className="text-lg">Clone this strategy</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Create a copy of this strategy in your account. You can then customize its parameters and
              start running it.
            </p>
            <div className="space-y-2">
              <label className="text-sm font-medium">Clone name</label>
              <input
                type="text"
                value={cloneName}
                onChange={(e) => setCloneName(e.target.value)}
                className="flex h-10 w-full rounded-md border border-border bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>
            <Button
              className="w-full cursor-pointer"
              onClick={handleClone}
              disabled={cloning}
            >
              {cloning ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : null}
              Clone &amp; open
            </Button>
            {!token && (
              <p className="text-xs text-muted-foreground">
                <Link href="/login" className="underline">
                  Sign in
                </Link>{' '}
                to clone this strategy.
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      {bot.builderConfig ? (
        <Card className="border-border/70 bg-card/80 backdrop-blur-xl">
          <CardHeader>
            <CardTitle className="text-lg">Visual builder config</CardTitle>
          </CardHeader>
          <CardContent>
            <pre className="max-h-80 overflow-auto rounded-md bg-muted p-3 font-mono text-xs">
              {JSON.stringify(bot.builderConfig, null, 2)}
            </pre>
          </CardContent>
        </Card>
      ) : null}
    </div>
  )
}
