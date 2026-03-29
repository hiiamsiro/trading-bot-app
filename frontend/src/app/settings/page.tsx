'use client'

import { Suspense, useCallback, useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { AppShell } from '@/components/layout/app-shell'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { PlanBadge } from '@/components/billing/plan-badge'
import {
  fetchMySubscription,
  fetchBots,
  updatePlan,
  cancelSubscription,
} from '@/lib/api-client'
import { useAuthStore } from '@/store/auth.store'
import { useHandleApiError } from '@/hooks/use-handle-api-error'
import { toast } from '@/hooks/use-toast'
import { Plan } from '@/types'
import { Check, X, Zap } from 'lucide-react'
import { cn } from '@/lib/utils'

type Tab = 'billing' | 'account'
type LoadingState = 'idle' | 'loading'

const PLAN_DETAILS = [
  {
    plan: Plan.FREE,
    label: 'Free',
    price: '$0',
    description: 'Get started with 1 bot and basic features.',
    limits: { maxBots: 1, maxRunningBots: 1, canBacktest: false, canPublish: false, canCloneFromMarketplace: false },
    popular: false,
  },
  {
    plan: Plan.PRO,
    label: 'Pro',
    price: '$9',
    description: '5 bots, backtesting, and publishing for serious traders.',
    limits: { maxBots: 5, maxRunningBots: 3, canBacktest: true, canPublish: true, canCloneFromMarketplace: true },
    popular: true,
  },
  {
    plan: Plan.PREMIUM,
    label: 'Premium',
    price: '$29',
    description: 'Unlimited bots with all features unlocked.',
    limits: { maxBots: -1, maxRunningBots: -1, canBacktest: true, canPublish: true, canCloneFromMarketplace: true },
    popular: false,
  },
] as const

const PLAN_ORDER: Plan[] = [Plan.FREE, Plan.PRO, Plan.PREMIUM]

function PlanCard({
  plan,
  label,
  price,
  description,
  limits,
  popular,
  currentPlan,
  botCount,
  onUpgrade,
  upgrading,
}: {
  plan: Plan
  label: string
  price: string
  description: string
  limits: { maxBots: number; maxRunningBots: number; canBacktest: boolean; canPublish: boolean; canCloneFromMarketplace: boolean }
  popular?: boolean
  currentPlan: Plan
  botCount: number
  onUpgrade: (plan: Plan) => void
  upgrading: boolean
}) {
  const isCurrent = plan === currentPlan
  const isDowngrade = PLAN_ORDER.indexOf(plan) < PLAN_ORDER.indexOf(currentPlan)
  const isUpgrade = PLAN_ORDER.indexOf(plan) > PLAN_ORDER.indexOf(currentPlan)

  const featureRows = [
    { label: `Bots (${botCount} used)`, value: limits.maxBots === -1 ? 'Unlimited' : limits.maxBots, ok: true },
    { label: 'Running bots', value: limits.maxRunningBots === -1 ? 'Unlimited' : limits.maxRunningBots, ok: true },
    { label: 'Backtesting', value: 'Backtest', ok: limits.canBacktest },
    { label: 'Publish to marketplace', value: 'Publish', ok: limits.canPublish },
    { label: 'Clone from marketplace', value: 'Clone', ok: limits.canCloneFromMarketplace },
  ]

  return (
    <Card className={cn('relative flex flex-col', popular && 'ring-2 ring-primary')}>
      {popular && (
        <div className="absolute -top-3 left-1/2 -translate-x-1/2">
          <span className="inline-flex items-center gap-1 rounded-full bg-primary px-3 py-0.5 text-xs font-semibold text-primary-foreground">
            <Zap className="h-3 w-3" />
            Most Popular
          </span>
        </div>
      )}
      <CardHeader>
        <div className="flex items-center gap-2">
          <CardTitle>{label}</CardTitle>
          {isCurrent && <PlanBadge plan={plan} />}
        </div>
        <div className="flex items-baseline gap-1">
          <span className="text-3xl font-bold">{price}</span>
          <span className="text-sm text-muted-foreground">/month</span>
        </div>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-1 flex-col gap-3">
        <ul className="space-y-2 text-sm">
          {featureRows.map(({ label, value, ok }) => (
            <li key={label} className="flex items-center justify-between">
              <span className="text-muted-foreground">{label}</span>
              <span className={cn(ok ? 'text-emerald-600' : 'text-muted-foreground', 'flex items-center gap-1 font-medium')}>
                {ok ? <Check className="h-4 w-4 text-emerald-600" /> : <X className="h-4 w-4 text-muted-foreground" />}
                {value}
              </span>
            </li>
          ))}
        </ul>
        <div className="mt-auto pt-4">
          {isCurrent ? (
            <Button variant="outline" disabled className="w-full">
              Current plan
            </Button>
          ) : isUpgrade ? (
            <Button
              className="w-full"
              disabled={upgrading}
              onClick={() => onUpgrade(plan)}
            >
              {upgrading ? 'Upgrading...' : `Upgrade to ${label}`}
            </Button>
          ) : (
            <Button variant="secondary" disabled className="w-full">
              Downgrade not available
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  )
}

function BillingTab({
  subscription,
  botCount,
  loading,
  onRefresh,
}: {
  subscription: import('@/types').SubscriptionWithLimits | null
  botCount: number
  loading: LoadingState
  onRefresh: () => void
}) {
  const token = useAuthStore((s) => s.token)
  const handleError = useHandleApiError()
  const [upgrading, setUpgrading] = useState(false)

  const currentPlan = subscription?.plan ?? Plan.FREE

  const handleUpgrade = useCallback(
    async (targetPlan: Plan) => {
      if (!token) return
      setUpgrading(true)
      try {
        await updatePlan(token, targetPlan)
        toast({ title: 'Plan updated', description: `You are now on the ${targetPlan} plan.` })
        onRefresh()
      } catch (err) {
        handleError(err, 'Failed to update plan')
      } finally {
        setUpgrading(false)
      }
    },
    [token, handleError, onRefresh],
  )

  const handleCancel = useCallback(async () => {
    if (!token) return
    if (!confirm('Cancel your subscription and revert to Free?')) return
    try {
      await cancelSubscription(token)
      toast({ title: 'Subscription cancelled', description: 'You are now on the Free plan.' })
      onRefresh()
    } catch (err) {
      handleError(err, 'Failed to cancel subscription')
    }
  }, [token, handleError, onRefresh])

  return (
    <div className="space-y-6">
      {subscription && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Current subscription</CardTitle>
                <CardDescription>Your active plan and usage</CardDescription>
              </div>
              <PlanBadge plan={currentPlan} />
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4 text-sm sm:grid-cols-4">
              <div>
                <p className="text-muted-foreground">Bots used</p>
                <p className="text-lg font-semibold">
                  {botCount}
                  <span className="text-muted-foreground">
                    /{subscription.limits.maxBots === -1 ? '∞' : subscription.limits.maxBots}
                  </span>
                </p>
              </div>
              <div>
                <p className="text-muted-foreground">Status</p>
                <p className="text-lg font-semibold capitalize">{subscription.status.toLowerCase().replace('_', ' ')}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Renews</p>
                <p className="text-lg font-semibold">
                  {new Date(subscription.currentPeriodEnd).toLocaleDateString()}
                </p>
              </div>
              {currentPlan !== Plan.FREE && (
                <div className="col-span-2 sm:col-span-1">
                  <Button variant="outline" size="sm" onClick={handleCancel}>
                    Cancel plan
                  </Button>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {loading === 'loading' && (
        <div className="grid gap-6 md:grid-cols-3">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-72 rounded-lg" />
          ))}
        </div>
      )}

      {loading === 'idle' && (
        <div className="grid gap-6 md:grid-cols-3">
          {PLAN_DETAILS.map(({ plan, label, price, description, limits, popular }) => (
            <PlanCard
              key={plan}
              plan={plan}
              label={label}
              price={price}
              description={description}
              limits={limits}
              popular={popular}
              currentPlan={currentPlan}
              botCount={botCount}
              onUpgrade={handleUpgrade}
              upgrading={upgrading}
            />
          ))}
        </div>
      )}
    </div>
  )
}

function AccountTab({ loading }: { loading: LoadingState }) {
  const user = useAuthStore((s) => s.user)

  if (loading === 'loading') {
    return <Skeleton className="h-32 rounded-lg" />
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Account</CardTitle>
        <CardDescription>Your profile information</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <p className="text-sm text-muted-foreground">Email</p>
          <p className="font-medium">{user?.email ?? '—'}</p>
        </div>
        <div>
          <p className="text-sm text-muted-foreground">Name</p>
          <p className="font-medium">{user?.name ?? '—'}</p>
        </div>
        <div>
          <p className="text-sm text-muted-foreground">Member since</p>
          <p className="font-medium">
            {user?.createdAt ? new Date(user.createdAt).toLocaleDateString() : '—'}
          </p>
        </div>
      </CardContent>
    </Card>
  )
}

export default function SettingsPage() {
  return (
    <Suspense>
      <SettingsContent />
    </Suspense>
  )
}

function SettingsContent() {
  const searchParams = useSearchParams()
  const tabParam = searchParams.get('tab') as Tab | null
  const [activeTab, setActiveTab] = useState<Tab>(tabParam ?? 'billing')
  const token = useAuthStore((s) => s.token)
  const handleError = useHandleApiError()

  const [subscription, setSubscription] = useState<import('@/types').SubscriptionWithLimits | null>(null)
  const [botCount, setBotCount] = useState(0)
  const [loading, setLoading] = useState<LoadingState>('loading')

  const loadData = useCallback(async () => {
    if (!token) return
    setLoading('loading')
    try {
      const [sub, bots] = await Promise.all([
        fetchMySubscription(token),
        fetchBots(token),
      ])
      setSubscription(sub)
      setBotCount(bots.length)
    } catch (err) {
      handleError(err, 'Failed to load subscription data')
    } finally {
      setLoading('idle')
    }
  }, [token, handleError])

  useEffect(() => {
    loadData()
  }, [loadData])

  const tabs: { id: Tab; label: string }[] = [
    { id: 'billing', label: 'Subscription' },
    { id: 'account', label: 'Account' },
  ]

  return (
    <AppShell>
      <div className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight">Settings</h1>
        <p className="text-muted-foreground">Manage your account and subscription</p>
      </div>

      {/* Tab bar */}
      <div className="mb-6 flex gap-1 border-b border-border">
        {tabs.map(({ id, label }) => (
          <button
            key={id}
            onClick={() => setActiveTab(id)}
            className={cn(
              'relative px-4 py-2 text-sm font-medium transition-colors',
              activeTab === id
                ? 'text-foreground'
                : 'text-muted-foreground hover:text-foreground',
            )}
          >
            {label}
            {activeTab === id && (
              <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary" />
            )}
          </button>
        ))}
      </div>

      {activeTab === 'billing' && (
        <BillingTab
          subscription={subscription}
          botCount={botCount}
          loading={loading}
          onRefresh={loadData}
        />
      )}
      {activeTab === 'account' && <AccountTab loading={loading} />}
    </AppShell>
  )
}
