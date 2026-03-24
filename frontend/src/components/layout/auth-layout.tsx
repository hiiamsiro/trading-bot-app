'use client'

import Link from 'next/link'
import { LockKeyhole, ShieldCheck, ChartCandlestick } from 'lucide-react'

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="relative flex min-h-screen flex-col bg-background">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_15%_20%,rgba(245,158,11,0.16),transparent_35%),radial-gradient(circle_at_90%_0%,rgba(139,92,246,0.2),transparent_30%)]" />
      <header className="relative border-b border-border/70 bg-background/70 backdrop-blur-xl">
        <div className="container flex h-14 max-w-7xl items-center justify-between px-4">
          <Link href="/" className="text-sm font-semibold">
            Trading Bot App
          </Link>
          <div className="flex gap-4 text-sm text-muted-foreground">
            <Link href="/login" className="cursor-pointer transition-colors duration-200 hover:text-foreground">
              Login
            </Link>
            <Link href="/register" className="cursor-pointer transition-colors duration-200 hover:text-foreground">
              Register
            </Link>
          </div>
        </div>
      </header>
      <div className="container relative grid flex-1 max-w-7xl gap-6 py-10 lg:grid-cols-2 lg:items-center">
        <section className="rounded-2xl border border-border/70 bg-card/70 p-6 backdrop-blur-xl md:p-8">
          <p className="mb-3 inline-flex items-center rounded-full border border-amber-400/40 bg-amber-400/10 px-3 py-1 text-xs text-amber-300">
            Trust and authority
          </p>
          <h1 className="text-3xl font-semibold tracking-tight md:text-4xl">
            Secure access for your paper-trading workspace
          </h1>
          <p className="mt-3 text-sm text-muted-foreground md:text-base">
            Authenticate quickly, manage bots safely, and monitor every action in one
            professional dashboard.
          </p>
          <div className="mt-6 space-y-3">
            <div className="flex items-start gap-3 rounded-lg border border-border/70 bg-background/60 p-3">
              <ShieldCheck className="mt-0.5 h-4 w-4 text-amber-300" />
              <div>
                <p className="text-sm font-medium">Reliable authentication flow</p>
                <p className="text-xs text-muted-foreground">
                  JWT-based session with guarded routes and safe redirects.
                </p>
              </div>
            </div>
            <div className="flex items-start gap-3 rounded-lg border border-border/70 bg-background/60 p-3">
              <ChartCandlestick className="mt-0.5 h-4 w-4 text-amber-300" />
              <div>
                <p className="text-sm font-medium">Fintech-first experience</p>
                <p className="text-xs text-muted-foreground">
                  Move from signup to live dashboard monitoring in minutes.
                </p>
              </div>
            </div>
            <div className="flex items-start gap-3 rounded-lg border border-border/70 bg-background/60 p-3">
              <LockKeyhole className="mt-0.5 h-4 w-4 text-amber-300" />
              <div>
                <p className="text-sm font-medium">Controlled demo environment</p>
                <p className="text-xs text-muted-foreground">
                  Build and test strategies without touching real capital.
                </p>
              </div>
            </div>
          </div>
        </section>
        <div className="flex justify-center lg:justify-end">{children}</div>
      </div>
    </div>
  )
}
