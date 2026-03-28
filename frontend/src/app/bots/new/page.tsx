'use client'

import Link from 'next/link'
import { GuidedCreateBot } from '@/components/bots/guided-create-bot'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import {
  GitBranch,
  ListChecks,
  Sparkles,
} from 'lucide-react'
import { useState } from 'react'

export default function CreateBotPage() {
  const [mode, setMode] = useState<'choose' | 'guided'>('choose')

  if (mode === 'guided') {
    return <GuidedCreateBot />
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <Button variant="ghost" size="sm" asChild className="mb-2 -ml-2 cursor-pointer">
          <Link href="/bots">← Back to bots</Link>
        </Button>
        <h1 className="text-3xl font-semibold tracking-tight">Create a bot</h1>
        <p className="text-muted-foreground">
          Choose how you want to set up your trading strategy.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        {/* Guided form option */}
        <Card className="cursor-pointer border-primary/30 bg-card/80 transition-all hover:border-primary/60 hover:bg-card">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <ListChecks className="h-4 w-4 text-primary" />
              Guided form
            </CardTitle>
            <CardDescription>
              Pick a preset strategy (SMA Crossover or RSI) and tune the parameters via a step-by-step wizard.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="mb-3 flex flex-wrap gap-2">
              {['SMA Crossover', 'RSI'].map((s) => (
                <span
                  key={s}
                  className="rounded bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary"
                >
                  {s}
                </span>
              ))}
            </div>
            <Button
              onClick={() => setMode('guided')}
              className="w-full cursor-pointer"
            >
              <Sparkles className="mr-2 h-4 w-4" />
              Use guided form
            </Button>
          </CardContent>
        </Card>

        {/* Visual builder option */}
        <Card className="cursor-pointer border-primary/30 bg-card/80 transition-all hover:border-primary/60 hover:bg-card">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <GitBranch className="h-4 w-4 text-primary" />
              Visual builder
            </CardTitle>
            <CardDescription>
              Build custom entry conditions with RSI and MA indicators. No code required.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="mb-3 flex flex-wrap gap-2">
              {['RSI', 'Moving Average', 'AND / OR logic'].map((s) => (
                <span
                  key={s}
                  className="rounded bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary"
                >
                  {s}
                </span>
              ))}
            </div>
            <Button
              variant="outline"
              asChild
              className="w-full cursor-pointer"
            >
              <Link href="/strategies/builder">
                <GitBranch className="mr-2 h-4 w-4" />
                Open builder
              </Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
