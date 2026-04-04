'use client'

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react'

function useIsMobile(threshold = 768) {
  const [isMobile, setIsMobile] = useState(false)
  useEffect(() => {
    const mq = window.matchMedia(`(max-width: ${threshold - 1}px)`)
    setIsMobile(mq.matches)
    const handler = (e: MediaQueryListEvent) => setIsMobile(e.matches)
    mq.addEventListener('change', handler)
    return () => mq.removeEventListener('change', handler)
  }, [threshold])
  return isMobile
}
import dynamic from 'next/dynamic'
import type { Monaco } from '@monaco-editor/react'
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type MonacoEditorType = any
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { SimpleTooltip } from '@/components/ui/simple-tooltip'
import { Skeleton } from '@/components/ui/skeleton'
import { Switch } from '@/components/ui/switch'
import { useThemeStore } from '@/store/theme.store'
import {
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Code2,
  Copy,
  Download,
  Braces,
  GripVertical,
  Hash,
  Keyboard,
  Loader2,
  Maximize,
  Minimize,
  PanelLeft,
  Play,
  CirclePlus,
  Replace,
  Save,
  Search,
  Terminal,
  Wand2,
  XCircle,
} from 'lucide-react'

const Editor = dynamic(() => import('@monaco-editor/react'), {
  ssr: false,
  loading: () => <Skeleton className="h-full w-full" />,
})

export interface ValidationResult {
  valid: boolean
  error?: string
  signal?: string
  confidence?: number
}

export interface BacktestResult {
  metrics: {
    totalTrades: number
    winRate: number | null
    netPnl: number
    maxDrawdown: number
    finalBalance: number
    averageWin: number | null
  }
  trades: Array<{
    id: number
    side: string
    entryPrice: number
    exitPrice: number | null
    netPnl: number | null
  }>
}

export interface CodeEditorProps {
  value: string
  onChange: (value: string) => void
  onSave?: () => Promise<void>
  onValidate?: () => Promise<ValidationResult | void>
  onRunPreview?: () => Promise<void>
  validationResult?: ValidationResult | null
  previewResult?: BacktestResult | null | undefined
  isValidating?: boolean
  isSaving?: boolean
  isPreviewLoading?: boolean
  readOnly?: boolean
  language?: string
  name?: string
  /** Called from mobile toolbar to open the strategy details sheet/drawer */
  onOpenMetaPanel?: () => void
}

// Use refs for callbacks to avoid stale closures
function useCallbackRef<T extends (...args: unknown[]) => unknown>(fn: T | undefined): React.MutableRefObject<T | undefined> {
  const ref = useRef<T>(undefined)
  ref.current = fn as T
  return ref
}

function useIsDark(): boolean {
  const theme = useThemeStore((s) => s.theme)
  return theme === 'dark'
}

// ─── Strategy API Reference ────────────────────────────────────────────────

