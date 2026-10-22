'use client'

import Link from 'next/link'
import Image from 'next/image'
import { Wordmark } from '@/components/brand/wordmark'
import { usePathname } from 'next/navigation'
import { useState, useEffect } from 'react'
import { cn } from '@/lib/utils'
import {
  LayoutDashboard, FileText, Users, CreditCard, Settings,
  PlusCircle, X, Menu, LogOut, Building2, KanbanSquare, Search, Mail,
  Activity, Briefcase, UserSearch,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useUserContext } from '@/contexts/user-context'
import { WorkspaceSwitcher } from '@/components/dashboard/workspace-switcher'
import { ClientSwitcher } from '@/components/dashboard/client-switcher'
import { LogoutLink } from '@kinde-oss/kinde-auth-nextjs'

const NAV_ITEMS = [
  { href: '/dashboard',          label: 'Overview',     icon: LayoutDashboard, exact: true },
  { href: '/dashboard/pipeline', label: 'Pipeline',     icon: KanbanSquare,    exact: false },
  { href: '/dashboard/content',  label: 'All Content',  icon: FileText,        exact: false },
  { href: '/dashboard/clients',  label: 'Clients',      icon: Building2,       exact: false },
  { href: '/dashboard/reports',  label: 'Reports',      icon: Mail,            exact: false },
  { href: '/dashboard/analytics',label: 'Analytics',    icon: Activity,        exact: false },
  { href: '/dashboard/jobs',     label: 'Jobs',         icon: Briefcase,       exact: false },
  { href: '/dashboard/hire',     label: 'Hire profile', icon: UserSearch,     exact: false },
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
      <div className="flex h-16 shrink-0 items-center justify-between px-5 pt-2">
        <Wordmark href="/dashboard" size="sm" onClick={onClose} />
        {onClose && (
          <button
            type="button"
            onClick={onClose}
            className="rounded-full p-1.5 transition-colors hover:bg-paper"
            aria-label="Close menu"
          >
            <X className="h-4 w-4 text-muted-foreground" />
          </button>
        )}
      </div>

      {/* Workspace switcher — renders nothing unless there is a choice to make */}
      <WorkspaceSwitcher onNavigate={onClose} />
      <ClientSwitcher onNavigate={onClose} />

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
          className="flex w-full items-center gap-2 rounded-full bg-paper px-3.5 py-2 text-left text-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          <Search className="h-3.5 w-3.5 shrink-0" />
          <span className="flex-1">Search</span>
          <kbd className="rounded-md bg-sand px-1.5 py-0.5 font-mono text-[10px]">
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
                'flex items-center gap-2.5 rounded-full px-3.5 py-2 text-sm transition-colors',
                isActive
                  ? 'bg-paper font-medium text-accent'
                  : 'text-foreground/80 hover:bg-paper/60 hover:text-foreground'
              )}
            >
              <item.icon className="h-4 w-4 shrink-0" />
              {item.label}
            </Link>
          )
        })}

        {/* No Admin link. The console moved to its own host, and a link here
            would put the entrance back in the navigation of the page every
            customer opens — which is the thing moving it was for. Admins reach
            it by its address; nothing about this sidebar should differ because
            of who is looking at it. */}

        {/* Divider + action button */}
        <div className="pt-5">
          <Link href="/dashboard/add" onClick={onClose}>
            <Button className="w-full justify-center gap-2">
              <PlusCircle className="h-4 w-4 shrink-0" />
              Add New Entry
            </Button>
          </Link>
        </div>
      </nav>

      {/* Footer: user */}
      <div className="shrink-0 border-t border-ink/10 px-3 py-3">
        {profile && (
          <div className="flex items-center gap-2.5 rounded-xl px-3 py-2">
            {profile.imageUrl ? (
              <Image
                src={profile.imageUrl}
                alt={displayName}
                width={28}
                height={28}
                className="rounded-full shrink-0"
              />
            ) : (
              <div className="h-7 w-7 rounded-full bg-ink flex items-center justify-center shrink-0">
                <span className="text-xs font-semibold text-paper">{initials}</span>
              </div>
            )}
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-foreground truncate">{displayName}</p>
              <p className="text-xs text-muted-foreground truncate">{profile.email}</p>
            </div>
            <LogoutLink>
              <button
                type="button"
                className="shrink-0 rounded-full p-1.5 transition-colors hover:bg-paper"
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
      <aside className="hidden lg:fixed lg:inset-y-3 lg:left-3 lg:z-40 lg:flex lg:w-60 lg:flex-col lg:overflow-hidden lg:rounded-[2rem] lg:bg-sidebar">
        <SidebarInner />
      </aside>

      {/* Mobile top bar */}
      <div className="fixed top-0 left-0 right-0 z-30 flex h-14 items-center justify-between bg-background px-4 lg:hidden">
        <Wordmark href="/dashboard" size="sm" />
        <button
          type="button"
          onClick={() => setMobileOpen(true)}
          className="rounded-full p-2 transition-colors hover:bg-sand"
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
            className="fixed inset-0 z-40 bg-ink/40"
            onClick={() => setMobileOpen(false)}
          />
          <aside className="fixed inset-y-2 left-2 z-50 w-72 overflow-hidden rounded-[2rem] bg-sidebar">
            <SidebarInner
              onClose={() => setMobileOpen(false)}
            />
          </aside>
        </>
      )}
    </>
  )
}
