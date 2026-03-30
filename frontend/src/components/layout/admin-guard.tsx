'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuthStore } from '@/store/auth.store'
import { Loader2, ShieldOff } from 'lucide-react'
import { Button } from '@/components/ui/button'

export function AdminGuard({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const rehydrated = useAuthStore((s) => s.rehydrated)
  const isAdmin = useAuthStore((s) => s.isAdmin)

  useEffect(() => {
    if (!rehydrated) return
    if (!isAdmin()) {
      router.replace('/dashboard')
    }
  }, [rehydrated, isAdmin, router])

  if (!rehydrated) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center text-muted-foreground">
        <Loader2 className="h-8 w-8 animate-spin" aria-hidden />
        <span className="sr-only">Loading</span>
      </div>
    )
  }

  if (!isAdmin()) {
    return (
      <div className="flex min-h-[50vh] flex-col items-center justify-center gap-4 text-center">
        <ShieldOff className="h-12 w-12 text-muted-foreground" aria-hidden />
        <div>
          <h2 className="text-lg font-semibold">Access denied</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            You don&apos;t have permission to view this page.
          </p>
        </div>
        <Button variant="outline" onClick={() => router.replace('/dashboard')}>
          Go to Dashboard
        </Button>
      </div>
    )
  }

  return <>{children}</>
}
