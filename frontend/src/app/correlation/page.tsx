'use client'

import { useState, useEffect, useCallback } from 'react'
import { useAuthStore } from '@/store/auth.store'
import { api } from '@/lib/api'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { Badge } from '@/components/ui/badge'

interface BotInfo {
  id: string
  name: string
  symbol: string
}

interface CorrelationEntry {
  botId: string
  otherBotId: string
  correlation: number
}

interface SymbolEntry {
  symbol1: string
  symbol2: string
  correlation: number
}

interface CorrelationData {
  bots: BotInfo[]
  matrix: CorrelationEntry[]
  symbolCorrelations: SymbolEntry[]
}

function correlationColor(r: number): string {
  // Green for positive, red for negative, gray for neutral
  if (r >= 0.7) return 'bg-emerald-600'
  if (r >= 0.3) return 'bg-emerald-400'
  if (r >= 0) return 'bg-emerald-200'
  if (r >= -0.3) return 'bg-red-100'
  if (r >= -0.7) return 'bg-red-300'
  return 'bg-red-600'
}

function correlationTextColor(r: number): string {
  if (Math.abs(r) >= 0.5) return 'text-white'
  if (Math.abs(r) >= 0.3) return 'text-black'
  return 'text-muted-foreground'
}

export default function CorrelationPage() {
  const token = useAuthStore((s) => s.token)
  const [data, setData] = useState<CorrelationData | null>(null)
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState<'bot' | 'symbol'>('bot')

  const load = useCallback(async () => {
    if (!token) return
    setLoading(true)
    try {
      const res = await api.get<CorrelationData>('/correlation/matrix', token)
      setData(res)
    } catch {
      setData(null)
    } finally {
      setLoading(false)
    }
  }, [token])

  useEffect(() => { void load() }, [load])

  if (loading) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold tracking-tight">Correlation Matrix</h1>
        <Skeleton className="h-96 w-full max-w-2xl rounded-lg" />
      </div>
    )
  }

  if (!data) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold tracking-tight">Correlation Matrix</h1>
        <p className="text-sm text-muted-foreground">
          Could not load correlation data. Make sure you have at least 2 bots with closed trades.
        </p>
      </div>
    )
  }

  const { bots, matrix, symbolCorrelations } = data

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Correlation Matrix</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Pearson correlation between bots and symbols based on daily equity returns.
        </p>
      </div>

      {/* Tab switcher */}
      <div className="flex gap-2">
        <button
          onClick={() => setTab('bot')}
          className={`rounded-md border px-3 py-1.5 text-sm transition-colors ${tab === 'bot' ? 'border-emerald-500 bg-emerald-500/20 text-emerald-300' : 'border-border text-muted-foreground hover:text-foreground'}`}
        >
          Bot vs Bot
        </button>
        <button
          onClick={() => setTab('symbol')}
          className={`rounded-md border px-3 py-1.5 text-sm transition-colors ${tab === 'symbol' ? 'border-emerald-500 bg-emerald-500/20 text-emerald-300' : 'border-border text-muted-foreground hover:text-foreground'}`}
        >
          Symbol vs Symbol
        </button>
      </div>

      {/* ── Bot correlation matrix ───────────────────── */}
      {tab === 'bot' && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Bot Correlations</CardTitle>
          </CardHeader>
          <CardContent>
            {bots.length < 2 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">
                Need at least 2 bots with closed trades to compute correlations.
              </p>
            ) : (
              <div className="overflow-x-auto">
                <div
                  style={{ display: 'grid', gridTemplateColumns: `120px repeat(${bots.length}, 80px)` }}
                  className="gap-px"
                >
                  {/* Header row */}
                  <div /> {/* top-left empty */}
                  {bots.map((b) => (
                    <div
                      key={b.id}
                      className="flex items-center justify-center px-1 py-1 text-center text-xs font-medium text-muted-foreground"
                      title={b.name}
                    >
                      <span className="truncate">{b.name}</span>
                    </div>
                  ))}

                  {/* Data rows */}
                  {bots.map((rowBot) => (
                    <>
                      <div
                        key={`label-${rowBot.id}`}
                        className="flex items-center px-2 py-1 text-xs font-medium text-muted-foreground"
                        title={rowBot.name}
                      >
                        <span className="truncate">{rowBot.name}</span>
                      </div>
                      {bots.map((colBot) => {
                        if (rowBot.id === colBot.id) {
                          return (
                            <div
                              key={`diag-${colBot.id}`}
                              className="flex items-center justify-center bg-muted/50 text-xs text-muted-foreground"
                            >
                              1.0
                            </div>
                          )
                        }
                        const entry = matrix.find(
                          (e) =>
                            (e.botId === rowBot.id && e.otherBotId === colBot.id) ||
                            (e.botId === colBot.id && e.otherBotId === rowBot.id),
                        )
                        const r = entry?.correlation ?? 0
                        return (
                          <div
                            key={`${rowBot.id}-${colBot.id}`}
                            className={`flex items-center justify-center text-xs font-medium ${correlationColor(r)} ${correlationTextColor(r)}`}
                            title={`${rowBot.name} ↔ ${colBot.name}: ${r.toFixed(3)}`}
                          >
                            {r.toFixed(2)}
                          </div>
                        )
                      })}
                    </>
                  ))}
                </div>

                {/* Legend */}
                <div className="mt-4 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                  <span>Correlation:</span>
                  <div className="flex items-center gap-1">
                    <div className="h-3 w-3 rounded-sm bg-red-600" />
                    <span>Strong neg (&lt;−0.7)</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <div className="h-3 w-3 rounded-sm bg-red-300" />
                    <span>Weak neg (−0.3 to −0.7)</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <div className="h-3 w-3 rounded-sm bg-red-100" />
                    <span>Near zero</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <div className="h-3 w-3 rounded-sm bg-emerald-200" />
                    <span>Weak pos (0 to 0.3)</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <div className="h-3 w-3 rounded-sm bg-emerald-600" />
                    <span>Strong pos (&gt;0.7)</span>
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* ── Symbol correlation list ─────────────────── */}
      {tab === 'symbol' && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Symbol Correlations</CardTitle>
          </CardHeader>
          <CardContent>
            {symbolCorrelations.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">
                Need at least 2 symbols to compute correlations.
              </p>
            ) : (
              <div className="space-y-2">
                {symbolCorrelations.map((entry) => {
                  const r = entry.correlation
                  return (
                    <div key={`${entry.symbol1}-${entry.symbol2}`} className="flex items-center justify-between rounded-md border border-border/40 bg-muted/20 px-3 py-2">
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="font-mono text-xs">
                          {entry.symbol1}
                        </Badge>
                        <span className="text-xs text-muted-foreground">vs</span>
                        <Badge variant="outline" className="font-mono text-xs">
                          {entry.symbol2}
                        </Badge>
                      </div>
                      <div className="flex items-center gap-3">
                        <div
                          className={`h-4 w-24 rounded-sm ${correlationColor(r)}`}
                          title={`${r.toFixed(3)}`}
                        />
                        <span className={`w-14 text-right text-xs font-medium ${correlationTextColor(Math.abs(r) >= 0.3 ? r : 0)}`}>
                          {r >= 0 ? '+' : ''}{r.toFixed(3)}
                        </span>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  )
}
