import { describe, expect, it } from 'vitest'
import {
  MAX_RANGE_MONTHS,
  downloadRanges,
  isoDate,
  parseRepo,
} from '@/lib/sources'

describe('parseRepo', () => {
  const expected = { owner: 'sholajegede', repo: 'devrel-studio' }

  it('handles every shape people paste in', () => {
    const inputs = [
      'https://github.com/sholajegede/devrel-studio',
      'http://github.com/sholajegede/devrel-studio',
      'https://github.com/sholajegede/devrel-studio.git',
      'git+https://github.com/sholajegede/devrel-studio.git',
      'git@github.com:sholajegede/devrel-studio.git',
      'github.com/sholajegede/devrel-studio',
      'sholajegede/devrel-studio',
      '  https://github.com/sholajegede/devrel-studio  ',
    ]

    for (const input of inputs) {
      expect(parseRepo(input), input).toEqual(expected)
    }
  })

  it('ignores trailing paths like /tree/main', () => {
    expect(parseRepo('https://github.com/sholajegede/devrel-studio/tree/main')).toEqual(
      expected,
    )
  })

  it('accepts www.github.com', () => {
    expect(parseRepo('https://www.github.com/sholajegede/devrel-studio')).toEqual(
      expected,
    )
  })

  it('returns null for hosts that are not GitHub', () => {
    expect(parseRepo('https://gitlab.com/owner/repo')).toBeNull()
    expect(parseRepo('https://bitbucket.org/owner/repo')).toBeNull()
  })

  it('does not treat a lookalike domain as GitHub', () => {
    // `endsWith('github.com')` without a dot boundary would let these through
    // and send a request to the real GitHub API with someone else's path.
    expect(parseRepo('https://evilgithub.com/owner/repo')).toBeNull()
    expect(parseRepo('https://notgithub.com/owner/repo')).toBeNull()
  })

  it('returns null when owner or repo is missing', () => {
    expect(parseRepo('https://github.com/sholajegede')).toBeNull()
    expect(parseRepo('https://github.com/')).toBeNull()
    expect(parseRepo('')).toBeNull()
    expect(parseRepo('   ')).toBeNull()
  })
})

describe('downloadRanges', () => {
  const now = new Date('2026-08-16T12:00:00Z')

  it('returns a single range for a package younger than the cap', () => {
    const ranges = downloadRanges(new Date('2026-02-01'), now)
    expect(ranges).toHaveLength(1)
    expect(ranges[0]).toEqual({ from: '2026-02-01', to: '2026-08-16' })
  })

  it('splits a longer history into multiple ranges', () => {
    const ranges = downloadRanges(new Date('2019-01-01'), now)
    expect(ranges.length).toBeGreaterThan(1)
    expect(ranges[0].to).toBe('2026-08-16')
    expect(ranges[ranges.length - 1].from).toBe('2019-01-01')
  })

  it('never overlaps, which would double-count a day of downloads', () => {
    const ranges = downloadRanges(new Date('2016-03-05'), now)

    for (let i = 0; i < ranges.length - 1; i++) {
      const thisFrom = new Date(ranges[i].from)
      const nextTo = new Date(ranges[i + 1].to)
      const gapDays = (thisFrom.getTime() - nextTo.getTime()) / 86_400_000

      // Exactly one day: contiguous with no shared day at the boundary.
      expect(gapDays, `${ranges[i + 1].to} → ${ranges[i].from}`).toBe(1)
    }
  })

  it('keeps every range inside npm’s 18-month limit', () => {
    for (const range of downloadRanges(new Date('2015-01-01'), now)) {
      const months =
        (new Date(range.to).getTime() - new Date(range.from).getTime()) /
        (30.44 * 86_400_000)
      expect(months, `${range.from}:${range.to}`).toBeLessThanOrEqual(18)
    }
  })

  it('clamps to the npm epoch rather than walking back forever', () => {
    const ranges = downloadRanges(new Date('1998-01-01'), now)
    expect(ranges[ranges.length - 1].from).toBe('2015-01-10')
  })

  it('respects the chunk ceiling', () => {
    const ranges = downloadRanges(new Date('2015-01-10'), now, 3)
    expect(ranges).toHaveLength(3)
  })

  it('returns nothing when the package is newer than now', () => {
    expect(downloadRanges(new Date('2026-09-01'), now)).toEqual([])
  })

  it('walks back by the configured number of months', () => {
    const ranges = downloadRanges(new Date('2015-01-10'), now)
    const first = ranges[0]
    const expectedStart = new Date(now)
    expectedStart.setMonth(expectedStart.getMonth() - MAX_RANGE_MONTHS)
    expect(first.from).toBe(isoDate(expectedStart))
  })
})
