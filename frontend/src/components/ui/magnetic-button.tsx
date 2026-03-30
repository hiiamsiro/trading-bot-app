'use client'

import { useCallback, useRef, useState } from 'react'
import { motion, useMotionValue, useSpring } from 'framer-motion'
import Link from 'next/link'
import type { Variants } from 'framer-motion'

interface MagneticButtonProps {
  children: React.ReactNode
  className?: string
  onClick?: () => void
  href?: string
  /** Spring strength — higher = stronger pull (0 = disabled) */
  strength?: number
}

function clamp(val: number, min: number, max: number) {
  return Math.min(Math.max(val, min), max)
}

/**
 * MagneticButton — cursor proximity drives a spring-physics pull.
 * The button subtly follows the mouse when it's nearby.
 */
export function MagneticButton({
  children,
  className = '',
  href,
  onClick,
  strength = 0.6,
}: MagneticButtonProps) {
  const ref = useRef<HTMLDivElement>(null)
  const x = useMotionValue(0)
  const y = useMotionValue(0)
  // Cache the bounding rect to avoid getBoundingClientRect on every mousemove
  const rectRef = useRef<DOMRect | null>(null)

  const springX = useSpring(x, { stiffness: 120, damping: 16, mass: 0.6 })
  const springY = useSpring(y, { stiffness: 120, damping: 16, mass: 0.6 })

  const handleMouseEnter = useCallback(() => {
    rectRef.current = ref.current?.getBoundingClientRect() ?? null
  }, [])

  function handleMouseMove(e: React.MouseEvent<HTMLDivElement>) {
    const rect = rectRef.current
    if (!rect || strength === 0) return
    const centerX = rect.left + rect.width / 2
    const centerY = rect.top + rect.height / 2
    const distX = e.clientX - centerX
    const distY = e.clientY - centerY
    const dist = Math.sqrt(distX ** 2 + distY ** 2)
    const maxDist = Math.max(rect.width, rect.height) * 0.9

    if (dist < maxDist) {
      x.set((distX / maxDist) * 40 * strength)
      y.set((distY / maxDist) * 40 * strength)
    } else {
      x.set(0)
      y.set(0)
    }
  }

  function handleMouseLeave() {
    x.set(0)
    y.set(0)
    rectRef.current = null
  }

  const inner = (
    <motion.div
      style={{ x: springX, y: springY }}
      className="relative flex h-full w-full items-center justify-center"
    >
      {children}
    </motion.div>
  )

  return (
    <motion.div
      ref={ref}
      onMouseEnter={handleMouseEnter}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      onClick={onClick}
      className={`relative flex ${className}`}
      whileHover={{ scale: 1.02 }}
      whileTap={{ scale: 0.98 }}
      transition={{ type: 'spring', stiffness: 300, damping: 20 }}
    >
      {href ? (
        <Link href={href} className="flex h-full w-full items-center justify-center">
          {inner}
        </Link>
      ) : (
        inner
      )}
    </motion.div>
  )
}

/* ── Ripple effect button ───────────────── */
export function RippleButton({
  children,
  className = '',
  onClick,
  href,
  variants,
}: MagneticButtonProps & { variants?: Variants }) {
  const [ripples, setRipples] = useState<{ x: number; y: number; id: number }[]>([])
  const idRef = useRef(0)

  function handleClick(e: React.MouseEvent<HTMLDivElement>) {
    const rect = (e.currentTarget as HTMLDivElement).getBoundingClientRect()
    const x = e.clientX - rect.left
    const y = e.clientY - rect.top
    const id = ++idRef.current
    setRipples((prev) => [...prev, { x, y, id }])
    // 750ms matches the CSS animation duration (0.7s ease-out)
    setTimeout(() => setRipples((prev) => prev.filter((r) => r.id !== id)), 750)
    onClick?.()
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLDivElement>) {
    // Support Space and Enter for keyboard activation
    if (e.key === ' ' || e.key === 'Enter') {
      e.preventDefault()
      // Synthesize a centered synthetic click for keyboard users
      const rect = (e.currentTarget as HTMLDivElement).getBoundingClientRect()
      const syntheticEvent = {
        clientX: rect.left + rect.width / 2,
        clientY: rect.top + rect.height / 2,
        currentTarget: e.currentTarget,
      } as unknown as React.MouseEvent<HTMLDivElement>
      handleClick(syntheticEvent)
    }
  }

  const content = (
    <motion.div
      variants={variants}
      initial="rest"
      whileHover="hover"
      whileTap="tap"
      className={`relative cursor-pointer overflow-hidden ${className}`}
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      role="button"
      tabIndex={0}
      aria-pressed={false}
    >
      <div className="relative z-10 flex items-center justify-center">
        {children}
      </div>
      {ripples.map((r) => (
        <span
          key={r.id}
          className="absolute rounded-full bg-white/25"
          style={{
            left: r.x,
            top: r.y,
            width: 0,
            height: 0,
            transform: 'translate(-50%, -50%)',
          }}
          onAnimationStart={(e) => {
            const el = e.currentTarget as HTMLSpanElement
            el.style.width = '400px'
            el.style.height = '400px'
            el.style.opacity = '0'
            el.style.transition = 'width 0.7s ease-out, height 0.7s ease-out, opacity 0.7s ease-out'
            requestAnimationFrame(() => {
              el.style.opacity = '0'
            })
          }}
        />
      ))}
    </motion.div>
  )

  return href ? <Link href={href} className="inline-block">{content}</Link> : content
}
