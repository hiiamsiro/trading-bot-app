import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'

export function TableSkeleton({
  columns = 5,
  rows = 6,
  className,
}: {
  columns?: number
  rows?: number
  className?: string
}) {
  const templateColumns = `repeat(${columns}, minmax(0, 1fr))`

  return (
    <div
      className={cn(
        'rounded-md border border-border/70 bg-card/80 p-4 backdrop-blur-xl',
        className,
      )}
    >
      <div className="grid gap-4" style={{ gridTemplateColumns: templateColumns }}>
        {Array.from({ length: columns }).map((_, i) => (
          <Skeleton key={`h-${i}`} className="h-4 w-full" />
        ))}
      </div>
      <div className="mt-4 space-y-3">
        {Array.from({ length: rows }).map((_, rowIndex) => (
          <div
            key={`r-${rowIndex}`}
            className="grid items-center gap-4"
            style={{ gridTemplateColumns: templateColumns }}
          >
            {Array.from({ length: columns }).map((__, colIndex) => (
              <Skeleton
                key={`c-${rowIndex}-${colIndex}`}
                className={cn('h-4 w-full', colIndex === 0 ? 'h-5' : '')}
              />
            ))}
          </div>
        ))}
      </div>
    </div>
  )
}

