'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { fetchMarketKlines } from '@/lib/api-client'
import { connectWebSocket } from '@/lib/websocket'
import type { MarketKline, MarketKlineInterval } from '@/types'

const REFETCH_DEBOUNCE_MS = 450

type MarketDataSocketPayload = {
  symbol?: string
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

  const normalizedSymbol = symbol.trim().toUpperCase()

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

    const onMarketData = (data: MarketDataSocketPayload) => {
      const incoming = data.symbol?.trim().toUpperCase()
      if (incoming && incoming === normalizedSymbol) {
        scheduleRefetch()
      }
    }

    socket.on('market-data', onMarketData)
    return () => {
      socket.off('market-data', onMarketData)
      if (debounceRef.current) {
        clearTimeout(debounceRef.current)
        debounceRef.current = null
      }
    }
  }, [token, normalizedSymbol, scheduleRefetch])

  return { bars, loading, error, reload: load }
}
