'use client'

import { Plan } from '@/types'
import { Badge } from '@/components/ui/badge'

const PLAN_CONFIG: Record<Plan, { label: string; variant: 'secondary' | 'default' | 'success' }> = {
  [Plan.FREE]: { label: 'Free', variant: 'secondary' },
  [Plan.PRO]: { label: 'Pro', variant: 'default' },
  [Plan.PREMIUM]: { label: 'Premium', variant: 'success' },
}

interface PlanBadgeProps {
  plan: Plan
  className?: string
}

export function PlanBadge({ plan, className }: PlanBadgeProps) {
  const config = PLAN_CONFIG[plan]
  return (
    <Badge variant={config.variant} className={className}>
      {config.label}
    </Badge>
  )
}
