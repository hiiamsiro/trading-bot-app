import Link from 'next/link'
import {
  Activity,
  BadgeCheck,
  Bitcoin,
  ChartCandlestick,
  CheckCircle2,
  ChevronRight,
  Clock3,
  Cpu,
  Eye,
  Fingerprint,
  Globe,
  Headphones,
  LockKeyhole,
  Network,
  Rocket,
  Shield,
  ShieldCheck,
  Users,
  Wallet,
  Zap,
} from 'lucide-react'
import { RedirectToDashboardIfAuth } from '@/components/auth/redirect-to-dashboard-if-auth'

const priceCards = [
  { pair: 'BTC/USDT', price: '$68,244.13', change: '+2.31%', positive: true, points: [36, 40, 38, 46, 49, 53, 56, 59] },
  { pair: 'ETH/USDT', price: '$3,481.72', change: '+1.64%', positive: true, points: [22, 24, 28, 27, 31, 33, 36, 38] },
  { pair: 'SOL/USDT', price: '$178.05', change: '+4.92%', positive: true, points: [12, 16, 15, 21, 25, 24, 30, 34] },
  { pair: 'BNB/USDT', price: '$592.40', change: '+0.87%', positive: true, points: [30, 32, 29, 35, 33, 37, 36, 40] },
  { pair: 'XRP/USDT', price: '$0.5231', change: '-0.42%', positive: false, points: [45, 42, 44, 40, 42, 38, 40, 37] },
  { pair: 'DOGE/USDT', price: '$0.1247', change: '+3.21%', positive: true, points: [20, 22, 19, 28, 31, 29, 35, 38] },
]

const securityFeatures = [
  {
    title: 'Multi-layer Encryption',
    description: 'AES-256 at rest and TLS 1.3 in transit across every request path.',
    proof: '256-bit encryption',
    icon: LockKeyhole,
    color: 'text-amber-300',
    bg: 'bg-amber-300/10',
    border: 'border-amber-300/25',
  },
  {
    title: 'Multi-Sig Order Validation',
    description: 'Critical actions require policy checks before execution is accepted.',
    proof: 'Policy-based approvals',
    icon: Shield,
    color: 'text-violet-300',
    bg: 'bg-violet-300/10',
    border: 'border-violet-300/25',
  },
  {
    title: 'AI Anomaly Detection',
    description: 'Runtime models detect outlier behavior and auto-trigger safeguards.',
    proof: '24/7 behavior scoring',
    icon: Cpu,
    color: 'text-emerald-300',
    bg: 'bg-emerald-300/10',
    border: 'border-emerald-300/25',
  },
  {
    title: 'Continuous Audit Trails',
    description: 'Every event is traceable with immutable logs and verification metadata.',
    proof: 'Tamper-evident logs',
    icon: Fingerprint,
    color: 'text-blue-300',
    bg: 'bg-blue-300/10',
    border: 'border-blue-300/25',
  },
]

const trustStats = [
  { label: 'Protected assets', value: '$2.4B+', icon: Shield },
  { label: 'Active traders', value: '128K+', icon: Users },
  { label: 'Infrastructure uptime', value: '99.99%', icon: Globe },
  { label: 'Processed orders', value: '430M+', icon: Activity },
]

const features = [
  {
    title: 'Real-time Execution',
    description: 'Sub-120ms order execution with intelligent routing across major exchanges.',
    icon: Zap,
    color: 'text-amber-300',
    bg: 'bg-amber-300/10',
    border: 'border-amber-300/20',
  },
  {
    title: 'Smart Risk Management',
    description: 'Configurable position limits, stop-loss, and drawdown protection for every strategy.',
    icon: Eye,
    color: 'text-violet-300',
    bg: 'bg-violet-300/10',
    border: 'border-violet-300/20',
  },
  {
    title: 'Portfolio Analytics',
    description: 'Deep performance metrics, equity curves, and attribution analysis in real-time.',
    icon: ChartCandlestick,
    color: 'text-emerald-300',
    bg: 'bg-emerald-300/10',
    border: 'border-emerald-300/20',
  },
  {
    title: '24/7 Support',
    description: 'Dedicated trading specialists and technical support available around the clock.',
    icon: Headphones,
    color: 'text-blue-300',
    bg: 'bg-blue-300/10',
    border: 'border-blue-300/20',
  },
]

