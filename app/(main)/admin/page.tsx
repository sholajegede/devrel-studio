'use client'

import Link from 'next/link'
import { useQuery } from 'convex/react'
import { api } from '@/convex/_generated/api'
import { actionLabel, formatAuditTime } from '@/lib/admin-audit'
import { Card } from '@/components/ui/card'
import { AlertTriangle } from 'lucide-react'

// ── The overview ──────────────────────────────────────────────────────────────
//
// What an operator needs to know before deciding whether today needs them.
//
// Composed from the same queries the other pages use rather than from counters
// maintained on write: a rollup drifts the moment anything changes a row
// without going through the console — a migration, a webhook, a Convex
// dashboard session — and a number that is quietly wrong is worse than one that
// costs a table scan.
//
// The two figures at the top are the ones with a deadline attached. Everything
// below is context.

export default function AdminOverviewPage() {
  const overview = useQuery(api.adminUsers.overview)
  const loading = overview === undefined

  return (
    <>
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-foreground">Overview</h1>
        <p className="text-sm text-muted-foreground">
          {loading
            ? 'Loading…'
            : `${overview.accounts} accounts · ${overview.admins} ${
                overview.admins === 1 ? 'admin' : 'admins'
              }`}
        </p>
      </div>

      {loading ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, index) => (
            <Card key={index} className="gap-0 p-5">
              <div className="h-3 w-20 animate-pulse rounded bg-muted" />
              <div className="mt-3 h-7 w-12 animate-pulse rounded bg-muted" />
            </Card>
          ))}
        </div>
      ) : (
        <>
          {/* Needs a person */}
          <div className="grid gap-3 sm:grid-cols-2">
            <Stat
              label="Waiting on you"
              value={overview.openRequests}
              href="/admin/requests"
              tone={overview.openRequests > 0 ? 'attention' : 'plain'}
              hint={
                overview.openRequests === 0
                  ? 'Nobody is waiting'
                  : 'Requests nobody has answered'
              }
            />
            <Stat
              label="Expiring within a fortnight"
              value={overview.expiringSoon}
              tone={overview.expiringSoon > 0 ? 'attention' : 'plain'}
              hint={
                // Renewals are collected by hand: an invoice to send, a
                // transfer to clear, and somebody to approve it. Two weeks is
                // roughly what that needs, which is why it is the threshold
                // rather than the friendlier-sounding thirty days.
                overview.expiringSoon === 0
                  ? 'No renewals due'
                  : 'Paid access running out — invoice now'
              }
            />
          </div>

          {/* The book */}
          <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Stat label="Paying" value={overview.states.active} hint="Access open" />
            <Stat label="On trial" value={overview.states.trial} hint="Never paid yet" />
            <Stat
              label="Lapsed"
              value={overview.states.expired}
              hint="Readable, cannot write"
            />
            <Stat
              label="Comped"
              value={overview.states.comped}
              hint="Top plan, no purchase"
            />
          </div>

          <Card className="mt-4 gap-0 p-5">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h2 className="text-sm font-semibold text-foreground">Last 30 days</h2>
              <p className="text-xs text-muted-foreground">
                {overview.grantsThisMonth}{' '}
                {overview.grantsThisMonth === 1 ? 'grant' : 'grants'} ·{' '}
                {overview.revokesThisMonth}{' '}
                {overview.revokesThisMonth === 1 ? 'revoke' : 'revokes'}
              </p>
            </div>

            {overview.recent.length === 0 ? (
              <p className="mt-3 text-sm text-muted-foreground">
                Nothing has been done through the console this month.
              </p>
            ) : (
              <ul className="mt-3 space-y-3">
                {overview.recent.map((row) => (
                  <li
                    key={row.id}
                    className="border-b border-border pb-3 text-sm last:border-0 last:pb-0"
                  >
                    <div className="flex flex-wrap items-baseline justify-between gap-2">
                      <span className="text-foreground">
                        {actionLabel(row.action)}
                        {row.subjectEmail && (
                          <>
                            {' — '}
                            {row.subjectId ? (
                              <Link
                                href={`/admin/users/${row.subjectId}`}
                                className="underline underline-offset-4 hover:text-foreground"
                              >
                                {row.subjectEmail}
                              </Link>
                            ) : (
                              row.subjectEmail
                            )}
                          </>
                        )}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {row.actorEmail} · {formatAuditTime(row.at)}
                      </span>
                    </div>
                    {row.reason && (
                      <p className="mt-1 text-xs text-muted-foreground">{row.reason}</p>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </>
      )}
    </>
  )
}

function Stat({
  label,
  value,
  hint,
  href,
  tone = 'plain',
}: {
  label: string
  value: number
  hint?: string
  href?: string
  tone?: 'plain' | 'attention'
}) {
  const body = (
    <Card
      className={`gap-0 p-5 transition-colors ${href ? 'hover:border-foreground/20' : ''}`}
    >
      <div className="flex items-center gap-1.5">
        {tone === 'attention' && value > 0 && (
          <AlertTriangle className="h-3.5 w-3.5 shrink-0 text-amber-600 dark:text-amber-500" />
        )}
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          {label}
        </p>
      </div>
      <p className="mt-2 text-3xl font-semibold tabular-nums text-foreground">{value}</p>
      {hint && <p className="mt-1 text-xs text-muted-foreground">{hint}</p>}
    </Card>
  )

  return href ? (
    <Link href={href} className="block">
      {body}
    </Link>
  ) : (
    body
  )
}

