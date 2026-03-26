'use client'

import { useEffect } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { useAuthStore } from '@/store/auth.store'
import { Loader2 } from 'lucide-react'

export function AuthGuard({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const pathname = usePathname()
  const rehydrated = useAuthStore((s) => s.rehydrated)
  const token = useAuthStore((s) => s.token)

  useEffect(() => {
    if (!rehydrated) return
    if (!token) {
      const search = typeof window !== 'undefined' ? window.location.search : ''
      const nextPath = search ? `${pathname}${search}` : pathname
      const next = encodeURIComponent(nextPath)
      router.replace(`/login?next=${next}`)
    }
  }, [rehydrated, token, router, pathname])

  if (!rehydrated || !token) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center text-muted-foreground">
        <Loader2 className="h-8 w-8 animate-spin" aria-hidden />
        <span className="sr-only">Loading</span>
      </div>
    )
  }

  return <>{children}</>
}
