import { describe, expect, it } from 'vitest'
import {
  MAX_ACCESS_MONTHS,
  REQUEST_STATUSES,
  checkMonths,
  extendAccessWindow,
} from '@/convex/model/access'

// Local-time constructors throughout. `extendAccessWindow` uses `setMonth`,
// which is local-time arithmetic, so building the fixtures in UTC would make
// these assertions pass or fail depending on where the machine is.
const at = (y: number, m: number, d: number) => new Date(y, m, d, 12, 0, 0).getTime()
const parts = (ms: number) => {
  const date = new Date(ms)
  return [date.getFullYear(), date.getMonth(), date.getDate()] as const
}

describe('extendAccessWindow', () => {
  it('opens a new window from today when there is no access', () => {
    const now = at(2026, 7, 26) // 26 Aug 2026
    const window = extendAccessWindow(undefined, 3, now)

    expect(window.extended).toBe(false)
    expect(window.from).toBe(now)
    expect(parts(window.until)).toEqual([2026, 10, 26]) // 26 Nov
  })

  // The reason renewing early is safe. Extending from today instead would make
  // the day after being locked out the cheapest moment to renew.
  it('adds to the time left rather than replacing it', () => {
    const now = at(2026, 7, 26)
    const until = at(2026, 9, 1) // 1 Oct, still in the future
    const window = extendAccessWindow(until, 6, now)

    expect(window.extended).toBe(true)
    expect(window.from).toBe(until)
    expect(parts(window.until)).toEqual([2027, 3, 1]) // 1 Apr 2027
  })

  it('ignores an expired window', () => {
    const now = at(2026, 7, 26)
    const window = extendAccessWindow(at(2026, 0, 1), 1, now)

    expect(window.extended).toBe(false)
    expect(window.from).toBe(now)
    expect(parts(window.until)).toEqual([2026, 8, 26]) // 26 Sep
  })

  it('treats an expiry of exactly now as expired', () => {
    const now = at(2026, 7, 26)
    expect(extendAccessWindow(now, 1, now).extended).toBe(false)
  })

  // Calendar months, not 30-day blocks: someone who buys a month on the 31st
  // does not silently lose a day. `setMonth` rolls short months forward rather
  // than clamping, so 31 January plus one month is 3 March. That favours the
  // buyer, which is the right direction for the error to go — pinned here so it
  // stays a decision rather than an accident somebody "fixes".
  it('rolls a short month forward rather than clamping', () => {
    const window = extendAccessWindow(undefined, 1, at(2026, 0, 31))
    expect(parts(window.until)).toEqual([2026, 2, 3]) // 3 Mar, not 28 Feb
  })

  it('crosses a year boundary', () => {
    const window = extendAccessWindow(undefined, 12, at(2026, 11, 15))
    expect(parts(window.until)).toEqual([2027, 11, 15])
  })

  it('never returns an expiry in the past', () => {
    const now = at(2026, 7, 26)
    for (const months of [1, 2, 3, 6, 12, MAX_ACCESS_MONTHS]) {
      expect(extendAccessWindow(undefined, months, now).until).toBeGreaterThan(now)
    }
  })
})

describe('checkMonths', () => {
  it('accepts an ordinary term', () => {
    expect(checkMonths(1)).toBeNull()
    expect(checkMonths(12)).toBeNull()
    expect(checkMonths(MAX_ACCESS_MONTHS)).toBeNull()
  })

  // The guard is against a slipped decimal, not against a business rule: 360
  // instead of 36 grants thirty years and nothing downstream would question it.
  it('refuses a term nobody meant to type', () => {
    expect(checkMonths(MAX_ACCESS_MONTHS + 1)).toMatch(/60 or fewer/)
    expect(checkMonths(0)).toMatch(/at least 1/)
    expect(checkMonths(-3)).toMatch(/at least 1/)
    expect(checkMonths(1.5)).toMatch(/whole number/)
  })
})

describe('request statuses', () => {
  it('lists exactly the statuses the code produces', () => {
    expect([...REQUEST_STATUSES].sort()).toEqual([
      'cancelled',
      'declined',
      'granted',
      'open',
    ])
  })
})
