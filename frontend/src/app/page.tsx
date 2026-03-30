'use client'

import { useRef, useState, useEffect, useId } from 'react'
import Link from 'next/link'
import {
  Activity, BadgeCheck, ChartCandlestick, CheckCircle2, ChevronRight,
  Cpu, Eye, Fingerprint, Globe, Headphones, LockKeyhole, Network,
  Rocket, Shield, ShieldCheck, TrendingUp, Users, Wallet, Zap,
} from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { RedirectToDashboardIfAuth } from '@/components/auth/redirect-to-dashboard-if-auth'
import { MagneticButton } from '@/components/ui/magnetic-button'
import { AnimatedCounter } from '@/components/ui/animated-counter'
import { GlowOrbs, ParticleGrid, ScanLine } from '@/components/ui/animated-bg'
import {
  fadeUp, fadeLeft, fadeRight, fadeScale,
  staggerContainer, heroWord, heroText,
  spring,
  testimonialSlide,
} from '@/lib/animations'

// Register ScrollTrigger plugin — required before any ScrollTrigger.create() call.
// Guard keeps this safe during SSR/SSG where gsap is browser-only.
if (typeof window !== 'undefined') {
  gsap.registerPlugin(ScrollTrigger)
}

/* ═══════════════════════════════════════════════
   DATA
═══════════════════════════════════════════════ */
const priceCards = [
  { pair: 'BTC/USDT',  price: 68244.13, change: '+2.31%', positive: true,
    points: 'M10,60 C20,55 30,58 40,45 C50,32 60,38 70,28 C75,22 85,18 90,10' },
  { pair: 'ETH/USDT',  price: 3481.72,  change: '+1.64%', positive: true,
    points: 'M10,65 C20,60 30,62 40,55 C50,48 60,52 70,44 C75,38 85,35 90,28' },
  { pair: 'SOL/USDT',  price: 178.05,   change: '+4.92%', positive: true,
    points: 'M10,68 C20,58 30,62 40,48 C50,34 60,40 70,25 C75,15 85,18 90,8' },
  { pair: 'BNB/USDT',  price: 592.40,   change: '+0.87%', positive: true,
    points: 'M10,58 C20,55 30,60 40,52 C50,44 60,50 70,42 C75,36 85,34 90,28' },
  { pair: 'XRP/USDT',  price: 0.5231,  change: '-0.42%', positive: false,
    points: 'M10,35 C20,40 30,36 40,44 C50,52 60,46 70,52 C75,56 85,52 90,58' },
  { pair: 'DOGE/USDT', price: 0.1247,  change: '+3.21%', positive: true,
    points: 'M10,65 C20,60 30,66 40,52 C50,38 60,48 70,30 C75,22 85,25 90,12' },
]

const securityFeatures = [
  { title: 'Multi-layer Encryption',       desc: 'AES-256 at rest and TLS 1.3 in transit.',
    proof: '256-bit encryption', icon: LockKeyhole, color: 'amber',   bg: 'bg-amber-300/10',   border: 'border-amber-300/25' },
  { title: 'Multi-Sig Order Validation',  desc: 'Policy checks before any critical execution.',
    proof: 'Policy-based approvals', icon: Shield,       color: 'violet', bg: 'bg-violet-300/10',  border: 'border-violet-300/25' },
  { title: 'AI Anomaly Detection',         desc: 'Runtime models detect outlier behavior.',
    proof: '24/7 behavior scoring', icon: Cpu,         color: 'emerald', bg: 'bg-emerald-300/10', border: 'border-emerald-300/25' },
  { title: 'Continuous Audit Trails',     desc: 'Immutable logs with verification metadata.',
    proof: 'Tamper-evident logs', icon: Fingerprint, color: 'blue',   bg: 'bg-blue-300/10',    border: 'border-blue-300/25' },
]

const trustStats = [
  { label: 'Protected assets',     value: 2.4,   suffix: 'B+',  raw: '$2.4B+',  icon: Shield,   color: 'text-amber-300',   fmt: (v: number) => `$${v.toFixed(1)}B+` },
  { label: 'Active traders',       value: 128,   suffix: 'K+',  raw: '128K+',   icon: Users,    color: 'text-violet-300', fmt: (v: number) => `${Math.round(v)}K+` },
  { label: 'Infrastructure uptime',value: 99.99,  suffix: '%',   raw: '99.99%',  icon: Globe,    color: 'text-emerald-300', fmt: (v: number) => `${v.toFixed(2)}%` },
  { label: 'Processed orders',    value: 430,   suffix: 'M+',  raw: '430M+',   icon: Activity, color: 'text-blue-300',   fmt: (v: number) => `${Math.round(v)}M+` },
]

