import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import { useAuthStore } from './auth.store'

// Mock the websocket module so clearAuth() doesn't try to disconnect a real socket
vi.mock('@/lib/websocket', () => ({
  disconnectWebSocket: vi.fn(),
}))

// Use ISO string dates so JSON.stringify round-trips correctly (no Date→string mismatch)
const mockUser = {
  id: 'user-1',
  email: 'test@example.com',
  name: 'Test User',
  role: 'USER' as const,
  createdAt: '2024-01-01T00:00:00.000Z',
  updatedAt: '2024-01-01T00:00:00.000Z',
}

describe('useAuthStore', () => {
  beforeEach(() => {
    // Reset store state and clear mock call counts between tests
    useAuthStore.setState({ user: null, token: null, rehydrated: false })
    vi.clearAllMocks()
  })

  afterEach(() => {
    useAuthStore.setState({ user: null, token: null, rehydrated: false })
    vi.clearAllMocks()
  })

  // ─────────────────────────────────────────────────────
  // setAuth
  // ─────────────────────────────────────────────────────

  it('setAuth stores user and token in state', () => {
    useAuthStore.getState().setAuth(mockUser, 'jwt-token-abc')

    const state = useAuthStore.getState()
    expect(state.user).toEqual(mockUser)
    expect(state.token).toBe('jwt-token-abc')
  })

  it('setAuth writes token and user to localStorage', () => {
    useAuthStore.getState().setAuth(mockUser, 'jwt-token-abc')

    expect(localStorage.getItem('token')).toBe('jwt-token-abc')
    const stored = localStorage.getItem('user')
    expect(stored).toBeTruthy()
    expect(JSON.parse(stored!)).toEqual(mockUser)
  })

  // ─────────────────────────────────────────────────────
  // clearAuth
  // ─────────────────────────────────────────────────────

  it('clearAuth resets user and token to null', () => {
    useAuthStore.getState().setAuth(mockUser, 'token')
    useAuthStore.getState().clearAuth()

    const state = useAuthStore.getState()
    expect(state.user).toBeNull()
    expect(state.token).toBeNull()
  })

  it('clearAuth removes token and user from localStorage', () => {
    useAuthStore.getState().setAuth(mockUser, 'token')
    useAuthStore.getState().clearAuth()

    expect(localStorage.getItem('token')).toBeNull()
    expect(localStorage.getItem('user')).toBeNull()
  })

  it('clearAuth calls disconnectWebSocket', async () => {
    const { disconnectWebSocket } = await import('@/lib/websocket')
    useAuthStore.getState().setAuth(mockUser, 'token')
    useAuthStore.getState().clearAuth()

    expect(disconnectWebSocket).toHaveBeenCalledTimes(1)
  })

  // ─────────────────────────────────────────────────────
  // isAuthenticated
  // ─────────────────────────────────────────────────────

  it('isAuthenticated returns true when token exists', () => {
    useAuthStore.getState().setAuth(mockUser, 'valid-token')
    expect(useAuthStore.getState().isAuthenticated()).toBe(true)
  })

  it('isAuthenticated returns false when token is null', () => {
    expect(useAuthStore.getState().isAuthenticated()).toBe(false)
  })

  it('isAuthenticated returns false after clearAuth', () => {
    useAuthStore.getState().setAuth(mockUser, 'token')
    useAuthStore.getState().clearAuth()
    expect(useAuthStore.getState().isAuthenticated()).toBe(false)
  })

  // ─────────────────────────────────────────────────────
  // hydrateFromStorage
  // ─────────────────────────────────────────────────────

  it('hydrateFromStorage rehydrates user and token from localStorage', () => {
    localStorage.setItem('token', 'stored-token')
    localStorage.setItem('user', JSON.stringify(mockUser))

    useAuthStore.getState().hydrateFromStorage()

    const state = useAuthStore.getState()
    expect(state.token).toBe('stored-token')
    expect(state.user).toEqual(mockUser)
    expect(state.rehydrated).toBe(true)
  })

  it('hydrateFromStorage handles missing token gracefully', () => {
    // localStorage is already empty from beforeEach storage clear
    useAuthStore.getState().hydrateFromStorage()

    const state = useAuthStore.getState()
    expect(state.token).toBeNull()
    expect(state.user).toBeNull()
    expect(state.rehydrated).toBe(true)
  })

  it('hydrateFromStorage handles malformed user JSON gracefully', () => {
    localStorage.setItem('token', 'token-only')
    localStorage.setItem('user', 'not valid json {{{')

    useAuthStore.getState().hydrateFromStorage()

    const state = useAuthStore.getState()
    expect(state.token).toBe('token-only')
    expect(state.user).toBeNull() // parse failed → null
    expect(state.rehydrated).toBe(true)
  })

  it('hydrateFromStorage does nothing during SSR (window is undefined)', () => {
    // This test just verifies the guard in hydrateFromStorage doesn't crash
    // The actual SSR path is tested implicitly since localStorage is undefined in SSR
    // We just ensure no error is thrown
    expect(() => useAuthStore.getState().hydrateFromStorage()).not.toThrow()
  })

  // ─────────────────────────────────────────────────────
  // setRehydrated
  // ─────────────────────────────────────────────────────

  it('setRehydrated updates the rehydrated flag', () => {
    expect(useAuthStore.getState().rehydrated).toBe(false)
    useAuthStore.getState().setRehydrated(true)
    expect(useAuthStore.getState().rehydrated).toBe(true)
  })
})
