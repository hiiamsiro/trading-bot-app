'use client'

import Link from 'next/link'
import { GuidedCreateBot } from '@/components/bots/guided-create-bot'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Code2, GitBranch, ListChecks, Sparkles } from 'lucide-react'
import { useState } from 'react'

function OptionCard({
  icon: Icon,
  title,
  description,
  tags,
  button,
}: {
  icon: React.ElementType
  title: string
  description: string
  tags: string[]
  button: React.ReactNode
}) {
  return (
    <Card className="flex flex-col border-primary/30 bg-card/80 transition-all hover:border-primary/60 hover:bg-card">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-base">
          <Icon className="h-4 w-4 text-primary" />
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent className="flex flex-1 flex-col pt-0">
        <p className="mb-3 text-sm text-muted-foreground">{description}</p>
        <div className="mb-auto flex flex-wrap gap-2">
          {tags.map((tag) => (
            <span
              key={tag}
              className="rounded bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary"
            >
              {tag}
            </span>
          ))}
        </div>
        <div className="mt-4">{button}</div>
      </CardContent>
    </Card>
  )
}

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

      <div className="grid gap-4 sm:grid-cols-3">
        <OptionCard
          icon={ListChecks}
          title="Guided form"
          description="Pick a preset strategy (SMA Crossover or RSI) and tune the parameters via a step-by-step wizard."
          tags={['SMA Crossover', 'RSI']}
          button={
            <Button
              variant="outline"
              onClick={() => setMode('guided')}
              className="w-full cursor-pointer"
            >
              <Sparkles className="mr-2 h-4 w-4" />
              Use guided form
            </Button>
          }
        />
        <OptionCard
          icon={GitBranch}
          title="Visual builder"
          description="Build custom entry conditions with RSI and MA indicators. No code required."
          tags={['RSI', 'Moving Average', 'AND / OR logic']}
          button={
            <Button variant="outline" asChild className="w-full cursor-pointer">
              <Link href="/strategies/builder">
                <GitBranch className="mr-2 h-4 w-4" />
                Open builder
              </Link>
            </Button>
          }
        />
        <OptionCard
          icon={Code2}
          title="Code editor"
          description="Write custom strategies in JavaScript using the Monaco editor with autocomplete."
          tags={['JavaScript', 'Monaco Editor', 'Autocomplete']}
          button={
            <Button variant="outline" asChild className="w-full cursor-pointer">
              <Link href="/bots/new/code">
                <Code2 className="mr-2 h-4 w-4" />
                Write strategy
              </Link>
            </Button>
          }
        />
      </div>
    </div>
  )
}
