'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { fetchMarketKlines } from '@/lib/api-client'
import { connectWebSocket } from '@/lib/websocket'
import type { MarketKline, MarketKlineInterval } from '@/types'

const REFETCH_DEBOUNCE_MS = 450
const MAX_EVENT_IDS = 500
const MAX_BARS = 400

type MarketDataSocketPayload = {
  symbol?: string
  interval?: MarketKlineInterval | string
  price?: unknown
  timestamp?: unknown
  kline?: Partial<MarketKline> | undefined
  isFinal?: unknown
  eventId?: unknown
}

function normalizeSymbol(value: string) {
  return value.trim().toUpperCase()
}

function isMarketKline(value: unknown): value is MarketKline {
  if (!value || typeof value !== 'object') return false
  const row = value as Record<string, unknown>
  return (
    typeof row.openTime === 'number' &&
    typeof row.open === 'number' &&
    typeof row.high === 'number' &&
    typeof row.low === 'number' &&
    typeof row.close === 'number' &&
    typeof row.volume === 'number' &&
    typeof row.closeTime === 'number'
  )
}

function upsertKline(prev: MarketKline[], incoming: MarketKline): MarketKline[] {
  if (prev.length === 0) return [incoming]

  const last = prev[prev.length - 1]
  if (last && incoming.openTime > last.openTime) {
    const next = [...prev, incoming]
    return next.length > MAX_BARS ? next.slice(-MAX_BARS) : next
  }

  const idx = prev.findIndex((row) => row.openTime === incoming.openTime)
  if (idx === -1) {
    const insertAt = prev.findIndex((row) => row.openTime > incoming.openTime)
    const next =
      insertAt === -1
        ? [...prev, incoming]
        : [...prev.slice(0, insertAt), incoming, ...prev.slice(insertAt)]
    return next.length > MAX_BARS ? next.slice(-MAX_BARS) : next
  }

  const next = [...prev]
  next[idx] = incoming
  return next
}

export function useMarketKlines(
  token: string | undefined,
  symbol: string,
  interval: MarketKlineInterval,
) {
  const [bars, setBars] = useState<MarketKline[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const fetchIdRef = useRef(0)
  const seenEventIdsRef = useRef<Map<string, number>>(new Map())

  const normalizedSymbol = useMemo(() => normalizeSymbol(symbol), [symbol])

  const trackEventId = useCallback((eventId: string) => {
    const seen = seenEventIdsRef.current
    if (seen.has(eventId)) return false
    seen.set(eventId, Date.now())
    if (seen.size > MAX_EVENT_IDS) {
      const oldest = Array.from(seen.entries()).sort((a, b) => a[1] - b[1]).slice(0, 50)
      for (const [key] of oldest) seen.delete(key)
    }
    return true
  }, [])

  const load = useCallback(async () => {
    if (!token || !normalizedSymbol) {
      setBars([])
      setLoading(false)
      return
    }
    const fetchId = ++fetchIdRef.current
    setLoading(true)
    setError(null)
    try {
      const data = await fetchMarketKlines(token, symbol, interval)
      if (fetchId !== fetchIdRef.current) return
      setBars(data)
    } catch (e) {
      if (fetchId !== fetchIdRef.current) return
      const message = e instanceof Error ? e.message : 'Could not load candles'
      setError(message)
      setBars([])
    } finally {
      if (fetchId === fetchIdRef.current) {
        setLoading(false)
      }
    }
  }, [token, symbol, interval, normalizedSymbol])

  useEffect(() => {
    setBars([])
    void load()
  }, [load])

  const scheduleRefetch = useCallback(() => {
    if (debounceRef.current) {
      clearTimeout(debounceRef.current)
    }
    debounceRef.current = setTimeout(() => {
      debounceRef.current = null
      void load()
    }, REFETCH_DEBOUNCE_MS)
  }, [load])

  useEffect(() => {
    if (!token || !normalizedSymbol) return

    const socket = connectWebSocket(token)
    const subscription = { symbol: normalizedSymbol, interval }

    const subscribe = () => socket.emit('subscribe-market', subscription)
    const onConnect = () => {
      subscribe()
      scheduleRefetch()
    }

    const unsubscribe = () => {
      socket.emit('unsubscribe-market', subscription)
    }

    const onMarketData = (data: MarketDataSocketPayload) => {
      const incoming = data.symbol ? normalizeSymbol(String(data.symbol)) : null
      if (!incoming || incoming !== normalizedSymbol) return

      const incomingInterval = typeof data.interval === 'string' ? data.interval : interval
      if (incomingInterval !== interval) return

      const eventId = typeof data.eventId === 'string' ? data.eventId : null
      if (eventId && !trackEventId(eventId)) return

      if (isMarketKline(data.kline)) {
        setBars((prev) => upsertKline(prev, data.kline as MarketKline))
        return
      }

      scheduleRefetch()
    }

    subscribe()
    if (socket.connected) {
      scheduleRefetch()
    }
    socket.on('connect', onConnect)
    socket.on('market-data', onMarketData)
    return () => {
      socket.off('market-data', onMarketData)
      socket.off('connect', onConnect)
      unsubscribe()
      if (debounceRef.current) {
        clearTimeout(debounceRef.current)
        debounceRef.current = null
      }
    }
  }, [token, normalizedSymbol, interval, scheduleRefetch, trackEventId])

  return { bars, loading, error, reload: load }
}
