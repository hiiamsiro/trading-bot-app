'use client'

import { create } from 'zustand'

export type Theme = 'light' | 'dark'

interface ThemeState {
  theme: Theme
  setTheme: (theme: Theme) => void
  toggleTheme: () => void
}

export const useThemeStore = create<ThemeState>((set, get) => ({
  theme: 'dark',

  setTheme: (theme) => {
    set({ theme })
    if (typeof window !== 'undefined') {
      localStorage.setItem('theme', theme)
      if (theme === 'dark') {
        document.documentElement.classList.add('dark')
      } else {
        document.documentElement.classList.remove('dark')
      }
    }
  },

  toggleTheme: () => {
    const next = get().theme === 'dark' ? 'light' : 'dark'
    get().setTheme(next)
  },
}))

// Rehydrate from localStorage on first load (call once at app startup)
export function hydrateTheme() {
  if (typeof window === 'undefined') return
  const stored = localStorage.getItem('theme') as Theme | null
  if (stored === 'light' || stored === 'dark') {
    useThemeStore.getState().setTheme(stored)
  } else {
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches
    useThemeStore.getState().setTheme(prefersDark ? 'dark' : 'light')
  }
}
