'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useQuery } from 'convex/react'
import { api } from '@/convex/_generated/api'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { PauseCircle, Search, ShieldCheck } from 'lucide-react'

// ── Finding an account ────────────────────────────────────────────────────────
//
// One box, because there is one way anybody arrives here: an email address at
// the top of a support message. Searching by name was considered and dropped —
// it cannot use an index, and it answers a question nobody asks.
//
// The list is the newest accounts until something is typed, so the page has
// something true on it rather than an empty state explaining itself.

export default function AdminUsersPage() {
  const [term, setTerm] = useState('')

  // Queried on every keystroke, which is what a reactive query is for: Convex
  // holds one subscription and swaps the result, and at fourteen accounts an
  // indexed prefix read costs less than the debounce timer would.
  const result = useQuery(api.adminUsers.searchUsers, { term: term.trim() })
  const loading = result === undefined
  const rows = result?.rows ?? []

  return (
    <>
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-foreground">Accounts</h1>
        <p className="text-sm text-muted-foreground">
          {loading
            ? 'Loading…'
            : term.trim()
              ? `${rows.length} ${rows.length === 1 ? 'match' : 'matches'}`
              : 'The most recent sign-ups'}
        </p>
      </div>

      <div className="relative mb-4">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={term}
          onChange={(event) => setTerm(event.target.value)}
          placeholder="Email address, or @handle"
          className="pl-9"
          autoComplete="off"
          spellCheck={false}
          aria-label="Search accounts by email or handle"
        />
      </div>

      {loading ? (
        <div className="space-y-2">
          {Array.from({ length: 4 }).map((_, index) => (
            <Card key={index} className="gap-0 p-4">
              <div className="h-4 w-56 animate-pulse rounded bg-muted" />
              <div className="mt-2.5 h-3 w-28 animate-pulse rounded bg-muted" />
            </Card>
          ))}
        </div>
      ) : rows.length === 0 ? (
        <Card className="gap-0 p-10 text-center">
          <p className="text-sm text-muted-foreground">
            {term.trim()
              ? `Nothing matches “${term.trim()}”. Search matches the start of an address, so try fewer characters.`
              : 'No accounts yet.'}
          </p>
        </Card>
      ) : (
        <div className="space-y-2">
          {rows.map((row) => (
            <Link
              key={row.id}
              href={`/admin/users/${row.id}`}
              className="block rounded-xl border border-border bg-card p-4 transition-colors hover:border-foreground/20 hover:bg-muted/40"
            >
              <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-medium text-foreground">
                      {row.name ?? row.email}
                    </span>
                    {row.paused && (
                      <span className="inline-flex items-center gap-1 rounded-full border border-destructive/40 px-2 py-0.5 text-[11px] font-medium text-destructive">
                        <PauseCircle className="h-3 w-3" />
                        paused
                      </span>
                    )}
                    {row.adminRole && (
                      <span className="inline-flex items-center gap-1 rounded-full border border-border px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
                        <ShieldCheck className="h-3 w-3" />
                        {row.adminRole}
                      </span>
                    )}
                  </div>
                  {row.name && (
                    <p className="mt-0.5 truncate text-sm text-muted-foreground">
                      {row.email}
                    </p>
                  )}
                </div>
                <AccessChip state={row.state} planName={row.planName} until={row.until} />
              </div>
            </Link>
          ))}
        </div>
      )}
    </>
  )
}

/**
 * What this account can do right now, in one chip.
 *
 * The state comes from `accessOf` server-side — the same function the product
 * gates on — so a row that says active here is active everywhere. Recomputing
 * it in the browser is how a console ends up disagreeing with the thing it
 * administers.
 */
function AccessChip({
  state,
  planName,
  until,
}: {
  state: string
  planName: string
  until: number | null
}) {
  const tone: Record<string, string> = {
    comped: 'border-violet-600/30 text-violet-700 dark:text-violet-400',
    active: 'border-emerald-600/30 text-emerald-700 dark:text-emerald-400',
    trial: 'border-border text-muted-foreground',
    expired: 'border-border text-muted-foreground',
  }

  const label =
    state === 'comped'
      ? 'Comped'
      : state === 'active'
        ? until
          ? `${planName} · ${formatDate(until)}`
          : planName
        : state === 'trial'
          ? until
            ? `Trial · ${formatDate(until)}`
            : 'Trial'
          : 'No access'

  return (
    <span
      className={`shrink-0 rounded-full border px-2.5 py-0.5 text-xs font-medium ${tone[state] ?? tone.expired}`}
    >
      {label}
    </span>
  )
}

function formatDate(ms: number): string {
  return new Date(ms).toLocaleDateString(undefined, { day: 'numeric', month: 'short' })
}
