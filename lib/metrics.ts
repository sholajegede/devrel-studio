import { Category, CATEGORIES } from './types'

// ── Metrics ───────────────────────────────────────────────────────────────────
//
// Single source of truth for "which number belongs to which category" and for
// rolling entries up into totals. Everything that shows a metric — both
// dashboards, the PDF report, the CSV export — reads from here, so adding a
// category means editing this file and `category-meta.tsx`, not eight others.
//
// This module is deliberately free of React and lucide imports so the PDF
// renderer can use it without pulling UI code into the server bundle.

export type MetricKey = 'views' | 'downloads' | 'attendees' | 'stars'

/** Entries written before categories existed are treated as Written. */
export const DEFAULT_CATEGORY: Category = 'Written'

export const CATEGORY_METRIC: Record<Category, { key: MetricKey; label: string }> = {
  Written: { key: 'views',     label: 'Views' },
  Video:   { key: 'views',     label: 'Views' },
  Event:   { key: 'attendees', label: 'Attendees' },
  Podcast: { key: 'downloads', label: 'Listeners' },
  Package: { key: 'downloads', label: 'Downloads' },
  Demo:    { key: 'stars',     label: 'Stars' },
}

/** Hex colours for the PDF report, which cannot use Tailwind classes. */
export const CATEGORY_PDF_COLOR: Record<Category, string> = {
  Written: '#1d4ed8',
  Video:   '#dc2626',
  Event:   '#7c3aed',
  Podcast: '#ea580c',
  Package: '#059669',
  Demo:    '#0f766e',
}

/**
 * The minimum shape needed to compute metrics. Both `ContentEntry` and the
 * PDF's `ReportContentItem` satisfy it, which is why aggregation can be shared.
 */
export interface MetricSource {
  category?: string
  views?: number
  downloads?: number
  attendees?: number
  stars?: number
  status?: string
  reshares?: unknown[]
}

/** Normalise a possibly-missing / unknown category to a known one. */
export function categoryOf(entry: { category?: string }): Category {
  const cat = entry.category
  return cat && (CATEGORIES as readonly string[]).includes(cat)
    ? (cat as Category)
    : DEFAULT_CATEGORY
}

export function getMetricLabel(category?: Category): string {
  return CATEGORY_METRIC[category ?? DEFAULT_CATEGORY].label
}

/** The headline number for an entry, based on its category. */
export function getMetricValue(entry: MetricSource): number {
  const { key } = CATEGORY_METRIC[categoryOf(entry)]
  return entry[key] ?? 0
}

export interface Totals {
  count: number
  published: number
  inProgress: number
  views: number
  downloads: number
  attendees: number
  stars: number
  reshares: number
}

function emptyTotals(): Totals {
  return {
    count: 0, published: 0, inProgress: 0,
    views: 0, downloads: 0, attendees: 0, stars: 0, reshares: 0,
  }
}

/**
 * Roll a set of entries up into totals.
 *
 * Each entry contributes only to the metric its category owns — an Event's
 * `views` field is ignored, a Package's `attendees` is ignored — which is what
 * keeps "Total views" from silently mixing in numbers from other categories.
 */
export function aggregate(entries: readonly MetricSource[]): Totals {
  const totals = emptyTotals()

  for (const entry of entries) {
    totals.count++
    if (entry.status === 'Published') totals.published++
    else totals.inProgress++

    const { key } = CATEGORY_METRIC[categoryOf(entry)]
    totals[key] += entry[key] ?? 0

    totals.reshares += entry.reshares?.length ?? 0
  }

  return totals
}

/** Same roll-up, split per category — powers breakdown sections. */
export function aggregateByCategory(
  entries: readonly MetricSource[],
): Record<Category, Totals> {
  const result = {} as Record<Category, Totals>
  for (const category of CATEGORIES) result[category] = emptyTotals()

  for (const entry of entries) {
    const category = categoryOf(entry)
    const totals = result[category]

    totals.count++
    if (entry.status === 'Published') totals.published++
    else totals.inProgress++

    const { key } = CATEGORY_METRIC[category]
    totals[key] += entry[key] ?? 0
    totals.reshares += entry.reshares?.length ?? 0
  }

  return result
}

export function formatCompact(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000)     return `${(n / 1_000).toFixed(1)}K`
  return n.toLocaleString()
}

// ── Period comparison ─────────────────────────────────────────────────────────
//
// "412 views" is a number. "412 views, up 38% on last month" is an argument.
// The second is what gets a retainer renewed, so the dashboards show both.

export interface PeriodSource extends MetricSource {
  publicationDate?: string
}

export interface Delta {
  current: number
  previous: number
  /** Percentage change, or null when the previous period was zero. */
  percent: number | null
  direction: 'up' | 'down' | 'flat'
}

/** `YYYY-MM` for a date string, or null if it is unparseable. */
export function monthKey(iso?: string): string | null {
  if (!iso) return null
  const match = /^(\d{4})-(\d{2})/.exec(iso.trim())
  return match ? `${match[1]}-${match[2]}` : null
}

/** The `YYYY-MM` immediately before the one given. */
export function previousMonth(key: string): string {
  const [y, m] = key.split('-').map(Number)
  return m === 1
    ? `${y - 1}-12`
    : `${y}-${String(m - 1).padStart(2, '0')}`
}

function change(current: number, previous: number): Delta {
  // Growth from zero has no meaningful percentage — 5 from 0 is not "500%
  // up", it is "5, from nothing". Callers render the raw numbers in that case.
  const percent = previous === 0 ? null : Math.round(((current - previous) / previous) * 100)

  return {
    current,
    previous,
    percent,
    direction: current > previous ? 'up' : current < previous ? 'down' : 'flat',
  }
}

/**
 * Compare one month against the month before it.
 *
 * Entries are bucketed by publication date, so this answers "how much did we
 * publish, and how did it perform, in each period" — not "how did a single
 * piece's numbers move", which would need historic metric snapshots the schema
 * does not keep.
 *
 * Only Published entries contribute. This differs from `aggregate`, which sums
 * every entry it is given: a draft carrying a view count would otherwise inflate
 * the period it was written in, and this number goes in front of a client.
 */
export function compareToPreviousMonth(
  entries: readonly PeriodSource[],
  month: string,
): { published: Delta; views: Delta; downloads: Delta; attendees: Delta; stars: Delta } {
  const prev = previousMonth(month)

  const inMonth = (key: string) =>
    entries.filter(
      (entry) => monthKey(entry.publicationDate) === key && entry.status === 'Published',
    )

  const currentTotals = aggregate(inMonth(month))
  const previousTotals = aggregate(inMonth(prev))

  return {
    published: change(currentTotals.published, previousTotals.published),
    views: change(currentTotals.views, previousTotals.views),
    downloads: change(currentTotals.downloads, previousTotals.downloads),
    attendees: change(currentTotals.attendees, previousTotals.attendees),
    stars: change(currentTotals.stars, previousTotals.stars),
  }
}

/** The most recent month that has any entries, or null for an empty set. */
export function latestMonth(entries: readonly PeriodSource[]): string | null {
  const keys = entries
    .map((entry) => monthKey(entry.publicationDate))
    .filter((key): key is string => key !== null)

  return keys.length ? keys.sort().at(-1)! : null
}

/** `+38%`, `-12%`, `—`. */
export function formatDelta(delta: Delta): string {
  if (delta.percent === null) return delta.current > 0 ? 'new' : '—'
  if (delta.percent === 0) return 'no change'
  return `${delta.percent > 0 ? '+' : ''}${delta.percent}%`
}
