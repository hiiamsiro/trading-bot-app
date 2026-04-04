'use client'

import React, { useState, useRef } from 'react'
import { createPortal } from 'react-dom'

interface SimpleTooltipProps {
  children: React.ReactNode
  content: React.ReactNode
  side?: 'top' | 'bottom' | 'left' | 'right'
}

const SIDE_STYLES: Record<string, React.CSSProperties> = {
  top: { top: 'auto', bottom: '100%', left: '50%', transform: 'translateX(-50%)', marginBottom: '6px' },
  bottom: { top: '100%', bottom: 'auto', left: '50%', transform: 'translateX(-50%)', marginTop: '6px' },
  left: { top: '50%', bottom: 'auto', left: 'auto', right: '100%', transform: 'translateY(-50%)', marginRight: '6px' },
  right: { top: '50%', bottom: 'auto', left: '100%', right: 'auto', transform: 'translateY(-50%)', marginLeft: '6px' },
}

export function SimpleTooltip({ children, content, side = 'top' }: SimpleTooltipProps) {
  const [visible, setVisible] = useState(false)
  const [coords, setCoords] = useState({ x: 0, y: 0 })
  const containerRef = useRef<HTMLDivElement>(null)
  const [mounted, setMounted] = React.useState(false)

  React.useEffect(() => { setMounted(true) }, [])

  return (
    <div
      ref={containerRef}
      className="relative inline-flex"
      onMouseEnter={() => {
        const rect = containerRef.current!.getBoundingClientRect()
        setCoords({ x: rect.left, y: rect.top })
        setVisible(true)
      }}
      onMouseLeave={() => setVisible(false)}
      onFocus={() => {
        const rect = containerRef.current!.getBoundingClientRect()
        setCoords({ x: rect.left, y: rect.top })
        setVisible(true)
      }}
      onBlur={() => setVisible(false)}
    >
      {children}
      {mounted &&
        visible &&
        createPortal(
          <div
            role="tooltip"
            style={{
              position: 'fixed',
              zIndex: 100000,
              ...SIDE_STYLES[side],
              x: coords.x,
              y: coords.y,
            }}
            className="pointer-events-none whitespace-nowrap rounded-md border border-border/70 bg-popover px-2.5 py-1.5 text-xs text-popover-foreground shadow-xl animate-in fade-in-0 zoom-in-95 duration-150"
          >
            {content}
          </div>,
          document.body,
        )}
    </div>
  )
}