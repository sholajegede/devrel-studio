'use client'

import React, { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Label, Panel, countryFlag, formatDuration, formatRelative } from './primitives'

/**
 * Rows shown before the list is collapsed.
 *
 * The feed is the most interesting panel here, but at forty rows it is taller
 * than everything else on the page combined and pushes the breakdowns off the
 * bottom entirely. Twelve is about a screen — enough to see the shape of recent
 * attention — with the rest one click away.
 */
const COLLAPSED_ROWS = 12

export type ActivityRow = {
  id: string
  // 'site' rows are the platform's own traffic and never reach a DevRel's
  // analytics — their queries are scoped to a workspace and these belong to
  // none. Widened to match the schema rather than cast at the boundary.
  surface: 'dashboard' | 'portfolio' | 'site'
  target: string
  path: string
  identity: 'manager' | 'anonymous'
  country?: string
  referrer?: string
  durationMs?: number
  at: number
  clientName?: string
}

/**
 * Who read what, newest first.
 *
 * This is the panel the section exists for. The reference design puts a live
 * visitor globe here, which works at three hundred thousand views and says "0
 * people on the site right now" at three hundred — so the layout is kept and
 * the content is inverted: instead of aggregate presence, every row is one real
 * visit. At low volume a specific event carries far more than a total, and this
 * list gets *better* as it gets shorter, because each line is a person.
 */
export function AttentionLog({
  rows,
  liveCount,
  liveCountries,
  onLoadMore,
  canLoadMore = false,
}: {
  rows: ActivityRow[]
  liveCount: number
  liveCountries: string[]
  /** Fetch further back. Absent when the caller has everything already. */
  onLoadMore?: () => void
  canLoadMore?: boolean
}) {
  // Relative timestamps have to be recomputed on a timer or "26s ago" stays
  // "26s ago" until something else re-renders the tree.
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 15_000)
    return () => clearInterval(timer)
  }, [])

  const [expanded, setExpanded] = useState(false)
  const visible = expanded ? rows : rows.slice(0, COLLAPSED_ROWS)
  const hidden = rows.length - visible.length

  return (
    <Panel>
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <Label>Who has been reading your work</Label>
        <span className="text-xs text-muted-foreground">
          Country-level only, nobody is identifiable
        </span>
      </div>

      {/* Live counter. Honest about zero rather than hiding: "nobody right now"
          is information, and a panel that only ever appears when busy makes the
          quiet state feel like a bug. */}
      <div className="mt-4 flex items-center gap-2.5">
        <span
          className={`inline-block h-2 w-2 rounded-full ${
            liveCount > 0 ? 'bg-accent animate-pulse' : 'bg-muted-foreground/40'
          }`}
        />
        <span
          className={`text-xl leading-none font-semibold tabular-nums ${
            liveCount > 0 ? 'text-accent' : 'text-muted-foreground'
          }`}
        >
          {liveCount}
        </span>
        <span className="text-sm text-muted-foreground">
          {liveCount === 1 ? 'person reading right now' : 'people reading right now'}
          {liveCountries.length > 0 &&
            ` · from ${liveCountries.length} ${
              liveCountries.length === 1 ? 'country' : 'countries'
            }`}
        </span>
      </div>

      <div className="mt-4 border-t">
        {rows.length === 0 ? (
          <div className="py-8 text-sm leading-relaxed text-muted-foreground">
            No views recorded yet.
            <br />
            Views appear here as soon as someone opens a client dashboard or your
            public portfolio.
          </div>
        ) : (
          <>
            <ul className="divide-y">
              {visible.map((row) => (
                <LogRow key={row.id} row={row} now={now} />
              ))}
            </ul>
            {(hidden > 0 || expanded) && (
              <div className="flex flex-wrap gap-2 pt-3">
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 px-2 text-xs text-muted-foreground"
                  onClick={() => setExpanded((open) => !open)}
                >
                  {expanded ? 'Show less' : `Show ${hidden} more`}
                </Button>

                {/* Expanding shows what has been fetched; this fetches further
                    back. Without it the list ends wherever the first page
                    happened to stop, which on a busy dashboard is a few days —
                    and nothing on screen says the history continues. */}
                {expanded && canLoadMore && onLoadMore && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 px-2 text-xs text-muted-foreground"
                    onClick={onLoadMore}
                  >
                    Load earlier
                  </Button>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </Panel>
  )
}

function LogRow({ row, now }: { row: ActivityRow; now: number }) {
  return (
    <li className="flex flex-wrap items-baseline gap-x-2 gap-y-1 py-2.5 text-sm">
      <span aria-hidden className="text-base leading-none">
        {countryFlag(row.country)}
      </span>

      <span className="text-foreground">{describeVisitor(row)}</span>
      <span className="text-muted-foreground">{describeAction(row)}</span>

      {row.durationMs ? (
        <span
          className="font-medium tabular-nums text-accent"
          title="Time spent on the page"
        >
          {formatDuration(row.durationMs)}
        </span>
      ) : null}

      {row.referrer ? (
        <span className="text-xs text-muted-foreground">via {row.referrer}</span>
      ) : null}

      <span className="ml-auto text-xs tabular-nums text-muted-foreground">
        {formatRelative(row.at, now)}
      </span>
    </li>
  )
}

/**
 * What can honestly be said about who this was.
 *
 * A manager held an access code issued for one specific client, so naming that
 * client is a claim the data supports. Everyone else is described by country
 * and nothing else — a public page cannot know who is reading it, and the copy
 * must not imply otherwise.
 */
function describeVisitor(row: ActivityRow): string {
  if (row.identity === 'manager') {
    return row.clientName ? `${row.clientName}'s manager` : 'A manager'
  }
  return 'Someone'
}

function describeAction(row: ActivityRow): string {
  if (row.surface === 'portfolio') {
    const where = row.path && row.path !== '/' ? row.path : 'your portfolio'
    return `viewed ${where}`
  }

  // Paths on a client dashboard are few and known, so they can be named in
  // words rather than shown as a URL.
  //
  // The archive is tested first: '/reports' also starts with '/report', so the
  // other order labelled every visit to the index as reading a report.
  if (row.path.startsWith('/reports')) return 'browsed past reports'
  if (row.path.startsWith('/report')) return 'read the report'
  return `opened the ${row.clientName ?? row.target} dashboard`
}
