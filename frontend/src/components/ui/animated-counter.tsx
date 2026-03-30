'use client'

import { useEffect, useRef, useState } from 'react'
import { motion, useInView, useSpring, useTransform } from 'framer-motion'

interface AnimatedCounterProps {
  target: number
  format: (val: number) => string
  className?: string
  delay?: number
  externalRef?: React.RefObject<HTMLDivElement>
}

/**
 * Smooth counter animation using a Framer Motion spring.
 * The spring value drives the display without per-frame React state updates.
 */
export function AnimatedCounter({
  target,
  format,
  className = '',
  delay = 0,
  externalRef,
}: AnimatedCounterProps) {
  const nodeRef = useRef<HTMLSpanElement>(null)
  const isInView = useInView(externalRef ?? nodeRef, { once: true, margin: '-80px' })
  const started = useRef(false)

  // Single spring: starts at 0, animates to target after delay
  const spring = useSpring(0, { stiffness: 80, damping: 18 })

  // Sync spring value to DOM directly — no React state on each frame
  useEffect(() => {
    if (!isInView || started.current) return
    started.current = true
    const timeout = setTimeout(() => {
      spring.set(target)
    }, delay * 1000)
    return () => clearTimeout(timeout)
  }, [isInView, target, delay, spring])

  useEffect(() => {
    if (!spring || !nodeRef.current) return
    const unsub = spring.on('change', (v) => {
      if (nodeRef.current) nodeRef.current.textContent = format(Math.round(v))
    })
    return unsub
  }, [spring, format])

  return (
    <motion.span
      ref={nodeRef}
      className={className}
      initial={{ opacity: 0, y: 12 }}
      animate={isInView ? { opacity: 1, y: 0 } : {}}
      transition={{ duration: 0.4, delay }}
    />
  )
}

/* ── FlipDigit — dramatic number flip on change ── */
interface FlipDigitProps {
  digit: string
  delay?: number
}

export function FlipDigit({ digit, delay = 0 }: FlipDigitProps) {
  const [current, setCurrent] = useState(digit)
  const prev = useRef(digit)

  useEffect(() => {
    if (digit !== prev.current) {
      prev.current = digit
      setCurrent(digit)
    }
  }, [digit])

  return (
    <motion.span
      key={current}
      initial={{ rotateX: -90, opacity: 0 }}
      animate={{ rotateX: 0, opacity: 1 }}
      transition={{ duration: 0.35, delay, ease: [0.22, 1, 0.36, 1] }}
      style={{ display: 'inline-block', transformOrigin: 'center 80%' }}
    >
      {current}
    </motion.span>
  )
}

/* ── SkewSlam — spring-driven dramatic counter ── */
interface SkewCounterProps {
  target: number
  format: (val: number) => string
  className?: string
}

export function SkewCounter({ target, format, className = '' }: SkewCounterProps) {
  const ref = useRef<HTMLSpanElement>(null)
  const isInView = useInView(ref, { once: true })
  const spring = useSpring(0, { stiffness: 80, damping: 15 })
  const display = useTransform(spring, (v) => format(Math.round(v)))

  useEffect(() => {
    if (isInView) spring.set(target)
  }, [isInView, target, spring])

  return (
    <motion.span ref={ref} className={className}>
      <motion.span>{display}</motion.span>
    </motion.span>
  )
}
