'use client'

import { useEffect, useRef } from 'react'
import { motion } from 'framer-motion'

interface Particle {
  x: number
  y: number
  vx: number
  vy: number
  size: number
  opacity: number
  color: string
  id: number
}

const COLORS = [
  'rgba(245, 158, 11, 0.6)',   // amber
  'rgba(139, 92, 246, 0.6)',   // violet
  'rgba(52, 211, 153, 0.5)',   // emerald
  'rgba(96, 165, 250, 0.5)',   // blue
  'rgba(251, 146, 60, 0.5)',   // orange
]

/* ── Particle grid (canvas-based, 60fps) ── */
interface ParticleGridProps {
  className?: string
  particleCount?: number
  /** How fast particles move */
  speed?: number
}

/**
 * Canvas particle grid — draws connecting lines between nearby particles.
 * Lightweight: uses requestAnimationFrame, auto-cleans on unmount.
 */
export function ParticleGrid({
  className = '',
  particleCount = 60,
  speed = 0.4,
}: ParticleGridProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const particlesRef = useRef<Particle[]>([])
  const rafRef = useRef<number>(0)
  const mouseRef = useRef({ x: -1000, y: -1000 })

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    // Store in consts so TypeScript narrow carries through to nested function closures
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    const el = canvas as HTMLCanvasElement
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    const cx = ctx as CanvasRenderingContext2D

    function resize() {
      el.width = el.offsetWidth
      el.height = el.offsetHeight
    }

    function onMouseMove(e: MouseEvent) {
      const rect = el.getBoundingClientRect()
      mouseRef.current = { x: e.clientX - rect.left, y: e.clientY - rect.top }
    }

    resize()
    const ro = new ResizeObserver(resize)
    ro.observe(el)

    // Init particles
    particlesRef.current = Array.from({ length: particleCount }, (_, i) => ({
      x: Math.random() * el.width,
      y: Math.random() * el.height,
      vx: (Math.random() - 0.5) * speed,
      vy: (Math.random() - 0.5) * speed,
      size: Math.random() * 2 + 1,
      opacity: Math.random() * 0.5 + 0.2,
      color: COLORS[Math.floor(Math.random() * COLORS.length)],
      id: i,
    }))

    el.addEventListener('mousemove', onMouseMove)

    function draw() {
      cx.clearRect(0, 0, el.width, el.height)

      const particles = particlesRef.current
      const mouse = mouseRef.current
      const repelSq = 120 * 120
      const connectSq = 140 * 140

      for (let i = 0; i < particles.length; i++) {
        const p = particles[i]

        // Mouse repulsion — use squared distance to avoid sqrt
        const mdx = p.x - mouse.x
        const mdy = p.y - mouse.y
        const mDistSq = mdx * mdx + mdy * mdy
        if (mDistSq < repelSq) {
          const dist = Math.sqrt(mDistSq)
          const force = (Math.sqrt(repelSq) - dist) / Math.sqrt(repelSq)
          p.vx += (mdx / dist) * force * 0.3
          p.vy += (mdy / dist) * force * 0.3
        }

        // Dampen velocity
        p.vx *= 0.99
        p.vy *= 0.99

        // Move
        p.x += p.vx
        p.y += p.vy

        // Wrap edges
        if (p.x < 0) p.x = el.width
        else if (p.x > el.width) p.x = 0
        if (p.y < 0) p.y = el.height
        else if (p.y > el.height) p.y = 0

        // Draw particle
        cx.beginPath()
        cx.arc(p.x, p.y, p.size, 0, Math.PI * 2)
        cx.fillStyle = p.color
        cx.globalAlpha = p.opacity
        cx.fill()

        // Connect to nearby particles — squared distance avoids sqrt in inner loop
        for (let j = i + 1; j < particles.length; j++) {
          const q = particles[j]
          const ddx = p.x - q.x
          const ddy = p.y - q.y
          const dSq = ddx * ddx + ddy * ddy
          if (dSq < connectSq) {
            const d = Math.sqrt(dSq)
            cx.beginPath()
            cx.moveTo(p.x, p.y)
            cx.lineTo(q.x, q.y)
            cx.strokeStyle = p.color
            cx.globalAlpha = (1 - d / Math.sqrt(connectSq)) * 0.3
            cx.lineWidth = 0.5
            cx.stroke()
          }
        }
      }

      rafRef.current = requestAnimationFrame(draw)
    }

    draw()

    return () => {
      cancelAnimationFrame(rafRef.current)
      ro.disconnect()
      el.removeEventListener('mousemove', onMouseMove)
    }
  }, [particleCount, speed])

  return (
    <canvas
      ref={canvasRef}
      className={`pointer-events-none absolute inset-0 h-full w-full ${className}`}
      style={{ opacity: 0.6 }}
    />
  )
}

