'use client'

import { useEffect, useRef, useMemo } from 'react'
import {
  ColorType,
  LineStyle,
  createChart,
  type IChartApi,
  type IPriceLine,
  type ISeriesApi,
} from 'lightweight-charts'
import type { MarketKline, Trade } from '@/types'
import { cn } from '@/lib/utils'
import {
  marketKlinesToCandlestickData,
  marketKlinesToVolumeHistogramData,
} from '@/lib/chart/market-klines-to-lightweight'
import {
  computeMaLines,
  computeRsiLine,
  computeTradeMarkers,
  DEFAULT_MA_CONFIGS,
  DEFAULT_RSI_PERIOD,
  type ChartIndicatorConfig,
} from '@/lib/chart/indicators'

type MarketCandlestickChartProps = {
  bars: MarketKline[]
  height: number
  className?: string
  /** Trades to render as entry/exit markers. */
  trades?: Trade[]
  /** Indicator configuration (MA lines, RSI). */
  indicatorConfig?: ChartIndicatorConfig
}

export function MarketCandlestickChart({
  bars,
  height,
  className,
  trades = [],
  indicatorConfig = {},
}: MarketCandlestickChartProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const chartRef = useRef<IChartApi | null>(null)
  const rsiChartRef = useRef<IChartApi | null>(null)
  const candleRef = useRef<ISeriesApi<'Candlestick'> | null>(null)
  const volumeRef = useRef<ISeriesApi<'Histogram'> | null>(null)
  const maSeriesRefs = useRef<ISeriesApi<'Line'>[]>([])
  const rsiSeriesRef = useRef<ISeriesApi<'Line'> | null>(null)
  const priceLineRef = useRef<IPriceLine | null>(null)
  const lastFitCountRef = useRef<number>(0)

  const { mas, showRsi, rsiPeriod } = useMemo(() => {
    const cfg = indicatorConfig
    return {
      mas: cfg.mas ?? DEFAULT_MA_CONFIGS,
      showRsi: cfg.showRsi ?? false,
      rsiPeriod: cfg.rsiPeriod ?? DEFAULT_RSI_PERIOD,
    }
  }, [indicatorConfig])

  const chartHeight = showRsi ? Math.floor(height * 0.72) : height
  const rsiHeight = showRsi ? height - chartHeight - 8 : 0

  // ── Create / destroy main chart ─────────────────────────────────────────────
  useEffect(() => {
    const el = containerRef.current
    if (!el) return

    const chart = createChart(el, {
      width: el.clientWidth,
      height: chartHeight,
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

    // MA line series
    const maSeriesArr: ISeriesApi<'Line'>[] = []
    for (const ma of mas) {
      const s = chart.addLineSeries({
        color: ma.color,
        lineWidth: 1,
        priceLineVisible: false,
        lastValueVisible: false,
        title: ma.label,
      })
      maSeriesArr.push(s)
    }
    maSeriesRefs.current = maSeriesArr

    chartRef.current = chart
    candleRef.current = candleSeries
    volumeRef.current = volumeSeries

    // RSI sub-chart
    if (showRsi) {
      const rsiChartEl = el.querySelector<HTMLDivElement>('[data-rsi-chart]')
      if (rsiChartEl) {
        const rsiChart = createChart(rsiChartEl, {
          width: el.clientWidth,
          height: rsiHeight,
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
          rightPriceScale: {
            borderColor: '#2d3a4d',
            scaleMargins: { top: 0.1, bottom: 0.1 },
          },
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

        // Sync RSI time scale with main chart
        chart.timeScale().subscribeVisibleLogicalRangeChange((range) => {
          if (range) rsiChart.timeScale().setVisibleLogicalRange(range)
        })
        rsiChart.timeScale().subscribeVisibleLogicalRangeChange((range) => {
          if (range) chart.timeScale().setVisibleLogicalRange(range)
        })

        const rsiSeries = rsiChart.addLineSeries({
          color: '#a78bfa',
          lineWidth: 2,
          priceLineVisible: false,
          lastValueVisible: false,
        })
        rsiSeriesRef.current = rsiSeries
        rsiChartRef.current = rsiChart
      }
    }

    const ro = new ResizeObserver(() => {
      const w = el.clientWidth
      if (w > 0) {
        chart.applyOptions({ width: w })
        if (rsiChartRef.current) rsiChartRef.current.applyOptions({ width: w })
      }
    })
    ro.observe(el)

    return () => {
      ro.disconnect()
      priceLineRef.current = null
      chart.remove()
      if (rsiChartRef.current) {
        rsiChartRef.current.remove()
        rsiChartRef.current = null
      }
      chartRef.current = null
      candleRef.current = null
      volumeRef.current = null
      maSeriesRefs.current = []
      rsiSeriesRef.current = null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [height, showRsi, rsiPeriod, JSON.stringify(mas)])

  // ── Update candle + volume data ──────────────────────────────────────────────
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
      if (lastFitCountRef.current !== rows.length) {
        chart.timeScale().fitContent()
        lastFitCountRef.current = rows.length
      }
    }
  }, [bars])

  // ── Update MA lines ──────────────────────────────────────────────────────────
  useEffect(() => {
    const chart = chartRef.current
    if (!chart) return

    const maSeriesArr = maSeriesRefs.current
    if (maSeriesArr.length !== mas.length) {
      // Recreate MA series if config changed
      for (const s of maSeriesArr) {
        chart.removeSeries(s)
      }
      const newSeries: ISeriesApi<'Line'>[] = []
      for (const ma of mas) {
        const s = chart.addLineSeries({
          color: ma.color,
          lineWidth: 1,
          priceLineVisible: false,
          lastValueVisible: false,
          title: ma.label,
        })
        newSeries.push(s)
      }
      maSeriesRefs.current = newSeries
    }

    const maLines = computeMaLines(bars, mas)
    for (let i = 0; i < maLines.length; i++) {
      maSeriesRefs.current[i]?.setData(maLines[i].data)
    }
  }, [bars, JSON.stringify(mas)])

  // ── Update RSI ───────────────────────────────────────────────────────────────
  useEffect(() => {
    const rsiSeries = rsiSeriesRef.current
    if (!rsiSeries) return

    const rsiData = computeRsiLine(bars, rsiPeriod)
    rsiSeries.setData(rsiData)
  }, [bars, rsiPeriod])

  // ── Update trade markers ──────────────────────────────────────────────────────
  useEffect(() => {
    const candleSeries = candleRef.current
    if (!candleSeries) return

    candleSeries.setMarkers([])
    const markers = computeTradeMarkers(trades)
    const chartMarkers = markers.map((m) => ({
      time: m.time,
      position: m.position,
      color: m.color,
      shape: m.shape,
      text: m.text,
    }))

    if (chartMarkers.length > 0) {
      candleSeries.setMarkers(chartMarkers)
    }
  }, [trades])

  return (
    <div
      ref={containerRef}
      className={cn('w-full min-h-[200px] overflow-hidden rounded-md border border-border/60', className)}
      style={{ height }}
      role="img"
      aria-label="Candlestick price chart with indicators"
    >
      {showRsi && (
        <div
          data-rsi-chart
          style={{ height: rsiHeight, marginTop: 8 }}
        />
      )}
    </div>
  )
}
