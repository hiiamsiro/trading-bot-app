'use client'

import { AuthGuard } from '@/components/layout/auth-guard'
import { AppSidebar } from '@/components/layout/app-sidebar'

export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <AuthGuard>
      <div className="flex min-h-screen bg-background/80">
        <AppSidebar />
        <main className="flex-1 overflow-auto">
          <div className="container max-w-7xl py-8">{children}</div>
        </main>
      </div>
    </AuthGuard>
  )
}