const testimonials = [
  {
    quote: 'Execution logs and risk controls are clear enough for compliance review. This platform changed how our team approaches automated trading.',
    author: 'Marcus Chen',
    role: 'Head of Trading, Apex Fund',
    avatar: 'MC',
  },
  {
    quote: 'The latency and uptime profile makes this feel production-ready from day one. Integration was seamless.',
    author: 'Sarah Kim',
    role: 'Quant Developer, Blockwave Capital',
    avatar: 'SK',
  },
  {
    quote: 'Best-in-class security architecture. We audited the smart contracts and the implementation is solid.',
    author: 'David Torres',
    role: 'Security Lead, CyberVault',
    avatar: 'DT',
  },
]

const wallets = [
  { name: 'MetaMask', icon: '🦊' },
  { name: 'WalletConnect', icon: '🔗' },
  { name: 'Coinbase Wallet', icon: '💙' },
  { name: 'OKX Wallet', icon: '🟠' },
]

function MiniChart({ points, positive }: { points: number[]; positive: boolean }) {
  const max = Math.max(...points)
  const min = Math.min(...points)
  const normalized = points.map((value, index) => {
    const x = (index / (points.length - 1)) * 100
    const y = ((max - value) / Math.max(max - min, 1)) * 100
    return `${x},${y}`
  })

  return (
    <svg viewBox="0 0 100 100" className="h-16 w-full" aria-hidden="true" preserveAspectRatio="none">
      <defs>
        <linearGradient id={`grad-${positive}`} x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor={positive ? '#34d399' : '#f87171'} stopOpacity="0.3" />
          <stop offset="100%" stopColor={positive ? '#34d399' : '#f87171'} stopOpacity="0" />
        </linearGradient>
      </defs>
      <polygon
        points={`0,100 ${normalized.join(' ')} 100,100`}
        fill={`url(#grad-${positive})`}
      />
      <polyline
        fill="none"
        stroke={positive ? '#34d399' : '#f87171'}
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        points={normalized.join(' ')}
      />
    </svg>
  )
}

