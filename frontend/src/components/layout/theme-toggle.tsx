'use client'

import { Moon, Sun } from 'lucide-react'
import { useThemeStore } from '@/store/theme.store'
import { Button } from '@/components/ui/button'
import { SimpleTooltip } from '@/components/ui/simple-tooltip'

export function ThemeToggle() {
  const { theme, toggleTheme } = useThemeStore()

  return (
    <SimpleTooltip content={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}>
      <Button
        variant="ghost"
        size="sm"
        onClick={toggleTheme}
        className="h-8 w-8 cursor-pointer p-0"
        aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
      >
        {theme === 'dark' ? (
          <Sun className="h-4 w-4" />
        ) : (
          <Moon className="h-4 w-4" />
        )}
      </Button>
    </SimpleTooltip>
  )
}