const features = [
  { title: 'Real-time Execution',      desc: 'Sub-120ms order routing across major exchanges.',       icon: Zap,             color: 'text-amber-300',   bg: 'bg-amber-300/10',   wide: true  },
  { title: 'Smart Risk Management',   desc: 'Position limits, stop-loss, and drawdown protection.',    icon: Eye,            color: 'text-violet-300',  bg: 'bg-violet-300/10',  wide: false },
  { title: 'Portfolio Analytics',      desc: 'Equity curves, performance metrics, attribution.',         icon: ChartCandlestick, color: 'text-emerald-300', bg: 'bg-emerald-300/10', wide: false },
  { title: '24/7 Support',            desc: 'Dedicated trading specialists available around the clock.', icon: Headphones,     color: 'text-blue-300',    bg: 'bg-blue-300/10',   wide: true  },
]

const testimonials = [
  { quote: 'Execution logs and risk controls are clear enough for compliance review. This platform changed how our team approaches automated trading.', author: 'Marcus Chen',   role: 'Head of Trading, Apex Fund',         avatar: 'MC' },
  { quote: 'The latency and uptime profile makes this feel production-ready from day one. Integration was seamless.',                          author: 'Sarah Kim',     role: 'Quant Developer, Blockwave Capital', avatar: 'SK' },
  { quote: 'Best-in-class security architecture. We audited the smart contracts and the implementation is solid.',                              author: 'David Torres',  role: 'Security Lead, CyberVault',         avatar: 'DT' },
]

const wallets = ['MetaMask', 'WalletConnect', 'Coinbase Wallet', 'OKX Wallet']

/* ═══════════════════════════════════════════════
   SVG SPARKLINE — path draw animation
═══════════════════════════════════════════════ */
function Sparkline({ points, positive, delay = 0 }: { points: string; positive: boolean; delay?: number }) {
  const color = positive ? '#34d399' : '#f87171'
  const uid = useId()
  const gradId = `sg-${uid.replace(/:/g, '')}`

  return (
    <svg viewBox="0 0 100 70" className="h-14 w-full" aria-hidden="true" preserveAspectRatio="none">
      <defs>
        <linearGradient id={`${gradId}-fill`} x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%"   stopColor={color} stopOpacity="0.4" />
          <stop offset="100%" stopColor={color} stopOpacity="0.0" />
        </linearGradient>
      </defs>
      <defs>
        <clipPath id={`${gradId}-clip`}>
          <motion.rect
            x="0" y="0" width="100" height="70"
            initial={{ scaleX: 0 }}
            animate={{ scaleX: 1 }}
            transition={{ duration: 1.8, delay, ease: [0.22, 1, 0.36, 1] }}
            style={{ transformOrigin: 'left center' }}
          />
        </clipPath>
      </defs>
      <path
        d={`${points} L90,70 L10,70 Z`}
        fill={`url(#${gradId}-fill)`}
        clipPath={`url(#${gradId}-clip)`}
      />
      <motion.path
        d={points}
        fill="none"
        stroke={color}
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        initial={{ pathLength: 0 }}
        animate={{ pathLength: 1 }}
        transition={{ duration: 1.8, delay, ease: [0.22, 1, 0.36, 1] }}
      />
    </svg>
  )
}

