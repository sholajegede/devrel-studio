'use client'

import React, { useEffect, useState } from 'react'
import {
  Area,
  CartesianGrid,
  ComposedChart,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { ChevronDown, Monitor, Smartphone, Tablet } from 'lucide-react'
import { Card } from '@/components/ui/card'
import {
  EmptyRow,
  InfoHint,
  countryFlag,
  formatDuration,
  formatNumber,
  formatRelative,
} from './primitives'
import type { Tally } from './breakdowns'

// ── Section frame ─────────────────────────────────────────────────────────────

export function Section({
  title,
  note,
  children,
  className = '',
}: {
  title: string
  note?: string
  children: React.ReactNode
  className?: string
}) {
  return (
    <Card className={`gap-0 p-5 ${className}`}>
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <h2 className="text-base font-semibold text-foreground">{title}</h2>
        {note && <p className="text-xs text-muted-foreground">{note}</p>}
      </div>
      <div className="mt-4">{children}</div>
    </Card>
  )
}

// ── Headline metrics ──────────────────────────────────────────────────────────

export type Metric = { label: string; value: string; info?: React.ReactNode; accent?: boolean }

/** Eight numbers in one card, split by hairlines rather than eight boxes. */
export function MetricGrid({ metrics }: { metrics: Metric[] }) {
  return (
    <Card className="gap-0 overflow-hidden p-0">
      <div className="grid grid-cols-2 gap-px bg-border lg:grid-cols-4">
        {metrics.map((metric) => (
          <div key={metric.label} className="bg-card px-5 py-4">
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs text-muted-foreground">{metric.label}</span>
              {metric.info && <InfoHint>{metric.info}</InfoHint>}
            </div>
            <div
              className={`mt-1.5 text-2xl font-semibold leading-none tabular-nums ${
                metric.accent ? 'text-accent' : 'text-foreground'
              }`}
            >
              {metric.value}
            </div>
          </div>
        ))}
      </div>
    </Card>
  )
}

// ── Traffic ───────────────────────────────────────────────────────────────────

type Point = { date: string; views: number; visitors: number }

function pointDate(key: string): Date {
  // Hourly keys are 'YYYY-MM-DDTHH', which Date cannot parse on its own.
  return new Date(key.length === 13 ? `${key}:00:00Z` : `${key}T00:00:00Z`)
}

export function TrafficChart({ series, days }: { series: Point[]; days: number }) {
  const hourly = days <= 1
  const hasData = series.some((point) => point.views > 0)
  const max = Math.max(...series.map((point) => point.views), 1)

  return (
    <Section
      title="Traffic"
      note={hourly ? 'Last 24 hours, by hour' : `Last ${days} days, by day`}
    >
      <div className="mb-3 flex items-center gap-4 text-xs text-muted-foreground">
        <span className="flex items-center gap-1.5">
          <span className="h-0.5 w-3 rounded bg-accent" /> Page views
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-0.5 w-3 rounded bg-foreground/60" /> Visitors
        </span>
      </div>

      {!hasData ? (
        <EmptyRow>No views in this range yet.</EmptyRow>
      ) : (
        <div className="h-[260px] w-full sm:h-[300px]">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={series} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
              <defs>
                <pattern id="trafficHalftone" width="4" height="4" patternUnits="userSpaceOnUse">
                  <circle cx="1" cy="1" r="0.85" fill="var(--accent)" opacity="0.55" />
                </pattern>
              </defs>
              <CartesianGrid horizontal vertical={false} stroke="var(--border)" />
              <XAxis
                dataKey="date"
                tickLine={false}
                axisLine={false}
                tick={{ fill: 'var(--muted-foreground)', fontSize: 11 }}
                tickFormatter={(value: string) => {
                  const date = pointDate(value)
                  return hourly
                    ? `${String(date.getUTCHours()).padStart(2, '0')}:00`
                    : date.toLocaleDateString(undefined, {
                        day: 'numeric',
                        month: 'short',
                        timeZone: 'UTC',
                      })
                }}
                interval={Math.max(0, Math.ceil(series.length / 6) - 1)}
                minTickGap={12}
              />
              <YAxis
                width={40}
                allowDecimals={false}
                domain={[0, max]}
                tickLine={false}
                axisLine={false}
                tick={{ fill: 'var(--muted-foreground)', fontSize: 11 }}
              />
              <Tooltip
                cursor={{ stroke: 'var(--muted-foreground)', strokeDasharray: '3 3' }}
                content={<TrafficTooltip hourly={hourly} />}
              />
              <Area
                type="linear"
                dataKey="views"
                stroke="var(--accent)"
                strokeWidth={2}
                fill="url(#trafficHalftone)"
                isAnimationActive={false}
              />
              <Line
                type="linear"
                dataKey="visitors"
                stroke="var(--foreground)"
                strokeOpacity={0.6}
                strokeWidth={1.5}
                dot={false}
                isAnimationActive={false}
              />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      )}
    </Section>
  )
}

function TrafficTooltip({
  active,
  payload,
  hourly,
}: {
  active?: boolean
  payload?: { payload: Point }[]
  hourly: boolean
}) {
  if (!active || !payload?.length) return null
  const point = payload[0].payload
  const date = pointDate(point.date)
  const heading = hourly
    ? `${date.toLocaleDateString(undefined, { day: 'numeric', month: 'short', timeZone: 'UTC' })}, ${String(date.getUTCHours()).padStart(2, '0')}:00 UTC`
    : date.toLocaleDateString(undefined, {
        weekday: 'short',
        day: 'numeric',
        month: 'short',
        timeZone: 'UTC',
      })

  return (
    <div className="rounded-lg border bg-popover px-3 py-2 text-xs shadow-sm">
      <div className="font-medium text-popover-foreground">{heading}</div>
      <div className="mt-1 tabular-nums text-popover-foreground">
        {point.views.toLocaleString()} page views
      </div>
      <div className="tabular-nums text-muted-foreground">
        {point.visitors.toLocaleString()} visitors
      </div>
    </div>
  )
}

// ── Pages ─────────────────────────────────────────────────────────────────────

export type PageRow = {
  label: string
  views: number
  visitors: number
  avgDurationMs: number | null
}

export function PagesTable({ rows, className = '' }: { rows: PageRow[]; className?: string }) {
  const [expanded, setExpanded] = useState(false)
  const shown = expanded ? rows : rows.slice(0, 12)

  return (
    <Section
      title="Pages"
      note="Views, unique visitors and average time on page"
      className={className}
    >
      {rows.length === 0 ? (
        <EmptyRow>No pages opened in this range.</EmptyRow>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[420px] text-sm">
            <thead>
              <tr className="border-b text-left text-[11px] uppercase tracking-wide text-muted-foreground">
                <th className="py-2 pr-3 font-medium">Page</th>
                <th className="w-16 py-2 pr-3 text-right font-medium">Views</th>
                <th className="w-20 py-2 pr-3 text-right font-medium">Visitors</th>
                <th className="w-20 py-2 text-right font-medium">Avg. time</th>
              </tr>
            </thead>
            <tbody>
              {shown.map((row) => (
                <tr key={row.label} className="border-b last:border-b-0">
                  <td className="max-w-0 py-2.5 pr-3">
                    <span className="block truncate font-mono text-xs" title={row.label}>
                      {row.label}
                    </span>
                  </td>
                  <td className="py-2.5 pr-3 text-right tabular-nums">{row.views.toLocaleString()}</td>
                  <td className="py-2.5 pr-3 text-right tabular-nums">{row.visitors.toLocaleString()}</td>
                  <td className="py-2.5 text-right tabular-nums text-muted-foreground">
                    {formatDuration(row.avgDurationMs)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {rows.length > 12 && (
            <button
              type="button"
              onClick={() => setExpanded(!expanded)}
              className="mt-3 text-xs text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
            >
              {expanded ? 'Show fewer' : `+ ${rows.length - 12} more`}
            </button>
          )}
        </div>
      )}
    </Section>
  )
}

// ── Ranked lists ──────────────────────────────────────────────────────────────

/** A ranked list drawn as filled rows, the bar behind the label. */
export function RankedList({
  title,
  note,
  rows,
  empty,
  limit = 8,
  format,
  className = '',
}: {
  title: string
  note?: string
  rows: Tally[]
  empty: string
  limit?: number
  format?: (label: string) => React.ReactNode
  className?: string
}) {
  const [expanded, setExpanded] = useState(false)
  const shown = expanded ? rows : rows.slice(0, limit)
  const max = rows[0]?.count ?? 0

  return (
    <Section title={title} note={note} className={className}>
      {rows.length === 0 ? (
        <EmptyRow>{empty}</EmptyRow>
      ) : (
        <FilledRows rows={shown} max={max} format={format} />
      )}
      {rows.length > limit && (
        <button
          type="button"
          onClick={() => setExpanded(!expanded)}
          className="mt-3 text-xs text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
        >
          {expanded ? 'Show fewer' : `+ ${rows.length - limit} more`}
        </button>
      )}
    </Section>
  )
}

function FilledRows({
  rows,
  max,
  format,
}: {
  rows: Tally[]
  max: number
  format?: (label: string) => React.ReactNode
}) {
  return (
    <ul className="space-y-1.5">
      {rows.map((row) => {
        const pct = max > 0 ? Math.max(4, Math.round((row.count / max) * 100)) : 0
        return (
          <li key={row.label} className="relative overflow-hidden rounded-md">
            <div
              aria-hidden
              className="absolute inset-y-0 left-0 rounded-md bg-accent/15"
              style={{ width: `${pct}%` }}
            />
            <div className="relative flex items-center justify-between gap-3 px-2.5 py-1.5 text-sm">
              <span className="truncate" title={row.label}>
                {format ? format(row.label) : row.label}
              </span>
              <span className="shrink-0 tabular-nums text-foreground">
                {row.count.toLocaleString()}
              </span>
            </div>
          </li>
        )
      })}
    </ul>
  )
}

const REGION = typeof Intl !== 'undefined' && 'DisplayNames' in Intl
  ? new Intl.DisplayNames(undefined, { type: 'region' })
  : null

export function countryName(code: string): string {
  try {
    return REGION?.of(code) ?? code
  } catch {
    return code
  }
}

export function formatCountry(code: string): React.ReactNode {
  return (
    <>
      <span aria-hidden className="mr-2">{countryFlag(code)}</span>
      {countryName(code)}
    </>
  )
}

// ── Devices ───────────────────────────────────────────────────────────────────

const DEVICE_ICON = { mobile: Smartphone, tablet: Tablet, desktop: Monitor } as const
const DEVICE_NAME = { mobile: 'Mobile', tablet: 'Tablet', desktop: 'Desktop' } as const

export function DevicesPanel({
  devices,
  browsers,
  systems,
  className = '',
}: {
  devices: Tally[]
  browsers: Tally[]
  systems: Tally[]
  className?: string
}) {
  const empty = devices.length === 0 && browsers.length === 0 && systems.length === 0

  return (
    <Section title="Devices" className={className}>
      {empty ? (
        <EmptyRow>Recorded for visits from 29 Sep 2026 onward.</EmptyRow>
      ) : (
        <div className="space-y-3">
          <FilledRows
            rows={devices}
            max={devices[0]?.count ?? 0}
            format={(label) => {
              const key = label as keyof typeof DEVICE_ICON
              const Icon = DEVICE_ICON[key]
              return (
                <span className="inline-flex items-center gap-2">
                  {Icon && <Icon className="h-3.5 w-3.5 text-muted-foreground" />}
                  {DEVICE_NAME[key] ?? label}
                </span>
              )
            }}
          />
          <div className="border-t border-dashed" />
          <FilledRows rows={browsers.slice(0, 5)} max={browsers[0]?.count ?? 0} />
          <div className="border-t border-dashed" />
          <FilledRows rows={systems.slice(0, 5)} max={systems[0]?.count ?? 0} />
        </div>
      )}
    </Section>
  )
}

// ── Recent sessions ───────────────────────────────────────────────────────────

export type SessionRow = {
  id: string
  visitor: string
  manager: boolean
  country?: string
  city?: string
  device?: 'mobile' | 'tablet' | 'desktop'
  browser?: string
  os?: string
  referrer?: string
  campaign?: string
  startedAt: number
  lastAt: number
  durationMs: number | null
  steps: { label: string; at: number; durationMs?: number }[]
}

export function RecentSessions({
  rows,
  canLoadMore,
  onLoadMore,
}: {
  rows: SessionRow[]
  canLoadMore: boolean
  onLoadMore: () => void
}) {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 15_000)
    return () => clearInterval(timer)
  }, [])

  return (
    <Section title="Recent sessions" note="Each visit, step by step. Open a row to see the journey.">
      {rows.length === 0 ? (
        <EmptyRow>
          No visits yet. They appear here as soon as someone opens a client dashboard or your
          portfolio.
        </EmptyRow>
      ) : (
        <>
          <ul className="divide-y rounded-lg border">
            {rows.map((row) => (
              <SessionItem key={row.id} row={row} now={now} />
            ))}
          </ul>
          {canLoadMore && (
            <button
              type="button"
              onClick={onLoadMore}
              className="mt-3 text-xs text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
            >
              Load earlier sessions
            </button>
          )}
        </>
      )}
    </Section>
  )
}

function SessionItem({ row, now }: { row: SessionRow; now: number }) {
  const [open, setOpen] = useState(false)
  const place = [row.city, row.country ? countryName(row.country) : undefined]
    .filter(Boolean)
    .join(', ')
  const agent = [row.browser, row.os].filter(Boolean).join(' · ')
  const source = [row.referrer ?? 'Direct', row.campaign].filter(Boolean).join(' · ')
  const pages = row.steps.length

  return (
    <li>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        aria-expanded={open}
        className="flex w-full flex-wrap items-center gap-x-4 gap-y-1 px-3 py-2.5 text-left text-sm transition-colors hover:bg-muted/40"
      >
        <span aria-hidden className="text-base leading-none">{countryFlag(row.country)}</span>
        <span className="min-w-[9rem]">
          <span className="block font-medium text-foreground">
            {row.manager ? 'Manager' : `Visitor ${row.visitor}`}
          </span>
          <span className="block text-xs text-muted-foreground">{place || 'Unknown location'}</span>
        </span>
        {agent && <span className="hidden text-xs text-muted-foreground sm:inline">{agent}</span>}
        <span className="text-xs text-muted-foreground">{source}</span>
        <span className="ml-auto flex items-center gap-4 text-xs tabular-nums text-muted-foreground">
          <span>{pages} {pages === 1 ? 'page' : 'pages'}</span>
          <span className="w-14 text-right text-foreground">{formatDuration(row.durationMs)}</span>
          <span className="w-16 text-right">{formatRelative(row.lastAt, now)}</span>
          <ChevronDown className={`h-3.5 w-3.5 transition-transform ${open ? 'rotate-180' : ''}`} />
        </span>
      </button>
      {open && (
        <ol className="space-y-1.5 border-t bg-muted/20 px-3 py-3 pl-10">
          {row.steps.map((step, index) => (
            <li key={`${step.at}-${index}`} className="flex items-baseline gap-3 text-xs">
              <span className="w-12 shrink-0 tabular-nums text-muted-foreground">
                {new Date(step.at).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })}
              </span>
              <span className="truncate font-mono text-foreground" title={step.label}>
                {step.label}
              </span>
              <span className="ml-auto tabular-nums text-muted-foreground">
                {formatDuration(step.durationMs)}
              </span>
            </li>
          ))}
        </ol>
      )}
    </li>
  )
}

export { formatNumber }