const REFERENCE_SECTIONS = [
  {
    title: 'indicators',
    icon: '📊',
    items: [
      {
        name: 'indicators.sma(values, period)',
        signature: '(values: number[], period: number) => number',
        desc: 'Simple Moving Average — average of last N closing prices.',
        example: "const ma = indicators.sma(closes, 20);",
      },
      {
        name: 'indicators.rsi(closes, period)',
        signature: '(closes: number[], period: number) => number',
        desc: 'Relative Strength Index — momentum oscillator (0–100).',
        example: "const rsi = indicators.rsi(closes, 14);",
      },
      {
        name: 'indicators.ema(values, period)',
        signature: '(values: number[], period: number) => number',
        desc: 'Exponential Moving Average — weighted average with recent bias.',
        example: "const ema = indicators.ema(closes, 12);",
      },
      {
        name: 'indicators.macd(closes)',
        signature: '(closes: number[], fp?, sp?, sig?) => { macd, signal, histogram }',
        desc: 'MACD — (12, 26, 9 by default). Histogram = MACD − Signal.',
        example: "const m = indicators.macd(closes);\nif (m.histogram > 0) signal('BUY', 0.7, 'MACD bullish');",
      },
      {
        name: 'indicators.bollingerBands(values)',
        signature: '(values: number[], period?, stdDev?) => { upper, middle, lower }',
        desc: 'Bollinger Bands — volatility channel around SMA.',
        example: "const bb = indicators.bollingerBands(closes, 20, 2);\nif (close > bb.upper) signal('BUY', 0.8, 'Breakout');",
      },
    ],
  },
  {
    title: 'context',
    icon: '🧠',
    items: [
      {
        name: 'context.symbol',
        signature: 'string',
        desc: 'Trading pair symbol, e.g. "BTCUSDT".',
        example: 'if (context.symbol === "BTCUSDT") { ... }',
      },
      {
        name: 'context.interval',
        signature: 'string',
        desc: 'Candle interval, e.g. "1h", "4h", "1d".',
        example: 'const is1h = context.interval === "1h";',
      },
      {
        name: 'context.candles',
        signature: 'Array<{ open, high, low, close, volume, timestamp }>',
        desc: 'Historical OHLCV candles. Index 0 = oldest, last = most recent.',
        example: "const closes = context.candles.map(c => c.close);\nconst latest = closes[closes.length - 1];",
      },
      {
        name: 'context.position',
        signature: "'long' | 'short' | null",
        desc: 'Current open position. null = no position.',
        example: "if (context.position === null) signal('BUY', 0.8, 'No position');",
      },
      {
        name: 'context.balance',
        signature: 'number',
        desc: 'Current account balance in quote currency.',
        example: "const size = context.balance * 0.1; // 10% of balance",
      },
      {
        name: 'context.entryPrice',
        signature: 'number | null',
        desc: 'Entry price of current position. null if flat.',
        example: "const pnl = (current - context.entryPrice) / context.entryPrice;",
      },
    ],
  },
  {
    title: 'signal()',
    icon: '📡',
    items: [
      {
        name: 'signal(action, confidence, reason)',
        signature: "(action: 'BUY' | 'SELL' | 'HOLD', confidence: 0-1, reason?: string) => void",
        desc: 'Call once per tick to emit a trading signal. Only the first call is used.',
        example: "signal('BUY', 0.85, 'RSI oversold + MACD crossover');\nsignal('SELL', 0.6, 'RSI overbought');\nsignal('HOLD', 0.1, 'No conditions met');",
      },
    ],
  },
  {
    title: 'Quick examples',
    icon: '⚡',
    items: [
      {
        name: 'SMA Crossover',
        signature: 'trend-following',
        desc: 'Buy when short MA crosses above long MA.',
        example: `// SMA Crossover
const short = indicators.sma(context.candles.map(c=>c.close), 10);
const long  = indicators.sma(context.candles.map(c=>c.close), 30);
const prev  = context.candles.slice(0,-1).map(c=>c.close);
const ps = indicators.sma(prev, 10), pl = indicators.sma(prev, 30);
if (ps <= pl && short > long && context.position !== 'long')
  signal('BUY', 0.8, 'MA crossover');
else if (ps >= pl && short < long && context.position !== 'short')
  signal('SELL', 0.8, 'MA crossover down');
else signal('HOLD', 0.1, 'No signal');`,
      },
      {
        name: 'RSI Mean Reversion',
        signature: 'mean-reversion',
        desc: 'Buy oversold, sell overbought.',
        example: `const rsi = indicators.rsi(context.candles.map(c=>c.close), 14);
if (rsi < 30) signal('BUY', 0.7, \`RSI=\${rsi.toFixed(1)} oversold\`);
else if (rsi > 70) signal('SELL', 0.7, \`RSI=\${rsi.toFixed(1)} overbought\`);
else signal('HOLD', 0.5, \`RSI=\${rsi.toFixed(1)} neutral\`);`,
      },
      {
        name: 'MACD Momentum',
        signature: 'momentum',
        desc: 'Buy when MACD line crosses above signal line.',
        example: `const m = indicators.macd(context.candles.map(c=>c.close));
if (m.histogram > 0 && context.position !== 'long')
  signal('BUY', 0.75, 'MACD bullish');
else if (m.histogram < 0 && context.position !== 'short')
  signal('SELL', 0.75, 'MACD bearish');
else signal('HOLD', 0.2, 'No momentum signal');`,
      },
    ],
  },
]

// ─── Template snippets for toolbar ──────────────────────────────────────────