/* ═══════════════════════════════════════════════
   PRICE CARD — spring lift + path draw
═══════════════════════════════════════════════ */
function PriceCard({ card, index }: { card: typeof priceCards[0]; index: number }) {
  const [prevPrice, setPrevPrice] = useState(card.price)
  const [flash, setFlash] = useState<'up' | 'down' | null>(null)

  useEffect(() => {
    if (prevPrice !== card.price) {
      setFlash(card.positive ? 'up' : 'down')
      setPrevPrice(card.price)
      const t = setTimeout(() => setFlash(null), 700)
      return () => clearTimeout(t)
    }
  }, [card.price, card.positive, prevPrice])

  return (
    <motion.article
      initial="hidden"
      whileInView="visible"
      viewport={{ once: true, margin: '-60px' }}
      variants={fadeUp(0, 0.6)}
      whileHover="hover"
      className="group cursor-pointer overflow-hidden rounded-2xl border border-white/10 bg-white/5 p-5
        backdrop-blur-xl shadow-lg transition-all duration-300 hover:border-white/20 hover:bg-white/10"
    >
      <motion.div
        className="pointer-events-none absolute inset-0 rounded-2xl opacity-0"
        variants={{ hover: { opacity: 1 } }}
        style={{
          background: card.positive
            ? 'radial-gradient(ellipse at 50% 0%, rgba(52,211,153,0.12) 0%, transparent 70%)'
            : 'radial-gradient(ellipse at 50% 0%, rgba(248,113,113,0.12) 0%, transparent 70%)',
        }}
      />
      <div className="relative z-10">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <motion.div
              className="flex h-9 w-9 items-center justify-center rounded-lg bg-white/10"
              whileHover={{ scale: 1.15, rotate: 5 }}
              transition={spring}
            >
              <TrendingUp className="h-5 w-5 text-amber-400" />
            </motion.div>
            <p className="font-medium text-white">{card.pair}</p>
          </div>
          <motion.span
            key={card.change}
            initial={{ scale: 0.7, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
              card.positive ? 'bg-emerald-400/15 text-emerald-300' : 'bg-red-400/15 text-red-300'
            }`}
          >
            {card.change}
          </motion.span>
        </div>
        <motion.p
          className={`mt-3 font-orbitron text-2xl font-bold text-white ${flash === 'up' ? 'text-emerald-400' : flash === 'down' ? 'text-red-400' : ''}`}
          animate={flash ? { scale: [1, 1.05, 1] } : {}}
          transition={{ duration: 0.4 }}
        >
          {card.price < 1
            ? `$${card.price.toFixed(4)}`
            : `$${card.price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
          }
        </motion.p>
        <div className={`mt-3 ${card.positive ? 'text-emerald-400' : 'text-red-400'}`}>
          <Sparkline points={card.points} positive={card.positive} delay={index * 0.1} />
        </div>
      </div>
    </motion.article>
  )
}

/* ═══════════════════════════════════════════════
   TESTIMONIAL CAROUSEL
═══════════════════════════════════════════════ */
function TestimonialCarousel() {
  const [[page, dir], setPage] = useState([0, 0])
  const [dirState, setDir] = useState(1)

  function paginate(newDir: number) {
    setDir(newDir)
    setPage(([prev]) => [(prev + newDir + testimonials.length) % testimonials.length, newDir])
  }

  const t = testimonials[page]

  return (
    <div className="relative overflow-hidden">
      <div className="relative min-h-[220px]">
        <AnimatePresence mode="wait" custom={dirState}>
          <motion.div
            key={page}
            custom={dirState}
            variants={testimonialSlide(dirState as 1 | -1)}
            initial="enter"
            animate="center"
            exit="exit"
            transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
            className="rounded-xl border border-white/10 bg-white/5 p-5"
          >
            <p className="text-sm italic text-slate-200">&ldquo;{t.quote}&rdquo;</p>
            <div className="mt-4 flex items-center gap-3">
              <motion.div
                className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full
                  bg-gradient-to-br from-violet-500 to-amber-400 text-xs font-bold text-white"
                animate={{ rotate: [0, 360] }}
                transition={{ duration: 20, repeat: Infinity, ease: 'linear' }}
              >
                {t.avatar}
              </motion.div>
              <div>
                <p className="text-sm font-medium text-white">{t.author}</p>
                <p className="text-xs text-slate-400">{t.role}</p>
              </div>
            </div>
          </motion.div>
        </AnimatePresence>
      </div>

      <div className="mt-4 flex items-center justify-center gap-2">
        {testimonials.map((_, i) => (
          <button
            key={i}
            onClick={() => paginate(i > page ? 1 : -1)}
            className="cursor-pointer rounded-full transition-all duration-300"
            aria-label={`Testimonial ${i + 1}`}
          >
            <motion.div
              className={`h-1.5 rounded-full ${i === page ? 'w-6 bg-amber-400' : 'w-1.5 bg-white/20'}`}
              animate={{ width: i === page ? 24 : 6, backgroundColor: i === page ? '#fbbf24' : 'rgba(255,255,255,0.2)' }}
              transition={{ duration: 0.3 }}
            />
          </button>
        ))}
      </div>
    </div>
  )
}

/* ═══════════════════════════════════════════════
   FEATURE CARD
═══════════════════════════════════════════════ */
function FeatureCard({ feature, index }: { feature: typeof features[0]; index: number }) {
  return (
    <motion.article
      initial="hidden"
      whileInView="visible"
      viewport={{ once: true, margin: '-40px' }}
      variants={fadeUp(index * 0.1, 0.55)}
      whileHover={{ y: -6 }}
      transition={spring}
      className={`group cursor-pointer rounded-2xl border border-white/10 bg-white/5 p-6
        backdrop-blur-xl transition-all duration-300 hover:border-white/20 hover:bg-white/10
        ${feature.wide ? 'lg:col-span-2' : ''}`}
    >
      <motion.div
        className={`inline-flex rounded-xl ${feature.bg} p-3`}
        whileHover={{ scale: 1.1, rotate: -5 }}
        transition={spring}
      >
        <feature.icon className={`h-6 w-6 ${feature.color}`} />
      </motion.div>
      <h3 className="mt-4 font-orbitron text-lg font-semibold text-white">{feature.title}</h3>
      <p className="mt-2 text-sm text-slate-300">{feature.desc}</p>
      <motion.div
        className="mt-3 h-0.5 origin-left rounded-full"
        initial={{ scaleX: 0 }}
        whileHover={{ scaleX: 1 }}
        transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
        style={{
          background: feature.color === 'text-amber-300' ? '#fbbf24'
            : feature.color === 'text-violet-300' ? '#a78bfa'
            : feature.color === 'text-emerald-300' ? '#34d399'
            : '#60a5fa',
          opacity: 0.5,
        }}
      />
    </motion.article>
  )
}

/* ═══════════════════════════════════════════════
   SECURITY CARD
═══════════════════════════════════════════════ */
function SecurityCard({ item, index }: { item: typeof securityFeatures[0]; index: number }) {
  const colorClass = item.color === 'amber' ? 'text-amber-300'
    : item.color === 'violet' ? 'text-violet-300'
    : item.color === 'emerald' ? 'text-emerald-300'
    : 'text-blue-300'

  return (
    <motion.article
      initial="hidden"
      whileInView="visible"
      viewport={{ once: true, margin: '-40px' }}
      variants={fadeUp(index * 0.12, 0.6)}
      whileHover={{ y: -6, scale: 1.01 }}
      transition={spring}
      className={`rounded-2xl border ${item.border} ${item.bg} p-6 transition-all duration-300`}
    >
      <div className="relative">
        <motion.div
          className={`inline-flex rounded-xl ${item.bg} p-3`}
          animate={{
            boxShadow: [
              '0 0 0px rgba(139,92,246,0)',
              '0 0 20px rgba(139,92,246,0.3)',
              '0 0 0px rgba(139,92,246,0)',
            ],
          }}
          transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
        >
          <item.icon className={`h-6 w-6 ${colorClass}`} />
        </motion.div>
        <h3 className="mt-4 font-orbitron text-lg font-semibold text-white">{item.title}</h3>
        <p className="mt-2 text-sm text-slate-300">{item.desc}</p>
        <div className={`mt-4 inline-flex items-center gap-1.5 rounded-full border ${item.border} ${item.bg} px-3 py-1.5 text-xs font-medium ${colorClass}`}>
          <CheckCircle2 className="h-3 w-3" />
          {item.proof}
        </div>
      </div>
    </motion.article>
  )
}

/* ═══════════════════════════════════════════════
   HEADLINE WORD REVEAL — GSAP-powered
═══════════════════════════════════════════════ */
function HeroHeadline({ heroRef }: { heroRef: React.RefObject<HTMLDivElement | null> }) {
  const headlineRef = useRef<HTMLHeadingElement>(null)

  useEffect(() => {
    if (!headlineRef.current || typeof window === 'undefined') return
    const words = headlineRef.current.querySelectorAll<HTMLElement>('[data-word]')
    if (!words.length) return

    gsap.fromTo(words,
      { opacity: 0, y: 60, rotateX: -30, filter: 'blur(8px)' },
      {
        opacity: 1, y: 0, rotateX: 0, filter: 'blur(0px)',
        stagger: 0.07,
        duration: 0.9,
        ease: 'power4.out',
        delay: 0.6,
      }
    )
  }, [])

  return (
    <h1
      ref={headlineRef}
      className="font-orbitron text-4xl font-bold leading-tight tracking-tight md:text-6xl lg:text-7xl"
      style={{ perspective: 800 }}
    >
      <span data-word className="mr-[0.25em] inline-block opacity-0">Trade</span>
      <span data-word className="mr-[0.25em] inline-block opacity-0">smarter</span>
      <span data-word className="mr-[0.25em] inline-block opacity-0">with</span>
      <br />
      <span data-word className="mr-[0.25em] inline-block bg-gradient-to-r from-amber-300 via-violet-400 to-amber-300 bg-clip-text text-transparent opacity-0">
        AI-powered
      </span>
      <span data-word className="mr-[0.25em] inline-block bg-gradient-to-r from-amber-300 via-violet-400 to-amber-300 bg-clip-text text-transparent opacity-0">
        bots
      </span>
      <br />
      <span data-word className="mr-[0.25em] inline-block opacity-0">and</span>
      <span data-word className="mr-[0.25em] inline-block opacity-0">institutional</span>
      <span data-word className="mr-[0.25em] inline-block opacity-0">security</span>
    </h1>
  )
}

/* ═══════════════════════════════════════════════
   GSAP CURSOR TRAILER
═══════════════════════════════════════════════ */
function CursorTrailer() {
  const dotRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (typeof window === 'undefined') return
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    const dot = dotRef.current
    if (!dot) return

    const pos = { x: 0, y: 0 }
    const mouse = { x: 0, y: 0 }

    const onMove = (e: MouseEvent) => {
      mouse.x = e.clientX
      mouse.y = e.clientY
    }

    const tickerCb = () => {
      pos.x += (mouse.x - pos.x) * 0.1
      pos.y += (mouse.y - pos.y) * 0.1
      dot.style.transform = `translate(${pos.x}px, ${pos.y}px) translate(-50%, -50%)`
    }
    gsap.ticker.add(tickerCb)

    window.addEventListener('mousemove', onMove)
    return () => {
      window.removeEventListener('mousemove', onMove)
      gsap.ticker.remove(tickerCb)
    }
  }, [])

  return (
    <div
      ref={dotRef}
      className="pointer-events-none fixed z-[9999] hidden md:block"
      aria-hidden="true"
    >
      <div className="h-3 w-3 rounded-full bg-amber-400/40 blur-[2px]" />
    </div>
  )
}

