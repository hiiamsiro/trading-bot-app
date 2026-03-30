'use client'

import { useScrollReveal } from '@/hooks/use-scroll-reveal'

type RevealVariant = 'up' | 'left' | 'right' | 'scale'

interface FadeInSectionProps {
  /** CSS reveal class variant */
  variant?: RevealVariant
  /** Staggered children reveal */
  stagger?: boolean
  /** Extra CSS classes on the wrapper */
  className?: string
  /** IntersectionObserver threshold (0–1) */
  threshold?: number
  children: React.ReactNode
}

const variantClass: Record<RevealVariant, string> = {
  up:    'reveal',
  left:  'reveal-left',
  right: 'reveal-right',
  scale: 'reveal-scale',
}

/**
 * Wrapper that reveals its children on scroll-into-view.
 * - `variant` selects the direction of the reveal animation.
 * - `stagger` adds staggered entrance to direct children (up to 8).
 * - Respects `prefers-reduced-motion` via CSS.
 */
export function FadeInSection({
  variant = 'up',
  stagger = false,
  className = '',
  threshold,
  children,
}: FadeInSectionProps) {
  const { ref, isVisible } = useScrollReveal<HTMLDivElement>({ threshold })
  const base = variantClass[variant]

  return (
    <div
      ref={ref}
      className={`${base} ${isVisible ? 'visible' : ''} ${className}`}
      {...(stagger ? { 'data-stagger': '' } : {})}
    >
      {children}
    </div>
  )
}
