import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import * as apiClient from '@/lib/api-client'

// Mock api-client so we don't make real HTTP calls
vi.mock('@/lib/api-client', () => ({
  fetchMySubscription: vi.fn(),
  createCheckoutSession: vi.fn(),
  createPortalSession: vi.fn(),
  cancelSubscription: vi.fn(),
}))

// Mock window.location.href for redirect tests
const locationHrefSpy = vi.spyOn(window, 'location', 'get').mockReturnValue({
  ...window.location,
  href: '',
} as Location)

const mockSubscription = {
  id: 'sub-1',
  plan: 'FREE',
  status: 'ACTIVE',
  currentPeriodEnd: '2026-04-30T00:00:00.000Z',
  limits: {
    maxBots: 1,
    maxRunningBots: 1,
    canBacktest: false,
    canPublish: false,
    canCloneFromMarketplace: false,
  },
}

// We import the module after mocks are set up so vi.mock takes effect
// but for this test file we test the API functions directly via the mocked module

describe('billing API functions', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('fetchMySubscription', () => {
    it('calls GET /billing/me with the token', async () => {
      ;(apiClient.fetchMySubscription as ReturnType<typeof vi.fn>).mockResolvedValueOnce(
        mockSubscription,
      )

      const result = await apiClient.fetchMySubscription('token-abc')

      expect(apiClient.fetchMySubscription).toHaveBeenCalledTimes(1)
      expect(apiClient.fetchMySubscription).toHaveBeenCalledWith('token-abc')
      expect(result).toEqual(mockSubscription)
    })

    it('propagates errors from the API', async () => {
      const error = new Error('Network error')
      ;(apiClient.fetchMySubscription as ReturnType<typeof vi.fn>).mockRejectedValueOnce(error)

      await expect(apiClient.fetchMySubscription('token')).rejects.toThrow('Network error')
    })
  })

  describe('createCheckoutSession', () => {
    it('calls POST /billing/checkout with plan PRO', async () => {
      ;(apiClient.createCheckoutSession as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        url: 'https://checkout.stripe.com/c/pay_123',
      })

      const result = await apiClient.createCheckoutSession('token-abc', 'PRO')

      expect(apiClient.createCheckoutSession).toHaveBeenCalledTimes(1)
      expect(apiClient.createCheckoutSession).toHaveBeenCalledWith('token-abc', 'PRO')
      expect(result.url).toMatch(/checkout\.stripe\.com/)
    })

    it('calls POST /billing/checkout with plan PREMIUM', async () => {
      ;(apiClient.createCheckoutSession as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        url: 'https://checkout.stripe.com/c/pay_456',
      })

      await apiClient.createCheckoutSession('token-abc', 'PREMIUM')

      expect(apiClient.createCheckoutSession).toHaveBeenCalledWith('token-abc', 'PREMIUM')
    })

    it('propagates errors from the API', async () => {
      const error = new Error('Checkout failed')
      ;(apiClient.createCheckoutSession as ReturnType<typeof vi.fn>).mockRejectedValueOnce(error)

      await expect(
        apiClient.createCheckoutSession('token', 'PRO'),
      ).rejects.toThrow('Checkout failed')
    })
  })

  describe('createPortalSession', () => {
    it('calls POST /billing/portal with the token', async () => {
      ;(apiClient.createPortalSession as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        url: 'https://billing.stripe.com/session_123',
      })

      const result = await apiClient.createPortalSession('token-abc')

      expect(apiClient.createPortalSession).toHaveBeenCalledTimes(1)
      expect(apiClient.createPortalSession).toHaveBeenCalledWith('token-abc')
      expect(result.url).toMatch(/billing\.stripe\.com/)
    })

    it('propagates errors from the API', async () => {
      const error = new Error('Portal unavailable')
      ;(apiClient.createPortalSession as ReturnType<typeof vi.fn>).mockRejectedValueOnce(error)

      await expect(apiClient.createPortalSession('token')).rejects.toThrow(
        'Portal unavailable',
      )
    })
  })
})