export default function Home() {
  return (
    <>
      <RedirectToDashboardIfAuth />
      <main className="min-h-screen bg-slate-950 text-slate-50 font-exo">

        {/* Ambient Background Orbs */}
        <div className="pointer-events-none fixed inset-0 overflow-hidden">
          <div className="animate-pulse-glow absolute -left-40 -top-40 h-96 w-96 rounded-full bg-amber-500/10 blur-3xl [&:nth-child(2)]:animate-delay-1000" />
          <div className="animate-pulse-glow absolute -right-40 -top-20 h-80 w-80 rounded-full bg-violet-500/10 blur-3xl [&:nth-child(3)]:animate-delay-2000" />
          <div className="animate-pulse-glow absolute -bottom-20 left-1/3 h-72 w-72 rounded-full bg-blue-500/10 blur-3xl [&:nth-child(4)]:animate-delay-2000" />
          <div className="animate-float absolute right-20 top-1/3 h-64 w-64 rounded-full bg-emerald-500/5 blur-3xl" />
          <div className="animate-float-delayed absolute left-1/4 top-2/3 h-48 w-48 rounded-full bg-amber-400/5 blur-3xl" />
        </div>

        {/* Hero Section */}
        <section className="relative overflow-hidden border-b border-white/5">
          <div className="container relative z-10 mx-auto max-w-7xl px-4 py-20 md:py-28">
            <div className="mx-auto max-w-5xl text-center">

              {/* Badge */}
              <div className="animate-slide-up inline-flex items-center gap-2 rounded-full border border-amber-400/30 bg-amber-400/10 px-4 py-1.5 text-xs font-medium text-amber-300 shadow-lg shadow-amber-400/10">
                <ShieldCheck className="h-3.5 w-3.5" />
                Security-first crypto automation platform
                <span className="ml-1 h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
              </div>

              {/* Headline */}
              <h1 className="animate-slide-up mt-6 font-orbitron text-4xl font-bold leading-tight tracking-tight md:text-6xl lg:text-7xl" style={{ animationDelay: '0.1s' }}>
                Trade smarter with{' '}
                <span className="bg-gradient-to-r from-amber-300 via-violet-400 to-amber-300 bg-clip-text text-transparent animate-gradient">
                  AI-powered bots
                </span>
                <br />and institutional security
              </h1>

              {/* Subheadline */}
              <p className="animate-slide-up mx-auto mt-6 max-w-3xl text-balance text-base text-slate-300 md:text-lg" style={{ animationDelay: '0.2s' }}>
                Non-custodial infrastructure, continuous risk monitoring, and transparent execution
                logs for every trade decision. Join 128,000+ traders protecting $2.4B+ in assets.
              </p>

              {/* CTA Buttons */}
              <div className="animate-slide-up mt-10 flex flex-wrap items-center justify-center gap-4" style={{ animationDelay: '0.3s' }}>
                <Link
                  href="/register"
                  className="group inline-flex cursor-pointer items-center gap-2 rounded-xl bg-gradient-to-r from-violet-600 to-violet-500 px-8 py-4 text-sm font-semibold text-white shadow-lg shadow-violet-500/25 transition-all duration-300 hover:gap-3 hover:shadow-violet-500/40 hover:shadow-xl hover:-translate-y-0.5"
                >
                  Launch Trading Bot
                  <Rocket className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
                </Link>
                <Link
                  href="/dashboard"
                  className="group inline-flex cursor-pointer items-center gap-2 rounded-xl border border-white/20 bg-white/5 px-8 py-4 text-sm font-medium text-slate-100 backdrop-blur-sm transition-all duration-300 hover:bg-white/10 hover:border-white/30"
                >
                  View Live Demo
                  <ChevronRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
                </Link>
              </div>

              {/* Trust Pills */}
              <div className="animate-slide-up mt-8 flex flex-wrap items-center justify-center gap-2 text-xs text-slate-300" style={{ animationDelay: '0.4s' }}>
                {['Audited smart contracts', '256-bit encryption', '24/7 anomaly monitoring', 'Sub-120ms execution'].map((item) => (
                  <span key={item} className="rounded-full border border-white/10 bg-white/5 px-3 py-1.5 backdrop-blur-sm">
                    <CheckCircle2 className="mr-1 inline h-3 w-3 text-emerald-400" />
                    {item}
                  </span>
                ))}
              </div>

              {/* Stats Grid */}
              <div className="animate-slide-up mt-12 grid grid-cols-2 gap-3 sm:grid-cols-4" style={{ animationDelay: '0.5s' }}>
                {trustStats.map((stat, index) => (
                  <div
                    key={stat.label}
                    className="glass-card-hover cursor-pointer rounded-2xl border border-white/10 bg-white/5 p-5 text-left shadow-lg backdrop-blur-xl transition-all duration-300 hover:-translate-y-1 hover:shadow-xl"
                  >
                    <stat.icon className="h-5 w-5 text-amber-400" />
                    <p className="mt-2 font-orbitron text-2xl font-bold text-white">{stat.value}</p>
                    <p className="mt-1 text-xs text-slate-400">{stat.label}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Bottom Fade */}
          <div className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-white/10 to-transparent" />
        </section>

        {/* Market Preview Section */}
        <section className="relative z-10 container mx-auto max-w-7xl px-4 py-14 md:py-20">
          <div className="mb-8 flex flex-wrap items-center justify-between gap-4">
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
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-400" />
              </span>
              Avg. execution latency &lt;120ms
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {priceCards.map((card, index) => (
              <article
                key={card.pair}
                className="glass-card-hover group cursor-pointer rounded-2xl border border-white/10 bg-white/5 p-5 shadow-lg backdrop-blur-xl transition-all duration-300 hover:-translate-y-1 hover:shadow-xl"
                style={{ animationDelay: `${index * 0.1}s` }}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-white/10">
                      <Bitcoin className="h-5 w-5 text-amber-400" />
                    </div>
                    <p className="font-medium text-white">{card.pair}</p>
                  </div>
                  <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${card.positive ? 'bg-emerald-400/15 text-emerald-300' : 'bg-red-400/15 text-red-300'}`}>
                    {card.change}
                  </span>
                </div>
                <p className="mt-3 font-orbitron text-2xl font-bold text-white">{card.price}</p>
                <div className={`mt-4 ${card.positive ? 'text-emerald-400' : 'text-red-400'}`}>
                  <MiniChart points={card.points} positive={card.positive} />
                </div>
              </article>
            ))}
          </div>
        </section>

        {/* Security Architecture Section */}
        <section className="relative z-10 container mx-auto max-w-7xl px-4 py-14 md:py-20">
          <div className="rounded-3xl border border-white/10 bg-white/5 p-8 shadow-2xl backdrop-blur-xl md:p-10 lg:flex lg:gap-10">
            <div className="lg:w-1/3">
              <div className="inline-flex items-center gap-2 rounded-full border border-violet-400/30 bg-violet-400/10 px-3 py-1 text-xs font-medium text-violet-300">
                <Shield className="h-3.5 w-3.5" />
                Enterprise Security
              </div>
              <h2 className="mt-4 font-orbitron text-2xl font-bold tracking-tight md:text-3xl">
                Security architecture built for high-stakes execution
              </h2>
              <p className="mt-4 text-slate-300">
                Your strategy logic runs behind layered controls designed for resilience, traceability,
                and fast incident response.
              </p>
              <div className="mt-6 space-y-3">
                {[
                  { icon: Network, text: 'Ingress firewall + auth gateway' },
                  { icon: Zap, text: 'Strategy engine with risk guardrails' },
                  { icon: BadgeCheck, text: 'Immutable audit and verification layer' },
                ].map((item, i) => (
                  <div key={i} className="flex items-center gap-3 rounded-xl border border-white/10 bg-white/5 p-3 text-sm text-slate-200">
                    <item.icon className="h-4 w-4 text-amber-400" />
                    {item.text}
                  </div>
                ))}
              </div>
            </div>

            <div className="mt-8 grid gap-4 lg:mt-0 lg:w-2/3 md:grid-cols-2">
              {securityFeatures.map((item) => (
                <article
                  key={item.title}
                  className={`glass-card-hover cursor-pointer rounded-2xl border ${item.border} ${item.bg} p-6 transition-all duration-300 hover:-translate-y-1 hover:shadow-lg`}
                >
                  <div className={`inline-flex rounded-xl ${item.bg} p-3`}>
                    <item.icon className={`h-6 w-6 ${item.color}`} />
                  </div>
                  <h3 className="mt-4 font-orbitron text-lg font-semibold text-white">{item.title}</h3>
                  <p className="mt-2 text-sm text-slate-300">{item.description}</p>
                  <div className={`mt-4 inline-flex items-center gap-1.5 rounded-full border ${item.border} ${item.bg} px-3 py-1.5 text-xs font-medium ${item.color}`}>
                    <CheckCircle2 className="h-3 w-3" />
                    {item.proof}
                  </div>
                </article>
              ))}
            </div>
          </div>
        </section>

        {/* Features Bento Grid */}
        <section className="relative z-10 container mx-auto max-w-7xl px-4 py-14 md:py-20">
          <div className="mb-10 text-center">
            <h2 className="font-orbitron text-3xl font-bold tracking-tight md:text-4xl">
              Everything you need to{' '}
              <span className="bg-gradient-to-r from-amber-300 to-violet-400 bg-clip-text text-transparent">
                trade confidently
              </span>
            </h2>
            <p className="mx-auto mt-4 max-w-2xl text-slate-300">
              Professional-grade tools designed for traders who demand reliability, transparency, and performance.
            </p>
          </div>

          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            {features.map((feature, index) => (
              <article
                key={feature.title}
                className={`glass-card-hover cursor-pointer rounded-2xl border border-white/10 bg-white/5 p-6 transition-all duration-300 hover:-translate-y-1 hover:shadow-xl ${index === 0 ? 'md:col-span-2 lg:col-span-2' : ''} ${index === 3 ? 'lg:col-span-2' : ''}`}
              >
                <div className={`inline-flex rounded-xl ${feature.bg} p-3`}>
                  <feature.icon className={`h-6 w-6 ${feature.color}`} />
                </div>
                <h3 className="mt-4 font-orbitron text-lg font-semibold text-white">{feature.title}</h3>
                <p className="mt-2 text-sm text-slate-300">{feature.description}</p>
              </article>
            ))}
          </div>
        </section>

        {/* Wallet & Trust Section */}
        <section className="relative z-10 container mx-auto max-w-7xl px-4 py-14 md:py-20">
          <div className="grid gap-6 lg:grid-cols-2">
            {/* Wallet Integration */}
            <div className="glass-card-hover rounded-3xl border border-white/10 bg-white/5 p-8 shadow-xl backdrop-blur-xl transition-all duration-300 hover:-translate-y-1 hover:shadow-2xl">
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
                Connect in seconds with non-custodial access and granular risk settings. You maintain full control of your assets at all times.
              </p>

              <div className="mt-5 flex flex-wrap gap-3">
                {wallets.map((wallet) => (
                  <span
                    key={wallet.name}
                    className="cursor-pointer rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm text-slate-200 transition-all duration-200 hover:bg-white/10 hover:border-white/20"
                  >
                    {wallet.name}
                  </span>
                ))}
              </div>

              <div className="mt-6 space-y-3">
                {[
                  { step: 1, text: 'Connect wallet of your choice' },
                  { step: 2, text: 'Configure risk profile and bot behavior' },
                  { step: 3, text: 'Start automated execution with live monitoring' },
                ].map((item) => (
                  <div key={item.step} className="flex items-center gap-3 text-sm text-slate-200">
                    <div className="flex h-6 w-6 items-center justify-center rounded-full bg-violet-500/20 text-xs font-bold text-violet-300">
                      {item.step}
                    </div>
                    <span>{item.text}</span>
                  </div>
                ))}
              </div>

              <p className="mt-5 flex items-center gap-2 text-xs text-slate-400">
                <LockKeyhole className="h-3.5 w-3.5 text-emerald-400" />
                Non-custodial by design. You retain control of your assets.
              </p>
            </div>

            {/* Trust Indicators */}
            <div className="glass-card-hover rounded-3xl border border-white/10 bg-white/5 p-8 shadow-xl backdrop-blur-xl transition-all duration-300 hover:-translate-y-1 hover:shadow-2xl">
              <div className="flex items-center gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl border border-amber-400/30 bg-amber-400/10">
                  <ShieldCheck className="h-6 w-6 text-amber-300" />
                </div>
                <div>
                  <h2 className="font-orbitron text-xl font-bold text-white">Trusted by Professionals</h2>
                  <p className="text-xs text-slate-400">Built for compliance</p>
                </div>
              </div>

              {/* Testimonials */}
              <div className="mt-6 space-y-4">
                {testimonials.map((testimonial, index) => (
                  <div
                    key={index}
                    className="rounded-xl border border-white/10 bg-white/5 p-4 transition-all duration-200 hover:bg-white/10"
                  >
                    <p className="text-sm italic text-slate-200">"{testimonial.quote}"</p>
                    <div className="mt-3 flex items-center gap-3">
                      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-violet-500 to-amber-400 text-xs font-bold text-white">
                        {testimonial.avatar}
                      </div>
                      <div>
                        <p className="text-sm font-medium text-white">{testimonial.author}</p>
                        <p className="text-xs text-slate-400">{testimonial.role}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              <div className="mt-5 flex items-center gap-2 text-xs text-slate-400">
                <BadgeCheck className="h-3.5 w-3.5 text-emerald-400" />
                Verified by leading security auditors
              </div>
            </div>
          </div>
        </section>

        {/* CTA Section */}
        <section className="relative z-10 container mx-auto max-w-7xl px-4 pb-20 md:pb-28">
          <div className="relative overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-br from-violet-600/20 via-slate-900/90 to-amber-500/15 p-10 shadow-2xl backdrop-blur-xl md:p-14">
            {/* Background Glow */}
            <div className="pointer-events-none absolute -right-20 -top-20 h-72 w-72 rounded-full bg-violet-500/20 blur-3xl" />
            <div className="pointer-events-none absolute -bottom-20 -left-20 h-72 w-72 rounded-full bg-amber-500/20 blur-3xl" />

            <div className="relative z-10 text-center">
              <h2 className="font-orbitron text-3xl font-bold tracking-tight md:text-4xl lg:text-5xl">
                Start secure trading today
              </h2>
              <p className="mx-auto mt-4 max-w-2xl text-slate-300 md:text-lg">
                Launch your first strategy with transparent controls, advanced guardrails, and
                real-time observability from day one.
              </p>

              <div className="mt-8 flex flex-wrap items-center justify-center gap-4">
                <Link
                  href="/register"
                  className="group inline-flex cursor-pointer items-center gap-2 rounded-xl bg-gradient-to-r from-amber-500 to-amber-400 px-8 py-4 text-sm font-bold text-slate-900 shadow-lg shadow-amber-500/25 transition-all duration-300 hover:gap-3 hover:shadow-amber-500/40 hover:shadow-xl hover:-translate-y-0.5"
                >
                  Create Free Account
                  <Rocket className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
                </Link>
                <Link
                  href="/dashboard"
                  className="group inline-flex cursor-pointer items-center gap-2 rounded-xl border border-white/25 bg-white/10 px-8 py-4 text-sm font-medium text-white backdrop-blur-sm transition-all duration-300 hover:bg-white/15 hover:border-white/40"
                >
                  Explore Dashboard
                  <ChevronRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
                </Link>
              </div>

              <p className="mx-auto mt-6 max-w-xl text-xs text-slate-400/80">
                <ShieldCheck className="mr-1 inline h-3 w-3 text-emerald-400" />
                Risk disclaimer: Crypto trading involves market risk. Always configure position limits
                and stop-loss safeguards before enabling live execution.
              </p>
            </div>
          </div>
        </section>

        {/* Footer */}
        <footer className="relative z-10 border-t border-white/5 bg-slate-950/80 backdrop-blur-xl">
          <div className="container mx-auto max-w-7xl px-4 py-10">
            <div className="flex flex-col items-center justify-between gap-4 md:flex-row">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-violet-600 to-amber-500">
                  <Activity className="h-5 w-5 text-white" />
                </div>
                <div>
                  <p className="font-orbitron text-sm font-bold text-white">TradingBot</p>
                  <p className="text-xs text-slate-400">Security-first crypto automation</p>
                </div>
              </div>
              <div className="flex items-center gap-6 text-xs text-slate-400">
                <a href="#" className="hover:text-white transition-colors">Privacy</a>
                <a href="#" className="hover:text-white transition-colors">Terms</a>
                <a href="#" className="hover:text-white transition-colors">Contact</a>
                <a href="#" className="hover:text-white transition-colors">Documentation</a>
              </div>
              <p className="text-xs text-slate-500">© 2026 TradingBot. All rights reserved.</p>
            </div>
          </div>
        </footer>
      </main>
    </>
  )
}
