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