/* ═══════════════════════════════════════════════
   GSAP SCROLL SECTION REVEAL
═══════════════════════════════════════════════ */
function GsapSection({ children, className, id }: { children: React.ReactNode; className?: string; id?: string }) {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!ref.current || typeof window === 'undefined') return

    const ctx = gsap.context(() => {
      const targets = ref.current!.querySelectorAll<HTMLElement>('[data-gsap]')
      targets.forEach((el, i) => {
        const type: string = el.dataset.gsap ?? 'fadeUp'
        const delay = Number(el.dataset.delay ?? i * 0.1)
        const dur = Number(el.dataset.dur ?? 0.7)
        const fromY = Number(el.dataset.y ?? 50)
        const fromX = Number(el.dataset.x ?? 0)

        let vars: gsap.TweenVars = { opacity: 0, y: fromY, x: fromX, duration: dur, delay, ease: 'power3.out' }

        if (type === 'fadeLeft')    vars = { ...vars, x: -60, y: 0 }
        if (type === 'fadeRight')    vars = { ...vars, x: 60,  y: 0 }
        if (type === 'scale')        vars = { ...vars, x: 0,  y: 0, scale: 0.85, opacity: 0 }
        if (type === 'blur')        vars = { ...vars, x: 0,  y: 30, filter: 'blur(8px)', opacity: 0 }

        ScrollTrigger.create({
          trigger: el,
          start: 'top 88%',
          once: true,
          onEnter: () => gsap.from(el, vars),
        })
      })

      // Stagger groups
      ref.current!.querySelectorAll<HTMLElement>('[data-stagger-group]').forEach((group) => {
        const children = group.querySelectorAll<HTMLElement>('[data-stagger-item]')
        const stagger = Number(group.dataset.staggerDelay ?? 0.1)
        gsap.from(children, {
          opacity: 0, y: 40, stagger,
          duration: 0.6,
          ease: 'power3.out',
          scrollTrigger: {
            trigger: group,
            start: 'top 88%',
            once: true,
          },
        })
      })
    }, ref)

    return () => ctx.revert()
  }, [])

  return (
    <div ref={ref} className={className} id={id}>
      {children}
    </div>
  )
}

