'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useQuery } from 'convex/react'
import { api } from '@/convex/_generated/api'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import {
  BarRow,
  EmptyRow,
  Label,
  Panel,
  StatTile,
  formatNumber,
  formatRelative,
} from '@/components/dashboard/analytics/primitives'
import { ExternalLink } from 'lucide-react'

// ── What everybody is putting into the product ────────────────────────────────
//
// Visible one workspace at a time since the beginning, and never in aggregate —
// which is the shape that says what the product is actually being used for.
// Whether people log talks or blog posts, whether entries sit in Draft for
// months, and whether anything at all happened this week are all questions the
// console could not previously ask.
//
// It is not a reading tool. The title and the link are here because they are
// what makes an entry identifiable when somebody writes in about one; nobody
// needs an admin browsing customers' work, and the counts beside them are the
// point.

const CATEGORIES = ['Written', 'Video', 'Event', 'Podcast', 'Package', 'Demo'] as const
const STATUSES = ['Published', 'Draft', 'Waiting Approval', 'Scheduled'] as const

type Category = (typeof CATEGORIES)[number]
type Status = (typeof STATUSES)[number]

export default function AdminContentPage() {
  const [category, setCategory] = useState<Category | null>(null)
  const [status, setStatus] = useState<Status | null>(null)

  const shape = useQuery(api.adminInsights.contentShape)
  const page = useQuery(api.adminInsights.content, {
    category: category ?? undefined,
    status: status ?? undefined,
    limit: 60,
  })

  return (
    <>
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-foreground">Content</h1>
        <p className="text-sm text-muted-foreground">
          Every entry logged across every workspace. Counts, not reading — what is in
          them belongs to the customer.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <StatTile
          label="Entries"
          value={shape === undefined ? '—' : formatNumber(shape.total)}
          caption="Across the whole platform"
        />
        <StatTile
          label="This week"
          value={shape === undefined ? '—' : formatNumber(shape.lastWeek)}
          caption="Logged in the last 7 days"
          accent
        />
        <StatTile
          label="This month"
          value={shape === undefined ? '—' : formatNumber(shape.lastMonth)}
          caption="Logged in the last 30 days"
        />
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-3">
        <Panel>
          <Label>By category</Label>
          {/* Over the whole table, not over the page below. A distribution taken
              from the newest sixty rows is a distribution of this week, which is
              exactly the number somebody would read as the shape of everything. */}
          <div className="mt-4 space-y-2.5">
            {shape === undefined || shape.categories.length === 0 ? (
              <EmptyRow>Nothing logged yet.</EmptyRow>
            ) : (
              shape.categories.map((row) => (
                <BarRow
                  key={row.key}
                  label={row.key}
                  value={row.count}
                  max={shape.categories[0].count}
                />
              ))
            )}
          </div>
        </Panel>

        <Panel>
          <Label>By platform</Label>
          <div className="mt-4 space-y-2.5">
            {shape === undefined || shape.platforms.length === 0 ? (
              <EmptyRow>Nothing logged yet.</EmptyRow>
            ) : (
              shape.platforms
                .slice(0, 8)
                .map((row) => (
                  <BarRow
                    key={row.key}
                    label={row.key}
                    value={row.count}
                    max={shape.platforms[0].count}
                  />
                ))
            )}
          </div>
        </Panel>

        <Panel>
          <Label>By status</Label>
          <div className="mt-4 space-y-2.5">
            {shape === undefined || shape.statuses.length === 0 ? (
              <EmptyRow>Nothing logged yet.</EmptyRow>
            ) : (
              shape.statuses.map((row) => (
                <BarRow
                  key={row.key}
                  label={row.key}
                  value={row.count}
                  max={shape.statuses[0].count}
                />
              ))
            )}
          </div>
        </Panel>
      </div>

      <div className="mt-6 mb-3 flex flex-wrap items-center gap-1">
        <Button
          type="button"
          size="sm"
          variant={!category && !status ? 'secondary' : 'ghost'}
          onClick={() => {
            setCategory(null)
            setStatus(null)
          }}
          className="h-8 px-3 text-xs"
        >
          Everything
        </Button>
        {CATEGORIES.map((value) => (
          <Button
            key={value}
            type="button"
            size="sm"
            variant={category === value ? 'secondary' : 'ghost'}
            onClick={() => {
              setCategory(category === value ? null : value)
              setStatus(null)
            }}
            aria-pressed={category === value}
            className="h-8 px-3 text-xs"
          >
            {value}
          </Button>
        ))}
        <span className="mx-1 h-4 w-px bg-border" aria-hidden />
        {STATUSES.map((value) => (
          <Button
            key={value}
            type="button"
            size="sm"
            variant={status === value ? 'secondary' : 'ghost'}
            onClick={() => {
              setStatus(status === value ? null : value)
              setCategory(null)
            }}
            aria-pressed={status === value}
            className="h-8 px-3 text-xs"
          >
            {value}
          </Button>
        ))}
      </div>

      {page === undefined ? (
        <Card className="gap-0 p-5">
          <div className="space-y-3">
            {Array.from({ length: 6 }).map((_, index) => (
              <div key={index} className="h-4 w-full animate-pulse rounded bg-muted" />
            ))}
          </div>
        </Card>
      ) : page.entries.length === 0 ? (
        <Card className="gap-0 p-10 text-center">
          <p className="text-sm text-muted-foreground">
            {category || status
              ? 'Nothing matches that filter.'
              : 'Nothing has been logged yet.'}
          </p>
        </Card>
      ) : (
        <Card className="gap-0 p-5">
          <ul className="space-y-2.5">
            {page.entries.map((entry) => (
              <li
                key={entry.id}
                className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 border-b border-border pb-2.5 text-sm last:border-0 last:pb-0"
              >
                <span className="min-w-0 flex-1">
                  <span className="text-foreground">{entry.title}</span>
                  {entry.url && (
                    <a
                      href={entry.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="ml-1.5 inline-block align-middle text-muted-foreground transition-colors hover:text-foreground"
                      aria-label="Open the entry"
                    >
                      <ExternalLink className="h-3 w-3" />
                    </a>
                  )}
                  <span className="block truncate text-xs text-muted-foreground">
                    {entry.category ?? 'uncategorised'}
                    {entry.platform && ` · ${entry.platform}`}
                    {entry.client && ` · ${entry.client}`}
                  </span>
                </span>

                <span className="flex shrink-0 items-center gap-3 text-xs text-muted-foreground">
                  {entry.workspaceId ? (
                    <Link
                      href={`/admin/workspaces/${entry.workspaceId}`}
                      className="underline-offset-4 hover:text-foreground hover:underline"
                    >
                      {entry.workspace}
                    </Link>
                  ) : (
                    // Rows created before workspaces existed carry no id. They
                    // still belong to somebody; there is simply nowhere to link.
                    <span>no workspace</span>
                  )}
                  <span className="tabular-nums">{formatRelative(entry.at)}</span>
                </span>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </>
  )
}
