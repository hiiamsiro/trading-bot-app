'use client'

import { useEffect } from 'react'
import { Toaster } from '@/components/ui/toaster'
import { ErrorBoundary } from '@/components/error-boundary'
import { useAuthStore } from '@/store/auth.store'
import { hydrateTheme } from '@/store/theme.store'

export function Providers({ children }: { children: React.ReactNode }) {
  const hydrateFromStorage = useAuthStore((s) => s.hydrateFromStorage)

  useEffect(() => {
    hydrateTheme()
    hydrateFromStorage()
  }, [hydrateFromStorage])

  return (
    <ErrorBoundary>
      {children}
      <Toaster />
    </ErrorBoundary>
  )
}
