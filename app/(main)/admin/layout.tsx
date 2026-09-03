'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useQuery } from 'convex/react'
import { api } from '@/convex/_generated/api'
import { LogoutLink } from '@kinde-oss/kinde-auth-nextjs/components'
import { UserProvider } from '@/contexts/user-context'
import { ImpersonationBanner } from '@/components/admin/impersonation-banner'
import {
  Activity,
  Building2,
  FileText,
  Inbox,
  LayoutDashboard,
  LogOut,
  ScrollText,
  ShieldAlert,
  ShieldCheck,
  Users,
  Wallet,
} from 'lucide-react'

// ── The admin console ─────────────────────────────────────────────────────────
//
// Running the platform, as distinct from running a workspace.
//
// It has its own host — admin.devrel.studio, routed in proxy.ts — so the
// authority to administer the platform and the session every customer's own
// dashboard runs on live on separate origins. That is not the security boundary:
// every query behind these pages resolves `requireAdmin` server-side, because a
// host is something the network can lie about and a Convex guard is not. What
// the separate origin buys is that local storage, host-scoped cookies and any
// edge rule added later stop at the edge of the console.
//
// The navigation is a sidebar rather than the row of tabs it started as. Nine
// sections in a horizontal strip is a strip that wraps, and a wrapped tab row
// gives no sense of what the console *contains* — which is the first thing
// somebody opening it needs to know.

interface Item {
  href: string
  label: string
  icon: typeof LayoutDashboard
  exact?: boolean
}

/**
 * Grouped by the question being asked, not by the table being read.
 *
 * "Today" is what needs a person now. "The book" is who and what exists. "The
 * product" is what people are doing with it. "The record" is what has happened.
 * Somebody opening this at nine in the morning reads the first group and stops.
 */
const GROUPS: { label: string; items: Item[] }[] = [
  {
    label: 'Today',
    items: [
      { href: '/admin', label: 'Overview', icon: LayoutDashboard, exact: true },
      { href: '/admin/requests', label: 'Requests', icon: Inbox },
      { href: '/admin/abuse', label: 'Lockouts', icon: ShieldAlert },
    ],
  },
  {
    label: 'The book',
    items: [
      { href: '/admin/users', label: 'Accounts', icon: Users },
      { href: '/admin/workspaces', label: 'Workspaces', icon: Building2 },
      { href: '/admin/revenue', label: 'Revenue', icon: Wallet },
    ],
  },
  {
    label: 'The product',
    items: [
      { href: '/admin/content', label: 'Content', icon: FileText },
      { href: '/admin/traffic', label: 'Traffic', icon: Activity },
    ],
  },
  {
    label: 'The record',
    items: [{ href: '/admin/audit', label: 'Audit', icon: ScrollText }],
  },
]

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const role = useQuery(api.admin.myAdminRole)
  const openRequests = useQuery(api.admin.openRequestCount, role ? {} : 'skip')

  // Undefined is still loading; null is signed in without a role, or not signed
  // in at all. Both non-admin cases render the same nothing the server returns —
  // no "you are not an admin", which would confirm the console is real to
  // whoever is trying the address.
  if (role === undefined) {
    return (
      <div className="min-h-screen bg-background">
        <div className="mx-auto max-w-6xl px-6 py-16">
          <div className="h-4 w-32 animate-pulse rounded bg-muted" />
        </div>
      </div>
    )
  }

  if (role === null) return <NotFound />

  return (
    <UserProvider>
      {/* Renders nothing unless a session is open. Here as well as on the
          dashboard: an admin who starts one, walks into the console and comes
          back later would otherwise have nothing on screen saying so. */}
      <ImpersonationBanner />

      <div className="min-h-screen bg-background">
        <div className="mx-auto flex max-w-[1400px] flex-col lg:flex-row">
          <aside className="relative shrink-0 border-b border-border lg:sticky lg:top-0 lg:h-screen lg:w-56 lg:border-b-0 lg:border-r">
            <div className="flex items-center gap-2.5 px-5 py-4">
              <ShieldCheck className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-semibold text-foreground">Admin</span>
              <span className="rounded-full border border-border px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
                {role}
              </span>
            </div>

            <nav className="flex gap-4 overflow-x-auto px-5 pb-3 lg:block lg:space-y-5 lg:overflow-visible lg:px-3 lg:pb-0">
              {GROUPS.map((group) => (
                <div key={group.label} className="shrink-0">
                  <p className="hidden px-2 pb-1.5 text-[11px] font-medium uppercase tracking-wide text-muted-foreground lg:block">
                    {group.label}
                  </p>
                  <div className="flex gap-1 lg:block lg:space-y-0.5">
                    {group.items.map((item) => {
                      const active = item.exact
                        ? pathname === item.href
                        : pathname === item.href || pathname.startsWith(item.href + '/')
                      const Icon = item.icon

                      return (
                        <Link
                          key={item.href}
                          href={item.href}
                          aria-current={active ? 'page' : undefined}
                          className={`flex shrink-0 items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-sm transition-colors ${
                            active
                              ? 'bg-secondary font-medium text-foreground'
                              : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                          }`}
                        >
                          <Icon className="h-4 w-4 shrink-0" />
                          {item.label}
                          {/* The only count in the navigation, because it is the
                              only one that means somebody is waiting. */}
                          {item.href === '/admin/requests' && !!openRequests && (
                            <span className="ml-auto rounded-full bg-accent px-1.5 py-0.5 text-[11px] font-medium text-accent-foreground">
                              {openRequests}
                            </span>
                          )}
                        </Link>
                      )
                    })}
                  </div>
                </div>
              ))}
            </nav>

            {/* Signing out was only possible from the product's dashboard,
                which meant leaving the console to leave the console — on a host
                whose whole point is that it is not that one. It sits at the
                foot of the navigation, the same place the dashboard puts it. */}
            <div className="mt-4 px-5 pb-4 lg:absolute lg:bottom-0 lg:px-3">
              <LogoutLink className="flex items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground">
                <LogOut className="h-4 w-4 shrink-0" />
                Sign out
              </LogoutLink>
            </div>
          </aside>

          <main className="min-w-0 flex-1 px-6 py-8 lg:px-10">{children}</main>
        </div>
      </div>
    </UserProvider>
  )
}

/** Deliberately identical to any other unknown URL. */
function NotFound() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-6">
      <div className="text-center">
        <h1 className="text-2xl font-semibold text-foreground">Not found</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          There is nothing at this address.
        </p>
        <Link
          href="/"
          className="mt-6 inline-block text-sm text-muted-foreground underline underline-offset-4 hover:text-foreground"
        >
          devrel.studio
        </Link>
      </div>
    </div>
  )
}
