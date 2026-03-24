import Link from 'next/link'
import {
  BadgeCheck,
  Bitcoin,
  ChartCandlestick,
  CheckCircle2,
  Clock3,
  Cpu,
  Fingerprint,
  LockKeyhole,
  Network,
  Shield,
  ShieldCheck,
  Wallet,
  Zap,
} from 'lucide-react'

const priceCards = [
  { pair: 'BTC/USDT', price: '$68,244.13', change: '+2.31%', points: [36, 40, 38, 46, 49, 53, 56, 59] },
  { pair: 'ETH/USDT', price: '$3,481.72', change: '+1.64%', points: [22, 24, 28, 27, 31, 33, 36, 38] },
  { pair: 'SOL/USDT', price: '$178.05', change: '+4.92%', points: [12, 16, 15, 21, 25, 24, 30, 34] },
]

const securityFeatures = [
  {
    title: 'Multi-layer Encryption',
    description: 'AES-256 at rest and TLS 1.3 in transit across every request path.',
    proof: '256-bit encryption',
    icon: LockKeyhole,
  },
  {
    title: 'Multi-Sig Order Validation',
    description: 'Critical actions require policy checks before execution is accepted.',
    proof: 'Policy-based approvals',
    icon: Shield,
  },
  {
    title: 'AI Anomaly Detection',
    description: 'Runtime models detect outlier behavior and auto-trigger safeguards.',
    proof: '24/7 behavior scoring',
    icon: Cpu,
  },
  {
    title: 'Continuous Audit Trails',
    description: 'Every event is traceable with immutable logs and verification metadata.',
    proof: 'Tamper-evident logs',
    icon: Fingerprint,
  },
]

const trustStats = [
  { label: 'Protected assets', value: '$2.4B+' },
  { label: 'Active traders', value: '128K+' },
  { label: 'Infrastructure uptime', value: '99.99%' },
  { label: 'Processed orders', value: '430M+' },
]

const wallets = ['MetaMask', 'WalletConnect', 'Coinbase Wallet', 'OKX Wallet']

function MiniChart({ points }: { points: number[] }) {
  const max = Math.max(...points)
  const min = Math.min(...points)
  const normalized = points.map((value, index) => {
    const x = (index / (points.length - 1)) * 100
    const y = ((max - value) / Math.max(max - min, 1)) * 100
    return `${x},${y}`
  })

  return (
    <svg viewBox="0 0 100 100" className="h-20 w-full" aria-hidden="true">
      <polyline
        fill="none"
        stroke="currentColor"
        strokeWidth="3"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="text-amber-300"
        points={normalized.join(' ')}
      />
    </svg>
  )
}

