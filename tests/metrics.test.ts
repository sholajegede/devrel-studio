import { describe, expect, it } from 'vitest'
import {
  aggregate,
  aggregateByCategory,
  categoryOf,
  formatCompact,
  getMetricValue,
  type MetricSource,
} from '@/lib/metrics'

describe('categoryOf', () => {
  it('passes through known categories', () => {
    expect(categoryOf({ category: 'Package' })).toBe('Package')
    expect(categoryOf({ category: 'Event' })).toBe('Event')
  })

  it('falls back for missing or unknown values', () => {
    // Entries predate the category field, and the schema stores it as an
    // optional — so this has to cope with both absent and junk values.
    expect(categoryOf({})).toBe('Written')
    expect(categoryOf({ category: 'Nonsense' })).toBe('Written')
    expect(categoryOf({ category: '' })).toBe('Written')
  })
})

describe('getMetricValue', () => {
  it('reads the metric belonging to the entry’s category', () => {
    expect(getMetricValue({ category: 'Written', views: 120 })).toBe(120)
    expect(getMetricValue({ category: 'Package', downloads: 900 })).toBe(900)
    expect(getMetricValue({ category: 'Event', attendees: 40 })).toBe(40)
    expect(getMetricValue({ category: 'Demo', stars: 12 })).toBe(12)
  })

  it('is 0 when the owning metric is absent', () => {
    expect(getMetricValue({ category: 'Package', views: 5000 })).toBe(0)
  })
})

describe('aggregate', () => {
  const entries: MetricSource[] = [
    { category: 'Written', status: 'Published', views: 100, reshares: [1, 2] },
    { category: 'Written', status: 'Draft', views: 50 },
    { category: 'Package', status: 'Published', downloads: 900 },
    { category: 'Event', status: 'Published', attendees: 40 },
    { category: 'Demo', status: 'Scheduled', stars: 12 },
  ]

  it('counts everything, splitting published from in progress', () => {
    const totals = aggregate(entries)
    expect(totals.count).toBe(5)
    expect(totals.published).toBe(3)
    expect(totals.inProgress).toBe(2)
    expect(totals.published + totals.inProgress).toBe(totals.count)
  })

  it('sums each metric', () => {
    const totals = aggregate(entries)
    expect(totals.views).toBe(150)
    expect(totals.downloads).toBe(900)
    expect(totals.attendees).toBe(40)
    expect(totals.stars).toBe(12)
    expect(totals.reshares).toBe(2)
  })

  it('never mixes a metric across categories', () => {
    // The whole point of the category→metric mapping: an Event with a stray
    // `views` value must not inflate the headline view count.
    const totals = aggregate([
      { category: 'Event', status: 'Published', attendees: 10, views: 99_999 },
      { category: 'Package', status: 'Published', downloads: 5, attendees: 88 },
    ])
    expect(totals.views).toBe(0)
    expect(totals.attendees).toBe(10)
    expect(totals.downloads).toBe(5)
  })

  it('treats an unknown category as Written', () => {
    const totals = aggregate([
      { category: 'Nonsense', status: 'Published', views: 7 },
    ])
    expect(totals.views).toBe(7)
  })

  it('returns zeroes for an empty list', () => {
    const totals = aggregate([])
    expect(totals).toEqual({
      count: 0, published: 0, inProgress: 0,
      views: 0, downloads: 0, attendees: 0, stars: 0, reshares: 0,
    })
  })

  it('counts any non-Published status as in progress', () => {
    const totals = aggregate([
      { status: 'Draft' },
      { status: 'Waiting Approval' },
      { status: 'Scheduled' },
      {},
    ])
    expect(totals.inProgress).toBe(4)
    expect(totals.published).toBe(0)
  })

  it('does not mutate its input', () => {
    const input: MetricSource[] = [{ category: 'Written', views: 10 }]
    const snapshot = structuredClone(input)
    aggregate(input)
    expect(input).toEqual(snapshot)
  })
})

describe('aggregateByCategory', () => {
  it('splits totals per category, and the parts sum to the whole', () => {
    const entries: MetricSource[] = [
      { category: 'Written', status: 'Published', views: 100 },
      { category: 'Written', status: 'Draft', views: 50 },
      { category: 'Package', status: 'Published', downloads: 900 },
    ]

    const byCategory = aggregateByCategory(entries)
    const totals = aggregate(entries)

    expect(byCategory.Written.count).toBe(2)
    expect(byCategory.Written.views).toBe(150)
    expect(byCategory.Package.downloads).toBe(900)
    expect(byCategory.Video.count).toBe(0)

    const summed = Object.values(byCategory).reduce((sum, t) => sum + t.count, 0)
    expect(summed).toBe(totals.count)
  })

  it('includes every category even when empty', () => {
    const byCategory = aggregateByCategory([])
    for (const key of ['Written', 'Video', 'Event', 'Podcast', 'Package', 'Demo']) {
      expect(byCategory[key as keyof typeof byCategory].count).toBe(0)
    }
  })
})

describe('formatCompact', () => {
  it('abbreviates thousands and millions', () => {
    expect(formatCompact(999)).toBe('999')
    expect(formatCompact(1_500_000)).toBe('1.5M')
  })

  it('handles zero', () => {
    expect(formatCompact(0)).toBe('0')
  })
})
