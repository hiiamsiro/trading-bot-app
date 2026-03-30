'use client'

import Link from 'next/link'
import { LockKeyhole, ShieldCheck, ChartCandlestick, Activity } from 'lucide-react'
import { FadeInSection } from '@/components/ui/fade-in-section'

const trustItems = [
  {
    icon: ShieldCheck,
    title: 'Reliable authentication flow',
    description: 'JWT-based session with guarded routes and safe redirects.',
    color: 'text-amber-300',
  },
  {
    icon: ChartCandlestick,
    title: 'Fintech-first experience',
    description: 'Move from signup to live dashboard monitoring in minutes.',
    color: 'text-violet-300',
  },
  {
    icon: LockKeyhole,
    title: 'Controlled demo environment',
    description: 'Build and test strategies without touching real capital.',
    color: 'text-emerald-300',
  },
]

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative flex min-h-screen flex-col bg-background">
      {/* Ambient background */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background: [
            'radial-gradient(circle at 15% 20%, rgba(245,158,11,0.16), transparent 35%)',
            'radial-gradient(circle at 90% 0%, rgba(139,92,246,0.2), transparent 30%)',
          ].join(', '),
        }}
        aria-hidden="true"
      />

      {/* Header */}
      <header className="relative border-b border-border/70 bg-background/70 backdrop-blur-xl">
        <div className="container flex h-14 max-w-7xl items-center justify-between px-4">
          <Link
            href="/"
            className="group flex items-center gap-2 text-sm font-semibold transition-opacity duration-200 hover:opacity-80"
          >
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-gradient-to-br from-violet-600 to-amber-500">
              <Activity className="h-4 w-4 text-white" />
            </div>
            Trading Bot App
          </Link>
          <nav className="flex gap-4 text-sm text-muted-foreground" aria-label="Auth nav">
            <Link
              href="/login"
              className="cursor-pointer transition-colors duration-200 hover:text-foreground"
            >
              Login
            </Link>
            <Link
              href="/register"
              className="cursor-pointer transition-colors duration-200 hover:text-foreground"
            >
              Register
            </Link>
          </nav>
        </div>
      </header>

      {/* Main content */}
      <div className="container relative grid flex-1 max-w-7xl gap-6 py-10 lg:grid-cols-2 lg:items-center">
        {/* Left panel */}
        <FadeInSection variant="left" className="order-2 lg:order-1">
          <section className="rounded-2xl border border-border/70 bg-card/70 p-6 backdrop-blur-xl transition-all duration-300 hover:shadow-xl md:p-8">
            <p className="trust-badge mb-3 inline-flex items-center gap-1.5 rounded-full border border-amber-400/40 bg-amber-400/10 px-3 py-1 text-xs text-amber-300">
              <span className="h-1.5 w-1.5 rounded-full bg-amber-400 animate-pulse" />
              Trust and authority
            </p>
            <h1 className="mt-4 text-3xl font-semibold tracking-tight md:text-4xl">
              Secure access for your paper-trading workspace
            </h1>
            <p className="mt-3 text-sm text-muted-foreground md:text-base">
              Authenticate quickly, manage bots safely, and monitor every action in one
              professional dashboard.
            </p>
            <div className="mt-6 space-y-3">
              {trustItems.map((item) => (
                <div
                  key={item.title}
                  className="flex items-start gap-3 rounded-lg border border-border/70 bg-background/60 p-3 transition-all duration-200 hover:border-border/90 hover:bg-background/80"
                >
                  <item.icon className={`mt-0.5 h-4 w-4 flex-shrink-0 ${item.color}`} />
                  <div>
                    <p className="text-sm font-medium">{item.title}</p>
                    <p className="text-xs text-muted-foreground">{item.description}</p>
                  </div>
                </div>
              ))}
            </div>
          </section>
        </FadeInSection>

        {/* Right panel: form */}
        <div className="order-1 flex justify-center lg:order-2 lg:justify-end">
          {children}
        </div>
      </div>
    </div>
  )
}
