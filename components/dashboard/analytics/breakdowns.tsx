'use client'

import React from 'react'
import { BarRow, EmptyRow, Label, Panel, countryFlag } from './primitives'

export type Tally = { label: string; count: number }

/**
 * One ranked list. Capped at `limit` with a count of what is left, so a long
 * tail is acknowledged without turning the panel into a scroll.
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
  const shown = rows.slice(0, limit)
  const max = shown[0]?.count ?? 0
  const remaining = rows.length - shown.length

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
        {remaining > 0 && (
          <div className="pt-2 text-xs text-muted-foreground">
            + {remaining} more
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
export function CountryChips({ rows }: { rows: Tally[] }) {
  const shown = rows.slice(0, 12)
  const remaining = rows.length - shown.length

  return (
    <Panel>
      <Label>Visitors · 7d · by country</Label>
      {shown.length === 0 ? (
        <EmptyRow>No visits in the last seven days.</EmptyRow>
      ) : (
        <div className="mt-3 flex flex-wrap gap-2">
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
          {remaining > 0 && (
            <span className="inline-flex items-center px-1 text-sm text-muted-foreground">
              + {remaining} more
            </span>
          )}
        </div>
      )}
    </Panel>
  )
}
