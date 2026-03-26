import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'

type LogLevel = 'DEBUG' | 'INFO' | 'WARNING' | 'ERROR'

function normalizeLevel(level: string): LogLevel | 'UNKNOWN' {
  const trimmed = level.trim().toUpperCase()
  if (trimmed === 'DEBUG') return 'DEBUG'
  if (trimmed === 'INFO') return 'INFO'
  if (trimmed === 'WARNING') return 'WARNING'
  if (trimmed === 'ERROR') return 'ERROR'
  return 'UNKNOWN'
}

export function LogLevelBadge({
  level,
  className,
}: {
  level: string
  className?: string
}) {
  const normalized = normalizeLevel(level)
  const variant =
    normalized === 'ERROR'
      ? 'destructive'
      : normalized === 'WARNING'
        ? 'warning'
        : normalized === 'INFO'
          ? 'outline'
          : 'secondary'

  return (
    <Badge variant={variant} className={cn('font-mono', className)}>
      {level}
    </Badge>
  )
}

