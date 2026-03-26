'use client'

import { useEffect, useRef } from 'react'
import { connectWebSocket } from '@/lib/websocket'

type TradingSocketEvent = 'bot-status' | 'new-trade' | 'bot-log' | 'notification'
const DEFAULT_EVENTS: TradingSocketEvent[] = ['bot-status', 'new-trade', 'bot-log', 'notification']

type WsPayload = {
  userId?: string
  botId?: string
  eventId?: string
  level?: string
}

export function useTradingSocket(options: {
  token?: string | null
  userId?: string
  /** When set, only events for this bot trigger refresh (bot detail / logs). */
  botId?: string
  /** Which events should trigger refresh. Defaults to all trading events. */
  events?: TradingSocketEvent[]
  /** Bot log levels that trigger refresh (only applies to `bot-log`). */
  logLevels?: string[]
  /** Minimum time between `onRefresh` calls (ms). */
  minRefreshIntervalMs?: number
  onRefresh: () => void
}) {
  const {
    token,
    userId,
    botId,
    onRefresh,
    events,
    logLevels,
    minRefreshIntervalMs = 1000,
  } = options
  const effectiveEventsKey = (events ?? DEFAULT_EVENTS).join('|')
  const logLevelsKey = logLevels?.join('|') ?? ''
  const refreshRef = useRef(onRefresh)
  refreshRef.current = onRefresh
  const lastRefreshAtRef = useRef<number>(0)
  const refreshTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const seenIdsRef = useRef<Map<string, number>>(new Map())

  const requestRefresh = () => {
    const now = Date.now()
    const last = lastRefreshAtRef.current
    const elapsed = now - last

    if (elapsed >= minRefreshIntervalMs) {
      lastRefreshAtRef.current = now
      refreshRef.current()
      return
    }

    if (refreshTimerRef.current) return
    refreshTimerRef.current = setTimeout(() => {
      refreshTimerRef.current = null
      lastRefreshAtRef.current = Date.now()
      refreshRef.current()
    }, Math.max(25, minRefreshIntervalMs - elapsed))
  }

  const trackEventId = (eventId: string) => {
    const seen = seenIdsRef.current
    if (seen.has(eventId)) return false
    seen.set(eventId, Date.now())
    if (seen.size > 600) {
      const oldest = Array.from(seen.entries()).sort((a, b) => a[1] - b[1]).slice(0, 100)
      for (const [key] of oldest) seen.delete(key)
    }
    return true
  }

  useEffect(() => {
    if (!token || !userId) return

    const socket = connectWebSocket(token)
    const effectiveEvents = effectiveEventsKey
      ? (effectiveEventsKey.split('|') as TradingSocketEvent[])
      : DEFAULT_EVENTS
    const allowedLogLevels = logLevelsKey ? new Set(logLevelsKey.split('|')) : null

    const shouldHandle = (data: WsPayload) => {
      if (data.userId !== userId) return
      if (botId && data.botId !== botId) return
      if (typeof data.eventId === 'string' && !trackEventId(data.eventId)) return
      if (allowedLogLevels && typeof data.level === 'string' && !allowedLogLevels.has(data.level))
        return
      requestRefresh()
    }

    const onConnect = () => requestRefresh()

    socket.on('connect', onConnect)
    for (const eventName of effectiveEvents) {
      socket.on(eventName, shouldHandle)
    }

    return () => {
      socket.off('connect', onConnect)
      for (const eventName of effectiveEvents) {
        socket.off(eventName, shouldHandle)
      }
      if (refreshTimerRef.current) {
        clearTimeout(refreshTimerRef.current)
        refreshTimerRef.current = null
      }
    }
  }, [
    token,
    userId,
    botId,
    effectiveEventsKey,
    logLevelsKey,
    minRefreshIntervalMs,
  ])
}
