'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import * as Collapsible from '@radix-ui/react-collapsible'
import {
  LayoutDashboard,
  Bot,
  History,
  ScrollText,
  Activity,
  LogOut,
  BarChart3,
  FolderOpen,
  Globe,
  Trophy,
  HeartPulse,
  Settings,
  ChevronDown,
  type LucideIcon,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { useAuthStore } from '@/store/auth.store'
import { useRouter } from 'next/navigation'
import { useState } from 'react'

type NavItem = { href: string; label: string; icon: LucideIcon; adminOnly?: boolean }

type NavGroup = {
  id: string
  label: string
  icon: LucideIcon
  items: NavItem[]
}

// Rendered in this order: flat items → collapsible group → flat items → collapsible group
const NAV_ITEMS_TOP: NavItem[] = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/bots', label: 'Bots', icon: Bot },
  { href: '/portfolios', label: 'Portfolios', icon: FolderOpen },
]

const NAV_GROUPS: NavGroup[] = [
  {
    id: 'analytics',
    label: 'Analytics',
    icon: BarChart3,
    items: [
      { href: '/backtest', label: 'Backtest', icon: BarChart3 },
      { href: '/optimization', label: 'Optimize', icon: Activity },
      { href: '/walkforward', label: 'Walk-Forward', icon: Activity },
    ],
  },
  {
    id: 'operations',
    label: 'Operations',
    icon: ScrollText,
    items: [
      { href: '/trades', label: 'Trade history', icon: History },
      { href: '/logs', label: 'Logs', icon: ScrollText },
      { href: '/health', label: 'Health', icon: HeartPulse },
    ],
  },
]

const NAV_ITEMS_BOTTOM: NavItem[] = [
  { href: '/marketplace', label: 'Marketplace', icon: Globe },
  { href: '/leaderboard', label: 'Leaderboard', icon: Trophy },
  { href: '/settings', label: 'Settings', icon: Settings },
  { href: '/admin', label: 'Monitoring', icon: Activity, adminOnly: true },
]

function isActive(href: string, pathname: string) {
  return pathname === href || pathname.startsWith(`${href}/`)
}

function NavGroupSection({
  group,
  pathname,
  isOpen,
  onToggle,
}: {
  group: NavGroup
  pathname: string
  isOpen: boolean
  onToggle: () => void
}) {
  const hasActiveItem = group.items.some((item) => isActive(item.href, pathname))

  return (
    <Collapsible.Root open={isOpen} onOpenChange={() => onToggle()}>
      <Collapsible.Trigger asChild>
        <button
          type="button"
          className={cn(
            'flex w-full items-center gap-2 rounded-md px-3 py-2 text-xs font-semibold uppercase tracking-wider transition-colors duration-200',
            hasActiveItem
              ? 'text-foreground'
              : 'text-muted-foreground hover:text-foreground hover:bg-muted/80',
          )}
        >
          <group.icon className="h-3.5 w-3.5 shrink-0" />
          <span className="flex-1 text-left">{group.label}</span>
          <ChevronDown
            className={cn(
              'h-3.5 w-3.5 shrink-0 transition-transform duration-200',
              isOpen ? 'rotate-180' : 'rotate-0',
            )}
          />
        </button>
      </Collapsible.Trigger>

      <Collapsible.Content
        className={cn(
          'overflow-hidden data-[state=open]:animate-accordion-down data-[state=closed]:animate-accordion-up',
        )}
      >
        <div className="flex flex-col gap-0.5 py-1 pl-4">
          {group.items.map(({ href, label, icon: ItemIcon }) => {
            const active = isActive(href, pathname)
            return (
              <Link
                key={href}
                href={href}
                className={cn(
                  'flex cursor-pointer items-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition-colors duration-200',
                  active
                    ? 'bg-primary/20 text-primary ring-1 ring-primary/40'
                    : 'text-muted-foreground hover:bg-muted/80 hover:text-foreground',
                )}
              >
                <ItemIcon className="h-4 w-4 shrink-0" />
                {label}
              </Link>
            )
          })}
        </div>
      </Collapsible.Content>
    </Collapsible.Root>
  )
}

export function AppSidebar() {
  const pathname = usePathname()
  const router = useRouter()
  const user = useAuthStore((s) => s.user)
  const clearAuth = useAuthStore((s) => s.clearAuth)
  const isAdmin = useAuthStore((s) => s.isAdmin)

  const visibleItems = NAV_ITEMS_BOTTOM.filter((item) => !item.adminOnly || isAdmin())

  const [openGroups, setOpenGroups] = useState<Set<string>>(() => {
    const active = new Set<string>()
    for (const group of NAV_GROUPS) {
      if (group.items.some((item) => isActive(item.href, pathname))) {
        active.add(group.id)
      }
    }
    return active
  })

  const toggleGroup = (id: string) => {
    setOpenGroups((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  return (
    <aside className="flex w-64 shrink-0 flex-col border-r border-border/70 bg-card/70 backdrop-blur-xl">
      <div className="border-b border-border/70 px-4 py-5">
        <Link
          href="/dashboard"
          className="font-semibold tracking-tight text-foreground"
        >
          Trading Bot App
        </Link>
        <p className="mt-1 truncate text-xs text-muted-foreground">
          {user?.email ?? '—'}
        </p>
      </div>

      <nav className="flex flex-1 flex-col gap-1 p-3">
        {NAV_ITEMS_TOP.map(({ href, label, icon: ItemIcon }) => {
          const active = isActive(href, pathname)
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                'flex cursor-pointer items-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition-colors duration-200',
                active
                  ? 'bg-primary/20 text-primary ring-1 ring-primary/40'
                  : 'text-muted-foreground hover:bg-muted/80 hover:text-foreground',
              )}
            >
              <ItemIcon className="h-4 w-4 shrink-0" />
              {label}
            </Link>
          )
        })}

        {NAV_GROUPS.map((group) => (
          <NavGroupSection
            key={group.id}
            group={group}
            pathname={pathname}
            isOpen={openGroups.has(group.id)}
            onToggle={() => toggleGroup(group.id)}
          />
        ))}

        {visibleItems.map(({ href, label, icon: ItemIcon }) => {
          const active = isActive(href, pathname)
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                'flex cursor-pointer items-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition-colors duration-200',
                active
                  ? 'bg-primary/20 text-primary ring-1 ring-primary/40'
                  : 'text-muted-foreground hover:bg-muted/80 hover:text-foreground',
              )}
            >
              <ItemIcon className="h-4 w-4 shrink-0" />
              {label}
            </Link>
          )
        })}
      </nav>

      <div className="border-t p-2">
        <Button
          variant="ghost"
          className="w-full justify-start gap-2 text-muted-foreground transition-colors duration-200 hover:text-foreground"
          onClick={() => {
            clearAuth()
            router.replace('/login')
          }}
        >
          <LogOut className="h-4 w-4" />
          Sign out
        </Button>
      </div>
    </aside>
  )
}
