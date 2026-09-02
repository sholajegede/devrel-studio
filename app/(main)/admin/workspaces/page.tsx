'use client'

import Link from 'next/link'
import { useQuery } from 'convex/react'
import { api } from '@/convex/_generated/api'
import { Card } from '@/components/ui/card'
import { AlertTriangle, Users } from 'lucide-react'

// ── Workspaces ────────────────────────────────────────────────────────────────
//
// Who is using more than they are paying for, and who is nowhere near it.
//
// Usage is counted by workspace against the owner's plan — the way every limit
// in the product is actually enforced. Counting any other way would put a number
// on this page that the customer's own gate disagrees with, and somebody would
// act on it.
//
// Over-limit is not an accusation. A workspace on Pro with five clients that
// lapses to the trial is instantly four over, having done nothing at all; the
// product stops writes rather than deleting anything. Usually it means somebody
// needs an invoice, not an intervention.

export default function AdminWorkspacesPage() {
  const result = useQuery(api.adminWorkspaces.listWorkspaces, {})
  const loading = result === undefined

  return (
    <>
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-foreground">Workspaces</h1>
        <p className="text-sm text-muted-foreground">
          {loading
            ? 'Loading…'
            : result.overLimit === 0
              ? `${result.total} ${result.total === 1 ? 'workspace' : 'workspaces'}, all within plan`
              : `${result.overLimit} of ${result.total} over the owner's plan`}
        </p>
      </div>

      {loading ? (
        <div className="space-y-2">
          {Array.from({ length: 4 }).map((_, index) => (
            <Card key={index} className="gap-0 p-4">
              <div className="h-4 w-56 animate-pulse rounded bg-muted" />
              <div className="mt-2.5 h-3 w-40 animate-pulse rounded bg-muted" />
            </Card>
          ))}
        </div>
      ) : result.rows.length === 0 ? (
        <Card className="gap-0 p-10 text-center">
          <p className="text-sm text-muted-foreground">No workspaces yet.</p>
        </Card>
      ) : (
        <div className="space-y-2">
          {result.rows.map((row) => {
            const flagged = row.over.clients || row.over.entries || row.over.seats
            return (
              <Link
                key={row.id}
                href={`/admin/workspaces/${row.id}`}
                className="block rounded-xl border border-border bg-card p-4 transition-colors hover:border-foreground/20 hover:bg-muted/40"
              >
                <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      {flagged && (
                        <AlertTriangle className="h-3.5 w-3.5 shrink-0 text-amber-600 dark:text-amber-500" />
                      )}
                      <span className="font-medium text-foreground">{row.name}</span>
                      {row.isPersonal && (
                        <span className="rounded-full border border-border px-2 py-0.5 text-[11px] text-muted-foreground">
                          personal
                        </span>
                      )}
                    </div>
                    <p className="mt-0.5 truncate text-sm text-muted-foreground">
                      {row.owner
                        ? `${row.owner.email} · ${row.owner.planName}`
                        : 'no owner — the account was deleted'}
                    </p>
                  </div>

                  <div className="flex shrink-0 flex-wrap items-center gap-4 text-sm">
                    <Meter
                      label="clients"
                      count={row.usage.clients}
                      limit={row.limits.maxClients}
                      over={row.over.clients}
                    />
                    <Meter
                      label="entries"
                      count={row.usage.entries}
                      limit={row.limits.maxEntries}
                      over={row.over.entries}
                    />
                    <span
                      className={`flex items-center gap-1 tabular-nums ${
                        row.over.seats ? 'text-amber-600 dark:text-amber-500' : 'text-muted-foreground'
                      }`}
                      title="Members against seats"
                    >
                      <Users className="h-3.5 w-3.5" />
                      {row.usage.members}/{row.limits.seats}
                    </span>
                  </div>
                </div>
              </Link>
            )
          })}
        </div>
      )}
    </>
  )
}

/**
 * A count against its ceiling.
 *
 * `null` is unlimited and renders as a bare number: "12 of ∞" is a sum nobody
 * needs to read, and an infinity sign in a support tool reads as a bug.
 */
function Meter({
  label,
  count,
  limit,
  over,
}: {
  label: string
  count: number
  limit: number | null
  over: boolean
}) {
  return (
    <span
      className={`tabular-nums ${over ? 'font-medium text-amber-600 dark:text-amber-500' : 'text-muted-foreground'}`}
      title={`${label}: ${count}${limit === null ? ' (unlimited)' : ` of ${limit}`}`}
    >
      {limit === null ? count : `${count}/${limit}`}{' '}
      <span className="text-xs">{label}</span>
    </span>
  )
}
