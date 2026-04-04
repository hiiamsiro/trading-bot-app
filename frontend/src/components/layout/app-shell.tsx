'use client'

import { AuthGuard } from '@/components/layout/auth-guard'
import { AppSidebar, MobileSidebar } from '@/components/layout/app-sidebar'
import { NotificationPanel } from '@/components/notifications/notification-panel'
import { ThemeToggle } from '@/components/layout/theme-toggle'
import { Menu } from 'lucide-react'
import { useState } from 'react'

// ─── AppShell: full flex layout (sidebar + header + main).
// Wraps itself in a div with flex-row on desktop, flex-col on mobile.
// AuthGuard must be OUTSIDE AppShell (use RootShell if you need AuthGuard).
export function AppShell({ children }: { children: React.ReactNode }) {
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false)

  return (
    <div className="flex h-screen flex-col lg:flex-row">

      {/* Mobile top bar — hidden on desktop */}
      <header className="fixed inset-x-0 top-0 z-[51] flex h-14 shrink-0 items-center justify-between border-b border-border/70 bg-card/80 px-4 backdrop-blur-xl lg:hidden">
        <button
          type="button"
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md hover:bg-muted/80 active:bg-muted/60"
          onClick={() => setMobileSidebarOpen(true)}
          aria-label="Open navigation menu"
        >
          <Menu className="h-5 w-5 text-foreground" />
        </button>
        <span className="font-semibold text-foreground">Trading Bot</span>
        <div className="flex shrink-0 items-center gap-2">
          <ThemeToggle />
          <NotificationPanel />
        </div>
      </header>

      {/* Mobile sidebar drawer */}
      <MobileSidebar
        open={mobileSidebarOpen}
        onClose={() => setMobileSidebarOpen(false)}
      />

      {/* Desktop sidebar — full height, always visible on lg+ */}
      <div className="hidden h-full lg:flex lg:w-64 lg:shrink-0">
        <AppSidebar />
      </div>

      {/* Main content */}
      <main className="flex flex-1 flex-col overflow-auto pt-14 lg:pt-0">
        <div className="container max-w-7xl px-4 py-6 sm:px-6">
          <div className="mb-4 hidden items-center justify-end gap-2 lg:flex">
            <ThemeToggle />
            <NotificationPanel />
          </div>
          {children}
        </div>
      </main>

    </div>
  )
}

// ─── RootShell: AppShell + AuthGuard. Use for pages that need AuthGuard
// but are not inside a layout that already provides it (e.g. /settings).
export function RootShell({ children }: { children: React.ReactNode }) {
  return (
    <AuthGuard>
      <AppShell>{children}</AppShell>
    </AuthGuard>
  )
}
