'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { Bell, Check, CheckCheck } from 'lucide-react'
import { useAuthStore } from '@/store/auth.store'
import {
  fetchNotifications,
  markAllNotificationsRead,
  markNotificationRead,
} from '@/lib/api-client'
import { type InAppNotification, type InAppNotificationType } from '@/types'
import { useHandleApiError } from '@/hooks/use-handle-api-error'
import { connectWebSocket } from '@/lib/websocket'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'

type NotificationEventPayload = InAppNotification & {
  userId?: string
}

const PAGE_SIZE = 25

const typeLabel: Record<InAppNotificationType, string> = {
  BOT_STARTED: 'Bot started',
  BOT_STOPPED: 'Bot stopped',
  BOT_ERROR: 'Bot error',
  TRADE_OPENED: 'Trade opened',
  TRADE_CLOSED: 'Trade closed',
  STOP_LOSS_HIT: 'Stop loss hit',
  TAKE_PROFIT_HIT: 'Take profit hit',
}

function formatNotificationTime(value: string) {
  return new Date(value).toLocaleString([], {
    month: 'short',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function listMergeById(prev: InAppNotification[], incoming: InAppNotification) {
  const withoutSame = prev.filter((item) => item.id !== incoming.id)
  return [incoming, ...withoutSame]
}

export function NotificationPanel() {
  const token = useAuthStore((s) => s.token)
  const user = useAuthStore((s) => s.user)
  const handleError = useHandleApiError()

  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [markingAll, setMarkingAll] = useState(false)
  const [items, setItems] = useState<InAppNotification[]>([])
  const [total, setTotal] = useState(0)
  const [unreadCount, setUnreadCount] = useState(0)

  const hasMore = items.length < total

  const itemsLengthRef = useRef(0)
  useEffect(() => {
    itemsLengthRef.current = items.length
  }, [items.length])

  const loadNotifications = useCallback(
    async (reset = false) => {
      if (!token) return
      setLoading(true)
      try {
        const skip = reset ? 0 : itemsLengthRef.current
        const res = await fetchNotifications(token, {
          take: PAGE_SIZE,
          skip,
        })
        setItems((prev) => {
          if (reset) return res.items
          const existing = new Set(prev.map((row) => row.id))
          const incoming = res.items.filter((row) => !existing.has(row.id))
          return [...prev, ...incoming]
        })
        setTotal(res.total)
        setUnreadCount(res.unreadCount)
      } catch (e) {
        handleError(e)
      } finally {
        setLoading(false)
      }
    },
    [handleError, token],
  )

  useEffect(() => {
    if (!token) return
    ;(async () => {
      try {
        const res = await fetchNotifications(token, { take: 1, skip: 0 })
        setUnreadCount(res.unreadCount)
        if (open) {
          setItems(res.items)
          setTotal(res.total)
        }
      } catch {
        // ignore badge bootstrap errors; regular panel load handles detail errors
      }
    })()
  }, [token, open])

  useEffect(() => {
    if (!token || !open) return
    void loadNotifications(true)
  }, [token, open, loadNotifications])

  useEffect(() => {
    if (!user?.id) return
    if (!token) return
    const socket = connectWebSocket(token)

    const handleNotification = (payload: NotificationEventPayload) => {
      if (!payload || payload.userId !== user.id) return

      setItems((prev) => {
        const exists = prev.some((item) => item.id === payload.id)
        if (!exists) {
          setTotal((current) => current + 1)
          if (!payload.isRead) {
            setUnreadCount((current) => current + 1)
          }
        }
        return listMergeById(prev, payload)
      })
    }

    socket.on('notification', handleNotification)
    return () => {
      socket.off('notification', handleNotification)
    }
  }, [token, user?.id])

  async function onToggleRead(row: InAppNotification) {
    if (!token) return
    try {
      const updated = await markNotificationRead(token, row.id, { isRead: !row.isRead })
      setItems((prev) => prev.map((item) => (item.id === updated.id ? updated : item)))
      setUnreadCount((prev) => {
        if (row.isRead === updated.isRead) {
          return prev
        }
        return updated.isRead ? Math.max(0, prev - 1) : prev + 1
      })
    } catch (e) {
      handleError(e)
    }
  }

  async function onMarkAllRead() {
    if (!token) return
    setMarkingAll(true)
    try {
      await markAllNotificationsRead(token)
      setItems((prev) => {
        const now = new Date().toISOString()
        return prev.map((row) => ({
          ...row,
          isRead: true,
          readAt: row.readAt ?? now,
        }))
      })
      setUnreadCount(0)
    } catch (e) {
      handleError(e)
    } finally {
      setMarkingAll(false)
    }
  }

  const panelItems = useMemo(() => items, [items])

  return (
    <div className="relative">
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="relative"
        onClick={() => setOpen((prev) => !prev)}
        aria-label="Toggle notifications"
      >
        <Bell className="h-5 w-5" />
        {unreadCount > 0 ? (
          <span className="absolute -right-0.5 -top-0.5 inline-flex min-w-[18px] items-center justify-center rounded-full bg-rose-500 px-1 text-[10px] font-semibold text-white">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        ) : null}
      </Button>

      {open ? (
        <div className="absolute right-0 z-[100] mt-2 w-[380px] max-w-[calc(100vw-2rem)] rounded-lg border border-border/70 bg-card/95 p-3 shadow-2xl backdrop-blur-xl">
          <div className="mb-2 flex items-center justify-between gap-2">
            <div>
              <p className="text-sm font-semibold">Notifications</p>
              <p className="text-xs text-muted-foreground">
                {unreadCount} unread | {total} total
              </p>
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={onMarkAllRead}
              disabled={markingAll || unreadCount === 0}
              className="gap-1"
            >
              <CheckCheck className="h-3.5 w-3.5" />
              Mark all read
            </Button>
          </div>

          <div className="max-h-[420px] space-y-2 overflow-y-auto pr-1">
            {panelItems.length === 0 && !loading ? (
              <div className="rounded-md border border-dashed border-border/70 px-3 py-8 text-center text-sm text-muted-foreground">
                No notifications yet.
              </div>
            ) : (
              panelItems.map((row) => (
                <div
                  key={row.id}
                  className={cn(
                    'rounded-md border px-3 py-2 transition-colors',
                    row.isRead
                      ? 'border-border/70 bg-background/50'
                      : 'border-primary/40 bg-primary/10',
                  )}
                >
                  <div className="flex items-center justify-between gap-2">
                    <Badge variant="outline" className="text-[10px]">
                      {typeLabel[row.type]}
                    </Badge>
                    <span className="whitespace-nowrap font-mono text-[11px] text-muted-foreground">
                      {formatNotificationTime(row.createdAt)}
                    </span>
                  </div>

                  <p className="mt-1 text-sm font-medium">{row.title}</p>
                  <p className="text-xs text-muted-foreground">{row.message}</p>

                  <div className="mt-2 flex items-center justify-between gap-2">
                    <div className="flex gap-2">
                      {row.botId ? (
                        <Link
                          href={`/bots/${row.botId}`}
                          className="text-xs text-primary underline-offset-4 hover:underline"
                          onClick={() => setOpen(false)}
                        >
                          Open bot
                        </Link>
                      ) : null}
                      {row.tradeId ? (
                        <Link
                          href={`/trades/${row.tradeId}`}
                          className="text-xs text-primary underline-offset-4 hover:underline"
                          onClick={() => setOpen(false)}
                        >
                          Open trade
                        </Link>
                      ) : null}
                    </div>

                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      className="h-7 px-2 text-xs"
                      onClick={() => onToggleRead(row)}
                    >
                      <Check className="mr-1 h-3.5 w-3.5" />
                      {row.isRead ? 'Unread' : 'Read'}
                    </Button>
                  </div>
                </div>
              ))
            )}
          </div>

          {hasMore ? (
            <div className="mt-2 border-t border-border/70 pt-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => loadNotifications(false)}
                disabled={loading}
                className="w-full"
              >
                {loading ? 'Loading...' : 'Load more'}
              </Button>
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  )
}
