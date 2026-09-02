'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useQuery } from 'convex/react'
import { api } from '@/convex/_generated/api'
import { UserProvider } from '@/contexts/user-context'
import { ShieldCheck } from 'lucide-react'

// ── The admin console ─────────────────────────────────────────────────────────
//
// Running the platform, as distinct from running a workspace. It sits outside
// the dashboard shell deliberately: the sidebar there is somebody's own work,
// and mixing "your clients" with "everybody's accounts" in one navigation is
// how an admin ends up acting on the wrong one.
//
// The guard below decides what to *render*. It is not the security boundary —
// every query and mutation behind these pages resolves the caller through
// `requireAdmin` server-side, because a check that only exists in the browser
// is a check that anybody can skip by calling the API directly.

// `exact` for the overview alone: it sits at the root of the console, so a
// prefix match would light it up on every page underneath it.
const TABS: { href: string; label: string; exact?: boolean }[] = [
  { href: '/admin', label: 'Overview', exact: true },
  { href: '/admin/requests', label: 'Requests' },
  { href: '/admin/users', label: 'Accounts' },
]

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const role = useQuery(api.admin.myAdminRole)

  // Undefined is still loading; null is signed in without a role, or not
  // signed in at all. Both non-admin cases render the same nothing the server
  // returns — no "you are not an admin", which would confirm the console is
  // real to whoever is trying the URL.
  if (role === undefined) {
    return (
      <div className="min-h-screen bg-background">
        <div className="mx-auto max-w-5xl px-6 py-16">
          <div className="h-4 w-32 animate-pulse rounded bg-muted" />
        </div>
      </div>
    )
  }

  if (role === null) return <NotFound />

  return (
    <UserProvider>
      <div className="min-h-screen bg-background">
        <header className="border-b border-border">
          <div className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-6 py-4">
            <div className="flex items-center gap-2.5">
              <ShieldCheck className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-semibold text-foreground">Admin</span>
              <span className="rounded-full border border-border px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
                {role}
              </span>
            </div>
            <Link
              href="/dashboard"
              className="text-sm text-muted-foreground transition-colors hover:text-foreground"
            >
              Back to dashboard
            </Link>
          </div>

          <nav className="mx-auto flex max-w-5xl gap-1 px-6">
            {TABS.map((tab) => {
              const active = tab.exact
                ? pathname === tab.href
                : pathname === tab.href || pathname.startsWith(tab.href + '/')
              return (
                <Link
                  key={tab.href}
                  href={tab.href}
                  aria-current={active ? 'page' : undefined}
                  className={`-mb-px border-b-2 px-3 py-2 text-sm transition-colors ${
                    active
                      ? 'border-foreground font-medium text-foreground'
                      : 'border-transparent text-muted-foreground hover:text-foreground'
                  }`}
                >
                  {tab.label}
                </Link>
              )
            })}
          </nav>
        </header>

        <main className="mx-auto max-w-5xl px-6 py-8">{children}</main>
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
          href="/dashboard"
          className="mt-6 inline-block text-sm text-muted-foreground underline underline-offset-4 hover:text-foreground"
        >
          Back to the dashboard
        </Link>
      </div>
    </div>
  )
}
