'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useQuery } from 'convex/react'
import { api } from '@/convex/_generated/api'
import { actionLabel, formatAuditTime } from '@/lib/admin-audit'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'

// ── The audit reader ──────────────────────────────────────────────────────────
//
// The log has been written since phase one and until now the only way to read it
// was the raw Convex table view. A trail nobody can read is a trail nobody
// checks, which makes it decoration.
//
// Reading is support-level for the same reason: the argument for keeping a
// record is that somebody can look at it, and a log only one person may open
// gets opened once a year.
//
// Paged by timestamp rather than by Convex's opaque cursor: the filter chips
// change the query, and a cursor belonging to the previous one would silently
// skip everything newer that matches. A plain `at` is readable, and it stays
// meaningful when the query beside it changes.

export default function AdminAuditPage() {
  const [action, setAction] = useState<string | null>(null)
  const [before, setBefore] = useState<number | undefined>(undefined)

  const actions = useQuery(api.adminWorkspaces.auditActions)
  const page = useQuery(api.adminWorkspaces.listAudit, {
    action: action ?? undefined,
    before,
    limit: 50,
  })

  const loading = page === undefined

  function filterBy(next: string | null) {
    setAction(next)
    // A cursor from the unfiltered list means nothing in a filtered one — it
    // would silently skip everything newer that matches.
    setBefore(undefined)
  }

  return (
    <>
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-foreground">Audit</h1>
        <p className="text-sm text-muted-foreground">
          Every privileged action, appended and never edited.
        </p>
      </div>

      <div className="mb-4 flex flex-wrap gap-1">
        <Button
          type="button"
          size="sm"
          variant={action === null ? 'secondary' : 'ghost'}
          onClick={() => filterBy(null)}
          aria-pressed={action === null}
          className="h-8 px-3 text-xs"
        >
          Everything
        </Button>
        {(actions ?? []).map((entry) => (
          <Button
            key={entry.action}
            type="button"
            size="sm"
            variant={action === entry.action ? 'secondary' : 'ghost'}
            onClick={() => filterBy(entry.action)}
            aria-pressed={action === entry.action}
            className="h-8 px-3 text-xs"
          >
            {actionLabel(entry.action)}
            <span className="ml-1.5 text-muted-foreground">{entry.count}</span>
          </Button>
        ))}
      </div>

      {loading ? (
        <Card className="gap-0 p-5">
          <div className="space-y-3">
            {Array.from({ length: 5 }).map((_, index) => (
              <div key={index} className="h-4 w-full animate-pulse rounded bg-muted" />
            ))}
          </div>
        </Card>
      ) : page.rows.length === 0 ? (
        <Card className="gap-0 p-10 text-center">
          <p className="text-sm text-muted-foreground">
            {before
              ? 'Nothing older than this.'
              : action
                ? 'Nothing of that kind has been recorded.'
                : 'The log is empty. Anything done through the console lands here.'}
          </p>
          {before && (
            <button
              type="button"
              onClick={() => setBefore(undefined)}
              className="mt-4 text-sm text-muted-foreground underline underline-offset-4 hover:text-foreground"
            >
              Back to the newest
            </button>
          )}
        </Card>
      ) : (
        <Card className="gap-0 p-5">
          <ul className="space-y-3">
            {page.rows.map((row) => (
              <li
                key={row.id}
                className="border-b border-border pb-3 text-sm last:border-0 last:pb-0"
              >
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <span className="text-foreground">
                    <span className="font-medium">{actionLabel(row.action)}</span>
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
                    {!row.subjectEmail && row.subjectId && (
                      // Not every subject is an account. A lifted lockout is
                      // recorded against the dashboard slug, which has no email.
                      <> — {row.subjectId}</>
                    )}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {row.actorEmail} · {formatAuditTime(row.at)}
                  </span>
                </div>

                {row.reason && (
                  <p className="mt-1 text-sm text-muted-foreground">{row.reason}</p>
                )}

                {(row.before || row.after) && (
                  <p className="mt-1 font-mono text-xs text-muted-foreground">
                    {row.before && <span>{row.before}</span>}
                    {row.before && row.after && <span className="mx-1.5">→</span>}
                    {row.after && <span>{row.after}</span>}
                  </p>
                )}
              </li>
            ))}
          </ul>

          {page.nextBefore !== null && (
            <div className="mt-4 flex justify-center">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setBefore(page.nextBefore!)}
              >
                Older
              </Button>
            </div>
          )}
        </Card>
      )}
    </>
  )
}
