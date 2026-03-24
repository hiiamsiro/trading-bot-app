import Link from 'next/link'
import {
  Activity,
  Bot,
  ChartCandlestick,
  Gauge,
  ShieldCheck,
  Workflow,
} from 'lucide-react'

const features = [
  {
    title: 'Strategy Execution Engine',
    description:
      'Create bots with configurable strategies and execute paper trades continuously.',
    icon: Bot,
  },
  {
    title: 'Live Market Stream',
    description:
      'Track simulated ticks and bot updates in real time through WebSocket events.',
    icon: Activity,
  },
  {
    title: 'Risk-Aware Monitoring',
    description:
      'Review trade history, open positions, and realized P/L from one control center.',
    icon: Gauge,
  },
  {
    title: 'Trusted Fintech Workflow',
    description:
      'Clear auth flow, role-safe endpoints, and audit-ready logs for every bot action.',
    icon: ShieldCheck,
  },
]

const proofStats = [
  { label: 'Live modules', value: '4' },
  { label: 'Core entities tracked', value: '6' },
  { label: 'WebSocket event types', value: '4' },
  { label: 'Setup time', value: '< 10 min' },
]

export default function Home() {
  return (
    <main className="min-h-screen">
      <section className="relative overflow-hidden border-b border-border/70">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_15%_20%,rgba(14,165,233,0.2),transparent_40%),radial-gradient(circle_at_85%_0%,rgba(249,115,22,0.2),transparent_30%)]" />
        <div className="container relative max-w-7xl py-24">
          <div className="mx-auto max-w-4xl text-center">
            <p className="mb-4 inline-flex items-center rounded-full border border-primary/40 bg-primary/10 px-4 py-1 text-xs font-medium text-primary">
              Social-proof focused fintech landing
            </p>
            <h1 className="text-4xl font-semibold leading-tight tracking-tight md:text-6xl">
              Ship trading bots faster with a trustworthy paper-trading workspace
            </h1>
            <p className="mx-auto mt-6 max-w-2xl text-lg text-muted-foreground">
              Build, run, and monitor demo trading bots with real-time market streams,
              strategy controls, and transparent trade logs.
            </p>
            <div className="mt-10 flex flex-wrap items-center justify-center gap-3">
              <Link
                href="/register"
                className="inline-flex cursor-pointer items-center rounded-md bg-primary px-6 py-3 text-sm font-medium text-primary-foreground transition-colors duration-200 hover:bg-primary/90"
              >
                Start free demo
              </Link>
              <Link
                href="/login"
                className="inline-flex cursor-pointer items-center rounded-md border border-border bg-card/70 px-6 py-3 text-sm font-medium transition-colors duration-200 hover:bg-muted/70"
              >
                Sign in
              </Link>
            </div>
            <div className="mt-10 grid grid-cols-2 gap-3 sm:grid-cols-4">
              {proofStats.map((stat) => (
                <div
                  key={stat.label}
                  className="rounded-lg border border-border/70 bg-card/70 p-4 text-left backdrop-blur-xl"
                >
                  <p className="font-mono text-xl font-semibold">{stat.value}</p>
                  <p className="mt-1 text-xs text-muted-foreground">{stat.label}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="container max-w-7xl py-16">
        <div className="mb-8 flex items-center gap-2 text-sm text-muted-foreground">
          <Workflow className="h-4 w-4 text-primary" />
          Built for demo-trading teams that need speed and clarity
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          {features.map((item) => (
            <article
              key={item.title}
              className="rounded-xl border border-border/70 bg-card/80 p-6 transition-colors duration-200 hover:bg-card"
            >
              <item.icon className="h-5 w-5 text-primary" />
              <h2 className="mt-4 text-xl font-semibold">{item.title}</h2>
              <p className="mt-2 text-sm text-muted-foreground">{item.description}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="container max-w-7xl pb-16">
        <div className="rounded-2xl border border-border/70 bg-card/70 p-8 md:p-10">
          <div className="grid gap-8 md:grid-cols-2 md:items-center">
            <div>
              <p className="mb-3 inline-flex items-center gap-2 rounded-md bg-muted px-3 py-1 text-xs text-muted-foreground">
                <ChartCandlestick className="h-3.5 w-3.5" />
                Trust and authority pattern
              </p>
              <h3 className="text-3xl font-semibold tracking-tight">
                From first bot to full monitoring in one clean workflow
              </h3>
              <p className="mt-3 text-muted-foreground">
                Onboard quickly, configure strategy parameters, and observe bot behavior in
                real time with logs and trade-level visibility.
              </p>
            </div>
            <div className="grid gap-3 rounded-xl border border-border/70 bg-background/60 p-4">
              <p className="text-sm font-medium">What teams like most</p>
              <div className="rounded-md border border-border/70 bg-card/80 p-3 text-sm text-muted-foreground">
                “The dashboard gives us immediate clarity on bot status and execution flow.”
              </div>
              <div className="rounded-md border border-border/70 bg-card/80 p-3 text-sm text-muted-foreground">
                “Setup is fast, and monitoring pages are structured like a real production tool.”
              </div>
            </div>
          </div>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link
              href="/register"
              className="inline-flex cursor-pointer items-center rounded-md bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground transition-colors duration-200 hover:bg-primary/90"
            >
              Create account
            </Link>
            <Link
              href="/dashboard"
              className="inline-flex cursor-pointer items-center rounded-md border border-border px-5 py-2.5 text-sm font-medium transition-colors duration-200 hover:bg-muted/70"
            >
              View dashboard
            </Link>
          </div>
        </div>
      </section>
    </main>
  )
}
