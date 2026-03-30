'use client'

import { useEffect, useRef } from 'react'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'

// Register plugins once on first import — re-registration is idempotent but wasteful
let registered = false
if (typeof window !== 'undefined' && !registered) {
  gsap.registerPlugin(ScrollTrigger)
  registered = true
}

/* ─────────────────────────────────────────
   GSAP Scroll-triggered animations
   Usage: const { containerRef } = useGsapScroll()
   Place ref on parent, children animate on scroll-into-view.
───────────────────────────────────────── */
export function useGsapScroll() {
  const containerRef = useRef<HTMLDivElement>(null)
  const ctxRef = useRef<gsap.Context | null>(null)

  useEffect(() => {
    if (!containerRef.current || typeof window === 'undefined') return

    ctxRef.current = gsap.context(() => {
      const el = containerRef.current
      if (!el) return

      // Every [data-gsap] child animates on scroll
      el.querySelectorAll<HTMLElement>('[data-gsap]').forEach((target, i) => {
        const type: string = target.dataset.gsap ?? 'fadeUp'
        const delay = Number(target.dataset.delay ?? i * 0.08)
        const duration = Number(target.dataset.duration ?? 0.7)
        const y = Number(target.dataset.y ?? 50)
        const x = Number(target.dataset.x ?? 0)
        const scale = Number(target.dataset.scale ?? 1)
        const stagger = Number(target.dataset.stagger ?? 0.1)

        const fromVars: gsap.TweenVars = { opacity: 0, y, x, scale, duration, delay, ease: 'power3.out' }

        switch (type) {
          case 'fadeLeft':   gsap.from(target, { ...fromVars, x: -60, y: 0, scale: 1 }); break
          case 'fadeRight':   gsap.from(target, { ...fromVars, x: 60,  y: 0, scale: 1 }); break
          case 'fadeUp':      gsap.from(target, { ...fromVars, x: 0,  y: 50, scale: 1 }); break
          case 'fadeDown':    gsap.from(target, { ...fromVars, x: 0,  y: -50, scale: 1 }); break
          case 'scale':       gsap.from(target, { ...fromVars, x: 0,  y: 0, scale: 0.85 }); break
          case 'blur':        gsap.from(target, { ...fromVars, x: 0,  y: 30, scale: 1, filter: 'blur(8px)' }); break
          case 'stagger': {
            gsap.from(target.children, {
              opacity: 0, y: 30, stagger,
              duration, delay, ease: 'power3.out',
            })
            break
          }
          case 'clipUp':      gsap.from(target, { ...fromVars, clipPath: 'inset(100% 0 0 0)' }); break
          case 'draw': {
            const path = target.querySelector('path, line, polyline, circle')
            if (path) {
              const len = (path as SVGPathElement).getTotalLength?.() ?? 300
              gsap.from(path, {
                strokeDasharray: len, strokeDashoffset: len,
                duration, delay, ease: 'power2.inOut',
              })
            } else {
              gsap.from(target, fromVars)
            }
            break
          }
          default:            gsap.from(target, fromVars)
        }
      })
    }, containerRef)

    return () => {
      ctxRef.current?.revert()
    }
  }, [])

  return { containerRef }
}

/* ─────────────────────────────────────────
   Hero entrance — runs once on mount
───────────────────────────────────────── */
export function useGsapHero() {
  const heroRef = useRef<HTMLElement>(null)
  const ctxRef = useRef<gsap.Context | null>(null)

  useEffect(() => {
    if (!heroRef.current || typeof window === 'undefined') return

    ctxRef.current = gsap.context(() => {
      const tl = gsap.timeline({ defaults: { ease: 'power4.out' } })

      // Badge
      tl.from('[data-hero="badge"]', { opacity: 0, y: -20, scale: 0.8, duration: 0.6 }, 0.2)

      // Headline words staggered
      tl.from('[data-hero="word"]', {
        opacity: 0, y: 40, rotateX: -20,
        stagger: 0.06,
        duration: 0.7,
      }, 0.5)

      // Subheadline
      tl.from('[data-hero="sub"]', { opacity: 0, y: 24, duration: 0.7 }, 1.1)

      // CTA buttons
      tl.from('[data-hero="cta"]', { opacity: 0, y: 20, stagger: 0.1, duration: 0.6 }, 1.3)

      // Trust pills
      tl.from('[data-hero="pill"]', { opacity: 0, scale: 0.8, stagger: 0.06, duration: 0.5 }, 1.5)

      // Stats
      tl.from('[data-hero="stat"]', { opacity: 0, y: 30, stagger: 0.1, duration: 0.6 }, 1.7)
    }, heroRef)

    return () => ctxRef.current?.revert()
  }, [])

  return { heroRef }
}

/* ─────────────────────────────────────────
   Number counter with GSAP
───────────────────────────────────────── */
export function gsapCounter(
  el: HTMLElement,
  target: number,
  suffix: string,
  duration = 1.6,
) {
  const obj = { val: 0 }
  gsap.to(obj, {
    val: target,
    duration,
    ease: 'power2.out',
    onUpdate() {
      el.textContent = target >= 100
        ? `${Math.round(obj.val)}${suffix}`
        : `${obj.val.toFixed(target < 10 ? 2 : 1)}${suffix}`
    },
  })
}

/* ─────────────────────────────────────────
   Parallax effect on scroll
───────────────────────────────────────── */
export function useGsapParallax() {
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!containerRef.current || typeof window === 'undefined') return

    const ctx = gsap.context(() => {
      gsap.to('[data-parallax="slow"]', {
        y: -80,
        ease: 'none',
        scrollTrigger: { trigger: containerRef.current, start: 'top bottom', end: 'bottom top', scrub: 1 },
      })
      gsap.to('[data-parallax="medium"]', {
        y: -120,
        ease: 'none',
        scrollTrigger: { trigger: containerRef.current, start: 'top bottom', end: 'bottom top', scrub: 1.5 },
      })
      gsap.to('[data-parallax="fast"]', {
        y: -160,
        ease: 'none',
        scrollTrigger: { trigger: containerRef.current, start: 'top bottom', end: 'bottom top', scrub: 2 },
      })
    }, containerRef)

    return () => ctx.revert()
  }, [])

  return { containerRef }
}

/* ─────────────────────────────────────────
   Cursor trailer effect
───────────────────────────────────────── */
export function useGsapCursor() {
  const dotRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (typeof window === 'undefined') return

    const dot = dotRef.current
    if (!dot) return

    const pos = { x: 0, y: 0 }
    const mouse = { x: 0, y: 0 }

    const onMove = (e: MouseEvent) => {
      mouse.x = e.clientX
      mouse.y = e.clientY
    }

    const tickerCb = () => {
      pos.x += (mouse.x - pos.x) * 0.12
      pos.y += (mouse.y - pos.y) * 0.12
      if (dot) {
        dot.style.transform = `translate(${pos.x}px, ${pos.y}px)`
      }
    }
    gsap.ticker.add(tickerCb)

    window.addEventListener('mousemove', onMove)
    return () => {
      window.removeEventListener('mousemove', onMove)
      gsap.ticker.remove(tickerCb)
    }
  }, [])

  return { dotRef }
}
