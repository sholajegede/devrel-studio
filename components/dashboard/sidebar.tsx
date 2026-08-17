'use client'

import Link from 'next/link'
import Image from 'next/image'
import { usePathname } from 'next/navigation'
import { useState, useEffect } from 'react'
import { cn } from '@/lib/utils'
import {
  LayoutDashboard, FileText, Users, CreditCard, Settings,
  PlusCircle, X, Menu, LogOut, Building2, KanbanSquare, Search,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useUserContext } from '@/contexts/user-context'
import { WorkspaceSwitcher } from '@/components/dashboard/workspace-switcher'
import { ThemeToggle } from '@/components/theme-toggle'
import { LogoutLink } from '@kinde-oss/kinde-auth-nextjs'

const NAV_ITEMS = [
  { href: '/dashboard',          label: 'Overview',     icon: LayoutDashboard, exact: true },
  { href: '/dashboard/pipeline', label: 'Pipeline',     icon: KanbanSquare,    exact: false },
  { href: '/dashboard/content',  label: 'All Content',  icon: FileText,        exact: false },
  { href: '/dashboard/clients',  label: 'Clients',      icon: Building2,       exact: false },
  { href: '/dashboard/members',  label: 'Members',      icon: Users,           exact: false },
  { href: '/dashboard/billing',  label: 'Billing',      icon: CreditCard,      exact: false },
  { href: '/dashboard/settings', label: 'Settings',     icon: Settings,        exact: false },
]

function SidebarInner({ onClose }: { onClose?: () => void }) {
  const pathname  = usePathname()
  const { profile } = useUserContext()

  const initials = profile
    ? (profile.firstName?.[0] ?? profile.email[0]).toUpperCase()
    : '?'

  const displayName = profile
    ? (profile.firstName ? `${profile.firstName} ${profile.lastName ?? ''}`.trim() : profile.email)
    : ''

  return (
    <div className="flex h-full flex-col">

      {/* Logo bar */}
      <div className="flex h-14 shrink-0 items-center justify-between border-b border-border px-4">
        <Link href="/dashboard" className="flex items-center gap-2.5" onClick={onClose}>
          <Image
            src="/images/devrel-logo.png"
            alt="DevRel Studio"
            width={28}
            height={28}
            className="rounded"
          />
          <span className="text-base font-semibold text-foreground">
            devrel<span className="text-muted-foreground">.studio</span>
          </span>
        </Link>
        {onClose && (
          <button
            type="button"
            onClick={onClose}
            className="rounded-md p-1 hover:bg-muted transition-colors"
            aria-label="Close menu"
          >
            <X className="h-4 w-4 text-muted-foreground" />
          </button>
        )}
      </div>

      {/* Workspace switcher — renders nothing unless there is a choice to make */}
      <WorkspaceSwitcher onNavigate={onClose} />

      {/* A keyboard shortcut nobody knows about does not exist. This is the
          only advertisement for ⌘K, and it opens the palette when clicked so it
          works for people who never try the shortcut. */}
      <div className="px-3 pt-3">
        <button
          type="button"
          onClick={() => {
            document.dispatchEvent(
              new KeyboardEvent('keydown', { key: 'k', metaKey: true, bubbles: true }),
            )
            onClose?.()
          }}
          className="flex w-full items-center gap-2 rounded-md border border-border px-2.5 py-1.5 text-left text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        >
          <Search className="h-3.5 w-3.5 shrink-0" />
          <span className="flex-1">Search</span>
          <kbd className="rounded border border-border bg-muted px-1.5 py-0.5 font-mono text-[10px]">
            ⌘K
          </kbd>
        </button>
      </div>

      {/* Nav */}
      <nav id="dashboard-nav" aria-label="Dashboard" className="flex-1 overflow-y-auto px-3 py-4 space-y-0.5">
        {NAV_ITEMS.map((item) => {
          const isActive = item.exact
            ? pathname === item.href
            : pathname === item.href || pathname.startsWith(item.href + '/')
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={onClose}
              className={cn(
                'flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm transition-colors',
                isActive
                  ? 'bg-secondary font-medium text-foreground'
                  : 'text-muted-foreground hover:bg-muted hover:text-foreground'
              )}
            >
              <item.icon className="h-4 w-4 shrink-0" />
              {item.label}
            </Link>
          )
        })}

        {/* Divider + action button */}
        <div className="pt-5">
          <Link href="/dashboard/add" onClick={onClose}>
            <Button
              size="sm"
              className="w-full justify-start gap-2 bg-accent text-accent-foreground hover:bg-accent/90"
            >
              <PlusCircle className="h-4 w-4 shrink-0" />
              Add New Entry
            </Button>
          </Link>
        </div>
      </nav>

      {/* Footer: user */}
      <div className="shrink-0 border-t border-border px-3 py-3">
        {profile && (
          <div className="flex items-center gap-2.5 rounded-lg px-3 py-2">
            {profile.imageUrl ? (
              <Image
                src={profile.imageUrl}
                alt={displayName}
                width={28}
                height={28}
                className="rounded-full shrink-0"
              />
            ) : (
              <div className="h-7 w-7 rounded-full bg-primary flex items-center justify-center shrink-0">
                <span className="text-xs font-semibold text-primary-foreground">{initials}</span>
              </div>
            )}
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-foreground truncate">{displayName}</p>
              <p className="text-xs text-muted-foreground truncate">{profile.email}</p>
            </div>
            <ThemeToggle className="h-7 w-7 shrink-0" />
            <LogoutLink>
              <button
                type="button"
                className="shrink-0 rounded-md p-1 hover:bg-muted transition-colors"
                title="Sign out"
              >
                <LogOut className="h-3.5 w-3.5 text-muted-foreground" />
              </button>
            </LogoutLink>
          </div>
        )}
      </div>

    </div>
  )
}

export function DashboardSidebar() {
  const [mobileOpen, setMobileOpen] = useState(false)
  const pathname = usePathname()

  useEffect(() => { setMobileOpen(false) }, [pathname])

  return (
    <>
      {/* Desktop sidebar */}
      <aside className="hidden lg:fixed lg:inset-y-0 lg:left-0 lg:z-40 lg:flex lg:w-60 lg:flex-col lg:border-r lg:border-border lg:bg-card">
        <SidebarInner />
      </aside>

      {/* Mobile top bar */}
      <div className="fixed top-0 left-0 right-0 z-30 flex h-14 items-center justify-between border-b border-border bg-card px-4 lg:hidden">
        <Link href="/dashboard" className="flex items-center gap-2.5">
          <Image
            src="/images/devrel-logo.png"
            alt="DevRel Studio"
            width={28}
            height={28}
            className="rounded"
          />
          <span className="text-base font-semibold text-foreground">
            devrel<span className="text-muted-foreground">.studio</span>
          </span>
        </Link>
        <button
          type="button"
          onClick={() => setMobileOpen(true)}
          className="rounded-md p-2 hover:bg-muted transition-colors"
          aria-label="Open navigation"
          aria-expanded={mobileOpen}
          aria-controls="dashboard-nav"
        >
          <Menu className="h-5 w-5 text-foreground" />
        </button>
      </div>

      {/* Mobile drawer */}
      {mobileOpen && (
        <>
          <div
            className="fixed inset-0 z-40 bg-black/50"
            onClick={() => setMobileOpen(false)}
          />
          <aside className="fixed inset-y-0 left-0 z-50 w-72 bg-card border-r border-border">
            <SidebarInner
              onClose={() => setMobileOpen(false)}
            />
          </aside>
        </>
      )}
    </>
  )
}
