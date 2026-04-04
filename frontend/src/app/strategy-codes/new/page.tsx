'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useBotsStore } from '@/store/bots.store'
import { useAuthStore } from '@/store/auth.store'
import { useHandleApiError } from '@/hooks/use-handle-api-error'
import { toast } from '@/hooks/use-toast'
import { CodeEditor } from '@/components/bots/code-editor'
import { Button } from '@/components/ui/button'
import { ThemeToggle } from '@/components/layout/theme-toggle'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Loader2, PanelLeft } from 'lucide-react'

const DEFAULT_CODE = `// Strategy: Custom RSI Momentum
// Runs on the given candles and calls signal() to emit trade signals.

const closes = context.candles.map(c => c.close)

// RSI with configurable period (default 14)
const rsiValue = indicators.rsi(closes, 14)

// Simple moving average for trend filter
const smaValue = indicators.sma(closes, 50)

// Signal logic: BUY when RSI oversold AND price above SMA
if (rsiValue < 30 && closes[closes.length - 1] > smaValue) {
  signal('BUY', 0.8, 'RSI oversold + price above SMA')
} else if (rsiValue > 70) {
  signal('SELL', 0.7, 'RSI overbought')
} else {
  signal('HOLD', 0, 'No signal')
}
`

function MetaPanel({
  name,
  description,
  onNameChange,
  onDescChange,
}: {
  name: string
  description: string
  onNameChange: (v: string) => void
  onDescChange: (v: string) => void
}) {
  return (
    <div className="space-y-4 p-4">
      <div className="space-y-2">
        <Label htmlFor="sc-name">Name *</Label>
        <Input
          id="sc-name"
          value={name}
          onChange={(e) => onNameChange(e.target.value)}
          placeholder="e.g. RSI momentum strategy"
          maxLength={200}
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="sc-desc">Description</Label>
        <Input
          id="sc-desc"
          value={description}
          onChange={(e) => onDescChange(e.target.value)}
          placeholder="What does this strategy do?"
          maxLength={500}
        />
      </div>

      {/* API reference */}
      <Card className="border-border/60 bg-muted/30">
        <CardHeader className="pb-2">
          <CardTitle className="text-xs font-medium">Available API</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-xs">
          <p className="text-muted-foreground">
            The following globals are available in the editor:
          </p>
          <ul className="space-y-1.5 font-mono text-muted-foreground">
            <li>
              <span className="text-primary">indicators</span>.sma(values, period)
            </li>
            <li>
              <span className="text-primary">indicators</span>.rsi(closes, period)
            </li>
            <li>
              <span className="text-primary">indicators</span>.ema(values, period)
            </li>
            <li>
              <span className="text-primary">indicators</span>.macd(closes)
            </li>
            <li>
              <span className="text-primary">context</span>.symbol
            </li>
            <li>
              <span className="text-primary">context</span>.interval
            </li>
            <li>
              <span className="text-primary">context</span>.candles
            </li>
            <li>
              <span className="text-primary">context</span>.position
            </li>
            <li>
              <span className="text-primary">context</span>.balance
            </li>
            <li>
              <span className="text-primary">signal</span>(action, confidence, reason?)
            </li>
          </ul>
        </CardContent>
      </Card>
    </div>
  )
}

export default function NewStrategyCodePage() {
  const router = useRouter()
  const token = useAuthStore((s) => s.token)
  const { saveStrategyCode } = useBotsStore()
  const handleError = useHandleApiError()

  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [code, setCode] = useState(DEFAULT_CODE)
  const [saving, setSaving] = useState(false)
  const [metaPanelOpen, setMetaPanelOpen] = useState(false)

  async function handleSave() {
    if (!token) return
    if (!name.trim()) {
      toast({ title: 'Name is required', variant: 'destructive' })
      return
    }
    setSaving(true)
    try {
      const sc = await saveStrategyCode({
        name: name.trim(),
        description: description.trim() || undefined,
        code,
        language: 'javascript',
      })
      toast({ title: 'Strategy code created' })
      router.push(`/strategy-codes/${sc.id}`)
    } catch (err) {
      handleError(err, 'Could not create strategy code')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="flex h-[calc(100vh-4rem)] flex-col">
      {/* Top bar */}
      <div className="flex flex-shrink-0 items-center justify-between gap-3 border-b border-border/60 bg-muted/30 px-4 py-3">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" asChild className="-ml-2 cursor-pointer">
            <Link href="/bots/new/code">
              ← Back
            </Link>
          </Button>
          <div className="h-4 w-px bg-border/50" />
          <span className="truncate text-sm font-medium sm:text-base md:text-lg">New Strategy Code</span>
        </div>
        <div className="flex items-center gap-2">
          {/* Mobile: open strategy details sheet */}
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setMetaPanelOpen(true)}
            className="h-8 gap-1.5 cursor-pointer md:hidden"
          >
            <PanelLeft className="h-4 w-4" />
            <span className="text-xs">Details</span>
          </Button>
          <ThemeToggle />
          <Button
            variant="default"
            size="sm"
            onClick={() => void handleSave()}
            disabled={saving || !name.trim()}
            className="h-8 cursor-pointer gap-1.5"
          >
            {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
            {saving ? 'Creating…' : 'Create'}
          </Button>
        </div>
      </div>

      {/* Metadata + editor */}
      <div className="flex min-h-0 min-w-0 flex-1">
        {/* Meta panel — sidebar on desktop, sheet/drawer on mobile */}
        {/* Desktop: always visible sidebar */}
        <div className="hidden min-h-0 w-0 min-w-[280px] flex-col border-r border-border/40 bg-muted/10 md:flex">
          <MetaPanel name={name} description={description} onNameChange={setName} onDescChange={setDescription} />
        </div>

        {/* Mobile: slide-in sheet triggered by toolbar button */}
        <Sheet open={metaPanelOpen} onOpenChange={setMetaPanelOpen}>
          <SheetContent side="left" className="flex w-80 flex-col overflow-y-auto p-0">
            <SheetHeader className="border-b border-border/40 p-4">
              <SheetTitle className="text-sm">Strategy Details</SheetTitle>
            </SheetHeader>
            <div className="flex-1 overflow-y-auto p-4">
              <MetaPanel name={name} description={description} onNameChange={setName} onDescChange={setDescription} />
            </div>
          </SheetContent>
        </Sheet>

        {/* Editor */}
        <div className="min-h-0 flex-1">
          <CodeEditor
            value={code}
            onChange={setCode}
            language="javascript"
            name="strategy.js"
            onOpenMetaPanel={metaPanelOpen ? undefined : () => setMetaPanelOpen(true)}
          />
        </div>
      </div>
    </div>
  )
}