/* ── Morphing blob background ─────────── */
interface GlowOrbsProps {
  className?: string
}

export function GlowOrbs({ className = '' }: GlowOrbsProps) {
  return (
    <div className={`pointer-events-none absolute inset-0 overflow-hidden ${className}`} aria-hidden="true">
      {/* Amber orb */}
      <motion.div
        className="absolute -left-40 -top-40 h-[500px] w-[500px] rounded-full"
        style={{ background: 'radial-gradient(circle, rgba(245,158,11,0.18) 0%, transparent 70%)' }}
        animate={{
          x: [0, 40, 20, 0],
          y: [0, -20, 40, 0],
          scale: [1, 1.1, 0.95, 1],
        }}
        transition={{ duration: 12, repeat: Infinity, ease: 'easeInOut' }}
      />

      {/* Violet orb */}
      <motion.div
        className="absolute -right-40 top-0 h-96 w-96 rounded-full"
        style={{ background: 'radial-gradient(circle, rgba(139,92,246,0.22) 0%, transparent 70%)' }}
        animate={{
          x: [0, -30, 30, 0],
          y: [0, 50, 20, 0],
          scale: [1, 0.9, 1.08, 1],
        }}
        transition={{ duration: 14, repeat: Infinity, ease: 'easeInOut', delay: 2 }}
      />

      {/* Blue orb */}
      <motion.div
        className="absolute bottom-0 left-1/3 h-80 w-80 rounded-full"
        style={{ background: 'radial-gradient(circle, rgba(96,165,250,0.15) 0%, transparent 70%)' }}
        animate={{
          x: [0, 50, -20, 0],
          y: [0, -30, 30, 0],
          scale: [1, 1.05, 0.95, 1],
        }}
        transition={{ duration: 16, repeat: Infinity, ease: 'easeInOut', delay: 4 }}
      />

      {/* Emerald accent */}
      <motion.div
        className="absolute right-20 top-1/3 h-64 w-64 rounded-full"
        style={{ background: 'radial-gradient(circle, rgba(52,211,153,0.1) 0%, transparent 70%)' }}
        animate={{
          x: [0, -20, 40, 0],
          y: [0, 40, -20, 0],
          scale: [1, 1.15, 0.9, 1],
        }}
        transition={{ duration: 11, repeat: Infinity, ease: 'easeInOut', delay: 6 }}
      />
    </div>
  )
}

/* ── Scan line effect ─────────────────── */
interface ScanLineProps {
  className?: string
  color?: string
  speed?: number
}

export function ScanLine({ className = '', color = 'rgba(255,255,255,0.06)', speed = 3 }: ScanLineProps) {
  return (
    <div className={`pointer-events-none absolute inset-0 overflow-hidden ${className}`} aria-hidden="true">
      <motion.div
        className="absolute left-0 right-0 h-px"
        style={{ background: color }}
        initial={{ top: '-2%' }}
        animate={{ top: ['-2%', '102%'] }}
        transition={{ duration: speed, repeat: Infinity, ease: 'linear', repeatDelay: 1 }}
      />
    </div>
  )
}