export default function Home() {
  return (
    <main className="min-h-screen bg-slate-950 text-slate-50">
      <section className="relative overflow-hidden border-b border-white/10">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_12%_18%,rgba(245,158,11,0.18),transparent_35%),radial-gradient(circle_at_85%_5%,rgba(139,92,246,0.22),transparent_30%),radial-gradient(circle_at_50%_90%,rgba(59,130,246,0.12),transparent_35%)]" />
        <div className="container relative max-w-7xl py-20 md:py-24">
          <div className="mx-auto max-w-5xl text-center">
            <p className="inline-flex items-center gap-2 rounded-full border border-amber-300/35 bg-amber-300/10 px-4 py-1 text-xs font-medium text-amber-300">
              <ShieldCheck className="h-3.5 w-3.5" />
              Security-first crypto automation platform
            </p>
            <h1 className="mt-5 text-balance text-4xl font-semibold leading-tight tracking-tight md:text-6xl">
              Trade smarter with real-time AI bots and institutional-grade security
            </h1>
            <p className="mx-auto mt-6 max-w-3xl text-pretty text-base text-slate-300 md:text-lg">
              Non-custodial infrastructure, continuous risk monitoring, and transparent execution
              logs for every trade decision.
            </p>
            <div className="mt-10 flex flex-wrap items-center justify-center gap-3">
              <Link
                href="/register"
                className="inline-flex cursor-pointer items-center rounded-md bg-violet-500 px-6 py-3 text-sm font-medium text-white transition-colors duration-200 hover:bg-violet-400"
              >
                Connect Wallet
              </Link>
              <Link
                href="/login"
                className="inline-flex cursor-pointer items-center rounded-md border border-white/20 bg-white/5 px-6 py-3 text-sm font-medium text-slate-100 transition-colors duration-200 hover:bg-white/10"
              >
                View Live Demo
              </Link>
            </div>
            <div className="mt-6 flex flex-wrap items-center justify-center gap-2 text-xs text-slate-200/90">
              <span className="rounded-full border border-white/15 bg-white/5 px-3 py-1">
                Audited smart contracts
              </span>
              <span className="rounded-full border border-white/15 bg-white/5 px-3 py-1">
                256-bit encryption
              </span>
              <span className="rounded-full border border-white/15 bg-white/5 px-3 py-1">
                24/7 anomaly monitoring
              </span>
            </div>

            <div className="mt-10 grid grid-cols-2 gap-3 sm:grid-cols-4">
              {trustStats.map((stat) => (
                <div
                  key={stat.label}
                  className="rounded-xl border border-white/15 bg-white/10 p-4 text-left shadow-lg shadow-black/20 backdrop-blur-xl"
                >
                  <p className="font-mono text-xl font-semibold text-white">{stat.value}</p>
                  <p className="mt-1 text-xs text-slate-300">{stat.label}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="container max-w-7xl py-14 md:py-16">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <p className="inline-flex items-center gap-2 text-sm text-slate-300">
            <ChartCandlestick className="h-4 w-4 text-amber-300" />
            Real-time market preview
          </p>
          <div className="inline-flex items-center gap-2 rounded-full border border-emerald-400/35 bg-emerald-400/10 px-3 py-1 text-xs text-emerald-300">
            <Clock3 className="h-3.5 w-3.5" />
            Avg. execution latency &lt;120ms
          </div>
        </div>
        <div className="grid gap-4 md:grid-cols-3">
          {priceCards.map((card) => (
            <article
              key={card.pair}
              className="rounded-xl border border-white/15 bg-white/10 p-5 shadow-lg shadow-black/20 backdrop-blur-xl transition-colors duration-200 hover:bg-white/15"
            >
              <div className="flex items-center justify-between">
                <p className="font-medium text-white">{card.pair}</p>
                <span className="rounded-full bg-emerald-400/15 px-2 py-0.5 text-xs text-emerald-300">
                  {card.change}
                </span>
              </div>
              <p className="mt-2 font-mono text-xl text-slate-100">{card.price}</p>
              <div className="mt-4 text-amber-300">
                <MiniChart points={card.points} />
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="container max-w-7xl py-6 md:py-8">
        <div className="rounded-2xl border border-white/15 bg-white/10 p-6 shadow-xl shadow-black/20 backdrop-blur-xl md:p-8">
          <h2 className="text-2xl font-semibold tracking-tight md:text-3xl">
            Security architecture built for high-stakes execution
          </h2>
          <p className="mt-3 max-w-3xl text-slate-300">
            Your strategy logic runs behind layered controls designed for resilience, traceability,
            and fast incident response.
          </p>
          <div className="mt-6 grid gap-4 md:grid-cols-2">
            {securityFeatures.map((item) => (
              <article
                key={item.title}
                className="rounded-xl border border-white/15 bg-slate-900/70 p-5 transition-colors duration-200 hover:bg-slate-900"
              >
                <item.icon className="h-5 w-5 text-amber-300" />
                <h3 className="mt-3 text-lg font-semibold text-white">{item.title}</h3>
                <p className="mt-2 text-sm text-slate-300">{item.description}</p>
                <p className="mt-3 inline-flex rounded-full border border-violet-300/35 bg-violet-300/10 px-2.5 py-1 text-xs text-violet-200">
                  {item.proof}
                </p>
              </article>
            ))}
          </div>
          <div className="mt-6 grid gap-3 rounded-xl border border-white/15 bg-slate-900/70 p-4 text-sm text-slate-200 md:grid-cols-3">
            <div className="flex items-center gap-2">
              <Network className="h-4 w-4 text-amber-300" />
              Ingress firewall + auth gateway
            </div>
            <div className="flex items-center gap-2">
              <Zap className="h-4 w-4 text-amber-300" />
              Strategy engine with risk guardrails
            </div>
            <div className="flex items-center gap-2">
              <BadgeCheck className="h-4 w-4 text-amber-300" />
              Immutable audit and verification layer
            </div>
          </div>
        </div>
      </section>

      <section className="container max-w-7xl py-10 md:py-12">
        <div className="grid gap-6 lg:grid-cols-2">
          <div className="rounded-2xl border border-white/15 bg-white/10 p-6 shadow-lg shadow-black/20 backdrop-blur-xl md:p-8">
            <h2 className="flex items-center gap-2 text-2xl font-semibold tracking-tight">
              <Wallet className="h-5 w-5 text-violet-300" />
              Wallet integration showcase
            </h2>
            <p className="mt-3 text-slate-300">
              Connect in seconds with non-custodial access and granular risk settings.
            </p>
            <div className="mt-5 flex flex-wrap gap-2">
              {wallets.map((wallet) => (
                <span
                  key={wallet}
                  className="rounded-full border border-white/15 bg-slate-900/70 px-3 py-1 text-xs text-slate-200"
                >
                  {wallet}
                </span>
              ))}
            </div>
            <ol className="mt-6 space-y-2 text-sm text-slate-200">
              <li className="flex items-start gap-2">
                <CheckCircle2 className="mt-0.5 h-4 w-4 text-emerald-300" />
                Connect wallet
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle2 className="mt-0.5 h-4 w-4 text-emerald-300" />
                Configure risk profile and bot behavior
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle2 className="mt-0.5 h-4 w-4 text-emerald-300" />
                Start automated execution with live monitoring
              </li>
            </ol>
            <p className="mt-5 text-xs text-slate-400">Non-custodial by design. You retain control of your assets.</p>
          </div>

          <div className="rounded-2xl border border-white/15 bg-white/10 p-6 shadow-lg shadow-black/20 backdrop-blur-xl md:p-8">
            <h2 className="text-2xl font-semibold tracking-tight">Trust indicators</h2>
            <p className="mt-3 text-slate-300">
              Built to satisfy professional teams that require reliability and auditability.
            </p>
            <div className="mt-5 grid grid-cols-2 gap-3">
              {trustStats.map((stat) => (
                <div key={stat.label} className="rounded-lg border border-white/15 bg-slate-900/70 p-3">
                  <p className="font-mono text-base font-semibold text-white">{stat.value}</p>
                  <p className="mt-1 text-xs text-slate-300">{stat.label}</p>
                </div>
              ))}
            </div>
            <div className="mt-5 space-y-2 text-sm text-slate-200">
              <p className="rounded-md border border-white/15 bg-slate-900/70 p-3">
                "Execution logs and risk controls are clear enough for compliance review."
              </p>
              <p className="rounded-md border border-white/15 bg-slate-900/70 p-3">
                "The latency and uptime profile makes this feel production-ready."
              </p>
            </div>
            <div className="mt-4 flex items-center gap-2 text-xs text-slate-400">
              <Bitcoin className="h-3.5 w-3.5" />
              Trusted by trading communities and ecosystem partners
            </div>
          </div>
        </div>
      </section>

      <section className="container max-w-7xl pb-16">
        <div className="rounded-2xl border border-white/15 bg-gradient-to-r from-violet-500/20 to-amber-400/15 p-8 shadow-xl shadow-black/20 backdrop-blur-xl md:p-10">
          <h2 className="text-3xl font-semibold tracking-tight">Start secure trading today</h2>
          <p className="mt-3 max-w-2xl text-slate-200">
            Launch your first strategy with transparent controls, advanced guardrails, and
            real-time observability from day one.
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <Link
              href="/register"
              className="inline-flex cursor-pointer items-center rounded-md bg-violet-500 px-5 py-2.5 text-sm font-medium text-white transition-colors duration-200 hover:bg-violet-400"
            >
              Create account
            </Link>
            <Link
              href="/dashboard"
              className="inline-flex cursor-pointer items-center rounded-md border border-white/25 bg-white/10 px-5 py-2.5 text-sm font-medium text-slate-100 transition-colors duration-200 hover:bg-white/15"
            >
              Explore dashboard
            </Link>
          </div>
          <p className="mt-4 text-xs text-slate-300/85">
            Risk disclaimer: Crypto trading involves market risk. Always configure position limits
            and stop-loss safeguards before enabling live execution.
          </p>
        </div>
      </section>
    </main>
  )
}
