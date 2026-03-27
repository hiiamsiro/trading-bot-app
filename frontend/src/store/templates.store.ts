'use client'

import { create } from 'zustand'
import { BotTemplate } from '@/types'

interface TemplatesState {
  userTemplates: BotTemplate[]
  defaults: BotTemplate[]
  isLoaded: boolean
  loadTemplates: (userTemplates: BotTemplate[], defaults: BotTemplate[]) => void
  addUserTemplate: (t: BotTemplate) => void
  removeUserTemplate: (id: string) => void
}

export const useTemplatesStore = create<TemplatesState>((set) => ({
  userTemplates: [],
  defaults: [],
  isLoaded: false,

  loadTemplates: (userTemplates, defaults) =>
    set({ userTemplates, defaults, isLoaded: true }),

  addUserTemplate: (t) =>
    set((state) => ({
      userTemplates: [t, ...state.userTemplates],
    })),

  removeUserTemplate: (id) =>
    set((state) => ({
      userTemplates: state.userTemplates.filter((t) => t.id !== id),
    })),
}))
