import {
  aggregate,
  categoryOf,
  getMetricValue,
  monthKey,
  previousMonth,
  type PeriodSource,
  type Totals,
} from './metrics'
import { CATEGORIES, type Category } from './types'

// ── Monthly report shaping ────────────────────────────────────────────────────
//
// Turns a client's whole content history into the specific numbers one month's
// report needs. Kept free of React so the page and the PDF build from the same
// function — a printed report that disagrees with the page it was printed from
// is worse than no report at all.

export interface ReportEntry extends PeriodSource {
  id?: string
  title: string
  platform: string
  contentType?: string
  link?: string
  publicationDate: string
  eventName?: string
  eventLocation?: string
  podcastName?: string
  packageName?: string
  repoUrl?: string
  stack?: string
  tags?: string[]
  reshares?: { platform: string; link: string; date: string }[]
}

/** `2026-07` → `July 2026`. */
export function periodLabel(period: string): string {
  const [year, month] = period.split('-').map(Number)
  const names = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December',
  ]
  return `${names[month - 1] ?? '—'} ${year}`
}

/**
 * Accepts `?month=2026-07`, or `?month=7&year=2026`.
 *
 * Two shapes because a link in an email should be readable, and because
 * somebody will eventually construct one by hand. Returns null rather than
 * guessing when neither parses — the caller falls back to the latest period,
 * which is a better default than a silently wrong month.
 */
export function parsePeriod(
  month?: string | null,
  year?: string | null,
): string | null {
  if (month && /^\d{4}-\d{2}$/.test(month.trim())) return month.trim()

  const m = Number(month)
  const y = Number(year)
  if (Number.isInteger(m) && m >= 1 && m <= 12 && Number.isInteger(y) && y > 1970) {
    return `${y}-${String(m).padStart(2, '0')}`
  }

  return null
}

export interface Highlight {
  entry: ReportEntry
  /** The one number this piece is judged on — views, attendees, downloads or stars. */
  metric: number
}

export interface TargetProgress {
  target: number
  actual: number
  /** Rounded percentage of the target reached. 0 when the target is 0. */
  percent: number
  met: boolean
}

export interface ReportSummary {
  period: string
  label: string
  totals: Totals
  previous: Totals
  /** Entries published in this period, newest first. */
  published: ReportEntry[]
  /** Work that carries into the next period. */
  upcoming: ReportEntry[]
  byCategory: { category: Category; count: number; metric: number; label: string }[]
  /** Reach = every metric that represents a person reached, summed. */
  reach: number
  previousReach: number
  reshareCount: number
  platforms: { platform: string; count: number }[]
  /**
   * The best-performing pieces, largest first.
   *
   * `published` is ordered by date, so its first row is whatever happened to
   * ship last — which is rarely what mattered. A reader who gets no further
   * than the first screen should still have seen the work worth seeing.
   */
  highlights: Highlight[]
}

/**
 * Progress against a goal.
 *
 * Returns null when there is no target, and every caller renders nothing in
 * that case — an absent goal should look absent, not like a goal of zero that
 * was triumphantly exceeded.
 */
export function targetProgress(
  actual: number,
  target: number | undefined | null,
): TargetProgress | null {
  if (typeof target !== 'number' || !Number.isFinite(target) || target <= 0) {
    return null
  }

  return {
    target,
    actual,
    percent: Math.round((actual / target) * 100),
    met: actual >= target,
  }
}

/**
 * The single number a piece is judged on.
 *
 * Deferred to `getMetricValue` so a category is only ever ranked on the metric
 * it owns — a written post is judged on views, an event on attendees. Taking
 * the largest of the four would let a stray star count outrank a real
 * readership, and would disagree with the number the PDF already prints.
 */
function headlineMetric(entry: ReportEntry): number {
  return getMetricValue(entry)
}

/**
 * Reach is views plus attendees plus downloads.
 *
 * Deliberately excludes stars: a GitHub star is an endorsement from someone who
 * had already arrived, not a person reached, and folding it in would inflate the
 * one number a client is most likely to quote back.
 */
function reachOf(totals: Totals): number {
  return totals.views + totals.attendees + totals.downloads
}

export function buildReport(
  entries: readonly ReportEntry[],
  period: string,
): ReportSummary {
  const inPeriod = (key: string, onlyPublished: boolean) =>
    entries.filter(
      (entry) =>
        monthKey(entry.publicationDate) === key &&
        (!onlyPublished || entry.status === 'Published'),
    )

  const published = inPeriod(period, true).sort((a, b) =>
    b.publicationDate.localeCompare(a.publicationDate),
  )

  const totals = aggregate(published)
  const previous = aggregate(inPeriod(previousMonth(period), true))

  // Anything in the period that has not shipped, plus everything dated after it.
  const upcoming = entries
    .filter((entry) => {
      const key = monthKey(entry.publicationDate)
      if (!key) return false
      if (entry.status === 'Published') return false
      return key >= period
    })
    .sort((a, b) => a.publicationDate.localeCompare(b.publicationDate))

  const byCategory = CATEGORIES.map((category) => {
    const rows = published.filter((entry) => categoryOf(entry) === category)
    const totalsForCategory = aggregate(rows)
    const metric =
      totalsForCategory.views +
      totalsForCategory.attendees +
      totalsForCategory.downloads +
      totalsForCategory.stars

    return {
      category: category as Category,
      count: rows.length,
      metric,
      label: category as string,
    }
  }).filter((row) => row.count > 0)

  const platformCounts = new Map<string, number>()
  for (const entry of published) {
    if (!entry.platform) continue
    platformCounts.set(entry.platform, (platformCounts.get(entry.platform) ?? 0) + 1)
  }

  // Only pieces that actually recorded a number can be ranked. A period whose
  // figures have not been collected yet gets no highlights rather than three
  // arbitrary rows tied at zero.
  const highlights = published
    .map((entry) => ({ entry, metric: headlineMetric(entry) }))
    .filter((row) => row.metric > 0)
    .sort((a, b) => b.metric - a.metric)
    .slice(0, 3)

  return {
    period,
    label: periodLabel(period),
    totals,
    previous,
    published,
    upcoming,
    byCategory,
    reach: reachOf(totals),
    previousReach: reachOf(previous),
    reshareCount: totals.reshares,
    platforms: [...platformCounts.entries()]
      .map(([platform, count]) => ({ platform, count }))
      .sort((a, b) => b.count - a.count),
    highlights,
  }
}

/**
 * Reach for each of the last `count` months, oldest first — the series behind
 * the trend chart.
 *
 * Months with nothing published are included as zero rather than skipped. A gap
 * is information: a chart that quietly closes it implies steady output that did
 * not happen.
 */
export function reachTrend(
  entries: readonly ReportEntry[],
  period: string,
  count = 6,
): { period: string; label: string; reach: number; published: number }[] {
  const series: { period: string; label: string; reach: number; published: number }[] = []

  let cursor = period
  for (let i = 0; i < count; i++) {
    const rows = entries.filter(
      (entry) =>
        monthKey(entry.publicationDate) === cursor && entry.status === 'Published',
    )
    const totals = aggregate(rows)

    series.unshift({
      period: cursor,
      label: periodLabel(cursor).replace(/ \d{4}$/, '').slice(0, 3),
      reach: reachOf(totals),
      published: totals.published,
    })

    cursor = previousMonth(cursor)
  }

  return series
}
