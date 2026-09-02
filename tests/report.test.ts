import { describe, expect, it } from 'vitest'
import {
  buildReport,
  parsePeriod,
  periodLabel,
  reachTrend,
  targetProgress,
  type ReportEntry,
} from '@/lib/report'

const entry = (over: Partial<ReportEntry>): ReportEntry => ({
  title: 'Untitled',
  platform: 'Dev.to',
  publicationDate: '2026-07-10',
  status: 'Published',
  category: 'Written',
  ...over,
})

describe('parsePeriod', () => {
  it('accepts YYYY-MM directly', () => {
    expect(parsePeriod('2026-07')).toBe('2026-07')
    expect(parsePeriod('  2026-07  ')).toBe('2026-07')
  })

  it('accepts a separate month and year', () => {
    expect(parsePeriod('7', '2026')).toBe('2026-07')
    expect(parsePeriod('12', '2026')).toBe('2026-12')
  })

  it('pads a single-digit month so it matches a monthKey', () => {
    expect(parsePeriod('3', '2026')).toBe('2026-03')
  })

  it('returns null rather than guessing at nonsense', () => {
    expect(parsePeriod(null, null)).toBeNull()
    expect(parsePeriod('last july')).toBeNull()
    expect(parsePeriod('13', '2026')).toBeNull()
    expect(parsePeriod('0', '2026')).toBeNull()
    expect(parsePeriod('7', '12')).toBeNull()
  })
})

describe('periodLabel', () => {
  it('spells the month out', () => {
    expect(periodLabel('2026-07')).toBe('July 2026')
    expect(periodLabel('2026-01')).toBe('January 2026')
    expect(periodLabel('2026-12')).toBe('December 2026')
  })
})

describe('buildReport', () => {
  const entries: ReportEntry[] = [
    // June — the comparison period
    entry({ publicationDate: '2026-06-05', views: 1000 }),
    entry({ publicationDate: '2026-06-20', views: 500 }),
    // July — the report period
    entry({ publicationDate: '2026-07-02', views: 4000, reshares: [{ platform: 'LinkedIn', link: '', date: '' }] }),
    entry({ publicationDate: '2026-07-18', views: 2000 }),
    entry({ category: 'Event', publicationDate: '2026-07-22', attendees: 300, platform: 'Conference' }),
    entry({ category: 'Package', publicationDate: '2026-07-25', downloads: 900, platform: 'npm' }),
    // July but not shipped
    entry({ publicationDate: '2026-07-28', status: 'Draft', views: 9999 }),
    // August, scheduled
    entry({ publicationDate: '2026-08-04', status: 'Scheduled' }),
  ]

  const report = buildReport(entries, '2026-07')

  it('counts only work published in the period', () => {
    expect(report.published).toHaveLength(4)
    expect(report.totals.published).toBe(4)
  })

  it('excludes unpublished work from the metrics', () => {
    // The July draft carries 9,999 views and must not reach the client.
    expect(report.totals.views).toBe(6000)
  })

  it('compares against the month before', () => {
    expect(report.previous.views).toBe(1500)
    expect(report.previousReach).toBe(1500)
  })

  it('sums reach across views, attendees and downloads', () => {
    expect(report.reach).toBe(6000 + 300 + 900)
  })

  it('leaves stars out of reach', () => {
    // A star is an endorsement from someone already there, not a person
    // reached — folding it in would inflate the headline number.
    const withStars = buildReport(
      [...entries, entry({ category: 'Demo', publicationDate: '2026-07-09', stars: 5000, platform: 'GitHub' })],
      '2026-07',
    )
    expect(withStars.reach).toBe(6000 + 300 + 900)
    expect(withStars.totals.stars).toBe(5000)
  })

  it('lists categories that appeared, and only those', () => {
    const names = report.byCategory.map((row) => row.category)
    expect(names).toContain('Written')
    expect(names).toContain('Event')
    expect(names).toContain('Package')
    expect(names).not.toContain('Podcast')
  })

  it('carries unshipped and future work into upcoming', () => {
    const dates = report.upcoming.map((e) => e.publicationDate)
    expect(dates).toContain('2026-07-28') // draft inside the period
    expect(dates).toContain('2026-08-04') // scheduled after it
  })

  it('orders published work newest first', () => {
    const dates = report.published.map((e) => e.publicationDate)
    expect(dates).toEqual([...dates].sort().reverse())
  })

  it('counts reshares', () => {
    expect(report.reshareCount).toBe(1)
  })

  it('ranks platforms by how often they were used', () => {
    expect(report.platforms[0].count).toBeGreaterThanOrEqual(
      report.platforms[report.platforms.length - 1].count,
    )
  })

  it('produces an empty but valid report for a period with nothing in it', () => {
    const empty = buildReport(entries, '2026-01')
    expect(empty.published).toHaveLength(0)
    expect(empty.reach).toBe(0)
    expect(empty.byCategory).toEqual([])
    expect(empty.label).toBe('January 2026')
  })
})

