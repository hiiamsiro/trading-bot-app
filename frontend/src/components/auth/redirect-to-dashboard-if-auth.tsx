'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuthStore } from '@/store/auth.store'

export function RedirectToDashboardIfAuth() {
  const router = useRouter()
  const rehydrated = useAuthStore((s) => s.rehydrated)
  const token = useAuthStore((s) => s.token)

  useEffect(() => {
    if (!rehydrated) return
    if (token) {
      router.replace('/dashboard')
    }
  }, [rehydrated, token, router])

  return null
}

