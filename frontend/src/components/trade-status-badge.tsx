import { TradeStatus } from '@/types'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'

const variantMap: Record<
  TradeStatus,
  'default' | 'secondary' | 'success' | 'destructive' | 'warning' | 'outline'
> = {
  [TradeStatus.PENDING]: 'warning',
  [TradeStatus.EXECUTED]: 'success',
  [TradeStatus.CLOSED]: 'secondary',
  [TradeStatus.CANCELLED]: 'secondary',
  [TradeStatus.FAILED]: 'destructive',
}

export function TradeStatusBadge({
  status,
  className,
}: {
  status: TradeStatus
  className?: string
}) {
  return (
    <Badge variant={variantMap[status]} className={cn('font-mono', className)}>
      {status}
    </Badge>
  )
}