describe('reachTrend', () => {
  const entries: ReportEntry[] = [
    entry({ publicationDate: '2026-05-01', views: 100 }),
    entry({ publicationDate: '2026-07-01', views: 700 }),
  ]

  it('returns the requested number of months, oldest first', () => {
    const trend = reachTrend(entries, '2026-07', 4)
    expect(trend).toHaveLength(4)
    expect(trend.map((t) => t.period)).toEqual(['2026-04', '2026-05', '2026-06', '2026-07'])
  })

  it('keeps empty months as zero rather than dropping them', () => {
    // A gap is information. Closing it implies output that did not happen.
    const trend = reachTrend(entries, '2026-07', 4)
    expect(trend.find((t) => t.period === '2026-06')?.reach).toBe(0)
    expect(trend.find((t) => t.period === '2026-05')?.reach).toBe(100)
  })

  it('walks back across a year boundary', () => {
    const trend = reachTrend([], '2026-01', 3)
    expect(trend.map((t) => t.period)).toEqual(['2025-11', '2025-12', '2026-01'])
  })
})

describe('highlights', () => {
  it('ranks by the metric each category owns, not by whichever number is largest', () => {
    // A written post is judged on views and an event on attendees. Taking the
    // largest of the four would let a stray star outrank a real readership.
    const report = buildReport(
      [
        entry({ title: 'Post', category: 'Written', views: 500, stars: 90_000 }),
        entry({ title: 'Talk', category: 'Event', attendees: 900, views: 10 }),
      ],
      '2026-07',
    )

    expect(report.highlights.map((h) => h.entry.title)).toEqual(['Talk', 'Post'])
    expect(report.highlights[0].metric).toBe(900)
    expect(report.highlights[1].metric).toBe(500)
  })

  it('takes at most three', () => {
    const report = buildReport(
      Array.from({ length: 8 }, (_, i) =>
        entry({ title: `Post ${i}`, category: 'Written', views: i + 1 }),
      ),
      '2026-07',
    )

    expect(report.highlights).toHaveLength(3)
    expect(report.highlights.map((h) => h.metric)).toEqual([8, 7, 6])
  })

  it('leaves out pieces with no recorded figure rather than tying them at zero', () => {
    const report = buildReport(
      [
        entry({ title: 'Measured', category: 'Written', views: 40 }),
        entry({ title: 'Not measured yet', category: 'Written' }),
      ],
      '2026-07',
    )

    expect(report.highlights).toHaveLength(1)
    expect(report.highlights[0].entry.title).toBe('Measured')
  })

  it('is empty when the period recorded nothing at all', () => {
    const report = buildReport([entry({ category: 'Written' })], '2026-07')
    expect(report.highlights).toEqual([])
  })

  it('only considers published work', () => {
    const report = buildReport(
      [
        entry({ title: 'Draft', category: 'Written', views: 9000, status: 'Draft' }),
        entry({ title: 'Live', category: 'Written', views: 12 }),
      ],
      '2026-07',
    )

    expect(report.highlights.map((h) => h.entry.title)).toEqual(['Live'])
  })
})

describe('targetProgress', () => {
  it('reports the percentage reached and whether the goal was met', () => {
    expect(targetProgress(20_000, 40_000)).toEqual({
      target: 40_000,
      actual: 20_000,
      percent: 50,
      met: false,
    })
    expect(targetProgress(40_000, 40_000)?.met).toBe(true)
    expect(targetProgress(60_000, 40_000)).toMatchObject({ percent: 150, met: true })
  })

  it('returns null when there is no goal, so an absent goal renders as absent', () => {
    // Treating a missing target as zero would render every report as having
    // triumphantly exceeded a goal nobody set.
    expect(targetProgress(500, undefined)).toBeNull()
    expect(targetProgress(500, null)).toBeNull()
    expect(targetProgress(500, 0)).toBeNull()
    expect(targetProgress(500, -10)).toBeNull()
    expect(targetProgress(500, Number.NaN)).toBeNull()
  })

  it('reports zero progress rather than failing when nothing was achieved', () => {
    expect(targetProgress(0, 40_000)).toMatchObject({ percent: 0, met: false })
  })
})
