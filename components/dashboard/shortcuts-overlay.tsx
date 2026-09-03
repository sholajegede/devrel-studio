'use client'

import { useEffect, useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'

// ── The shortcuts, on demand ──────────────────────────────────────────────────
//
// ⌘K has been here for a while and the sidebar advertises it, but nothing said
// what else the keyboard does — so for most people the answer was "nothing else",
// whether or not that was true.
//
// `?` because it is what every product that takes its keyboard seriously uses,
// and because somebody who tries it is exactly the person the list is for.

interface Shortcut {
  keys: string[]
  action: string
}

const GROUPS: { label: string; shortcuts: Shortcut[] }[] = [
  {
    label: 'Anywhere',
    shortcuts: [
      { keys: ['⌘', 'K'], action: 'Open the command palette' },
      { keys: ['?'], action: 'Show this list' },
      { keys: ['Esc'], action: 'Close whatever is open' },
    ],
  },
  {
    label: 'In the palette',
    shortcuts: [
      { keys: ['↑', '↓'], action: 'Move through results' },
      { keys: ['↵'], action: 'Run the highlighted one' },
      { keys: ['Type'], action: 'Filter everything at once — pages, clients, content' },
    ],
  },
]

export function ShortcutsOverlay() {
  const [open, setOpen] = useState(false)

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== '?') return

      // Not while somebody is writing. A question mark typed into a search box
      // or a report write-up belongs in the box, and stealing it would make the
      // field feel broken.
      const target = event.target as HTMLElement | null
      const typing =
        target?.tagName === 'INPUT' ||
        target?.tagName === 'TEXTAREA' ||
        target?.isContentEditable
      if (typing) return

      event.preventDefault()
      setOpen((previous) => !previous)
    }

    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [])

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Keyboard shortcuts</DialogTitle>
          <DialogDescription>
            Press <Key>?</Key> anywhere to bring this back.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5">
          {GROUPS.map((group) => (
            <div key={group.label}>
              <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                {group.label}
              </p>
              <ul className="mt-2.5 space-y-2">
                {group.shortcuts.map((shortcut) => (
                  <li
                    key={shortcut.action}
                    className="flex items-center justify-between gap-4 text-sm"
                  >
                    <span className="text-muted-foreground">{shortcut.action}</span>
                    <span className="flex shrink-0 gap-1">
                      {shortcut.keys.map((key) => (
                        <Key key={key}>{key}</Key>
                      ))}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  )
}

function Key({ children }: { children: React.ReactNode }) {
  return (
    <kbd className="inline-flex h-5 min-w-5 items-center justify-center rounded border border-border bg-muted px-1.5 font-mono text-[11px] text-foreground">
      {children}
    </kbd>
  )
}
