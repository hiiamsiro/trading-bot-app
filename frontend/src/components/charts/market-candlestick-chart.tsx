'use client'

import {
  useEffect,
  useLayoutEffect,
  useRef,
  useMemo,
  useState,
  useCallback,
} from 'react'
import {
  ColorType,
  LineStyle,
  createChart,
  CrosshairMode,
  type IChartApi,
  type IPriceLine,
  type ISeriesApi,
  type UTCTimestamp,
} from 'lightweight-charts'
import {
  Maximize2,
  Minimize2,
  ZoomIn,
  ZoomOut,
  TrendingUp,
  Baseline,
  BarChart2,
  LineChart,
} from 'lucide-react'
import type { MarketKline, Trade } from '@/types'
import { cn } from '@/lib/utils'
import { perfAdd, perfNow } from '@/lib/debug-perf'
import {
  marketKlinesToCandlestickData,
  marketKlinesToVolumeHistogramData,
} from '@/lib/chart/market-klines-to-lightweight'
import {
  computeMaLines,
  computeRsiLine,
  computeBollingerBands,
  computeMacd,
  computeAtrLine,
  computeVwapLine,
  computeTradeMarkers,
  DEFAULT_MA_CONFIGS,
  DEFAULT_RSI_PERIOD,
  DEFAULT_MACD_FAST,
  DEFAULT_MACD_SLOW,
  DEFAULT_MACD_SIGNAL,
  type ChartIndicatorConfig,
  type OhlcvPoint,
} from '@/lib/chart/indicators'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import { Badge } from '@/components/ui/badge'
import { SimpleTooltip } from '@/components/ui/simple-tooltip'
import { 
  Dialog, 
  DialogContent, 
  DialogOverlay, 
  DialogTitle, 
} from '@/components/ui/dialog' 

const INDICATOR_THROTTLE_MS = 250
const HOVER_THROTTLE_MS = 90

function useThrottledLatest<T>(value: T, delayMs: number, enabled: boolean): T {
  const [throttled, setThrottled] = useState(value)
  const latestRef = useRef(value)
  const lastSetRef = useRef(0)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    latestRef.current = value
  }, [value])

  useEffect(() => {
    if (!enabled) {
      if (timerRef.current) {
        clearTimeout(timerRef.current)
        timerRef.current = null
      }
      lastSetRef.current = Date.now()
      setThrottled(value)
      return
    }

    const now = Date.now()
    const elapsed = now - lastSetRef.current
    const remaining = delayMs - elapsed

    if (remaining <= 0) {
      lastSetRef.current = now
      setThrottled(value)
      return
    }

    if (timerRef.current) clearTimeout(timerRef.current)
    timerRef.current = setTimeout(() => {
      timerRef.current = null
      lastSetRef.current = Date.now()
      setThrottled(latestRef.current)
    }, remaining)

    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current)
        timerRef.current = null
      }
    }
  }, [value, delayMs, enabled])

  return throttled
}

// ─── Chart type ───────────────────────────────────────────────────────────────

export type ChartType = 'candlestick' | 'line' | 'area' | 'baseline'

// ─── Props ────────────────────────────────────────────────────────────────────

type MarketCandlestickChartProps = {
  bars: MarketKline[]
  height: number
  className?: string
  trades?: Trade[]
  indicatorConfig?: ChartIndicatorConfig
  /** Show the top toolbar with chart type, zoom, indicators, fullscreen */
  showToolbar?: boolean
  /** Default chart type */
  defaultChartType?: ChartType
  /** Show OHLCV legend bar below the toolbar */
  showOhlcvLegend?: boolean
  /** Symbol to display in the toolbar badge */
  symbol?: string
}

const DEFAULT_BOLLINGER_PERIOD = 20
const DEFAULT_BOLLINGER_STDDEV = 2
const DEFAULT_ATR_PERIOD = 14

// ─── OHLCV Legend ────────────────────────────────────────────────────────────

interface OhlcvLegendProps {
  bar: OhlcvPoint | null
  pricePrecision?: number
  volumeDecimals?: number
}

function OhlcvLegend({ bar, pricePrecision = 2, volumeDecimals = 0 }: OhlcvLegendProps) {
  if (!bar) {
    return (
      <div className="flex h-8 items-center gap-3 border-b border-border/40 px-3 text-xs font-mono">
        <span className="text-muted-foreground">Hover chart for details</span>
      </div>
    )
  }
  const diff = bar.close - bar.open
  const diffPct = bar.open !== 0 ? (diff / bar.open) * 100 : 0
  const bullish = diff >= 0
  const colorClass = bullish ? 'text-emerald-400' : 'text-red-400'
  const sign = bullish ? '+' : ''

  const fmt = (n: number) => n.toFixed(pricePrecision)
  const fmtVol = (n: number) =>
    n >= 1_000_000
      ? `${(n / 1_000_000).toFixed(1)}M`
      : n >= 1_000
        ? `${(n / 1_000).toFixed(1)}K`
        : n.toFixed(volumeDecimals)

  const fmtTime = (ts: number) => {
    const d = new Date(ts * 1000)
    return d.toLocaleString(undefined, {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  return (
    <div className="flex h-8 items-center gap-3 border-b border-border/40 px-3 text-xs font-mono">
      <span className="text-muted-foreground">{fmtTime(bar.time as number)}</span>
      <span className="text-muted-foreground">O</span>
      <span className="text-foreground">{fmt(bar.open)}</span>
      <span className="text-muted-foreground">H</span>
      <span className="text-foreground">{fmt(bar.high)}</span>
      <span className="text-muted-foreground">L</span>
      <span className="text-foreground">{fmt(bar.low)}</span>
      <span className="text-muted-foreground">C</span>
      <span className={colorClass}>{fmt(bar.close)}</span>
      <span className={colorClass}>
        {sign}
        {diffPct.toFixed(2)}%
      </span>
      <span className="ml-auto text-muted-foreground">Vol {fmtVol(bar.volume)}</span>
    </div>
  )
}

// ─── Toolbar ──────────────────────────────────────────────────────────────────

interface IndicatorState {
  showMa: boolean
  showRsi: boolean
  showMacd: boolean
  showAtr: boolean
  showBollingerBands: boolean
  showVwap: boolean
  showVolume: boolean
}

interface ChartToolbarProps {
  chartType: ChartType
  onChartTypeChange: (t: ChartType) => void
  isFullscreen?: boolean
  onToggleFullscreen: () => void
  onZoomIn: () => void
  onZoomOut: () => void
  indicators: IndicatorState
  onToggleIndicator: (key: keyof IndicatorState) => void
  pricePrecision?: number
  symbol?: string
}

const CHART_TYPE_OPTIONS: { value: ChartType; label: string; icon: React.ReactNode }[] = [
  { value: 'candlestick', label: 'Candle', icon: <BarChart2 className="h-3.5 w-3.5" /> },
  { value: 'line', label: 'Line', icon: <TrendingUp className="h-3.5 w-3.5" /> },
  { value: 'area', label: 'Area', icon: <LineChart className="h-3.5 w-3.5" /> },
  { value: 'baseline', label: 'Baseline', icon: <Baseline className="h-3.5 w-3.5" /> },
]

function ChartToolbar({
  chartType,
  onChartTypeChange,
  onToggleFullscreen,
  onZoomIn,
  onZoomOut,
  indicators,
  onToggleIndicator,
  symbol,
  isFullscreen,
}: ChartToolbarProps) {
  return (
    <div className="flex flex-wrap items-center gap-2 border-b border-border/40 px-3 py-2">
      {symbol && (
        <Badge variant="outline" className="font-mono text-xs">
          {symbol}
        </Badge>
      )}

      <div className="flex items-center gap-1 rounded-md border border-border/60 bg-muted/30 p-0.5">
        {CHART_TYPE_OPTIONS.map((opt) => (
          <Button
            key={opt.value}
            variant="ghost"
            size="sm"
            className={cn(
              'h-7 gap-1 px-2 py-1 text-xs',
              chartType === opt.value
                ? 'bg-background text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground',
            )}
            onClick={() => onChartTypeChange(opt.value)}
            title={opt.label}
          >
            {opt.icon}
            <span className="hidden sm:inline">{opt.label}</span>
          </Button>
        ))}
      </div>

      {isFullscreen && (
        <div className="flex flex-wrap items-center gap-2">
          <ToggleIndicator
            label="Vol"
            checked={indicators.showVolume}
            onChange={() => onToggleIndicator('showVolume')}
          />
          <ToggleIndicator
            label="MA"
            checked={indicators.showMa}
            onChange={() => onToggleIndicator('showMa')}
          />
          <ToggleIndicator
            label="RSI"
            checked={indicators.showRsi}
            onChange={() => onToggleIndicator('showRsi')}
          />
          <ToggleIndicator
            label="MACD"
            checked={indicators.showMacd}
            onChange={() => onToggleIndicator('showMacd')}
          />
          <ToggleIndicator
            label="BB"
            checked={indicators.showBollingerBands}
            onChange={() => onToggleIndicator('showBollingerBands')}
          />
          <ToggleIndicator
            label="ATR"
            checked={indicators.showAtr}
            onChange={() => onToggleIndicator('showAtr')}
          />
          <ToggleIndicator
            label="VWAP"
            checked={indicators.showVwap}
            onChange={() => onToggleIndicator('showVwap')}
          />
        </div>
      )}

      <div className="ml-auto flex items-center gap-1">
        <SimpleTooltip content="Zoom in">
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onZoomIn}>
            <ZoomIn className="h-3.5 w-3.5" />
          </Button>
        </SimpleTooltip>
        <SimpleTooltip content="Zoom out">
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onZoomOut}>
            <ZoomOut className="h-3.5 w-3.5" />
          </Button>
        </SimpleTooltip>
        <SimpleTooltip content="Fullscreen">
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onToggleFullscreen}>
            <Maximize2 className="h-3.5 w-3.5" />
          </Button>
        </SimpleTooltip>
      </div>
    </div>
  )
}

