'use client'

import { AlertTriangle } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { useRouter } from 'next/navigation'

interface UpgradePromptProps {
  title?: string
  message: string
  suggestedPlan?: 'PRO' | 'PREMIUM'
  className?: string
}

const PLAN_PRICES: Record<'PRO' | 'PREMIUM', string> = {
  PRO: '$9/mo',
  PREMIUM: '$29/mo',
}

export function UpgradePrompt({
  title = 'Upgrade required',
  message,
  suggestedPlan,
  className,
}: UpgradePromptProps) {
  const router = useRouter()

  return (
    <Card className={className} role="alert">
      <CardHeader className="flex flex-row items-center gap-3 pb-2">
        <AlertTriangle className="h-5 w-5 text-amber-500 shrink-0" />
        <CardTitle className="text-base font-semibold">{title}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground">{message}</p>
        <div className="flex gap-3">
          {suggestedPlan && (
            <Button
              size="sm"
              onClick={() => router.push('/settings?tab=billing')}
            >
              Upgrade to {suggestedPlan}{' '}
              <span className="ml-1 text-xs opacity-80">
                ({PLAN_PRICES[suggestedPlan]})
              </span>
            </Button>
          )}
          {!suggestedPlan && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => router.push('/settings?tab=billing')}
            >
              View plans
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