const SNIPPET_TEMPLATES = [
  { label: 'SMA Crossover', snippet: `// SMA Crossover Strategy
const short = indicators.sma(context.candles.map(c => c.close), 10);
const long  = indicators.sma(context.candles.map(c => c.close), 30);
const prev  = context.candles.slice(0, -1).map(c => c.close);
const ps = indicators.sma(prev, 10), pl = indicators.sma(prev, 30);

if (ps <= pl && short > long && context.position !== 'long') {
  signal('BUY', 0.8, 'MA crossover bullish');
} else if (ps >= pl && short < long && context.position !== 'short') {
  signal('SELL', 0.8, 'MA crossover bearish');
} else {
  signal('HOLD', 0.1, 'No crossover');
}
` },
  { label: 'RSI Mean Reversion', snippet: `// RSI Mean Reversion
const rsi = indicators.rsi(context.candles.map(c => c.close), 14);
if (Number.isNaN(rsi)) { signal('HOLD', 0.1, 'RSI not ready'); return; }
if (rsi < 30) signal('BUY', 0.7, \`RSI=\${rsi.toFixed(1)} oversold (<30)\`);
else if (rsi > 70) signal('SELL', 0.7, \`RSI=\${rsi.toFixed(1)} overbought (>70)\`);
else signal('HOLD', 0.5, \`RSI=\${rsi.toFixed(1)} neutral\`);
` },
  { label: 'MACD Momentum', snippet: `// MACD Momentum Strategy
const closes = context.candles.map(c => c.close);
const m = indicators.macd(closes, 12, 26, 9);
const prev = indicators.macd(closes.slice(0, -1), 12, 26, 9);
const prevHist = prev.macd - prev.signal;
const currHist = m.macd - m.signal;

if (prevHist <= 0 && currHist > 0 && context.position !== 'long')
  signal('BUY', 0.75, \`MACD crossed above signal (h=\${currHist.toFixed(4)})\`);
else if (prevHist >= 0 && currHist < 0 && context.position !== 'short')
  signal('SELL', 0.75, \`MACD crossed below signal (h=\${currHist.toFixed(4)})\`);
else
  signal('HOLD', 0.2, \`Histogram: \${currHist.toFixed(4)}\`);
` },
  { label: 'Bollinger Breakout', snippet: `// Bollinger Bands Breakout
const closes = context.candles.map(c => c.close);
const latest = closes[closes.length - 1];
const bb = indicators.bollingerBands(closes, 20, 2);
if (latest > bb.upper && context.position !== 'long')
  signal('BUY', 0.7, \`Breakout above BB upper (\${bb.upper.toFixed(2)})\`);
else if (latest < bb.lower && context.position !== 'short')
  signal('SELL', 0.7, \`Breakdown below BB lower (\${bb.lower.toFixed(2)})\`);
else
  signal('HOLD', 0.3, \`Price within bands\`);
` },
  { label: 'EMA Trend + RSI Filter', snippet: `// EMA Trend with RSI Confirmation
const ema9  = indicators.ema(context.candles.map(c => c.close), 9);
const ema21 = indicators.ema(context.candles.map(c => c.close), 21);
const rsi   = indicators.rsi(context.candles.map(c => c.close), 14);

const bullish = ema9 > ema21;
const rsiConfirm = rsi < 50; // RSI below 50 confirms bullish

if (bullish && rsiConfirm && context.position !== 'long')
  signal('BUY', 0.85, \`EMA bullish + RSI \${rsi.toFixed(1)} < 50\`);
else if (!bullish && context.position !== 'short')
  signal('SELL', 0.8, 'EMA bearish');
else
  signal('HOLD', 0.2, 'No entry');
` },
]

// ─── Main CodeEditor component ──────────────────────────────────────────────

