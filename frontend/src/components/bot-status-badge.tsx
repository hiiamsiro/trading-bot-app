import { BotStatus } from '@/types'
import { Badge } from '@/components/ui/badge'

const variantMap: Record<
  BotStatus,
  'default' | 'secondary' | 'success' | 'destructive' | 'warning'
> = {
  [BotStatus.RUNNING]: 'success',
  [BotStatus.STOPPED]: 'secondary',
  [BotStatus.PAUSED]: 'warning',
  [BotStatus.ERROR]: 'destructive',
}

export function BotStatusBadge({ status, label }: { status: BotStatus; label?: string }) {
  return <Badge variant={variantMap[status]}>{label ?? status}</Badge>
}