interface ToggleIndicatorProps {
  label: string
  checked: boolean
  onChange: () => void
  disabled?: boolean
  className?: string
}

function ToggleIndicator({ label, checked, onChange, disabled, className }: ToggleIndicatorProps) {
  return (
    <label
      className={cn(
        'flex cursor-pointer items-center gap-1.5 rounded border border-border/60 bg-muted/30 px-2 py-1 text-xs font-medium transition-colors',
        checked ? 'border-emerald-500/50 bg-emerald-500/10 text-emerald-400' : 'text-muted-foreground',
        disabled && 'cursor-not-allowed opacity-60',
        className,
      )}
    >
      <Switch
        checked={checked}
        onCheckedChange={onChange}
        className="h-3 min-w-5"
        disabled={disabled}
      />
      {label}
    </label>
  )
}

// ─── Chart content (used by both inline and fullscreen dialog) ────────────────

interface ChartContentProps {
  bars: MarketKline[]
  height: number
  trades: Trade[]
  indicatorConfig: ChartIndicatorConfig
  indicatorState: IndicatorState
  chartType: ChartType
  symbol?: string
  showToolbar: boolean
  showOhlcvLegend: boolean
  activeBar: OhlcvPoint | null
  setActiveBar: (bar: OhlcvPoint | null) => void
  onChartTypeChange: (t: ChartType) => void
  onZoomIn: () => void
  onZoomOut: () => void
  onToggleIndicator: (key: keyof IndicatorState) => void
  onCloseFullscreen?: () => void
  /** Pause expensive chart updates (useful when fullscreen is open). */
  paused?: boolean
  /** Whether this instance is inside the fullscreen dialog */
  isFullscreen?: boolean
  /** Expose chart API to parent for zoom/scroll controls */
  onChartApiRef?: (ref: IChartApi | null) => void
} 

