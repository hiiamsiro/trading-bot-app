'use client'

import { create } from 'zustand'
import { Bot } from '@/types'
import { useAuthStore } from '@/store/auth.store'
import {
  createBot as apiCreateBot,
  createBotFromBuilder,
  createBotFromCode as apiCreateBotFromCode,
  createStrategyCode as apiCreateStrategyCode,
  deleteBot as apiDeleteBot,
  deleteStrategyCode as apiDeleteStrategyCode,
  fetchBot as apiFetchBot,
  fetchBots as apiFetchBots,
  fetchStrategyCode as apiFetchStrategyCode,
  fetchStrategyCodes as apiFetchStrategyCodes,
  updateBot as apiUpdateBot,
  updateStrategyCode as apiUpdateStrategyCode,
  validateStrategyCode as apiValidateStrategyCode,
} from '@/lib/api-client'

export interface StrategyCode {
  id: string
  userId: string
  name: string
  description?: string
  code?: string        // excluded from listCodes() responses to avoid large payloads
  language: string
  isValid: boolean
  lastValidAt?: string
  createdAt: string
  updatedAt: string
}

export interface CreateStrategyCodePayload {
  name: string
  description?: string
  code: string
  language?: string
}

export interface UpdateStrategyCodePayload {
  name?: string
  description?: string
  code?: string
  language?: string
}

export interface CreateBotFromCodePayload {
  name: string
  description?: string
  symbol: string
  interval: string
  initialBalance: number
  strategyCodeId: string
}

interface BotsState {
  // Bot list
  bots: Bot[]
  isLoading: boolean
  error: string | null

  // Strategy codes
  strategyCodes: StrategyCode[]
  isCodesLoading: boolean
  codesError: string | null

  // Draft (unsaved code editor state)
  draftCode: string | null
  draftName: string | null

  // Actions
  loadBots: () => Promise<void>
  loadBot: (id: string) => Promise<Bot | null>
  createBot: (payload: unknown) => Promise<Bot>
  updateBot: (id: string, payload: unknown) => Promise<void>
  deleteBot: (id: string) => Promise<void>

  loadStrategyCodes: () => Promise<void>
  loadStrategyCode: (id: string) => Promise<StrategyCode | null>
  saveStrategyCode: (payload: CreateStrategyCodePayload) => Promise<StrategyCode>
  updateStrategyCode: (id: string, payload: UpdateStrategyCodePayload) => Promise<StrategyCode>
  deleteStrategyCode: (id: string) => Promise<void>
  validateCode: (code: string) => Promise<{ valid: boolean; error?: string }>
  runPreview: (params: unknown) => Promise<unknown>

  setDraftCode: (code: string, name: string) => void
  clearDraft: () => void

  // Helpers
  getBotById: (id: string) => Bot | undefined
  getCodeById: (id: string) => StrategyCode | undefined
}

export const useBotsStore = create<BotsState>((set, get) => ({
  bots: [],
  isLoading: false,
  error: null,

  strategyCodes: [],
  isCodesLoading: false,
  codesError: null,

  draftCode: null,
  draftName: null,

  // ─── Bots ──────────────────────────────────────────────────────────────────

  loadBots: async () => {
    const token = useAuthStore.getState().token
    if (!token) return
    set({ isLoading: true, error: null })
    try {
      const bots = await apiFetchBots(token)
      set({ bots, isLoading: false })
    } catch (err) {
      set({ error: (err as Error).message, isLoading: false })
    }
  },

  loadBot: async (id: string) => {
    const token = useAuthStore.getState().token
    if (!token) return null
    try {
      const bot = await apiFetchBot(token, id)
      set((state) => ({
        bots: state.bots.some((b) => b.id === id)
          ? state.bots.map((b) => (b.id === id ? bot : b))
          : [...state.bots, bot],
      }))
      return bot
    } catch {
      return null
    }
  },

  createBot: async (payload: unknown) => {
    const token = useAuthStore.getState().token
    if (!token) throw new Error('Not authenticated')
    const bot = await apiCreateBot(token, payload as Parameters<typeof apiCreateBot>[1])
    set((state) => ({ bots: [bot, ...state.bots] }))
    return bot
  },

  updateBot: async (id: string, payload: unknown) => {
    const token = useAuthStore.getState().token
    if (!token) throw new Error('Not authenticated')
    const bot = await apiUpdateBot(token, id, payload as Parameters<typeof apiUpdateBot>[2])
    set((state) => ({
      bots: state.bots.map((b) => (b.id === id ? bot : b)),
    }))
  },

  deleteBot: async (id: string) => {
    const token = useAuthStore.getState().token
    if (!token) throw new Error('Not authenticated')
    await apiDeleteBot(token, id)
    set((state) => ({ bots: state.bots.filter((b) => b.id !== id) }))
  },

  // ─── Strategy Codes ─────────────────────────────────────────────────────────

  loadStrategyCodes: async () => {
    const token = useAuthStore.getState().token
    if (!token) return
    set({ isCodesLoading: true, codesError: null })
    try {
      const strategyCodes = await apiFetchStrategyCodes(token)
      set({ strategyCodes, isCodesLoading: false })
    } catch (err) {
      set({ codesError: (err as Error).message, isCodesLoading: false })
    }
  },

  loadStrategyCode: async (id: string) => {
    const token = useAuthStore.getState().token
    if (!token) return null
    try {
      const code = await apiFetchStrategyCode(token, id)
      set((state) => ({
        strategyCodes: state.strategyCodes.some((c) => c.id === id)
          ? state.strategyCodes.map((c) => (c.id === id ? code : c))
          : [...state.strategyCodes, code],
      }))
      return code
    } catch {
      return null
    }
  },

  saveStrategyCode: async (payload: CreateStrategyCodePayload) => {
    const token = useAuthStore.getState().token
    if (!token) throw new Error('Not authenticated')
    const code = await apiCreateStrategyCode(token, payload)
    set((state) => ({ strategyCodes: [code, ...state.strategyCodes] }))
    return code
  },

  updateStrategyCode: async (id: string, payload: UpdateStrategyCodePayload) => {
    const token = useAuthStore.getState().token
    if (!token) throw new Error('Not authenticated')
    const code = await apiUpdateStrategyCode(token, id, payload)
    set((state) => ({
      strategyCodes: state.strategyCodes.map((c) => (c.id === id ? code : c)),
    }))
    return code
  },

  deleteStrategyCode: async (id: string) => {
    const token = useAuthStore.getState().token
    if (!token) throw new Error('Not authenticated')
    await apiDeleteStrategyCode(token, id)
    set((state) => ({
      strategyCodes: state.strategyCodes.filter((c) => c.id !== id),
    }))
  },

  validateCode: async (code: string) => {
    const token = useAuthStore.getState().token
    if (!token) return { valid: false, error: 'Not authenticated' }
    return apiValidateStrategyCode(token, code)
  },

  runPreview: async (_params: unknown) => {
    // Preview is called directly via the API in the component layer
    // since it needs additional runtime parameters (symbol, interval, etc.)
    return null
  },

  // ─── Draft ──────────────────────────────────────────────────────────────────

  setDraftCode: (code: string, name: string) => {
    set({ draftCode: code, draftName: name })
  },

  clearDraft: () => {
    set({ draftCode: null, draftName: null })
  },

  // ─── Helpers ───────────────────────────────────────────────────────────────

  getBotById: (id: string) => get().bots.find((b) => b.id === id),

  getCodeById: (id: string) => get().strategyCodes.find((c) => c.id === id),
}))
