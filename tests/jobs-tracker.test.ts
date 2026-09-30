import { describe, expect, it } from 'vitest'
import { median, trackerStats } from '@/lib/jobs/tracker'

const DAY = 24 * 60 * 60 * 1000
const NOW = Date.parse('2026-09-30T12:00:00Z')

const row = (stage: string, history: [string, number][], extra: object = {}) => ({
  stage,
  history: history.map(([s, daysAgo]) => ({ stage: s, at: NOW - daysAgo * DAY })),
  updatedAt: NOW - (history.at(-1)?.[1] ?? 0) * DAY,
  ...extra,
})

describe('trackerStats', () => {
  const rows = [
    row('saved', [['saved', 3]]),
    row('applied', [['saved', 20], ['applied', 15]]),
    row('interview', [['applied', 30], ['screening', 25], ['interview', 10]]),
    row('rejected', [['applied', 40], ['rejected', 30]]),
    row('offer', [['applied', 50], ['interview', 40], ['offer', 5]]),
  ]

  it('counts the funnel', () => {
    const stats = trackerStats(rows, NOW)
    expect(stats.total).toBe(5)
    expect(stats.applied).toBe(4)
    expect(stats.responded).toBe(3)
    expect(stats.interviews).toBe(2)
    expect(stats.offers).toBe(1)
    expect(stats.responseRate).toBeCloseTo(0.75)
  })

  it('finds the median time to a first response', () => {
    expect(trackerStats(rows, NOW).medianDaysToResponse).toBe(10)
  })

  it('flags applications that have gone quiet', () => {
    const stats = trackerStats(rows, NOW)
    expect(stats.needsFollowUp).toHaveLength(1)
    expect(stats.needsFollowUp[0].stage).toBe('applied')
  })

  it('lists next steps due this week', () => {
    const soon = row('interview', [['applied', 5]], { nextStepAt: NOW + 2 * DAY })
    const later = row('interview', [['applied', 5]], { nextStepAt: NOW + 20 * DAY })
    expect(trackerStats([soon, later], NOW).upcoming).toHaveLength(1)
  })

  it('handles an empty tracker', () => {
    const stats = trackerStats([], NOW)
    expect(stats.responseRate).toBeNull()
    expect(stats.medianDaysToResponse).toBeNull()
  })
})

describe('median', () => {
  it('averages the middle pair', () => {
    expect(median([1, 2, 3, 4])).toBe(3)
    expect(median([5])).toBe(5)
    expect(median([])).toBeNull()
  })
})
