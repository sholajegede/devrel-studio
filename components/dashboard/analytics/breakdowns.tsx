'use client'

import React from 'react'
import { BarRow, EmptyRow, Label, Panel, countryFlag } from './primitives'

export type Tally = { label: string; count: number }

/**
 * "+ 4 more", but you can press it.
 *
 * It used to be a line of muted text. Everything about it — the position under a
 * truncated list, the wording, the count — said "control", so people clicked it
 * and nothing happened. A label that describes an action has to perform one or
 * stop claiming to.
 */
function ShowRest({
  hidden,
  expanded,
  onToggle,
  className = '',
}: {
  hidden: number
  expanded: boolean
  onToggle: () => void
  className?: string
}) {
  if (hidden <= 0 && !expanded) return null

  return (
    <button
      type="button"
      onClick={onToggle}
      aria-expanded={expanded}
      className={`rounded-md text-xs text-muted-foreground underline-offset-4 transition-colors hover:text-foreground hover:underline ${className}`}
    >
      {expanded ? 'Show fewer' : `+ ${hidden} more`}
    </button>
  )
}

/**
 * One ranked list. Capped at `limit` with the rest one press away, so a long
 * tail is reachable without the panel opening as a scroll.
 */
export function BreakdownList({
  title,
  rows,
  empty,
  limit = 8,
  format,
}: {
  title: string
  rows: Tally[]
  empty: string
  limit?: number
  format?: (label: string) => string
}) {
  const [expanded, setExpanded] = React.useState(false)

  const shown = expanded ? rows : rows.slice(0, limit)
  // Scaled against the largest value in the whole list rather than the visible
  // slice, so the bars do not resize when the rest are revealed.
  const max = rows[0]?.count ?? 0
  const hidden = rows.length - Math.min(rows.length, limit)

  return (
    <Panel>
      <Label>{title}</Label>
      <div className="mt-3">
        {shown.length === 0 ? (
          <EmptyRow>{empty}</EmptyRow>
        ) : (
          shown.map((row) => (
            <BarRow
              key={row.label}
              label={format ? format(row.label) : row.label}
              hint={row.label}
              value={row.count}
              max={max}
            />
          ))
        )}
        {hidden > 0 && (
          <div className="pt-2">
            <ShowRest
              hidden={hidden}
              expanded={expanded}
              onToggle={() => setExpanded(!expanded)}
            />
          </div>
        )}
      </div>
    </Panel>
  )
}

/**
 * Countries as chips rather than bars.
 *
 * A country list is usually long and shallow — a lot of ones and twos — which
 * makes a ranked bar chart mostly empty space. Chips fit far more of the tail
 * in the same area, and the flag carries the identification so the code beside
 * it can stay small.
 */
export function CountryChips({ rows, days = 7 }: { rows: Tally[]; days?: number }) {
  const [expanded, setExpanded] = React.useState(false)

  const shown = expanded ? rows : rows.slice(0, 12)
  const hidden = rows.length - Math.min(rows.length, 12)

  return (
    <Panel>
      <Label>Visitors · {days}d · by country</Label>
      {rows.length === 0 ? (
        <EmptyRow>No visits in the last {days} days.</EmptyRow>
      ) : (
        <div className="mt-3 flex flex-wrap items-center gap-2">
          {shown.map((row) => (
            <span
              key={row.label}
              className="inline-flex items-center gap-2 rounded-md border px-2.5 py-1.5 text-sm"
            >
              <span aria-hidden>{countryFlag(row.label)}</span>
              <span>{row.label}</span>
              <span className="tabular-nums text-muted-foreground">
                {row.count.toLocaleString()}
              </span>
            </span>
          ))}
          {hidden > 0 && (
            <ShowRest
              hidden={hidden}
              expanded={expanded}
              onToggle={() => setExpanded(!expanded)}
              className="px-1"
            />
          )}
        </div>
      )}
    </Panel>
  )
}
