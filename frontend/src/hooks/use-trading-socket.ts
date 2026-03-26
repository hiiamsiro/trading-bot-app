'use client'

import { useEffect, useRef } from 'react'
import { connectWebSocket } from '@/lib/websocket'

type WsPayload = {
  userId?: string
  botId?: string
}

export function useTradingSocket(options: {
  userId?: string
  /** When set, only events for this bot trigger refresh (bot detail / logs). */
  botId?: string
  onRefresh: () => void
}) {
  const { userId, botId, onRefresh } = options
  const refreshRef = useRef(onRefresh)
  refreshRef.current = onRefresh

  useEffect(() => {
    if (!userId) return

    const socket = connectWebSocket()

    const handle = (data: WsPayload) => {
      if (data.userId !== userId) return
      if (botId && data.botId !== botId) return
      refreshRef.current()
    }

    socket.on('bot-status', handle)
    socket.on('new-trade', handle)
    socket.on('bot-log', handle)
    socket.on('notification', handle)

    return () => {
      socket.off('bot-status', handle)
      socket.off('new-trade', handle)
      socket.off('bot-log', handle)
      socket.off('notification', handle)
    }
  }, [userId, botId])
}
