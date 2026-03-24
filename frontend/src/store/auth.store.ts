'use client'

import { create } from 'zustand'
import { User } from '@/types'
import { disconnectWebSocket } from '@/lib/websocket'

interface AuthState {
  user: User | null
  token: string | null
  rehydrated: boolean
  setAuth: (user: User, token: string) => void
  clearAuth: () => void
  setRehydrated: (value: boolean) => void
  hydrateFromStorage: () => void
  isAuthenticated: () => boolean
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  token: null,
  rehydrated: false,
  setAuth: (user, token) => {
    set({ user, token })
    if (typeof window !== 'undefined') {
      localStorage.setItem('token', token)
      localStorage.setItem('user', JSON.stringify(user))
    }
  },
  clearAuth: () => {
    set({ user: null, token: null })
    if (typeof window !== 'undefined') {
      localStorage.removeItem('token')
      localStorage.removeItem('user')
      disconnectWebSocket()
    }
  },
  setRehydrated: (value) => set({ rehydrated: value }),
  hydrateFromStorage: () => {
    if (typeof window === 'undefined') {
      return
    }
    const token = localStorage.getItem('token')
    const raw = localStorage.getItem('user')
    let user: User | null = null
    if (raw) {
      try {
        user = JSON.parse(raw) as User
      } catch {
        user = null
      }
    }
    set({ token, user, rehydrated: true })
  },
  isAuthenticated: () => !!get().token,
}))
