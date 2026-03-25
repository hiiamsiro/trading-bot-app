'use client'

import { useEffect, useRef } from 'react'
import {
  ColorType,
  LineStyle,
  createChart,
  type IChartApi,
  type IPriceLine,
  type ISeriesApi,
} from 'lightweight-charts'
import type { MarketKline } from '@/types'
import { cn } from '@/lib/utils'
import {
  marketKlinesToCandlestickData,
  marketKlinesToVolumeHistogramData,
} from '@/lib/chart/market-klines-to-lightweight'

type MarketCandlestickChartProps = {
  bars: MarketKline[]
  height: number
  className?: string
}

export function MarketCandlestickChart({
  bars,
  height,
  className,
}: MarketCandlestickChartProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const chartRef = useRef<IChartApi | null>(null)
  const candleRef = useRef<ISeriesApi<'Candlestick'> | null>(null)
  const volumeRef = useRef<ISeriesApi<'Histogram'> | null>(null)
  const priceLineRef = useRef<IPriceLine | null>(null)

  useEffect(() => {
    const el = containerRef.current
    if (!el) return

    const chart = createChart(el, {
      width: el.clientWidth,
      height,
      layout: {
        // Hex/rgba only — lightweight-charts cannot parse modern hsl() syntax.
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
      timeScale: { borderColor: '#2d3a4d', timeVisible: true, secondsVisible: false },
      crosshair: {
        vertLine: { color: 'rgba(34, 197, 94, 0.35)' },
        horzLine: { color: 'rgba(34, 197, 94, 0.35)' },
      },
    })

    const candleSeries = chart.addCandlestickSeries({
      upColor: '#22c55e',
      downColor: '#ef4444',
      borderUpColor: '#22c55e',
      borderDownColor: '#ef4444',
      wickUpColor: '#22c55e',
      wickDownColor: '#ef4444',
    })

    const volumeSeries = chart.addHistogramSeries({
      priceFormat: { type: 'volume' },
      priceScaleId: '',
    })
    volumeSeries.priceScale().applyOptions({
      scaleMargins: { top: 0.85, bottom: 0 },
    })

    chartRef.current = chart
    candleRef.current = candleSeries
    volumeRef.current = volumeSeries

    const ro = new ResizeObserver(() => {
      const w = el.clientWidth
      if (w > 0) {
        chart.applyOptions({ width: w })
      }
    })
    ro.observe(el)

    return () => {
      ro.disconnect()
      priceLineRef.current = null
      chart.remove()
      chartRef.current = null
      candleRef.current = null
      volumeRef.current = null
    }
  }, [height])

  useEffect(() => {
    const chart = chartRef.current
    const candleSeries = candleRef.current
    const volumeSeries = volumeRef.current
    if (!chart || !candleSeries || !volumeSeries) return

    const rows = marketKlinesToCandlestickData(bars)
    const hasVolume = bars.some((b) => b.volume > 0)

    candleSeries.setData(rows)

    if (priceLineRef.current) {
      candleSeries.removePriceLine(priceLineRef.current)
      priceLineRef.current = null
    }

    const last = rows[rows.length - 1]
    if (last) {
      priceLineRef.current = candleSeries.createPriceLine({
        price: last.close,
        color: 'rgba(34, 197, 94, 0.9)',
        lineWidth: 1,
        lineStyle: LineStyle.Dotted,
        axisLabelVisible: true,
        title: 'Last',
      })
    }

    candleSeries.priceScale().applyOptions({
      scaleMargins: { top: 0.05, bottom: hasVolume ? 0.22 : 0.05 },
    })

    volumeSeries.applyOptions({ visible: hasVolume })
    volumeSeries.setData(hasVolume ? marketKlinesToVolumeHistogramData(bars) : [])

    if (rows.length > 0) {
      chart.timeScale().fitContent()
    }
  }, [bars])

  return (
    <div
      ref={containerRef}
      className={cn('w-full min-h-[200px] overflow-hidden rounded-md border border-border/60', className)}
      style={{ height }}
      role="img"
      aria-label="Candlestick price chart"
    />
  )
}
