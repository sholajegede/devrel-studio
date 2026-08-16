'use client'

import { useEffect, useState } from 'react'
import { useTheme } from 'next-themes'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Check, Monitor, Moon, Sun } from 'lucide-react'

const OPTIONS = [
  { value: 'light', label: 'Light', icon: Sun },
  { value: 'dark', label: 'Dark', icon: Moon },
  { value: 'system', label: 'System', icon: Monitor },
] as const

/**
 * Compact theme control for page headers.
 *
 * Three explicit choices rather than a two-state switch: "system" is a real
 * preference, and a toggle that silently overrides the OS setting is the thing
 * people complain about afterwards. The fuller version in Settings → Appearance
 * shows the same three as labelled cards.
 */
export function ThemeToggle({ className }: { className?: string }) {
  const { theme, resolvedTheme, setTheme } = useTheme()
  const [mounted, setMounted] = useState(false)

  // The server cannot know what the browser resolved, so the icon is decided
  // after mount. Rendering a fixed placeholder first keeps the header from
  // shifting and avoids a hydration mismatch.
  useEffect(() => setMounted(true), [])

  const Icon = !mounted ? Sun : resolvedTheme === 'dark' ? Moon : Sun

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          aria-label="Change theme"
          className={[
            'inline-flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground',
            className ?? '',
          ].join(' ')}
        >
          <Icon className="h-4 w-4" />
        </button>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" className="w-36">
        {OPTIONS.map((option) => (
          <DropdownMenuItem
            key={option.value}
            onClick={() => setTheme(option.value)}
            className="gap-2 text-sm"
          >
            <option.icon className="h-3.5 w-3.5" />
            {option.label}
            {mounted && theme === option.value && (
              <Check className="ml-auto h-3.5 w-3.5" />
            )}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
