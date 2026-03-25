'use client'

import { useEffect, useRef } from 'react'
import {
  ColorType,
  createChart,
  type IChartApi,
  type ISeriesApi,
  type UTCTimestamp,
} from 'lightweight-charts'
import type { DashboardEquityPoint } from '@/types'
import { cn } from '@/lib/utils'

type EquityCurveChartProps = {
  points: DashboardEquityPoint[]
  height: number
  className?: string
}

function toSeriesData(points: DashboardEquityPoint[]) {
  const bySecond = new Map<number, number>()
  for (const p of points) {
    const t = Math.floor(new Date(p.at).getTime() / 1000)
    bySecond.set(t, p.cumulativePnl)
  }
  return [...bySecond.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([time, value]) => ({
      time: time as UTCTimestamp,
      value,
    }))
}

export function EquityCurveChart({ points, height, className }: EquityCurveChartProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const chartRef = useRef<IChartApi | null>(null)
  const seriesRef = useRef<ISeriesApi<'Area'> | null>(null)

  useEffect(() => {
    const el = containerRef.current
    if (!el) return

    const chart = createChart(el, {
      width: el.clientWidth,
      height,
      layout: {
        background: { type: ColorType.Solid, color: '#0c1219' },
        textColor: '#9caab8',
        fontFamily:
          'ui-sans-serif, system-ui, sans-serif, "Apple Color Emoji", "Segoe UI Emoji"',
      },
      grid: {
        vertLines: { color: '#252f3f' },
        horzLines: { color: '#252f3f' },
      },
      rightPriceScale: { borderColor: '#2d3a4d' },
      timeScale: {
        borderColor: '#2d3a4d',
        timeVisible: true,
        secondsVisible: false,
      },
      crosshair: {
        vertLine: { color: 'rgba(34, 197, 94, 0.35)' },
        horzLine: { color: 'rgba(34, 197, 94, 0.35)' },
      },
    })

    const series = chart.addAreaSeries({
      lineColor: '#22c55e',
      topColor: 'rgba(34, 197, 94, 0.4)',
      bottomColor: 'rgba(34, 197, 94, 0.04)',
      lineWidth: 2,
    })

    chartRef.current = chart
    seriesRef.current = series

    const ro = new ResizeObserver(() => {
      const w = el.clientWidth
      if (w > 0) {
        chart.applyOptions({ width: w })
      }
    })
    ro.observe(el)

    return () => {
      ro.disconnect()
      chart.remove()
      chartRef.current = null
      seriesRef.current = null
    }
  }, [height])

  useEffect(() => {
    const chart = chartRef.current
    const series = seriesRef.current
    if (!chart || !series) return

    const data = toSeriesData(points)
    series.setData(data)
    if (data.length > 0) {
      chart.timeScale().fitContent()
    }
  }, [points])

  return (
    <div
      ref={containerRef}
      className={cn(
        'w-full min-h-[160px] overflow-hidden rounded-md border border-border/60',
        className,
      )}
      style={{ height }}
      role="img"
      aria-label="Cumulative realized PnL over closed trades"
    />
  )
}
