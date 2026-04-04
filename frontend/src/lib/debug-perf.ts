type PerfStat = {
  count: number
  totalMs: number
  minMs: number
  maxMs: number
  lastMeta?: Record<string, unknown>
}

const LOG_INTERVAL_MS = 5000

function nowMs() {
  if (typeof performance !== 'undefined' && typeof performance.now === 'function') {
    return performance.now()
  }
  return Date.now()
}

function isEnabled() {
  if (typeof window === 'undefined') return false
  try {
    const ls = window.localStorage
    return (
      (ls && ls.getItem('debugPerf') === '1') ||
      new URLSearchParams(window.location.search).get('perf') === '1' ||
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (window as any).__DEBUG_PERF__ === true
    )
  } catch {
    return false
  }
}

function getStore() {
  // keep stats stable across HMR
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const w = typeof window !== 'undefined' ? (window as any) : null
  if (!w) return { stats: new Map<string, PerfStat>(), lastLogAt: 0 }
  if (!w.__perfStore) w.__perfStore = { stats: new Map<string, PerfStat>(), lastLogAt: 0 }
  return w.__perfStore as { stats: Map<string, PerfStat>; lastLogAt: number }
}

function maybeLog() {
  if (!isEnabled()) return
  const store = getStore()
  const t = nowMs()
  if (t - store.lastLogAt < LOG_INTERVAL_MS) return
  store.lastLogAt = t

  const rows = [...store.stats.entries()].map(([name, s]) => ({
    name,
    count: s.count,
    avgMs: s.count > 0 ? +(s.totalMs / s.count).toFixed(2) : 0,
    minMs: s.minMs === Number.POSITIVE_INFINITY ? 0 : +s.minMs.toFixed(2),
    maxMs: +s.maxMs.toFixed(2),
    lastMeta: s.lastMeta,
  }))
  rows.sort((a, b) => b.avgMs - a.avgMs)

  // eslint-disable-next-line no-console
  console.groupCollapsed(`[perf] ${new Date().toLocaleTimeString()} (${rows.length} metrics)`)
  // eslint-disable-next-line no-console
  console.table(rows)
  // eslint-disable-next-line no-console
  console.groupEnd()
}

export function perfNow() {
  return nowMs()
}

export function perfCount(name: string, delta = 1, meta?: Record<string, unknown>) {
  if (!isEnabled()) return
  const store = getStore()
  const s = store.stats.get(name) ?? { count: 0, totalMs: 0, minMs: Number.POSITIVE_INFINITY, maxMs: 0 }
  s.count += delta
  if (meta) s.lastMeta = meta
  store.stats.set(name, s)
  maybeLog()
}

export function perfAdd(name: string, ms: number, meta?: Record<string, unknown>) {
  if (!isEnabled()) return
  const store = getStore()
  const s = store.stats.get(name) ?? { count: 0, totalMs: 0, minMs: Number.POSITIVE_INFINITY, maxMs: 0 }
  s.count += 1
  s.totalMs += ms
  if (ms < s.minMs) s.minMs = ms
  if (ms > s.maxMs) s.maxMs = ms
  if (meta) s.lastMeta = meta
  store.stats.set(name, s)
  maybeLog()
}