function ChartContent({ 
  bars,
  height,
  trades,
  indicatorConfig,
  indicatorState,
  chartType,
  symbol,
  showToolbar,
  showOhlcvLegend,
  activeBar,
  setActiveBar,
  onChartTypeChange,
  onZoomIn,
  onZoomOut,
  onToggleIndicator, 
  onCloseFullscreen,
  paused = false,
  isFullscreen = false,
  onChartApiRef, 
}: ChartContentProps) { 
  const containerRef = useRef<HTMLDivElement>(null) 
  const chartRef = useRef<IChartApi | null>(null) 
  const rsiChartRef = useRef<IChartApi | null>(null)
  const macdChartRef = useRef<IChartApi | null>(null)
  const atrChartRef = useRef<IChartApi | null>(null)

  const candleRef = useRef<ISeriesApi<'Candlestick'> | null>(null)
  const lineSeriesRef = useRef<ISeriesApi<'Line'> | null>(null)
  const areaSeriesRef = useRef<ISeriesApi<'Area'> | null>(null)
  const baselineSeriesRef = useRef<ISeriesApi<'Baseline'> | null>(null)
  const volumeRef = useRef<ISeriesApi<'Histogram'> | null>(null)
  const maSeriesRefs = useRef<ISeriesApi<'Line'>[]>([])
  const rsiSeriesRef = useRef<ISeriesApi<'Line'> | null>(null)
  const macdSeriesRef = useRef<ISeriesApi<'Line'> | null>(null)
  const signalSeriesRef = useRef<ISeriesApi<'Line'> | null>(null)
  const histogramSeriesRef = useRef<ISeriesApi<'Histogram'> | null>(null)
  const atrSeriesRef = useRef<ISeriesApi<'Histogram'> | null>(null)
  const vwapSeriesRef = useRef<ISeriesApi<'Line'> | null>(null)
  const bbUpperRef = useRef<ISeriesApi<'Line'> | null>(null) 
  const bbMiddleRef = useRef<ISeriesApi<'Line'> | null>(null) 
  const bbLowerRef = useRef<ISeriesApi<'Line'> | null>(null) 
  const priceLineRef = useRef<IPriceLine | null>(null) 
  const barsRef = useRef(bars) 
  const barsByTsRef = useRef<Map<number, MarketKline>>(new Map()) 
  const lastTsRef = useRef<number | null>(null) 
  const hoverRafRef = useRef<number | null>(null) 
  const hoverTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const lastHoverEmitAtRef = useRef(0)
  const pendingHoverTsRef = useRef<number | null>(null) 
  const pausedRef = useRef(paused) 
  const mainSeriesMetaRef = useRef<
    { len: number; firstOpenTime: number | null; lastOpenTime: number | null }
  >({ len: 0, firstOpenTime: null, lastOpenTime: null })

  const { mas, showRsi, rsiPeriod, showMacd, showBollingerBands, showAtr, showVwap } =
    useMemo(() => {
      const cfg = indicatorConfig
      return {
        mas: indicatorState.showMa ? (cfg.mas ?? DEFAULT_MA_CONFIGS) : [],
        showRsi: indicatorState.showRsi,
        rsiPeriod: cfg.rsiPeriod ?? DEFAULT_RSI_PERIOD,
        showMacd: indicatorState.showMacd,
        showBollingerBands: indicatorState.showBollingerBands,
        showAtr: indicatorState.showAtr,
        showVwap: indicatorState.showVwap,
      }
    }, [indicatorConfig, indicatorState])

  const indicatorBars = useThrottledLatest(bars, INDICATOR_THROTTLE_MS, !paused)

  const subPaneCount = [showRsi, showMacd, showAtr].filter(Boolean).length
  const subPaneHeight = subPaneCount > 0 ? Math.floor(height * 0.18) : 0
  const mainChartH =
    height -
    (showToolbar ? 44 : 0) -
    (showOhlcvLegend ? 32 : 0) -
    subPaneCount * subPaneHeight -
    subPaneCount * 8
  // Keep a mutable ref so ResizeObserver always reads the latest computed height
  const mainChartHRef = useRef(mainChartH)
  useEffect(() => { mainChartHRef.current = mainChartH }, [mainChartH])

  useEffect(() => { 
    pausedRef.current = paused 
  }, [paused]) 

  useEffect(() => {  
    if (paused) return 
    barsRef.current = bars  
    const map = new Map<number, MarketKline>()  
    for (const bar of bars) map.set(Math.floor(bar.openTime / 1000), bar)  
    barsByTsRef.current = map  
  }, [bars, paused])  

  // ── Chart init / destroy ────────────────────────────────────────────────────

  useEffect(() => {
    const el = containerRef.current
    if (!el) return

    const chart = createChart(el, {
      width: el.clientWidth,
      height: mainChartH,
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
      leftPriceScale: { visible: true, borderColor: '#2d3a4d' },
      rightPriceScale: { borderColor: '#2d3a4d' },
      timeScale: { borderColor: '#2d3a4d', timeVisible: true, secondsVisible: false },
      crosshair: {
        mode: CrosshairMode.Normal,
        vertLine: { color: 'rgba(34, 197, 94, 0.35)', style: LineStyle.Dashed },
        horzLine: { color: 'rgba(34, 197, 94, 0.35)', style: LineStyle.Dashed },
      },
    })

    const flushHover = () => { 
      hoverRafRef.current = null 
      lastHoverEmitAtRef.current = Date.now()
      const tsNum = pendingHoverTsRef.current 
      pendingHoverTsRef.current = null 
      if (tsNum == null) { 
        lastTsRef.current = null 
        setActiveBar(null) 
        return 
      } 
      const bar = barsByTsRef.current.get(tsNum) 
      if (!bar) { 
        setActiveBar(null) 
        return 
      } 
      setActiveBar({ 
        time: tsNum as UTCTimestamp, 
        open: bar.open, 
        high: bar.high, 
        low: bar.low, 
        close: bar.close, 
        volume: bar.volume, 
      }) 
    } 
 
    const scheduleHover = (nextTs: number | null) => { 
      pendingHoverTsRef.current = nextTs 
      const now = Date.now()
      const elapsed = now - lastHoverEmitAtRef.current
      const wait = Math.max(0, HOVER_THROTTLE_MS - elapsed)
      if (wait === 0) {
        if (hoverRafRef.current == null) hoverRafRef.current = requestAnimationFrame(flushHover)
        return
      }
      if (hoverTimerRef.current != null) return
      hoverTimerRef.current = setTimeout(() => {
        hoverTimerRef.current = null
        if (hoverRafRef.current == null) hoverRafRef.current = requestAnimationFrame(flushHover)
      }, wait)
    } 
 
    chart.subscribeCrosshairMove((param) => { 
      if (pausedRef.current) return 
      if (!param.time || !param.point) { 
        scheduleHover(null) 
        return 
      } 
      const tsNum = param.time as number 
      if (tsNum === lastTsRef.current) return 
      lastTsRef.current = tsNum 
      scheduleHover(tsNum) 
    }) 

    const candleSeries = chart.addCandlestickSeries({
      upColor: '#22c55e',
      downColor: '#ef4444',
      borderUpColor: '#22c55e',
      borderDownColor: '#ef4444',
      wickUpColor: '#22c55e',
      wickDownColor: '#ef4444',
    })

    const lineSeries = chart.addLineSeries({ color: '#38bdf8', lineWidth: 2, visible: false })
    const areaSeries = chart.addAreaSeries({
      lineColor: '#38bdf8',
      topColor: 'rgba(56, 189, 248, 0.35)',
      bottomColor: 'rgba(56, 189, 248, 0.04)',
      lineWidth: 2,
      visible: false,
    })
    const baselineSeries = chart.addBaselineSeries({
      baseValue: { type: 'price', price: 0 },
      topFillColor1: 'rgba(34, 197, 94, 0.35)',
      topFillColor2: 'rgba(34, 197, 94, 0.05)',
      bottomFillColor1: 'rgba(239, 68, 68, 0.05)',
      bottomFillColor2: 'rgba(239, 68, 68, 0.35)',
      lineWidth: 2,
      visible: false,
    })
    const volumeSeries = chart.addHistogramSeries({ priceFormat: { type: 'volume' }, priceScaleId: '' })
    volumeSeries.priceScale().applyOptions({ scaleMargins: { top: 0.85, bottom: 0 } })

    const vwapSeries = chart.addLineSeries({
      color: '#f59e0b',
      lineWidth: 1,
      lineStyle: LineStyle.Dashed,
      priceLineVisible: false,
      lastValueVisible: false,
      title: 'VWAP',
    })

    const bbUpper = chart.addLineSeries({
      color: 'rgba(168, 85, 247, 0.6)',
      lineWidth: 1,
      priceLineVisible: false,
      lastValueVisible: false,
      title: 'BB Upper',
    })
    const bbMiddle = chart.addLineSeries({
      color: 'rgba(168, 85, 247, 0.8)',
      lineWidth: 1,
      priceLineVisible: false,
      lastValueVisible: false,
      title: 'BB Middle',
    })
    const bbLower = chart.addLineSeries({
      color: 'rgba(168, 85, 247, 0.6)',
      lineWidth: 1,
      priceLineVisible: false,
      lastValueVisible: false,
      title: 'BB Lower',
    })

    chartRef.current = chart
    candleRef.current = candleSeries
    lineSeriesRef.current = lineSeries
    areaSeriesRef.current = areaSeries
    baselineSeriesRef.current = baselineSeries
    volumeRef.current = volumeSeries
    maSeriesRefs.current = []
    vwapSeriesRef.current = vwapSeries
    bbUpperRef.current = bbUpper
    bbMiddleRef.current = bbMiddle
    bbLowerRef.current = bbLower

    onChartApiRef?.(chart)

    // ── RSI sub-chart ──────────────────────────────────────────────────────
    const rsiChartEl = showRsi ? el.querySelector<HTMLDivElement>('[data-rsi-chart]') : null
    if (rsiChartEl) {
      const rsiChart = createChart(rsiChartEl, {
        width: el.clientWidth,
        height: subPaneHeight,
        handleScroll: false,
        handleScale: false,
        layout: { background: { type: ColorType.Solid, color: '#0c1219' }, textColor: '#9caab8' },
        grid: { vertLines: { color: '#252f3f' }, horzLines: { color: '#252f3f' } },
        rightPriceScale: { borderColor: '#2d3a4d', scaleMargins: { top: 0.1, bottom: 0.1 } },
        timeScale: { borderColor: '#2d3a4d', timeVisible: true, secondsVisible: false },
        crosshair: {
          mode: CrosshairMode.Normal,
          vertLine: { color: 'rgba(34, 197, 94, 0.35)', style: LineStyle.Dashed },
          horzLine: { color: 'rgba(34, 197, 94, 0.35)', style: LineStyle.Dashed },
        },
      })

      chart.timeScale().subscribeVisibleLogicalRangeChange((range) => {
        if (range) rsiChart.timeScale().setVisibleLogicalRange(range)
      })

      rsiSeriesRef.current = rsiChart.addLineSeries({
        color: '#a78bfa',
        lineWidth: 2,
        priceLineVisible: false,
        lastValueVisible: false,
      })
      rsiChartRef.current = rsiChart
    }

    // ── MACD sub-chart ──────────────────────────────────────────────────────
    const macdChartEl = showMacd ? el.querySelector<HTMLDivElement>('[data-macd-chart]') : null
    if (macdChartEl) {
      const macdChart = createChart(macdChartEl, {
        width: el.clientWidth,
        height: subPaneHeight,
        handleScroll: false,
        handleScale: false,
        layout: { background: { type: ColorType.Solid, color: '#0c1219' }, textColor: '#9caab8' },
        grid: { vertLines: { color: '#252f3f' }, horzLines: { color: '#252f3f' } },
        rightPriceScale: { borderColor: '#2d3a4d', scaleMargins: { top: 0.1, bottom: 0.1 } },
        timeScale: { borderColor: '#2d3a4d', timeVisible: true, secondsVisible: false },
        crosshair: {
          mode: CrosshairMode.Normal,
          vertLine: { color: 'rgba(34, 197, 94, 0.35)', style: LineStyle.Dashed },
          horzLine: { color: 'rgba(34, 197, 94, 0.35)', style: LineStyle.Dashed },
        },
      })

      chart.timeScale().subscribeVisibleLogicalRangeChange((range) => {
        if (range) macdChart.timeScale().setVisibleLogicalRange(range)
      })

      macdSeriesRef.current = macdChart.addLineSeries({
        color: '#38bdf8', lineWidth: 2, priceLineVisible: false, lastValueVisible: false,
      })
      signalSeriesRef.current = macdChart.addLineSeries({
        color: '#f59e0b', lineWidth: 1, priceLineVisible: false, lastValueVisible: false,
      })
      histogramSeriesRef.current = macdChart.addHistogramSeries({ priceLineVisible: false })
      macdChartRef.current = macdChart
    }

    // ── ATR sub-chart ──────────────────────────────────────────────────────
    const atrChartEl = showAtr ? el.querySelector<HTMLDivElement>('[data-atr-chart]') : null
    if (atrChartEl) {
      const atrChart = createChart(atrChartEl, {
        width: el.clientWidth,
        height: subPaneHeight,
        handleScroll: false,
        handleScale: false,
        layout: { background: { type: ColorType.Solid, color: '#0c1219' }, textColor: '#9caab8' },
        grid: { vertLines: { color: '#252f3f' }, horzLines: { color: '#252f3f' } },
        rightPriceScale: { borderColor: '#2d3a4d', scaleMargins: { top: 0.1, bottom: 0.1 } },
        timeScale: { borderColor: '#2d3a4d', timeVisible: true, secondsVisible: false },
        crosshair: {
          mode: CrosshairMode.Normal,
          vertLine: { color: 'rgba(34, 197, 94, 0.35)', style: LineStyle.Dashed },
          horzLine: { color: 'rgba(34, 197, 94, 0.35)', style: LineStyle.Dashed },
        },
      })

      chart.timeScale().subscribeVisibleLogicalRangeChange((range) => {
        if (range) atrChart.timeScale().setVisibleLogicalRange(range)
      })

      atrSeriesRef.current = atrChart.addHistogramSeries({
        priceFormat: { type: 'price', precision: 4 },
        color: 'rgba(251, 146, 60, 0.5)',
      })
      atrChartRef.current = atrChart
    }

    const ro = new ResizeObserver(() => {
      if (el.clientWidth > 0) {
        chart.applyOptions({ width: el.clientWidth })
        if (rsiChartRef.current) rsiChartRef.current.applyOptions({ width: el.clientWidth })
        if (macdChartRef.current) macdChartRef.current.applyOptions({ width: el.clientWidth })
        if (atrChartRef.current) atrChartRef.current.applyOptions({ width: el.clientWidth })
      }
      // Also handle height changes (e.g. when indicators toggle and mainChartH shrinks/grows)
      if (mainChartHRef.current > 0) {
        chart.applyOptions({ height: mainChartHRef.current })
      }
    })
    ro.observe(el) 
 
    return () => { 
      if (hoverRafRef.current != null) {
        cancelAnimationFrame(hoverRafRef.current)
        hoverRafRef.current = null
      }
      ro.disconnect()
      onChartApiRef?.(null)
      chart.remove() 
      if (rsiChartRef.current) { rsiChartRef.current.remove(); rsiChartRef.current = null } 
      if (macdChartRef.current) { macdChartRef.current.remove(); macdChartRef.current = null } 
      if (atrChartRef.current) { atrChartRef.current.remove(); atrChartRef.current = null } 
      chartRef.current = null
      candleRef.current = null
      lineSeriesRef.current = null
      areaSeriesRef.current = null
      baselineSeriesRef.current = null
      volumeRef.current = null
      maSeriesRefs.current = []
      rsiSeriesRef.current = null
      macdSeriesRef.current = null
      signalSeriesRef.current = null
      histogramSeriesRef.current = null
      atrSeriesRef.current = null
      vwapSeriesRef.current = null
      bbUpperRef.current = null
      bbMiddleRef.current = null
      bbLowerRef.current = null
      priceLineRef.current = null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mainChartH, showRsi, showMacd, showAtr, subPaneHeight])

  // ── Chart type visibility ─────────────────────────────────────────────────

  useEffect(() => { 
    if (paused) return
    if (candleRef.current) candleRef.current.applyOptions({ visible: chartType === 'candlestick' }) 
    if (lineSeriesRef.current) lineSeriesRef.current.applyOptions({ visible: chartType === 'line' }) 
    if (areaSeriesRef.current) areaSeriesRef.current.applyOptions({ visible: chartType === 'area' }) 
    if (baselineSeriesRef.current) 
      baselineSeriesRef.current.applyOptions({ visible: chartType === 'baseline' }) 

    // Keep the newly-visible series up to date without continuously updating all series.
    const rowsSrc = barsRef.current
    if (rowsSrc.length > 0) {
      const closeRows = rowsSrc.map((b) => ({
        time: Math.floor(b.openTime / 1000) as UTCTimestamp,
        value: b.close,
      }))
      if (chartType === 'line' && lineSeriesRef.current) lineSeriesRef.current.setData(closeRows)
      if (chartType === 'area' && areaSeriesRef.current) areaSeriesRef.current.setData(closeRows)
      if (chartType === 'baseline' && baselineSeriesRef.current) baselineSeriesRef.current.setData(closeRows)
    }
  }, [chartType, paused]) 

  // ── Indicator visibility ───────────────────────────────────────────────────

  useEffect(() => { 
    if (paused) return
    if (volumeRef.current) volumeRef.current.applyOptions({ visible: indicatorState.showVolume }) 
    if (vwapSeriesRef.current) vwapSeriesRef.current.applyOptions({ visible: showVwap }) 
    const bbVisible = showBollingerBands 
    if (bbUpperRef.current) bbUpperRef.current.applyOptions({ visible: bbVisible }) 
    if (bbMiddleRef.current) bbMiddleRef.current.applyOptions({ visible: bbVisible }) 
    if (bbLowerRef.current) bbLowerRef.current.applyOptions({ visible: bbVisible }) 
  }, [indicatorState.showVolume, showVwap, showBollingerBands, paused]) 

  // ── Update main chart data ────────────────────────────────────────────────

  useEffect(() => { 
    if (paused) return
    const chart = chartRef.current 
    if (!chart || !candleRef.current || !lineSeriesRef.current || !areaSeriesRef.current || 
        !baselineSeriesRef.current || !volumeRef.current) return 

    const t0 = perfNow()
    let path: 'empty' | 'incr' | 'set' = 'set'

    const hasVolume = bars.some((b) => b.volume > 0) && indicatorState.showVolume
    const prevMeta = mainSeriesMetaRef.current

    if (bars.length === 0) {
      path = 'empty'
      candleRef.current.setData([])
      lineSeriesRef.current.setData([])
      areaSeriesRef.current.setData([])
      baselineSeriesRef.current.setData([])
      volumeRef.current.setData([])
      volumeRef.current.applyOptions({ visible: false })
      if (priceLineRef.current) {
        candleRef.current.removePriceLine(priceLineRef.current)
        priceLineRef.current = null
      }
      mainSeriesMetaRef.current = { len: 0, firstOpenTime: null, lastOpenTime: null }
      perfAdd('chart.inline.data', perfNow() - t0, { path, bars: 0 })
      return
    }

    const first = bars[0]
    const last = bars[bars.length - 1]
    const firstOpenTime = first?.openTime ?? null
    const lastOpenTime = last?.openTime ?? null

    const replacedWindow =
      prevMeta.len > 0 && firstOpenTime != null && prevMeta.firstOpenTime != null &&
      firstOpenTime !== prevMeta.firstOpenTime

    const canIncremental =
      !replacedWindow &&
      prevMeta.len > 0 &&
      prevMeta.lastOpenTime != null &&
      lastOpenTime != null &&
      (bars.length === prevMeta.len || bars.length === prevMeta.len + 1) &&
      lastOpenTime >= prevMeta.lastOpenTime

    if (canIncremental) {
      path = 'incr'
      const sec = Math.floor(last.openTime / 1000) as UTCTimestamp
      candleRef.current.update({ time: sec, open: last.open, high: last.high, low: last.low, close: last.close })
      const closePoint = { time: sec, value: last.close }
      if (chartType === 'line') lineSeriesRef.current.update(closePoint)
      if (chartType === 'area') areaSeriesRef.current.update(closePoint)
      if (chartType === 'baseline') baselineSeriesRef.current.update(closePoint)
      if (hasVolume) {
        const bullish = last.close >= last.open
        volumeRef.current.applyOptions({ visible: true })
        volumeRef.current.update({
          time: sec,
          value: last.volume,
          color: bullish ? 'rgba(38, 166, 154, 0.45)' : 'rgba(239, 83, 80, 0.45)',
        })
      } else {
        volumeRef.current.applyOptions({ visible: false })
        volumeRef.current.setData([])
      }
    } else {
      path = 'set'
      const rows = marketKlinesToCandlestickData(bars)
      candleRef.current.setData(rows)
      const closeRows = rows.map((r) => ({ time: r.time, value: r.close }))
      lineSeriesRef.current.setData(closeRows)
      areaSeriesRef.current.setData(closeRows)
      baselineSeriesRef.current.setData(closeRows)
      volumeRef.current.applyOptions({ visible: hasVolume })
      volumeRef.current.setData(hasVolume ? marketKlinesToVolumeHistogramData(bars) : [])

      if (rows.length > 0 && (prevMeta.len === 0 || replacedWindow)) chart.timeScale().fitContent()
    }

    candleRef.current.priceScale().applyOptions({
      scaleMargins: { top: 0.05, bottom: hasVolume ? 0.22 : 0.05 },
    })

    if (priceLineRef.current) {
      priceLineRef.current.applyOptions({ price: last.close })
    } else {
      priceLineRef.current = candleRef.current.createPriceLine({
        price: last.close,
        color: 'rgba(34, 197, 94, 0.9)',
        lineWidth: 1,
        lineStyle: LineStyle.Dotted,
        axisLabelVisible: true,
        title: 'Last',
      })
    }

    mainSeriesMetaRef.current = {
      len: bars.length,
      firstOpenTime,
      lastOpenTime,
    }

    perfAdd('chart.inline.data', perfNow() - t0, { path, bars: bars.length, hasVolume })
  }, [bars, indicatorState.showVolume, paused]) 

  // ── Update MA lines ───────────────────────────────────────────────────────

  useEffect(() => { 
    if (paused) return
    const chart = chartRef.current 
    if (!chart) return 
    const t0 = perfNow()

    const maSeriesArr = maSeriesRefs.current
    if (mas.length === 0) {
      if (maSeriesArr.length > 0) {
        for (const s of maSeriesArr) chart.removeSeries(s)
        maSeriesRefs.current = []
      }
      return
    }
    if (maSeriesArr.length !== mas.length) {
      for (const s of maSeriesArr) chart.removeSeries(s)
      const newSeries: ISeriesApi<'Line'>[] = []
      for (const ma of mas) {
        newSeries.push(
          chart.addLineSeries({
            color: ma.color,
            lineWidth: 1,
            priceLineVisible: false,
            lastValueVisible: false,
            title: ma.label,
          }),
        )
      }
      maSeriesRefs.current = newSeries
    }
    const maLines = computeMaLines(indicatorBars, mas) 
    for (let i = 0; i < maLines.length; i++) { 
      maSeriesRefs.current[i]?.setData(maLines[i].data) 
    } 
    perfAdd('chart.inline.ind.ma', perfNow() - t0, { bars: indicatorBars.length, mas: mas.length })
  }, [indicatorBars, JSON.stringify(mas), paused])  

  // ── Bollinger Bands ───────────────────────────────────────────────────────

  useEffect(() => { 
    if (paused) return
    if (!bbUpperRef.current || !bbMiddleRef.current || !bbLowerRef.current) return 
    const t0 = perfNow()
    if (!showBollingerBands) { 
      bbUpperRef.current.setData([])
      bbMiddleRef.current.setData([])
      bbLowerRef.current.setData([])
      perfAdd('chart.inline.ind.bb', perfNow() - t0, { bars: indicatorBars.length, on: false })
      return
    }
    const period = indicatorConfig.bollingerPeriod ?? DEFAULT_BOLLINGER_PERIOD
    const stdDev = indicatorConfig.bollingerStdDev ?? DEFAULT_BOLLINGER_STDDEV
    const bb = computeBollingerBands(indicatorBars, period, stdDev) 
    bbUpperRef.current.setData(bb.upper) 
    bbMiddleRef.current.setData(bb.middle) 
    bbLowerRef.current.setData(bb.lower) 
    perfAdd('chart.inline.ind.bb', perfNow() - t0, { bars: indicatorBars.length, on: true })
  }, [indicatorBars, showBollingerBands, indicatorConfig.bollingerPeriod, indicatorConfig.bollingerStdDev, paused])  

  // ── VWAP ──────────────────────────────────────────────────────────────────

  useEffect(() => { 
    if (paused) return
    if (!vwapSeriesRef.current) return 
    const t0 = perfNow()
    if (!showVwap) { 
      vwapSeriesRef.current.setData([])
      perfAdd('chart.inline.ind.vwap', perfNow() - t0, { bars: indicatorBars.length, on: false })
      return
    } 
    vwapSeriesRef.current.setData(computeVwapLine(indicatorBars))  
    perfAdd('chart.inline.ind.vwap', perfNow() - t0, { bars: indicatorBars.length, on: true })
  }, [indicatorBars, showVwap, paused])  

  // ── RSI ──────────────────────────────────────────────────────────────────

  useEffect(() => { 
    if (paused) return
    if (!rsiSeriesRef.current) return 
    const t0 = perfNow()
    if (!showRsi) { 
      rsiSeriesRef.current.setData([])
      perfAdd('chart.inline.ind.rsi', perfNow() - t0, { bars: indicatorBars.length, on: false })
      return
    } 
    rsiSeriesRef.current.setData(computeRsiLine(indicatorBars, rsiPeriod))  
    perfAdd('chart.inline.ind.rsi', perfNow() - t0, { bars: indicatorBars.length, on: true, period: rsiPeriod })
  }, [indicatorBars, rsiPeriod, showRsi, paused])  

  // ── MACD ──────────────────────────────────────────────────────────────────

  useEffect(() => { 
    if (paused) return
    if (!macdSeriesRef.current || !signalSeriesRef.current || !histogramSeriesRef.current) return 
    const t0 = perfNow()
    if (!showMacd) { 
      macdSeriesRef.current.setData([]) 
      signalSeriesRef.current.setData([]) 
      histogramSeriesRef.current.setData([]) 
      perfAdd('chart.inline.ind.macd', perfNow() - t0, { bars: indicatorBars.length, on: false })
      return 
    } 
    const macdData = computeMacd(indicatorBars, DEFAULT_MACD_FAST, DEFAULT_MACD_SLOW, DEFAULT_MACD_SIGNAL)  
    macdSeriesRef.current.setData(macdData.macd)  
    signalSeriesRef.current.setData(macdData.signal)  
    histogramSeriesRef.current.setData(macdData.histogram)  
    perfAdd('chart.inline.ind.macd', perfNow() - t0, { bars: indicatorBars.length, on: true })
  }, [indicatorBars, showMacd, paused])  

  // ── ATR ───────────────────────────────────────────────────────────────────

  useEffect(() => { 
    if (paused) return
    if (!atrSeriesRef.current) return 
    const t0 = perfNow()
    if (!showAtr) { 
      atrSeriesRef.current.setData([])
      perfAdd('chart.inline.ind.atr', perfNow() - t0, { bars: indicatorBars.length, on: false })
      return
    } 
    const period = indicatorConfig.atrPeriod ?? DEFAULT_ATR_PERIOD 
    const atrData = computeAtrLine(indicatorBars, period)  
    atrSeriesRef.current.setData(  
      atrData.map((d) => ({ time: d.time, value: d.value, color: 'rgba(251, 146, 60, 0.5)' })),  
    )  
    perfAdd('chart.inline.ind.atr', perfNow() - t0, { bars: indicatorBars.length, on: true, period })
  }, [indicatorBars, indicatorConfig.atrPeriod, showAtr, paused])  

  // ── Trade markers ─────────────────────────────────────────────────────────

  useEffect(() => { 
    if (paused) return
    if (!candleRef.current) return 
    const t0 = perfNow()
    candleRef.current.setMarkers([]) 
    const markers = computeTradeMarkers(trades)
    const chartMarkers = markers.map((m) => ({
      time: m.time,
      position: m.position,
      color: m.color,
      shape: m.shape,
      text: m.text,
    }))
    if (chartMarkers.length > 0) candleRef.current.setMarkers(chartMarkers)
    perfAdd('chart.inline.markers', perfNow() - t0, { trades: trades.length, markers: chartMarkers.length })
  }, [trades, paused]) 

  return (
    <div className="flex flex-col">
      {showToolbar && (
        <ChartToolbar
          chartType={chartType}
          onChartTypeChange={onChartTypeChange}
          onToggleFullscreen={onCloseFullscreen ?? (() => {})}
          onZoomIn={onZoomIn}
          onZoomOut={onZoomOut}
          indicators={indicatorState}
          onToggleIndicator={onToggleIndicator}
          symbol={symbol}
          isFullscreen={false}
        />
      )}
      {showOhlcvLegend && <OhlcvLegend bar={activeBar} />}
      <div
        ref={containerRef}
        className="overflow-hidden rounded-b-md"
        style={{ height: mainChartH }}
        role="img"
        aria-label="Candlestick price chart"
      />
    </div>
  )
}

// ─── Zoom helpers (live refs) ─────────────────────────────────────────────────

function useChartZoom(chartRef: React.MutableRefObject<IChartApi | null>) {
  const handleZoomIn = useCallback(() => {
    const chart = chartRef.current
    if (!chart) return
    const range = chart.timeScale().getVisibleLogicalRange()
    if (!range) return
    const center = (range.from + range.to) / 2
    const span = (range.to - range.from) * 0.7
    chart.timeScale().setVisibleLogicalRange({ from: center - span / 2, to: center + span / 2 })
  }, [])

  const handleZoomOut = useCallback(() => {
    const chart = chartRef.current
    if (!chart) return
    const range = chart.timeScale().getVisibleLogicalRange()
    if (!range) return
    const center = (range.from + range.to) / 2
    const span = (range.to - range.from) * 1.4
    chart.timeScale().setVisibleLogicalRange({
      from: Math.max(0, center - span / 2),
      to: center + span / 2,
    })
  }, [])

  return { handleZoomIn, handleZoomOut }
}

// ─── Fullscreen Dialog ────────────────────────────────────────────────────────

interface FullscreenChartDialogProps {
  open: boolean
  onClose: () => void
  bars: MarketKline[]
  trades: Trade[]
  indicatorConfig: ChartIndicatorConfig
  indicatorState: IndicatorState
  chartType: ChartType
  symbol?: string
}

export function FullscreenChartDialog({
  open,
  onClose,
  bars,
  trades,
  indicatorConfig,
  indicatorState,
  chartType,
  symbol,
}: FullscreenChartDialogProps) {  
  const [containerEl, setContainerEl] = useState<HTMLDivElement | null>(null)
  const [mainChartEl, setMainChartEl] = useState<HTMLDivElement | null>(null)
  const [chartReadyTick, setChartReadyTick] = useState(0)
  const [initAttempt, setInitAttempt] = useState(0)
  const chartRef = useRef<IChartApi | null>(null)  
  const rsiChartRef = useRef<IChartApi | null>(null)  
  const macdChartRef = useRef<IChartApi | null>(null)  
  const atrChartRef = useRef<IChartApi | null>(null)  

  const candleRef = useRef<ISeriesApi<'Candlestick'> | null>(null)
  const lineSeriesRef = useRef<ISeriesApi<'Line'> | null>(null)
  const areaSeriesRef = useRef<ISeriesApi<'Area'> | null>(null)
  const baselineSeriesRef = useRef<ISeriesApi<'Baseline'> | null>(null)
  const volumeRef = useRef<ISeriesApi<'Histogram'> | null>(null)
  const maSeriesRefs = useRef<ISeriesApi<'Line'>[]>([])
  const rsiSeriesRef = useRef<ISeriesApi<'Line'> | null>(null)
  const macdSeriesRef = useRef<ISeriesApi<'Line'> | null>(null)
  const signalSeriesRef = useRef<ISeriesApi<'Line'> | null>(null)
  const histogramSeriesRef = useRef<ISeriesApi<'Histogram'> | null>(null)
  const atrSeriesRef = useRef<ISeriesApi<'Histogram'> | null>(null)
  const vwapSeriesRef = useRef<ISeriesApi<'Line'> | null>(null)
  const bbUpperRef = useRef<ISeriesApi<'Line'> | null>(null) 
  const bbMiddleRef = useRef<ISeriesApi<'Line'> | null>(null) 
  const bbLowerRef = useRef<ISeriesApi<'Line'> | null>(null)  
  const priceLineRef = useRef<IPriceLine | null>(null)  
  const barsRef = useRef(bars)  
  const barsByTsRef = useRef<Map<number, MarketKline>>(new Map())  
  const lastTsRef = useRef<number | null>(null)  
  const hoverRafRef = useRef<number | null>(null)  
  const hoverTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const lastHoverEmitAtRef = useRef(0)
  const pendingHoverTsRef = useRef<number | null>(null)  
  const mainSeriesMetaRef = useRef<  
    { len: number; firstOpenTime: number | null; lastOpenTime: number | null }  
  >({ len: 0, firstOpenTime: null, lastOpenTime: null }) 

  const setContainerNode = useCallback((node: HTMLDivElement | null) => {
    setContainerEl(node)
  }, [])

  const setMainChartNode = useCallback((node: HTMLDivElement | null) => {
    setMainChartEl(node)
  }, [])

  // Keep barsRef in sync so crosshair handler always reads fresh data 
  useEffect(() => { 
    barsRef.current = bars 
    const map = new Map<number, MarketKline>() 
    for (const bar of bars) map.set(Math.floor(bar.openTime / 1000), bar) 
    barsByTsRef.current = map 
  }, [bars]) 

  const [chartTypeState, setChartTypeState] = useState<ChartType>(chartType)
  const [indicatorStateLocal, setIndicatorStateLocal] = useState<IndicatorState>(indicatorState)
  const [activeBar, setActiveBar] = useState<OhlcvPoint | null>(null)

  const { mas, showRsi, rsiPeriod, showMacd, showBollingerBands, showAtr, showVwap } =
    useMemo(() => {
      const cfg = indicatorConfig
      return {
        mas: indicatorStateLocal.showMa ? (cfg.mas ?? DEFAULT_MA_CONFIGS) : [],
        showRsi: indicatorStateLocal.showRsi,
        rsiPeriod: cfg.rsiPeriod ?? DEFAULT_RSI_PERIOD,
        showMacd: indicatorStateLocal.showMacd,
        showBollingerBands: indicatorStateLocal.showBollingerBands,
        showAtr: indicatorStateLocal.showAtr,
        showVwap: indicatorStateLocal.showVwap,
      }
    }, [indicatorConfig, indicatorStateLocal]) 

  const indicatorBars = useThrottledLatest(bars, INDICATOR_THROTTLE_MS, open)

  // Use window dimensions directly — avoids DOM measurement lag when dialog first opens
  const fullscreenWidth = typeof window !== 'undefined' ? window.innerWidth : 1200
  const fullscreenHeight = typeof window !== 'undefined' ? window.innerHeight : 700
  const chartWidth = fullscreenWidth - 48

  // Main chart height = fullscreen minus toolbar and OHLCV legend
  const mainChartH = fullscreenHeight - 44 - 32

  // Sub-panes are absolute overlays on top of the main chart canvas
  const subPaneCount = [showRsi, showMacd, showAtr].filter(Boolean).length
  const subPaneH = subPaneCount > 0 ? Math.floor(fullscreenHeight * 0.18) : 0

  useEffect(() => { setChartTypeState(chartType) }, [chartType]) 
  useEffect(() => { setIndicatorStateLocal(indicatorState) }, [indicatorState]) 

  const { handleZoomIn, handleZoomOut } = useChartZoom(chartRef)

  // ── Chart init ──────────────────────────────────────────────────────────

  // useLayoutEffect runs synchronously after DOM mutations, before paint.  
  // This ensures the container has its real dimensions when we create the chart.  
  useLayoutEffect(() => {  
    if (!open) return 
    const el = containerEl
    const mainEl = mainChartEl
    if (!el || !mainEl) return  

    // Measure actual DOM dimensions — dialog should be painted by now
    const domW = mainEl.clientWidth
    const domH = mainEl.clientHeight
    if (domW < 10 || domH < 10) {
      if (initAttempt < 120) {
        const raf = requestAnimationFrame(() => setInitAttempt((v) => v + 1))
        return () => cancelAnimationFrame(raf)
      }
      return
    }
    const realWidth = domW
    const realHeight = domH

    const chart = createChart(mainEl, { 
      width: realWidth, 
      height: realHeight, 
      handleScroll: true,
      handleScale: true,
      layout: {
        background: { type: ColorType.Solid, color: '#0c1219' },
        textColor: '#9caab8',
        fontFamily: 'ui-sans-serif, system-ui, sans-serif, "Apple Color Emoji", "Segoe UI Emoji"',
      },
      grid: { vertLines: { color: '#252f3f' }, horzLines: { color: '#252f3f' } },
      leftPriceScale: { visible: true, borderColor: '#2d3a4d' },
      rightPriceScale: { borderColor: '#2d3a4d' },
      timeScale: { borderColor: '#2d3a4d', timeVisible: true, secondsVisible: false },
      crosshair: {
        mode: CrosshairMode.Normal,
        vertLine: { color: 'rgba(34, 197, 94, 0.35)', style: LineStyle.Dashed },
        horzLine: { color: 'rgba(34, 197, 94, 0.35)', style: LineStyle.Dashed },
      },
    })

    const flushHover = () => { 
      hoverRafRef.current = null 
      lastHoverEmitAtRef.current = Date.now()
      const tsNum = pendingHoverTsRef.current 
      pendingHoverTsRef.current = null 
      if (tsNum == null) { 
        lastTsRef.current = null 
        setActiveBar(null) 
        return 
      } 
      const bar = barsByTsRef.current.get(tsNum) 
      if (!bar) { 
        setActiveBar(null) 
        return 
      } 
      setActiveBar({ 
        time: tsNum as UTCTimestamp, 
        open: bar.open, 
        high: bar.high, 
        low: bar.low, 
        close: bar.close, 
        volume: bar.volume, 
      }) 
    } 
 
    const scheduleHover = (nextTs: number | null) => { 
      pendingHoverTsRef.current = nextTs 
      const now = Date.now()
      const elapsed = now - lastHoverEmitAtRef.current
      const wait = Math.max(0, HOVER_THROTTLE_MS - elapsed)
      if (wait === 0) {
        if (hoverRafRef.current == null) hoverRafRef.current = requestAnimationFrame(flushHover)
        return
      }
      if (hoverTimerRef.current != null) return
      hoverTimerRef.current = setTimeout(() => {
        hoverTimerRef.current = null
        if (hoverRafRef.current == null) hoverRafRef.current = requestAnimationFrame(flushHover)
      }, wait)
    } 
 
    chart.subscribeCrosshairMove((param) => { 
      if (!param.time || !param.point) { 
        scheduleHover(null) 
        return 
      } 
      const tsNum = param.time as number 
      if (tsNum === lastTsRef.current) return 
      lastTsRef.current = tsNum 
      scheduleHover(tsNum) 
    }) 

    const candleSeries = chart.addCandlestickSeries({
      upColor: '#22c55e', downColor: '#ef4444', borderUpColor: '#22c55e', borderDownColor: '#ef4444',
      wickUpColor: '#22c55e', wickDownColor: '#ef4444',
    })
    const lineSeries = chart.addLineSeries({ color: '#38bdf8', lineWidth: 2, visible: false })
    const areaSeries = chart.addAreaSeries({
      lineColor: '#38bdf8', topColor: 'rgba(56, 189, 248, 0.35)', bottomColor: 'rgba(56, 189, 248, 0.04)',
      lineWidth: 2, visible: false,
    })
    const baselineSeries = chart.addBaselineSeries({
      baseValue: { type: 'price', price: 0 },
      topFillColor1: 'rgba(34, 197, 94, 0.35)', topFillColor2: 'rgba(34, 197, 94, 0.05)',
      bottomFillColor1: 'rgba(239, 68, 68, 0.05)', bottomFillColor2: 'rgba(239, 68, 68, 0.35)',
      lineWidth: 2, visible: false,
    })
    const volumeSeries = chart.addHistogramSeries({ priceFormat: { type: 'volume' }, priceScaleId: '' })
    volumeSeries.priceScale().applyOptions({ scaleMargins: { top: 0.85, bottom: 0 } })

    const vwapSeries = chart.addLineSeries({
      color: '#f59e0b', lineWidth: 1, lineStyle: LineStyle.Dashed,
      priceLineVisible: false, lastValueVisible: false, title: 'VWAP',
    })
    const bbUpper = chart.addLineSeries({
      color: 'rgba(168, 85, 247, 0.6)', lineWidth: 1, priceLineVisible: false, lastValueVisible: false, title: 'BB Upper',
    })
    const bbMiddle = chart.addLineSeries({
      color: 'rgba(168, 85, 247, 0.8)', lineWidth: 1, priceLineVisible: false, lastValueVisible: false, title: 'BB Middle',
    })
    const bbLower = chart.addLineSeries({
      color: 'rgba(168, 85, 247, 0.6)', lineWidth: 1, priceLineVisible: false, lastValueVisible: false, title: 'BB Lower',
    })

    chartRef.current = chart
    candleRef.current = candleSeries
    lineSeriesRef.current = lineSeries
    areaSeriesRef.current = areaSeries
    baselineSeriesRef.current = baselineSeries
    volumeRef.current = volumeSeries
    maSeriesRefs.current = []
    vwapSeriesRef.current = vwapSeries
    bbUpperRef.current = bbUpper
    bbMiddleRef.current = bbMiddle
    bbLowerRef.current = bbLower

    // ── RSI ──────────────────────────────────────────────────────────────
    const rsiChartEl = showRsi ? el.querySelector<HTMLDivElement>('[data-rsi-chart]') : null 
    if (rsiChartEl) { 
      const rsiChart = createChart(rsiChartEl, { 
        width: el.clientWidth || chartWidth,
        height: subPaneH,
        handleScroll: false,
        handleScale: false,
        layout: { background: { type: ColorType.Solid, color: '#0c1219' }, textColor: '#9caab8' },
        grid: { vertLines: { color: '#252f3f' }, horzLines: { color: '#252f3f' } },
        rightPriceScale: { borderColor: '#2d3a4d', scaleMargins: { top: 0.1, bottom: 0.1 } },
        timeScale: { borderColor: '#2d3a4d', timeVisible: true, secondsVisible: false },
        crosshair: {
          mode: CrosshairMode.Normal,
          vertLine: { color: 'rgba(34, 197, 94, 0.35)', style: LineStyle.Dashed },
          horzLine: { color: 'rgba(34, 197, 94, 0.35)', style: LineStyle.Dashed },
        },
      })
      chart.timeScale().subscribeVisibleLogicalRangeChange((range) => {
        if (range) rsiChart.timeScale().setVisibleLogicalRange(range)
      })
      rsiSeriesRef.current = rsiChart.addLineSeries({
        color: '#a78bfa', lineWidth: 2, priceLineVisible: false, lastValueVisible: false,
      })
      rsiChartRef.current = rsiChart
    }

    // ── MACD ─────────────────────────────────────────────────────────────
    const macdChartEl = showMacd ? el.querySelector<HTMLDivElement>('[data-macd-chart]') : null 
    if (macdChartEl) { 
      const macdChart = createChart(macdChartEl, { 
        width: el.clientWidth || chartWidth,
        height: subPaneH,
        handleScroll: false,
        handleScale: false,
        layout: { background: { type: ColorType.Solid, color: '#0c1219' }, textColor: '#9caab8' },
        grid: { vertLines: { color: '#252f3f' }, horzLines: { color: '#252f3f' } },
        rightPriceScale: { borderColor: '#2d3a4d', scaleMargins: { top: 0.1, bottom: 0.1 } },
        timeScale: { borderColor: '#2d3a4d', timeVisible: true, secondsVisible: false },
        crosshair: {
          mode: CrosshairMode.Normal,
          vertLine: { color: 'rgba(34, 197, 94, 0.35)', style: LineStyle.Dashed },
          horzLine: { color: 'rgba(34, 197, 94, 0.35)', style: LineStyle.Dashed },
        },
      })
      chart.timeScale().subscribeVisibleLogicalRangeChange((range) => {
        if (range) macdChart.timeScale().setVisibleLogicalRange(range)
      })
      macdSeriesRef.current = macdChart.addLineSeries({
        color: '#38bdf8', lineWidth: 2, priceLineVisible: false, lastValueVisible: false,
      })
      signalSeriesRef.current = macdChart.addLineSeries({
        color: '#f59e0b', lineWidth: 1, priceLineVisible: false, lastValueVisible: false,
      })
      histogramSeriesRef.current = macdChart.addHistogramSeries({ priceLineVisible: false })
      macdChartRef.current = macdChart
    }

    // ── ATR ───────────────────────────────────────────────────────────────
    const atrChartEl = showAtr ? el.querySelector<HTMLDivElement>('[data-atr-chart]') : null 
    if (atrChartEl) { 
      const atrChart = createChart(atrChartEl, { 
        width: el.clientWidth || chartWidth,
        height: subPaneH,
        handleScroll: false,
        handleScale: false,
        layout: { background: { type: ColorType.Solid, color: '#0c1219' }, textColor: '#9caab8' },
        grid: { vertLines: { color: '#252f3f' }, horzLines: { color: '#252f3f' } },
        rightPriceScale: { borderColor: '#2d3a4d', scaleMargins: { top: 0.1, bottom: 0.1 } },
        timeScale: { borderColor: '#2d3a4d', timeVisible: true, secondsVisible: false },
        crosshair: {
          mode: CrosshairMode.Normal,
          vertLine: { color: 'rgba(34, 197, 94, 0.35)', style: LineStyle.Dashed },
          horzLine: { color: 'rgba(34, 197, 94, 0.35)', style: LineStyle.Dashed },
        },
      })
      chart.timeScale().subscribeVisibleLogicalRangeChange((range) => {
        if (range) atrChart.timeScale().setVisibleLogicalRange(range)
      })
      atrSeriesRef.current = atrChart.addHistogramSeries({
        priceFormat: { type: 'price', precision: 4 }, color: 'rgba(251, 146, 60, 0.5)',
      })
      atrChartRef.current = atrChart
    }

    // Measure actual container height in case CSS hasn't resolved yet 
    requestAnimationFrame(() => { 
      if (mainEl.clientHeight > 0 && mainEl.clientHeight !== realHeight) { 
        chart.applyOptions({ height: mainEl.clientHeight }) 
      } 
    }) 
 
    const ro = new ResizeObserver(() => { 
      const width = mainEl.clientWidth > 0 ? mainEl.clientWidth : el.clientWidth
      if (width > 0) { 
        chart.applyOptions({ width, height: mainEl.clientHeight }) 
        if (rsiChartRef.current) rsiChartRef.current.applyOptions({ width: el.clientWidth, height: subPaneH }) 
        if (macdChartRef.current) macdChartRef.current.applyOptions({ width: el.clientWidth, height: subPaneH }) 
        if (atrChartRef.current) atrChartRef.current.applyOptions({ width: el.clientWidth, height: subPaneH }) 
      } 
    }) 
    ro.observe(el) 
    ro.observe(mainEl)

    const readyRaf = requestAnimationFrame(() => setChartReadyTick((v) => v + 1))

    // fitContent is called in the data effect after setData — not here

    return () => { 
      cancelAnimationFrame(readyRaf) 
      if (hoverRafRef.current != null) { 
        cancelAnimationFrame(hoverRafRef.current) 
        hoverRafRef.current = null 
      } 
      if (hoverTimerRef.current != null) {
        clearTimeout(hoverTimerRef.current)
        hoverTimerRef.current = null
      }
      ro.disconnect() 
      chart.remove() 
      if (rsiChartRef.current) { rsiChartRef.current.remove(); rsiChartRef.current = null }
      if (macdChartRef.current) { macdChartRef.current.remove(); macdChartRef.current = null }
      if (atrChartRef.current) { atrChartRef.current.remove(); atrChartRef.current = null }
      chartRef.current = null
      candleRef.current = null; lineSeriesRef.current = null; areaSeriesRef.current = null
      baselineSeriesRef.current = null; volumeRef.current = null; maSeriesRefs.current = []
      rsiSeriesRef.current = null; macdSeriesRef.current = null; signalSeriesRef.current = null
      histogramSeriesRef.current = null; atrSeriesRef.current = null; vwapSeriesRef.current = null
      bbUpperRef.current = null; bbMiddleRef.current = null; bbLowerRef.current = null
      priceLineRef.current = null
    } 
    // eslint-disable-next-line react-hooks/exhaustive-deps 
  }, [open, containerEl, mainChartEl, initAttempt, showRsi, showMacd, showAtr]) 

  // ── Chart type ──────────────────────────────────────────────────────────

  useEffect(() => { 
    if (!open) return
    if (candleRef.current) candleRef.current.applyOptions({ visible: chartTypeState === 'candlestick' }) 
    if (lineSeriesRef.current) lineSeriesRef.current.applyOptions({ visible: chartTypeState === 'line' }) 
    if (areaSeriesRef.current) areaSeriesRef.current.applyOptions({ visible: chartTypeState === 'area' }) 
    if (baselineSeriesRef.current) baselineSeriesRef.current.applyOptions({ visible: chartTypeState === 'baseline' }) 

    const rowsSrc = barsRef.current
    if (rowsSrc.length > 0) {
      const closeRows = rowsSrc.map((b) => ({
        time: Math.floor(b.openTime / 1000) as UTCTimestamp,
        value: b.close,
      }))
      if (chartTypeState === 'line' && lineSeriesRef.current) lineSeriesRef.current.setData(closeRows)
      if (chartTypeState === 'area' && areaSeriesRef.current) areaSeriesRef.current.setData(closeRows)
      if (chartTypeState === 'baseline' && baselineSeriesRef.current) baselineSeriesRef.current.setData(closeRows)
    }
  }, [chartTypeState, open, chartReadyTick])  

  // ── Indicators ───────────────────────────────────────────────────────────

  useEffect(() => { 
    if (!open) return
    if (volumeRef.current) volumeRef.current.applyOptions({ visible: indicatorStateLocal.showVolume }) 
    if (vwapSeriesRef.current) vwapSeriesRef.current.applyOptions({ visible: showVwap }) 
    const bbVisible = showBollingerBands 
    if (bbUpperRef.current) bbUpperRef.current.applyOptions({ visible: bbVisible }) 
    if (bbMiddleRef.current) bbMiddleRef.current.applyOptions({ visible: bbVisible }) 
    if (bbLowerRef.current) bbLowerRef.current.applyOptions({ visible: bbVisible }) 
  }, [indicatorStateLocal.showVolume, showVwap, showBollingerBands, open, chartReadyTick])  

  // ── Data ────────────────────────────────────────────────────────────────

  useEffect(() => {  
    if (!open) return 
    const chart = chartRef.current  
    if (!chart || !candleRef.current || !lineSeriesRef.current || !areaSeriesRef.current ||  
        !baselineSeriesRef.current || !volumeRef.current) return  

    const t0 = perfNow()
    let path: 'empty' | 'incr' | 'set' = 'set'
 
    const hasVolume = bars.some((b) => b.volume > 0) && indicatorStateLocal.showVolume 
    const prevMeta = mainSeriesMetaRef.current 
 
    if (bars.length === 0) { 
      path = 'empty'
      candleRef.current.setData([]) 
      lineSeriesRef.current.setData([]) 
      areaSeriesRef.current.setData([]) 
      baselineSeriesRef.current.setData([]) 
      volumeRef.current.setData([]) 
      volumeRef.current.applyOptions({ visible: false }) 
      if (priceLineRef.current) { 
        candleRef.current.removePriceLine(priceLineRef.current) 
        priceLineRef.current = null 
      } 
      mainSeriesMetaRef.current = { len: 0, firstOpenTime: null, lastOpenTime: null } 
      perfAdd('chart.full.data', perfNow() - t0, { path, bars: 0 })
      return 
    } 
 
    const first = bars[0] 
    const last = bars[bars.length - 1] 
    const firstOpenTime = first?.openTime ?? null 
    const lastOpenTime = last?.openTime ?? null 
 
    const replacedWindow = 
      prevMeta.len > 0 && firstOpenTime != null && prevMeta.firstOpenTime != null && 
      firstOpenTime !== prevMeta.firstOpenTime 
 
    const canIncremental = 
      !replacedWindow && 
      prevMeta.len > 0 && 
      prevMeta.lastOpenTime != null && 
      lastOpenTime != null && 
      (bars.length === prevMeta.len || bars.length === prevMeta.len + 1) && 
      lastOpenTime >= prevMeta.lastOpenTime 
 
    if (canIncremental) { 
      path = 'incr'
      const sec = Math.floor(last.openTime / 1000) as UTCTimestamp 
      candleRef.current.update({ time: sec, open: last.open, high: last.high, low: last.low, close: last.close }) 
      const closePoint = { time: sec, value: last.close } 
      if (chartTypeState === 'line') lineSeriesRef.current.update(closePoint) 
      if (chartTypeState === 'area') areaSeriesRef.current.update(closePoint) 
      if (chartTypeState === 'baseline') baselineSeriesRef.current.update(closePoint) 
 
      if (hasVolume) { 
        const bullish = last.close >= last.open 
        volumeRef.current.applyOptions({ visible: true }) 
        volumeRef.current.update({ 
          time: sec, 
          value: last.volume, 
          color: bullish ? 'rgba(38, 166, 154, 0.45)' : 'rgba(239, 83, 80, 0.45)', 
        }) 
      } else { 
        volumeRef.current.applyOptions({ visible: false }) 
        volumeRef.current.setData([]) 
      } 
    } else { 
      path = 'set'
      const rows = bars.map((b) => ({ 
        time: Math.floor(b.openTime / 1000) as UTCTimestamp, 
        open: b.open, 
        high: b.high, 
        low: b.low, 
        close: b.close, 
      })) 
      candleRef.current.setData(rows) 
      const closeRows = rows.map((r) => ({ time: r.time, value: r.close })) 
      lineSeriesRef.current.setData(closeRows) 
      areaSeriesRef.current.setData(closeRows) 
      baselineSeriesRef.current.setData(closeRows) 
 
      volumeRef.current.applyOptions({ visible: hasVolume }) 
      volumeRef.current.setData(hasVolume ? marketKlinesToVolumeHistogramData(bars) : []) 
 
      if (rows.length > 0 && (prevMeta.len === 0 || replacedWindow)) chart.timeScale().fitContent() 
    } 
 
    candleRef.current.priceScale().applyOptions({ 
      scaleMargins: { top: 0.05, bottom: hasVolume ? 0.22 : 0.05 }, 
    }) 
 
    if (priceLineRef.current) { 
      priceLineRef.current.applyOptions({ price: last.close }) 
    } else { 
      priceLineRef.current = candleRef.current.createPriceLine({ 
        price: last.close, 
        color: 'rgba(34, 197, 94, 0.9)', 
        lineWidth: 1, 
        lineStyle: LineStyle.Dotted, 
        axisLabelVisible: true, 
        title: 'Last', 
      }) 
    } 
 
    mainSeriesMetaRef.current = { 
      len: bars.length, 
      firstOpenTime, 
      lastOpenTime, 
    } 

    perfAdd('chart.full.data', perfNow() - t0, { path, bars: bars.length, hasVolume })
  }, [bars, indicatorStateLocal.showVolume, open, chartReadyTick])   
 
  useEffect(() => { 
    if (!open) return
    const chart = chartRef.current 
    if (!chart) return 
    const t0 = perfNow()
    const arr = maSeriesRefs.current
    if (mas.length === 0) {
      if (arr.length > 0) {
        for (const s of arr) chart.removeSeries(s)
        maSeriesRefs.current = []
      }
      return
    }
    if (arr.length !== mas.length) {
      for (const s of arr) chart.removeSeries(s)
      const newArr: ISeriesApi<'Line'>[] = []
      for (const ma of mas) {
        newArr.push(chart.addLineSeries({
          color: ma.color, lineWidth: 1, priceLineVisible: false, lastValueVisible: false, title: ma.label,
        }))
      }
      maSeriesRefs.current = newArr
    }
    const maLines = computeMaLines(indicatorBars, mas)  
    for (let i = 0; i < maLines.length; i++) maSeriesRefs.current[i]?.setData(maLines[i].data)  
    perfAdd('chart.full.ind.ma', perfNow() - t0, { bars: indicatorBars.length, mas: mas.length })
  }, [indicatorBars, JSON.stringify(mas), open, chartReadyTick])  
 
  useEffect(() => { 
    if (!open) return
    if (!bbUpperRef.current || !bbMiddleRef.current || !bbLowerRef.current) return 
    const t0 = perfNow()
    if (!showBollingerBands) {
      bbUpperRef.current.setData([]); bbMiddleRef.current.setData([]); bbLowerRef.current.setData([])
      perfAdd('chart.full.ind.bb', perfNow() - t0, { bars: indicatorBars.length, on: false })
      return
    }
    const period = indicatorConfig.bollingerPeriod ?? DEFAULT_BOLLINGER_PERIOD
    const stdDev = indicatorConfig.bollingerStdDev ?? DEFAULT_BOLLINGER_STDDEV 
    const bb = computeBollingerBands(indicatorBars, period, stdDev)  
    bbUpperRef.current.setData(bb.upper); bbMiddleRef.current.setData(bb.middle); bbLowerRef.current.setData(bb.lower)  
    perfAdd('chart.full.ind.bb', perfNow() - t0, { bars: indicatorBars.length, on: true })
  }, [indicatorBars, showBollingerBands, indicatorConfig.bollingerPeriod, indicatorConfig.bollingerStdDev, open, chartReadyTick])  
 
  useEffect(() => { 
    if (!open) return
    if (!vwapSeriesRef.current) return 
    const t0 = perfNow()
    if (!showVwap) { 
      vwapSeriesRef.current.setData([])
      perfAdd('chart.full.ind.vwap', perfNow() - t0, { bars: indicatorBars.length, on: false })
      return
    } 
    vwapSeriesRef.current.setData(computeVwapLine(indicatorBars))  
    perfAdd('chart.full.ind.vwap', perfNow() - t0, { bars: indicatorBars.length, on: true })
  }, [indicatorBars, showVwap, open, chartReadyTick])  
 
  useEffect(() => {  
    if (!open) return 
    if (!rsiSeriesRef.current) return  
    const t0 = perfNow()
    if (!showRsi) { 
      rsiSeriesRef.current.setData([])
      perfAdd('chart.full.ind.rsi', perfNow() - t0, { bars: indicatorBars.length, on: false })
      return
    } 
    rsiSeriesRef.current.setData(computeRsiLine(indicatorBars, rsiPeriod))  
    perfAdd('chart.full.ind.rsi', perfNow() - t0, { bars: indicatorBars.length, on: true, period: rsiPeriod })
  }, [indicatorBars, rsiPeriod, showRsi, open, chartReadyTick])  
 
  useEffect(() => {  
    if (!open) return 
    if (!macdSeriesRef.current || !signalSeriesRef.current || !histogramSeriesRef.current) return  
    const t0 = perfNow()
    if (!showMacd) { 
      macdSeriesRef.current.setData([]) 
      signalSeriesRef.current.setData([]) 
      histogramSeriesRef.current.setData([]) 
      perfAdd('chart.full.ind.macd', perfNow() - t0, { bars: indicatorBars.length, on: false })
      return 
    } 
    const macdData = computeMacd(indicatorBars, DEFAULT_MACD_FAST, DEFAULT_MACD_SLOW, DEFAULT_MACD_SIGNAL)  
    macdSeriesRef.current.setData(macdData.macd)  
    signalSeriesRef.current.setData(macdData.signal)  
    histogramSeriesRef.current.setData(macdData.histogram)  
    perfAdd('chart.full.ind.macd', perfNow() - t0, { bars: indicatorBars.length, on: true })
  }, [indicatorBars, showMacd, open, chartReadyTick])  
 
  useEffect(() => {  
    if (!open) return 
    if (!atrSeriesRef.current) return  
    const t0 = perfNow()
    if (!showAtr) { 
      atrSeriesRef.current.setData([])
      perfAdd('chart.full.ind.atr', perfNow() - t0, { bars: indicatorBars.length, on: false })
      return
    } 
    const period = indicatorConfig.atrPeriod ?? DEFAULT_ATR_PERIOD  
    const atrData = computeAtrLine(indicatorBars, period) 
    atrSeriesRef.current.setData(  
      atrData.map((d) => ({ time: d.time, value: d.value, color: 'rgba(251, 146, 60, 0.5)' })),  
    )  
    perfAdd('chart.full.ind.atr', perfNow() - t0, { bars: indicatorBars.length, on: true, period })
  }, [indicatorBars, indicatorConfig.atrPeriod, showAtr, open, chartReadyTick])  
 
  useEffect(() => { 
    if (!open) return
    if (!candleRef.current) return 
    const t0 = perfNow()
    candleRef.current.setMarkers([]) 
    const markers = computeTradeMarkers(trades)
    if (markers.length > 0) {
      candleRef.current.setMarkers( 
        markers.map((m) => ({ time: m.time, position: m.position, color: m.color, shape: m.shape, text: m.text })), 
      ) 
    } 
    perfAdd('chart.full.markers', perfNow() - t0, { trades: trades.length, markers: markers.length })
  }, [trades, open, chartReadyTick]) 

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogOverlay className="bg-black/70 backdrop-blur-sm" />
      <DialogContent
        className="border-emerald-500/30 bg-[#0c1219] p-0"
        style={{ maxWidth: '96vw', width: '96vw', height: '90vh', maxHeight: '90vh', display: 'flex', flexDirection: 'column' }}
      > 
        <DialogTitle className="sr-only">{symbol ? `${symbol} Chart` : 'Chart'}</DialogTitle> 
        <div className="flex flex-col flex-1 min-h-0 overflow-hidden rounded-b-md"> 
          <ChartToolbar
            chartType={chartTypeState}
            onChartTypeChange={setChartTypeState}
            onToggleFullscreen={onClose}
            onZoomIn={handleZoomIn}
            onZoomOut={handleZoomOut}
            indicators={indicatorStateLocal}
            onToggleIndicator={(key) =>
              setIndicatorStateLocal((prev) => ({ ...prev, [key]: !prev[key] }))
            }
            symbol={symbol}
            isFullscreen={true}
          /> 
          <OhlcvLegend bar={activeBar} />  
          <div  
            ref={setContainerNode} 
            data-dialog-chart  
            className="flex flex-col flex-1 min-h-0 overflow-hidden rounded-b-md"  
            role="img"  
            aria-label="Fullscreen candlestick chart"  
          >  
            <div ref={setMainChartNode} className="flex-1 min-h-0" /> 
            <div  
              data-rsi-chart  
              className="border-t border-border/40"  
              style={{ height: subPaneH, marginTop: 8, display: indicatorStateLocal.showRsi ? 'block' : 'none' }} 
            />
            <div
              data-macd-chart
              className="border-t border-border/40"
              style={{ height: subPaneH, marginTop: 8, display: indicatorStateLocal.showMacd ? 'block' : 'none' }}
            />
            <div
              data-atr-chart
              className="border-t border-border/40"
              style={{ height: subPaneH, marginTop: 8, display: indicatorStateLocal.showAtr ? 'block' : 'none' }}
            />
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

export function MarketCandlestickChart({ 
  bars,
  height,
  className,
  trades = [],
  indicatorConfig = {},
  showToolbar = true,
  defaultChartType = 'candlestick',
  showOhlcvLegend = true,
  symbol,
}: MarketCandlestickChartProps) { 
  const [isFullscreen, setIsFullscreen] = useState(false) 
  const [activeBar, setActiveBar] = useState<OhlcvPoint | null>(null)
  const [chartType, setChartType] = useState<ChartType>(defaultChartType)
  const [indicatorState, setIndicatorState] = useState<IndicatorState>({
    showMa: indicatorConfig.showMa ?? false,
    showRsi: indicatorConfig.showRsi ?? false,
    showMacd: indicatorConfig.showMacd ?? false,
    showAtr: indicatorConfig.showAtr ?? false,
    showBollingerBands: indicatorConfig.showBollingerBands ?? false,
    showVwap: indicatorConfig.showVwap ?? false,
    showVolume: true,
  })

  const handleToggleFullscreen = useCallback(() => {
    setIsFullscreen((v) => !v)
  }, [])

  const handleToggleIndicator = useCallback((key: keyof IndicatorState) => {
    setIndicatorState((prev) => ({ ...prev, [key]: !prev[key] }))
  }, [])

  const chartApiRef = useRef<IChartApi | null>(null)
  const setChartApiRef: React.RefCallback<IChartApi> = useCallback((node) => {
    chartApiRef.current = node
  }, [])

  const handleZoomIn = useCallback(() => {
    const chart = chartApiRef.current
    if (!chart) return
    const range = chart.timeScale().getVisibleLogicalRange()
    if (!range) return
    const center = (range.from + range.to) / 2
    const span = (range.to - range.from) * 0.7
    chart.timeScale().setVisibleLogicalRange({ from: center - span / 2, to: center + span / 2 })
  }, [])

  const handleZoomOut = useCallback(() => {
    const chart = chartApiRef.current
    if (!chart) return
    const range = chart.timeScale().getVisibleLogicalRange()
    if (!range) return
    const center = (range.from + range.to) / 2
    const span = (range.to - range.from) * 1.4
    chart.timeScale().setVisibleLogicalRange({
      from: Math.max(0, center - span / 2),
      to: center + span / 2,
    })
  }, [])

  return ( 
    <div className={cn('relative flex flex-col', className)}> 
      <ChartContent 
        bars={bars} 
        height={height} 
        trades={trades} 
        indicatorConfig={indicatorConfig} 
        indicatorState={indicatorState} 
        chartType={chartType} 
        symbol={symbol} 
        showToolbar={showToolbar} 
        showOhlcvLegend={showOhlcvLegend} 
        activeBar={activeBar} 
        setActiveBar={setActiveBar} 
        onChartTypeChange={setChartType} 
        onZoomIn={handleZoomIn}
        onZoomOut={handleZoomOut}
        onToggleIndicator={handleToggleIndicator}
        onCloseFullscreen={handleToggleFullscreen}
        onChartApiRef={setChartApiRef}
        paused={isFullscreen} 
      /> 
 
      {isFullscreen ? ( 
        <FullscreenChartDialog 
          open={isFullscreen} 
          onClose={() => setIsFullscreen(false)} 
          bars={bars} 
          trades={trades} 
          indicatorConfig={indicatorConfig} 
          indicatorState={indicatorState} 
          chartType={chartType} 
          symbol={symbol} 
        /> 
      ) : null} 
    </div> 
  ) 
} 
