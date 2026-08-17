import { describe, expect, it } from 'vitest'
import {
  compareToPreviousMonth,
  formatDelta,
  latestMonth,
  monthKey,
  previousMonth,
  type PeriodSource,
} from '@/lib/metrics'

describe('monthKey', () => {
  it('extracts YYYY-MM', () => {
    expect(monthKey('2026-08-17')).toBe('2026-08')
    expect(monthKey('2026-01-01T12:00:00Z')).toBe('2026-01')
  })

  it('is null for missing or unparseable dates', () => {
    expect(monthKey(undefined)).toBeNull()
    expect(monthKey('')).toBeNull()
    expect(monthKey('last tuesday')).toBeNull()
  })
})

describe('previousMonth', () => {
  it('steps back one month', () => {
    expect(previousMonth('2026-08')).toBe('2026-07')
    expect(previousMonth('2026-10')).toBe('2026-09')
  })

  it('wraps across the year boundary', () => {
    expect(previousMonth('2026-01')).toBe('2025-12')
  })

  it('keeps the two-digit month padding', () => {
    // '2026-9' would never match a key produced by monthKey.
    expect(previousMonth('2026-10')).toBe('2026-09')
    expect(previousMonth('2026-02')).toBe('2026-01')
  })
})

describe('compareToPreviousMonth', () => {
  const entries: PeriodSource[] = [
    // July: 2 published, 100 views
    { category: 'Written', status: 'Published', views: 60, publicationDate: '2026-07-04' },
    { category: 'Written', status: 'Published', views: 40, publicationDate: '2026-07-20' },
    // August: 3 published, 300 views
    { category: 'Written', status: 'Published', views: 150, publicationDate: '2026-08-01' },
    { category: 'Written', status: 'Published', views: 150, publicationDate: '2026-08-09' },
    { category: 'Event', status: 'Published', attendees: 40, publicationDate: '2026-08-12' },
    // A draft in August. Its view count must not reach the comparison — this
    // number is shown to clients, and unpublished work has not performed.
    { category: 'Written', status: 'Draft', views: 999, publicationDate: '2026-08-15' },
  ]

  it('compares the month against the one before', () => {
    const d = compareToPreviousMonth(entries, '2026-08')
    expect(d.views.current).toBe(300)
    expect(d.views.previous).toBe(100)
    expect(d.views.percent).toBe(200)
    expect(d.views.direction).toBe('up')
  })

  it('counts published separately from drafts', () => {
    const d = compareToPreviousMonth(entries, '2026-08')
    expect(d.published.current).toBe(3)
    expect(d.published.previous).toBe(2)
  })

  it('excludes unpublished work from the metrics, not just the count', () => {
    const d = compareToPreviousMonth(entries, '2026-08')
    // The August draft carries 999 views; 300 is the published total alone.
    expect(d.views.current).toBe(300)
  })

  it('keeps each metric in its own category', () => {
    const d = compareToPreviousMonth(entries, '2026-08')
    expect(d.attendees.current).toBe(40)
    expect(d.attendees.previous).toBe(0)
  })

  it('reports a drop as down', () => {
    const d = compareToPreviousMonth(entries, '2026-07')
    // Nothing in June, so July is growth from zero.
    expect(d.views.previous).toBe(0)
    expect(d.views.percent).toBeNull()
  })

  it('has no percentage when the previous period was zero', () => {
    // 5 from 0 is "5, from nothing" — not 500% growth.
    const d = compareToPreviousMonth(
      [{ category: 'Written', status: 'Published', views: 5, publicationDate: '2026-08-01' }],
      '2026-08',
    )
    expect(d.views.percent).toBeNull()
    expect(d.views.direction).toBe('up')
  })

  it('reports flat when nothing moved', () => {
    const flat: PeriodSource[] = [
      { category: 'Written', status: 'Published', views: 50, publicationDate: '2026-07-01' },
      { category: 'Written', status: 'Published', views: 50, publicationDate: '2026-08-01' },
    ]
    const d = compareToPreviousMonth(flat, '2026-08')
    expect(d.views.direction).toBe('flat')
    expect(d.views.percent).toBe(0)
  })

  it('is all zeroes for a month with nothing in it', () => {
    const d = compareToPreviousMonth(entries, '2026-12')
    expect(d.views.current).toBe(0)
    expect(d.published.current).toBe(0)
  })
})

describe('latestMonth', () => {
  it('finds the most recent month present', () => {
    expect(
      latestMonth([
        { publicationDate: '2026-03-01' },
        { publicationDate: '2026-11-30' },
        { publicationDate: '2026-07-15' },
      ]),
    ).toBe('2026-11')
  })

  it('sorts by value, not by insertion order', () => {
    expect(
      latestMonth([{ publicationDate: '2025-12-31' }, { publicationDate: '2026-01-01' }]),
    ).toBe('2026-01')
  })

  it('is null when there is nothing dated', () => {
    expect(latestMonth([])).toBeNull()
    expect(latestMonth([{ publicationDate: undefined }])).toBeNull()
  })
})

describe('formatDelta', () => {
  it('signs the percentage', () => {
    expect(formatDelta({ current: 3, previous: 2, percent: 50, direction: 'up' })).toBe('+50%')
    expect(formatDelta({ current: 1, previous: 2, percent: -50, direction: 'down' })).toBe('-50%')
  })

  it('says "new" for growth from nothing, and dash for nothing at all', () => {
    expect(formatDelta({ current: 5, previous: 0, percent: null, direction: 'up' })).toBe('new')
    expect(formatDelta({ current: 0, previous: 0, percent: null, direction: 'flat' })).toBe('—')
  })

  it('spells out no change rather than showing +0%', () => {
    expect(formatDelta({ current: 4, previous: 4, percent: 0, direction: 'flat' })).toBe(
      'no change',
    )
  })
})
