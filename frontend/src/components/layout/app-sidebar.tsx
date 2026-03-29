'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
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
  HeartPulse,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { useAuthStore } from '@/store/auth.store'
import { useRouter } from 'next/navigation'

const nav = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/portfolios', label: 'Portfolios', icon: FolderOpen },
  { href: '/bots', label: 'Bots', icon: Bot },
  { href: '/marketplace', label: 'Marketplace', icon: Globe },
  { href: '/backtest', label: 'Backtest', icon: BarChart3 },
  { href: '/trades', label: 'Trade history', icon: History },
  { href: '/logs', label: 'Logs', icon: ScrollText },
  { href: '/health', label: 'Health', icon: HeartPulse },
  { href: '/admin', label: 'Monitoring', icon: Activity },
]

export function AppSidebar() {
  const pathname = usePathname()
  const router = useRouter()
  const user = useAuthStore((s) => s.user)
  const clearAuth = useAuthStore((s) => s.clearAuth)

  return (
    <aside className="flex w-64 shrink-0 flex-col border-r border-border/70 bg-card/70 backdrop-blur-xl">
      <div className="border-b border-border/70 px-4 py-5">
        <Link href="/dashboard" className="font-semibold tracking-tight text-foreground">
          Trading Bot App
        </Link>
        <p className="mt-1 truncate text-xs text-muted-foreground">
          {user?.email ?? '—'}
        </p>
      </div>
      <nav className="flex flex-1 flex-col gap-1 p-3">
        {nav.map(({ href, label, icon: Icon }) => {
          const active = pathname === href || pathname.startsWith(`${href}/`)
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
              <Icon className="h-4 w-4 shrink-0" />
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
