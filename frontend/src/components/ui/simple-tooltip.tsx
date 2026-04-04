'use client'

import React, { useState } from 'react'
import { cn } from '@/lib/utils'

interface SimpleTooltipProps {
  children: React.ReactNode
  content: React.ReactNode
  side?: 'top' | 'bottom' | 'left' | 'right'
}

const SIDE_CLASSES = {
  top: 'bottom-full left-1/2 -translate-x-1/2 mb-1.5',
  bottom: 'top-full left-1/2 -translate-x-1/2 mt-1.5',
  left: 'right-full top-1/2 -translate-y-1/2 mr-1.5',
  right: 'left-full top-1/2 -translate-y-1/2 ml-1.5',
}

export function SimpleTooltip({ children, content, side = 'top' }: SimpleTooltipProps) {
  const [visible, setVisible] = useState(false)

  return (
    <div
      className="relative inline-flex"
      onMouseEnter={() => setVisible(true)}
      onMouseLeave={() => setVisible(false)}
      onFocus={() => setVisible(true)}
      onBlur={() => setVisible(false)}
    >
      {children}
      {visible && (
        <div
          role="tooltip"
          className={cn(
            'pointer-events-none absolute z-50 whitespace-nowrap rounded-md border border-border/70 bg-popover px-2.5 py-1.5 text-xs text-popover-foreground shadow-xl',
            'animate-in fade-in-0 zoom-in-95 duration-150',
            SIDE_CLASSES[side],
          )}
        >
          {content}
        </div>
      )}
    </div>
  )
}