export function CodeEditor({
  value,
  onChange,
  onSave,
  onValidate,
  onRunPreview,
  validationResult,
  previewResult,
  isValidating = false,
  isSaving = false,
  isPreviewLoading = false,
  readOnly = false,
  language = 'javascript',
  name = 'strategy.js',
  onOpenMetaPanel,
}: CodeEditorProps) {
  const isDark = useIsDark()
  const isMobile = useIsMobile()
  const [localValue, setLocalValue] = useState(value)
  const [cursorPos, setCursorPos] = useState({ line: 1, col: 1 })
  const [lineCount, setLineCount] = useState(1)
  const [autoFormat, setAutoFormat] = useState(true)
  // Always true by default; on mobile, the sidebar is hidden (shown via sheet instead)
  const [showSidebar, setShowSidebar] = useState(true)
  const [showConsole, setShowConsole] = useState(false)
  const [showTemplates, setShowTemplates] = useState(false)
  const [showKeyboard, setShowKeyboard] = useState(false)
  const [showFind, setShowFind] = useState(false)
  const [findQuery, setFindQuery] = useState('')
  const [replaceQuery, setReplaceQuery] = useState('')
  const [activeSection, setActiveSection] = useState<string | null>(null)
  // Incremented on sidebar toggle to force Monaco remount (fixes layout calculation)
  const [sidebarKey, setSidebarKey] = useState(0)

  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const editorRef = useRef<MonacoEditorType | null>(null)
  const monacoRef = useRef<Monaco | null>(null)
  const decorationsRef = useRef<string[]>([])

  // Keep latest callbacks in refs to avoid stale closures
  const onSaveRef = useCallbackRef(onSave)
  const onValidateRef = useCallbackRef(onValidate)
  const onRunPreviewRef = useCallbackRef(onRunPreview)

  // Ref to prevent [value] sync from clobbering a snippet insert in-flight
  const isInsertingSnippet = useRef(false)

  // Sync external value changes — but skip when a snippet insert is pending
  useEffect(() => {
    if (isInsertingSnippet.current) return
    setLocalValue(value)
  }, [value])

  // Cleanup debounce on unmount
  useEffect(() => {
    return () => {
      if (debounceTimer.current) clearTimeout(debounceTimer.current)
    }
  }, [])

  // Sync Monaco theme with app theme
  useEffect(() => {
    if (!editorRef.current || !monacoRef.current) return
    const theme = isDark ? 'vs-dark' : 'vs'
    monacoRef.current.editor.setTheme(theme)
  }, [isDark])

  const handleChange = useCallback(
    (newValue: string | undefined) => {
      const v = newValue ?? ''
      setLocalValue(v)
      if (debounceTimer.current) clearTimeout(debounceTimer.current)
      debounceTimer.current = setTimeout(() => {
        onChange(v)
      }, 800)
    },
    [onChange],
  )

  // Inline mount handler (passed directly to Editor onMount — avoids stale closure issues)
  function onEditorMount(editor: MonacoEditorType, monaco: Monaco) {
    editorRef.current = editor
    monacoRef.current = monaco

    // Track cursor position
    editor.onDidChangeCursorPosition((e: { position: { lineNumber: number; column: number } }) => {
      setCursorPos({ line: e.position.lineNumber, col: e.position.column })
      setLineCount(editor.getModel()?.getLineCount() ?? 1)
    })

    // Keyboard shortcuts using refs (always fresh)
    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS, () => {
      if (onSaveRef.current && !isSaving) onSaveRef.current()
    })
    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyMod.Shift | monaco.KeyCode.KeyF, () => {
      if (onValidateRef.current && !isValidating) onValidateRef.current()
    })
    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyF, () => {
      setShowFind((v) => !v)
    })
    editor.addCommand(
      monaco.KeyMod.CtrlCmd | monaco.KeyMod.Shift | monaco.KeyCode.KeyR,
      () => { setShowFind((v) => !v) },
    )
    editor.addCommand(
      monaco.KeyMod.CtrlCmd | monaco.KeyMod.Shift | monaco.KeyCode.KeyP,
      () => { if (onRunPreviewRef.current) onRunPreviewRef.current() },
    )
    editor.addCommand(
      monaco.KeyMod.CtrlCmd | monaco.KeyCode.Tab,
      () => { editor.trigger('keyboard', 'editor.action.formatDocument', null) },
    )

    // Add strategy API type definitions for IntelliSense autocomplete
    monaco.languages.typescript.javascriptDefaults.addExtraLib(
      `
      declare const indicators: {
        sma(values: number[], period: number): number
        rsi(closes: number[], period: number): number
        ema(values: number[], period: number): number
        macd(closes: number[], fastPeriod?: number, slowPeriod?: number, signalPeriod?: number): { macd: number; signal: number; histogram: number }
        bollingerBands(values: number[], period?: number, stdDevMultiplier?: number): { upper: number; middle: number; lower: number }
      }
      declare const context: {
        symbol: string
        interval: string
        candles: Array<{ timestamp: number; open: number; high: number; low: number; close: number; volume: number }>
        position: 'long' | 'short' | null
        balance: number
        entryPrice: number | null
      }
      declare function signal(action: 'BUY' | 'SELL' | 'HOLD', confidence: number, reason?: string): void
      `,
      'strategy-api.d.ts',
    )
    monaco.languages.typescript.javascriptDefaults.setDiagnosticsOptions({
      noSemanticValidation: false,
      noSyntaxValidation: false,
    })
    monaco.languages.typescript.javascriptDefaults.setCompilerOptions({
      target: monaco.languages.typescript.ScriptTarget.ES2020,
      allowNonTsExtensions: true,
      checkJs: true,
    })
  }

  // Auto-format on save
  const handleSaveWithFormat = useCallback(async () => {
    if (!onSave) return
    if (autoFormat && editorRef.current) {
      editorRef.current.getAction('editor.action.formatDocument')?.run()
    }
    await onSave()
  }, [onSave, autoFormat])

  // Insert template snippet
  const insertSnippet = useCallback(
    (snippet: string) => {
      if (!editorRef.current) return
      const editor = editorRef.current
      const selection = editor.getSelection()
      const range = selection ?? editor.getModel()?.getFullModelRange()
      if (range) {
        isInsertingSnippet.current = true
        editor.executeEdits('snippet-insert', [
          {
            range,
            text: snippet,
            forceMoveMarkers: true,
          },
        ])
        const newValue = editor.getValue()
        setLocalValue(newValue)
        onChange(newValue)
        // Reset flag after a tick so the next external value change syncs normally
        setTimeout(() => { isInsertingSnippet.current = false }, 0)
      }
      setShowTemplates(false)
    },
    [onChange],
  )

  // Find & Replace
  const highlightMatches = useCallback(() => {
    if (!editorRef.current || !monacoRef.current || !findQuery) {
      decorationsRef.current = editorRef.current?.deltaDecorations(decorationsRef.current, []) ?? []
      return
    }
    const model = editorRef.current.getModel()
    if (!model) return
    const matches = model.findMatches(findQuery, false, false, false, null, true)
    decorationsRef.current = editorRef.current.deltaDecorations(decorationsRef.current, [
      ...(matches as Array<{ range: { startLineNumber: number; startColumn: number; endLineNumber: number; endColumn: number } }>).map((m) => ({
        range: m.range,
        options: {
          className: 'bg-yellow-500/30 border border-yellow-500/50 rounded-sm',
          hoverMessage: { value: findQuery },
        },
      })),
    ])
  }, [findQuery])

  useEffect(() => {
    highlightMatches()
  }, [highlightMatches])

  const handleReplace = useCallback(() => {
    if (!editorRef.current || !findQuery) return
    const editor = editorRef.current
    const model = editor.getModel()
    if (!model) return
    const matches = model.findMatches(findQuery, false, false, false, null, true)
    if (matches.length > 0) {
      editor.executeEdits('replace-all', [
        {
          range: matches[0].range,
          text: replaceQuery,
          forceMoveMarkers: true,
        },
      ])
      setLocalValue(editor.getValue())
      onChange(editor.getValue())
    }
  }, [findQuery, replaceQuery, onChange])

  const copyCode = useCallback(() => {
    navigator.clipboard.writeText(localValue)
  }, [localValue])

  const downloadCode = useCallback(() => {
    const blob = new Blob([localValue], { type: 'text/javascript' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = name
    a.click()
    URL.revokeObjectURL(url)
  }, [localValue, name])

  const hasErrors = validationResult && !validationResult.valid

  return (
    <div className="flex h-full flex-col overflow-hidden">
      {/* ── Top Toolbar ─────────────────────────────────────────────── */}
      <div className="flex flex-shrink-0 items-center justify-between gap-2 border-b border-border/60 bg-muted/30 px-3 py-1.5">
        {/* Left: file info */}
        <div className="flex items-center gap-2 min-w-0">
          <Code2 className="h-4 w-4 flex-shrink-0 text-muted-foreground" />
          <span className="truncate text-sm font-medium">{name}</span>
          <Badge variant="outline" className="hidden text-xs font-normal sm:inline-flex">
            {language}
          </Badge>
          {validationResult && (
            <span
              className={`flex items-center gap-1 flex-shrink-0 text-xs font-medium ${
                validationResult.valid ? 'text-emerald-400' : 'text-destructive'
              }`}
            >
              {validationResult.valid ? (
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
              ) : (
                <span className="h-1.5 w-1.5 rounded-full bg-destructive" />
              )}
              <span className="hidden sm:inline">{validationResult.valid ? 'Valid' : 'Error'}</span>
            </span>
          )}
        </div>

        {/* Right: action buttons — scroll horizontally on mobile */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden flex-shrink-0">
          {/* Template picker */}
          <div className="relative">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setShowTemplates((v) => !v)
                setShowKeyboard(false)
                setShowFind(false)
              }}
              className="h-8 gap-1 text-xs cursor-pointer"
            >
              <Wand2 className="h-3.5 w-3.5" />
              Snippets
              <ChevronDown className="h-3 w-3" />
            </Button>
            {showTemplates && (
              <div className="absolute left-0 top-full z-50 mt-1 w-64 rounded-lg border border-border/80 bg-popover shadow-xl">
                <div className="p-1">
                  {SNIPPET_TEMPLATES.map((t) => (
                    <button
                      key={t.label}
                      onClick={() => insertSnippet(t.snippet)}
                      className="w-full rounded-md px-3 py-2 text-left text-xs hover:bg-muted/70 cursor-pointer transition-colors"
                    >
                      <span className="block font-medium">{t.label}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Find */}
          <Button
            variant={showFind ? 'secondary' : 'ghost'}
            size="sm"
            onClick={() => {
              setShowFind((v) => !v)
              setShowTemplates(false)
              setShowKeyboard(false)
            }}
            className="h-8 gap-1 text-xs cursor-pointer"
          >
            <Search className="h-3.5 w-3.5" />
            Find
          </Button>

          {/* Keyboard shortcuts */}
          <Button
            variant={showKeyboard ? 'secondary' : 'ghost'}
            size="sm"
            onClick={() => {
              setShowKeyboard((v) => !v)
              setShowTemplates(false)
              setShowFind(false)
            }}
            className="h-8 gap-1 text-xs cursor-pointer"
          >
            <Keyboard className="h-3.5 w-3.5" />
          </Button>

          {/* Mobile: open strategy details sheet */}
          {onOpenMetaPanel && (
            <Button
              variant="ghost"
              size="sm"
              onClick={onOpenMetaPanel}
              className="h-8 w-8 gap-1 p-0 cursor-pointer md:hidden"
              title="Strategy details"
            >
              <PanelLeft className="h-3.5 w-3.5" />
            </Button>
          )}

          {/* Sidebar toggle */}
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setShowSidebar((v) => !v)
              setSidebarKey((k) => k + 1)
            }}
            className="h-8 gap-1 text-xs cursor-pointer hidden md:flex"
            title="Toggle API reference"
          >
            {showSidebar ? (
              <ChevronRight className="h-3.5 w-3.5" />
            ) : (
              <ChevronLeft className="h-3.5 w-3.5" />
            )}
            <span className="hidden lg:inline">API Ref</span>
          </Button>

          {/* Console toggle */}
          <Button
            variant={showConsole ? 'secondary' : 'ghost'}
            size="sm"
            onClick={() => setShowConsole((v) => !v)}
            className="h-8 gap-1 text-xs cursor-pointer"
            title="Toggle output console"
          >
            <Terminal className="h-3.5 w-3.5" />
            <span className="hidden lg:inline">Output</span>
            {previewResult && <span className="ml-1 h-1.5 w-1.5 rounded-full bg-emerald-400" />}
          </Button>

          <div className="h-4 w-px bg-border/50" />

          {/* Auto-format toggle */}
          <SimpleTooltip content="Auto-format on save (Ctrl+S)">
            <div className="flex items-center gap-1.5">
              <Switch
                checked={autoFormat}
                onCheckedChange={setAutoFormat}
                id="auto-format"
                className="h-4 w-7"
              />
              <label htmlFor="auto-format" className="text-xs text-muted-foreground hidden lg:inline">
                Format
              </label>
            </div>
          </SimpleTooltip>

          <div className="h-4 w-px bg-border/50" />

          {/* Copy */}
          <SimpleTooltip content="Copy code">
            <Button variant="ghost" size="sm" onClick={copyCode} className="h-8 w-8 p-0 cursor-pointer">
              <Copy className="h-3.5 w-3.5" />
            </Button>
          </SimpleTooltip>

          {/* Download */}
          <SimpleTooltip content="Download">
            <Button variant="ghost" size="sm" onClick={downloadCode} className="h-8 w-8 p-0 cursor-pointer">
              <Download className="h-3.5 w-3.5" />
            </Button>
          </SimpleTooltip>

          <div className="h-4 w-px bg-border/50" />

          {/* Validate */}
          {onValidate && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => void onValidate?.()}
              disabled={isValidating || readOnly}
              className="h-8 gap-1.5 text-xs cursor-pointer"
            >
              {isValidating ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Wand2 className="h-3.5 w-3.5" />
              )}
              Validate
              <kbd className="ml-1 hidden rounded bg-muted/60 px-1 py-0.5 text-[10px] font-mono lg:inline">
                ⇧F
              </kbd>
            </Button>
          )}

          {/* Preview */}
          {onRunPreview && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => void onRunPreview?.()}
              disabled={isPreviewLoading || readOnly}
              className="h-8 gap-1.5 text-xs cursor-pointer"
            >
              {isPreviewLoading ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Play className="h-3.5 w-3.5" />
              )}
              Preview
              <kbd className="ml-1 hidden rounded bg-muted/60 px-1 py-0.5 text-[10px] font-mono lg:inline">
                ⇧P
              </kbd>
            </Button>
          )}

          {/* Save */}
          {onSave && (
            <Button
              variant="default"
              size="sm"
              onClick={() => void handleSaveWithFormat()}
              disabled={isSaving || readOnly}
              className="h-8 gap-1.5 text-xs cursor-pointer"
            >
              {isSaving ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Save className="h-3.5 w-3.5" />
              )}
              {isSaving ? 'Saving…' : 'Save'}
              <kbd className="ml-1 hidden rounded bg-white/20 px-1 py-0.5 text-[10px] font-mono lg:inline">
                ⌘S
              </kbd>
            </Button>
          )}
        </div>
      </div>

      {/* ── Find & Replace Bar ───────────────────────────────────────── */}
      {showFind && (
        <div className="flex flex-shrink-0 items-center gap-2 border-b border-border/60 bg-muted/20 px-3 py-1.5">
          <div className="relative flex-1">
            <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <input
              autoFocus
              value={findQuery}
              onChange={(e) => setFindQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') highlightMatches()
              }}
              placeholder="Find…"
              className="h-7 w-full rounded border border-border/60 bg-background pl-8 pr-3 text-xs focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </div>
          <Replace className="h-3.5 w-3.5 flex-shrink-0 text-muted-foreground" />
          <input
            value={replaceQuery}
            onChange={(e) => setReplaceQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleReplace()
            }}
            placeholder="Replace…"
            className="h-7 w-40 rounded border border-border/60 bg-background px-2 text-xs focus:outline-none focus:ring-1 focus:ring-primary"
          />
          <Button variant="ghost" size="sm" onClick={highlightMatches} className="h-7 px-2 text-xs cursor-pointer">
            Find
          </Button>
          <Button variant="ghost" size="sm" onClick={handleReplace} disabled={!findQuery} className="h-7 px-2 text-xs cursor-pointer">
            Replace
          </Button>
          <Button variant="ghost" size="sm" onClick={() => setShowFind(false)} className="h-7 w-7 p-0 cursor-pointer">
            <XCircle className="h-3.5 w-3.5" />
          </Button>
        </div>
      )}

      {/* ── Error Banner ─────────────────────────────────────────────── */}
      {hasErrors && (
        <div className="flex-shrink-0 border-b border-destructive/30 bg-destructive/10 px-3 py-2">
          <p className="text-xs font-medium text-destructive">
            ✕ {validationResult.error ?? 'Validation failed'}
          </p>
        </div>
      )}

      {/* ── Main Content ───────────────────────────────────────────────── */}
      <div className="flex min-h-0 min-w-0 flex-1 overflow-hidden">
        {/* Editor */}
        <div className="min-h-0 min-w-0 flex-1 overflow-hidden">
          <Editor
            key={sidebarKey}
            height="100%"
            language={language}
            value={localValue}
            theme={isDark ? 'vs-dark' : 'vs'}
            onChange={handleChange}
            onMount={onEditorMount}
            options={{
              readOnly,
              minimap: { enabled: false },
              fontSize: isMobile ? 11 : 13,
              fontFamily: "'JetBrains Mono', 'Fira Code', 'Cascadia Code', monospace",
              fontLigatures: true,
              lineNumbers: 'on',
              glyphMargin: false,
              folding: true,
              foldingStrategy: 'indentation',
              scrollBeyondLastLine: false,
              renderLineHighlight: 'gutter',
              tabSize: 2,
              wordWrap: 'on',
              automaticLayout: true,
              padding: { top: isMobile ? 6 : 12, bottom: isMobile ? 6 : 12 },
              scrollbar: {
                verticalScrollbarSize: 6,
                horizontalScrollbarSize: 6,
              },
              bracketPairColorization: { enabled: true },
              autoClosingBrackets: 'always',
              autoClosingQuotes: 'always',
              autoIndent: 'full',
              formatOnPaste: true,
              formatOnType: autoFormat,
              suggest: {
                showKeywords: true,
                showSnippets: true,
                showFunctions: true,
                showVariables: true,
                showClasses: true,
              },
              quickSuggestions: {
                other: true,
                comments: false,
                strings: false,
              },
              parameterHints: { enabled: true },
              wordBasedSuggestions: 'currentDocument',
              occurrencesHighlight: 'singleFile',
              selectionHighlight: true,
              matchBrackets: 'always',
              cursorBlinking: 'smooth',
              cursorSmoothCaretAnimation: 'on',
              smoothScrolling: true,
              mouseWheelZoom: true,
              contextmenu: true,
            }}
          />
        </div>

        {/* ── Right: Sidebar + Console ─────────────────────────────────── */}
        {showSidebar && !isMobile && (
          <div className="flex min-h-0 w-72 flex-shrink-0 flex-col border-l border-border/40 bg-muted/5">
            {/* Reference Panel */}
            <div className="flex-1 overflow-y-auto">
              <div className="p-3">
                <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  API Reference
                </h3>
                <div className="space-y-1">
                  {REFERENCE_SECTIONS.map((section) => (
                    <div key={section.title}>
                      <button
                        onClick={() =>
                          setActiveSection(activeSection === section.title ? null : section.title)
                        }
                        className="flex w-full items-center justify-between rounded px-2 py-1.5 text-xs font-medium hover:bg-muted/60 cursor-pointer transition-colors"
                      >
                        <span>
                          <span className="mr-1.5">{section.icon}</span>
                          {section.title}
                        </span>
                        <ChevronDown
                          className={`h-3 w-3 transition-transform ${activeSection === section.title ? 'rotate-180' : ''}`}
                        />
                      </button>

                      {activeSection === section.title && (
                        <div className="ml-2 mt-1 space-y-2 border-l border-border/30 pl-2">
                          {section.items.map((item) => (
                            <div key={item.name} className="rounded-md border border-border/40 bg-card/60 p-2">
                              <div className="flex items-start justify-between gap-1">
                                <code className="text-[11px] font-mono font-medium text-primary leading-tight">
                                  {item.name}
                                </code>
                                <button
                                  onClick={() => {
                                    navigator.clipboard.writeText(item.example)
                                  }}
                                  className="flex-shrink-0 rounded p-0.5 text-muted-foreground hover:bg-muted/60 cursor-pointer transition-colors"
                                  title="Copy example"
                                >
                                  <Copy className="h-3 w-3" />
                                </button>
                              </div>
                              {item.signature && (
                                <p className="mt-0.5 text-[10px] font-mono text-muted-foreground">
                                  {item.signature}
                                </p>
                              )}
                              <p className="mt-1 text-[10px] text-muted-foreground leading-relaxed">
                                {item.desc}
                              </p>
                              {item.example && (
                                <pre className="mt-1.5 whitespace-pre-wrap break-words rounded bg-muted/60 p-1.5 text-[10px] font-mono leading-relaxed text-muted-foreground">
                                  {item.example}
                                </pre>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* ── Output Console ──────────────────────────────────────── */}
            {showConsole && (
              <div className="flex max-h-72 flex-shrink-0 flex-col border-t border-border/40">
                <div className="flex items-center justify-between border-b border-border/30 bg-muted/20 px-3 py-1.5">
                  <span className="text-xs font-medium">Output</span>
                  {previewResult && (
                    <span className="text-[10px] text-muted-foreground">
                      {previewResult.metrics.totalTrades} trades ·{' '}
                      {previewResult.metrics.winRate?.toFixed(1)}% WR
                    </span>
                  )}
                </div>
                <div className="flex-1 space-y-1 overflow-y-auto p-2">
                  {isPreviewLoading ? (
                    <div className="flex items-center gap-2 p-2 text-xs text-muted-foreground">
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      Running backtest…
                    </div>
                  ) : previewResult ? (
                    <>
                      {/* Summary */}
                      <ConsoleLine
                        label="Total trades"
                        value={previewResult.metrics.totalTrades.toString()}
                      />
                      <ConsoleLine
                        label="Win rate"
                        value={
                          previewResult.metrics.winRate != null
                            ? `${previewResult.metrics.winRate.toFixed(1)}%`
                            : '—'
                        }
                        color={
                          previewResult.metrics.winRate != null
                            ? previewResult.metrics.winRate >= 50
                              ? 'text-emerald-400'
                              : 'text-rose-400'
                            : undefined
                        }
                      />
                      <ConsoleLine
                        label="Net P/L"
                        value={previewResult.metrics.netPnl.toFixed(4)}
                        color={
                          previewResult.metrics.netPnl > 0
                            ? 'text-emerald-400'
                            : 'text-rose-400'
                        }
                      />
                      <ConsoleLine
                        label="Max DD"
                        value={`${previewResult.metrics.maxDrawdown.toFixed(2)}%`}
                        color={
                          previewResult.metrics.maxDrawdown > 20 ? 'text-rose-400' : undefined
                        }
                      />
                      <ConsoleLine
                        label="Final balance"
                        value={previewResult.metrics.finalBalance.toFixed(4)}
                      />
                      <ConsoleLine
                        label="Avg win"
                        value={previewResult.metrics.averageWin?.toFixed(4) ?? '—'}
                      />
                      {previewResult.trades.length > 0 && (
                        <>
                          <div className="my-1 border-t border-border/30" />
                          <p className="px-1 text-[10px] font-medium text-muted-foreground">
                            Trades
                          </p>
                          {previewResult.trades.slice(0, 10).map((t) => (
                            <div
                              key={t.id}
                              className="flex items-center justify-between rounded px-1.5 py-0.5 text-[10px] font-mono"
                            >
                              <span
                                className={
                                  t.side === 'BUY' ? 'text-emerald-400' : 'text-rose-400'
                                }
                              >
                                {t.side}
                              </span>
                              <span className="text-muted-foreground">
                                {t.entryPrice.toFixed(2)}
                              </span>
                              <span
                                className={
                                  t.netPnl != null && t.netPnl > 0
                                    ? 'text-emerald-400'
                                    : 'text-rose-400'
                                }
                              >
                                {t.netPnl?.toFixed(4) ?? '—'}
                              </span>
                            </div>
                          ))}
                        </>
                      )}
                    </>
                  ) : (
                    <p className="p-2 text-xs text-muted-foreground">
                      Run Preview to see output here.
                    </p>
                  )}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── Keyboard Shortcuts Overlay ───────────────────────────────── */}
      {showKeyboard && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="w-80 rounded-xl border border-border/80 bg-popover p-4 shadow-2xl">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-sm font-semibold">Keyboard Shortcuts</h3>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowKeyboard(false)}
                className="h-7 w-7 p-0 cursor-pointer"
              >
                <XCircle className="h-4 w-4" />
              </Button>
            </div>
            <div className="space-y-2">
              {[
                { keys: '⌘ S', desc: 'Save' },
                { keys: '⌘ ⇧ F', desc: 'Validate' },
                { keys: '⌘ ⇧ P', desc: 'Run Preview' },
                { keys: '⌘ F', desc: 'Find' },
                { keys: '⌘ ⇧ R', desc: 'Find & Replace' },
                { keys: '⌘ Tab', desc: 'Format document' },
                { keys: 'Ctrl + Scroll', desc: 'Zoom in/out' },
                { keys: 'Ctrl D', desc: 'Select next match' },
                { keys: 'Ctrl ⇧ L', desc: 'Select all matches' },
                { keys: 'Alt ↑/↓', desc: 'Move line up/down' },
                { keys: '⌘ /', desc: 'Toggle comment' },
                { keys: 'F2', desc: 'Rename symbol' },
              ].map(({ keys, desc }) => (
                <div key={keys} className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">{desc}</span>
                  <kbd className="rounded bg-muted/70 px-2 py-0.5 font-mono text-[10px]">{keys}</kbd>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ── Status Bar ───────────────────────────────────────────────── */}
      <div className="flex flex-shrink-0 items-center justify-between border-t border-border/60 bg-muted/20 px-3 py-1">
        <div className="flex items-center gap-3 text-[10px] text-muted-foreground">
          <span>Ln {cursorPos.line}, Col {cursorPos.col}</span>
          <span>·</span>
          <span>{lineCount} lines</span>
          <span>·</span>
          <span>UTF-8</span>
          <span>·</span>
          <span>{language}</span>
        </div>
        <div className="flex items-center gap-3 text-[10px] text-muted-foreground">
          {autoFormat && <span>Format on Save</span>}
          {localValue.length > 0 && (
            <>
              <span>·</span>
              <span>{localValue.length} chars</span>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

function ConsoleLine({
  label,
  value,
  color,
}: {
  label: string
  value: string
  color?: string
}) {
  return (
    <div className="flex items-center justify-between rounded px-1.5 py-0.5 text-[10px]">
      <span className="text-muted-foreground">{label}</span>
      <span className={`font-mono font-medium ${color ?? ''}`}>{value}</span>
    </div>
  )
}