/* ═══════════════════════════════════════════════
   MAIN LANDING PAGE
═══════════════════════════════════════════════ */
export default function Home() {
  const heroRef = useRef<HTMLDivElement>(null)
  const badgeRef = useRef<HTMLDivElement>(null)
  const [showMotionEffects, setShowMotionEffects] = useState(false)

  useEffect(() => {
    setShowMotionEffects(!window.matchMedia('(prefers-reduced-motion: reduce)').matches)
  }, [])

  // GSAP Hero entrance timeline
  useEffect(() => {
    if (typeof window === 'undefined') return
    const ctx = gsap.context(() => {
      const tl = gsap.timeline({ defaults: { ease: 'power4.out' } })

      // Badge
      tl.fromTo(badgeRef.current,
        { opacity: 0, y: -20, scale: 0.7, filter: 'blur(6px)' },
        { opacity: 1, y: 0, scale: 1, filter: 'blur(0px)', duration: 0.8 },
        0.3
      )

      // CTA buttons stagger
      tl.fromTo('[data-hero-cta]',
        { opacity: 0, y: 30, scale: 0.95 },
        { opacity: 1, y: 0, scale: 1, stagger: 0.12, duration: 0.7 },
        1.4
      )

      // Trust pills
      tl.fromTo('[data-hero-pill]',
        { opacity: 0, scale: 0.7 },
        { opacity: 1, scale: 1, stagger: 0.07, duration: 0.5 },
        1.6
      )

      // Stats
      tl.fromTo('[data-hero-stat]',
        { opacity: 0, y: 40, scale: 0.9 },
        { opacity: 1, y: 0, scale: 1, stagger: 0.1, duration: 0.6 },
        1.8
      )

      // Subheadline
      tl.fromTo('[data-hero-sub]',
        { opacity: 0, y: 24 },
        { opacity: 1, y: 0, duration: 0.7 },
        1.2
      )
    }, heroRef)

    return () => ctx.revert()
  }, [])

  return (
    <>
      <RedirectToDashboardIfAuth />
      <CursorTrailer />
      <main className="relative min-h-screen overflow-x-hidden bg-slate-950 font-exo text-slate-50">

        {/* ── BACKGROUND LAYERS ────────────────── */}
        <div className="pointer-events-none fixed inset-0 z-0" aria-hidden="true">
          {showMotionEffects && (
            <>
              <ParticleGrid particleCount={70} speed={0.5} />
              <ScanLine speed={4} />
            </>
          )}
          <GlowOrbs />
          <div
            style={{
              backgroundImage: `
                linear-gradient(rgba(255,255,255,0.018) 1px, transparent 1px),
                linear-gradient(90deg, rgba(255,255,255,0.018) 1px, transparent 1px)
              `,
              backgroundSize: '64px 64px',
            }}
          />
        </div>

        {/* ── HERO ─────────────────────────────── */}
        <section ref={heroRef} className="relative z-10 overflow-hidden">
          <div className="container relative z-10 mx-auto max-w-7xl px-4 py-28 md:py-40">
            <div className="mx-auto max-w-5xl text-center">

              {/* GSAP-animated badge */}
              <div
                ref={badgeRef}
                className="inline-flex items-center gap-2 rounded-full border border-amber-400/30
                  bg-amber-400/10 px-4 py-1.5 text-xs font-medium text-amber-300 shadow-lg shadow-amber-400/10"
              >
                <span className="relative flex h-2 w-2">
                  <span className="absolute inline-flex h-full w-full rounded-full bg-emerald-400 animate-ping opacity-75" />
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-400" />
                </span>
                <ShieldCheck className="h-3.5 w-3.5" />
                Security-first crypto automation platform
              </div>

              {/* GSAP headline word reveal */}
              <div className="mt-10">
                <HeroHeadline heroRef={heroRef} />
              </div>

              {/* GSAP subheadline */}
              <p
                data-hero-sub
                className="mx-auto mt-8 max-w-3xl text-pretty text-base text-slate-300 opacity-0 md:text-lg"
              >
                Non-custodial infrastructure, continuous risk monitoring, and transparent execution
                logs for every trade decision. Join 128,000+ traders protecting $2.4B+ in assets.
              </p>

              {/* GSAP CTA buttons */}
              <div className="mt-12 flex flex-wrap items-center justify-center gap-5">
                <div data-hero-cta className="opacity-0">
                  <MagneticButton
                    href="/register"
                    strength={0.7}
                    className="inline-flex cursor-pointer items-center gap-2 rounded-xl
                      bg-gradient-to-r from-violet-600 to-violet-500 px-9 py-4 text-sm font-semibold
                      text-white shadow-lg shadow-violet-500/25 hover:shadow-violet-500/50 hover:shadow-xl"
                  >
                    <span className="flex items-center gap-2">
                      Launch Trading Bot
                      <Rocket className="h-4 w-4" />
                    </span>
                  </MagneticButton>
                </div>
                <div data-hero-cta className="opacity-0">
                  <MagneticButton
                    href="/dashboard"
                    strength={0.5}
                    className="inline-flex cursor-pointer items-center gap-2 rounded-xl border border-white/20
                      bg-white/5 px-9 py-4 text-sm font-medium text-slate-100 backdrop-blur-sm
                      hover:bg-white/10 hover:border-white/30"
                  >
                    <span className="flex items-center gap-2">
                      View Live Demo
                      <ChevronRight className="h-4 w-4" />
                    </span>
                  </MagneticButton>
                </div>
              </div>

              {/* GSAP trust pills */}
              <div className="mt-8 flex flex-wrap items-center justify-center gap-2 text-xs text-slate-300">
                {['Audited smart contracts', '256-bit encryption', '24/7 anomaly monitoring', 'Sub-120ms execution'].map((item) => (
                  <span
                    key={item}
                    data-hero-pill
                    className="rounded-full border border-white/10 bg-white/5 px-3 py-1.5 backdrop-blur-sm opacity-0
                      transition-all duration-200 hover:border-white/20 hover:bg-white/10"
                  >
                    <CheckCircle2 className="mr-1 inline h-3 w-3 text-emerald-400" />
                    {item}
                  </span>
                ))}
              </div>

              {/* GSAP stats */}
              <div className="mt-16 grid grid-cols-2 gap-3 sm:grid-cols-4">
                {trustStats.map((stat, i) => (
                  <motion.div
                    key={stat.label}
                    data-hero-stat
                    initial="hidden"
                    whileInView="visible"
                    viewport={{ once: true }}
                    variants={fadeUp(i * 0.1, 0.6)}
                    className="rounded-2xl border border-white/10 bg-white/5 p-5 text-left shadow-lg
                      backdrop-blur-xl transition-all duration-300 hover:border-white/20 hover:bg-white/10 opacity-0"
                  >
                    <stat.icon className={`h-5 w-5 ${stat.color}`} />
                    <AnimatedCounter
                      target={stat.value}
                      format={stat.fmt}
                      delay={i * 0.15}
                      className="mt-2 block font-orbitron text-2xl font-bold text-white"
                    />
                    <p className="mt-1 text-xs text-slate-400">{stat.label}</p>
                  </motion.div>
                ))}
              </div>
            </div>
          </div>

          <div className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-white/10 to-transparent" />
        </section>

        {/* ── MARKET PREVIEW ───────────────────── */}
        <GsapSection className="relative z-10 container mx-auto max-w-7xl px-4 py-20 md:py-28">
          <motion.div
            data-gsap="fadeUp"
            className="mb-8 flex flex-wrap items-center justify-between gap-4"
          >
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-amber-400/30 bg-amber-400/10 shadow-lg shadow-amber-400/10">
                <ChartCandlestick className="h-5 w-5 text-amber-300" />
              </div>
              <div>
                <h2 className="font-orbitron text-lg font-semibold text-white">Real-time Market</h2>
                <p className="text-xs text-slate-400">Live price feeds from top exchanges</p>
              </div>
            </div>
            <div className="flex items-center gap-2 rounded-full border border-emerald-400/30 bg-emerald-400/10 px-4 py-2 text-xs font-medium text-emerald-300 shadow-lg shadow-emerald-400/10">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full rounded-full bg-emerald-400 animate-ping opacity-75" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-400" />
              </span>
              Avg. execution latency &lt;120ms
            </div>
          </motion.div>

          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3" data-stagger-group data-stagger-delay="0.08">
            {priceCards.map((card, i) => (
              <div key={card.pair} data-stagger-item>
                <PriceCard card={card} index={i} />
              </div>
            ))}
          </div>
        </GsapSection>

        {/* ── SECURITY SECTION ─────────────────── */}
        <GsapSection className="relative z-10 container mx-auto max-w-7xl px-4 py-20 md:py-28">
          <motion.div
            data-gsap="fadeLeft"
            className="rounded-3xl border border-white/10 bg-white/5 p-8 shadow-2xl backdrop-blur-xl md:p-12 lg:flex lg:gap-12"
          >
            <div className="lg:w-1/3">
              <div className="inline-flex items-center gap-2 rounded-full border border-violet-400/30 bg-violet-400/10 px-3 py-1 text-xs font-medium text-violet-300">
                <Shield className="h-3.5 w-3.5" />
                Enterprise Security
              </div>
              <h2 className="mt-5 font-orbitron text-2xl font-bold tracking-tight md:text-3xl">
                Security architecture built for high-stakes execution
              </h2>
              <p className="mt-4 text-slate-300">
                Your strategy logic runs behind layered controls designed for resilience, traceability,
                and fast incident response.
              </p>
              <div className="mt-6 space-y-3">
                {[
                  { icon: Network,    text: 'Ingress firewall + auth gateway' },
                  { icon: Zap,        text: 'Strategy engine with risk guardrails' },
                  { icon: BadgeCheck, text: 'Immutable audit and verification layer' },
                ].map((item, i) => (
                  <div key={i} className="flex items-center gap-3 rounded-xl border border-white/10 bg-white/5 p-3 text-sm text-slate-200">
                    <item.icon className="h-4 w-4 text-amber-400" />
                    {item.text}
                  </div>
                ))}
              </div>
            </div>
            <div className="mt-8 grid gap-4 lg:mt-0 lg:w-2/3 md:grid-cols-2" data-stagger-group data-stagger-delay="0.1">
              {securityFeatures.map((item, i) => (
                <div key={item.title} data-stagger-item>
                  <SecurityCard item={item} index={i} />
                </div>
              ))}
            </div>
          </motion.div>
        </GsapSection>

        {/* ── FEATURES ─────────────────────────── */}
        <GsapSection className="relative z-10 container mx-auto max-w-7xl px-4 py-20 md:py-28">
          <motion.div
            data-gsap="fadeUp"
            className="mb-12 text-center"
          >
            <h2 className="font-orbitron text-3xl font-bold tracking-tight md:text-4xl">
              Everything you need to{' '}
              <span className="bg-gradient-to-r from-amber-300 to-violet-400 bg-clip-text text-transparent">
                trade confidently
              </span>
            </h2>
            <p className="mx-auto mt-4 max-w-2xl text-slate-300">
              Professional-grade tools designed for traders who demand reliability, transparency, and performance.
            </p>
          </motion.div>

          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            {features.map((feature, i) => (
              <FeatureCard key={feature.title} feature={feature} index={i} />
            ))}
          </div>
        </GsapSection>

        {/* ── WALLET + TRUST ────────────────────── */}
        <GsapSection className="relative z-10 container mx-auto max-w-7xl px-4 py-20 md:py-28">
          <div className="grid gap-6 lg:grid-cols-2">

            {/* Wallet */}
            <motion.div
              data-gsap="fadeLeft"
              className="rounded-3xl border border-white/10 bg-white/5 p-8 shadow-xl backdrop-blur-xl
                transition-all duration-300 hover:border-white/20"
            >
              <div className="flex items-center gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl border border-violet-400/30 bg-violet-400/10">
                  <Wallet className="h-6 w-6 text-violet-300" />
                </div>
                <div>
                  <h2 className="font-orbitron text-xl font-bold text-white">Wallet Integration</h2>
                  <p className="text-xs text-slate-400">Non-custodial access</p>
                </div>
              </div>
              <p className="mt-5 text-slate-300">
                Connect in seconds with non-custodial access and granular risk settings. You maintain full control.
              </p>
              <div className="mt-5 flex flex-wrap gap-3">
                {wallets.map((wallet) => (
                  <motion.span
                    key={wallet}
                    whileHover={{ y: -3, scale: 1.04 }}
                    transition={spring}
                    className="cursor-pointer rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm text-slate-200
                      transition-all duration-200 hover:bg-white/10 hover:border-white/20"
                  >
                    {wallet}
                  </motion.span>
                ))}
              </div>
              <div className="mt-6 space-y-3">
                {[
                  { step: 1, text: 'Connect wallet of your choice' },
                  { step: 2, text: 'Configure risk profile and bot behavior' },
                  { step: 3, text: 'Start automated execution with live monitoring' },
                ].map((item) => (
                  <motion.div
                    key={item.step}
                    whileHover={{ x: 6 }}
                    transition={spring}
                    className="flex items-center gap-3 text-sm text-slate-200"
                  >
                    <div className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-violet-500/20 text-xs font-bold text-violet-300">
                      {item.step}
                    </div>
                    <span>{item.text}</span>
                  </motion.div>
                ))}
              </div>
              <p className="mt-5 flex items-center gap-2 text-xs text-slate-400">
                <LockKeyhole className="h-3.5 w-3.5 text-emerald-400" />
                Non-custodial by design. You retain control of your assets.
              </p>
            </motion.div>

            {/* Trust */}
            <motion.div
              data-gsap="fadeRight"
              className="rounded-3xl border border-white/10 bg-white/5 p-8 shadow-xl backdrop-blur-xl
                transition-all duration-300 hover:border-white/20"
            >
              <div className="flex items-center gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl border border-amber-400/30 bg-amber-400/10">
                  <ShieldCheck className="h-6 w-6 text-amber-300" />
                </div>
                <div>
                  <h2 className="font-orbitron text-xl font-bold text-white">Trusted by Professionals</h2>
                  <p className="text-xs text-slate-400">Built for compliance</p>
                </div>
              </div>
              <div className="mt-6">
                <TestimonialCarousel />
              </div>
              <p className="mt-5 flex items-center gap-2 text-xs text-slate-400">
                <BadgeCheck className="h-3.5 w-3.5 text-emerald-400" />
                Verified by leading security auditors
              </p>
            </motion.div>
          </div>
        </GsapSection>

        {/* ── CTA ───────────────────────────────── */}
        <GsapSection className="relative z-10 container mx-auto max-w-7xl px-4 pb-24 md:pb-36">
          <motion.div
            data-gsap="scale"
            className="animate-cta-glow relative overflow-hidden rounded-3xl border border-white/10
              bg-gradient-to-br from-violet-600/20 via-slate-900/90 to-amber-500/15
              p-10 shadow-2xl backdrop-blur-xl md:p-16"
          >
            <div className="pointer-events-none absolute -right-20 -top-20 h-80 w-80 rounded-full bg-violet-500/25 blur-3xl" aria-hidden="true" />
            <div className="pointer-events-none absolute -bottom-20 -left-20 h-80 w-80 rounded-full bg-amber-500/25 blur-3xl" aria-hidden="true" />

            <motion.div
              data-gsap="fadeUp"
              className="relative z-10 text-center"
            >
              <h2 className="font-orbitron text-3xl font-bold tracking-tight md:text-4xl lg:text-5xl">
                Start secure trading today
              </h2>
              <p className="mx-auto mt-5 max-w-2xl text-slate-300 md:text-lg">
                Launch your first strategy with transparent controls, advanced guardrails, and
                real-time observability from day one.
              </p>

              <div className="mt-10 flex flex-wrap items-center justify-center gap-4">
                <div data-hero-cta className="opacity-0">
                  <MagneticButton
                    href="/register"
                    strength={0.8}
                    className="inline-flex cursor-pointer items-center gap-2 rounded-xl
                      bg-gradient-to-r from-amber-500 to-amber-400 px-9 py-4 text-sm font-bold
                      text-slate-900 shadow-lg shadow-amber-500/25 hover:shadow-amber-500/50 hover:shadow-xl"
                  >
                    <span className="flex items-center gap-2">
                      Create Free Account
                      <Rocket className="h-4 w-4" />
                    </span>
                  </MagneticButton>
                </div>
                <div data-hero-cta className="opacity-0">
                  <MagneticButton
                    href="/dashboard"
                    strength={0.5}
                    className="inline-flex cursor-pointer items-center gap-2 rounded-xl border border-white/25
                      bg-white/10 px-9 py-4 text-sm font-medium text-white backdrop-blur-sm
                      hover:bg-white/15 hover:border-white/40"
                  >
                    <span className="flex items-center gap-2">
                      Explore Dashboard
                      <ChevronRight className="h-4 w-4" />
                    </span>
                  </MagneticButton>
                </div>
              </div>

              <p className="mx-auto mt-6 max-w-xl text-xs text-slate-400/80">
                <ShieldCheck className="mr-1 inline h-3 w-3 text-emerald-400" />
                Risk disclaimer: Crypto trading involves market risk. Always configure position limits
                and stop-loss safeguards before enabling live execution.
              </p>
            </motion.div>
          </motion.div>
        </GsapSection>

        {/* ── FOOTER ───────────────────────────── */}
        <footer className="relative z-10 border-t border-white/5 bg-slate-950/80 backdrop-blur-xl">
          <div className="container mx-auto max-w-7xl px-4 py-10">
            <motion.div
              data-gsap="fadeUp"
              className="flex flex-col items-center justify-between gap-4 md:flex-row"
            >
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-violet-600 to-amber-500">
                  <Activity className="h-5 w-5 text-white" />
                </div>
                <div>
                  <p className="font-orbitron text-sm font-bold text-white">TradingBot</p>
                  <p className="text-xs text-slate-400">Security-first crypto automation</p>
                </div>
              </div>
              <nav className="flex items-center gap-6 text-xs text-slate-400" aria-label="Footer">
                {['Privacy', 'Terms', 'Contact', 'Documentation'].map((link) => (
                  <a key={link} href="#" className="cursor-pointer transition-colors duration-200 hover:text-white">
                    {link}
                  </a>
                ))}
              </nav>
              <p className="text-xs text-slate-500">&copy; 2026 TradingBot. All rights reserved.</p>
            </motion.div>
          </div>
        </footer>

      </main>
    </>
  )
}
