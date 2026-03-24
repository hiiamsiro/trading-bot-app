'use client'

import Link from 'next/link'

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="flex min-h-screen flex-col bg-muted/30">
      <header className="border-b bg-background/80 backdrop-blur">
        <div className="container flex h-14 max-w-lg items-center justify-between px-4">
          <Link href="/" className="text-sm font-medium">
            Trading Bot
          </Link>
          <div className="flex gap-4 text-sm text-muted-foreground">
            <Link href="/login" className="hover:text-foreground">
              Login
            </Link>
            <Link href="/register" className="hover:text-foreground">
              Register
            </Link>
          </div>
        </div>
      </header>
      <div className="flex flex-1 items-center justify-center p-4">{children}</div>
    </div>
  )
}
