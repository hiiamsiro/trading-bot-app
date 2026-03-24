'use client'

import { useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { ApiError } from '@/lib/api'
import { useAuthStore } from '@/store/auth.store'
import { toast } from '@/hooks/use-toast'

export function useHandleApiError() {
  const router = useRouter()
  const clearAuth = useAuthStore((s) => s.clearAuth)

  return useCallback(
    (err: unknown, fallbackMessage = 'Something went wrong') => {
      if (err instanceof ApiError) {
        if (err.status === 401) {
          clearAuth()
          router.replace('/login')
          toast({
            title: 'Session expired',
            description: 'Please sign in again.',
            variant: 'destructive',
          })
          return
        }
        toast({
          title: 'Request failed',
          description: err.message,
          variant: 'destructive',
        })
        return
      }
      toast({
        title: 'Error',
        description: fallbackMessage,
        variant: 'destructive',
      })
    },
    [router, clearAuth],
  )
}
