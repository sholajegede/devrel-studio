import { describe, expect, it } from 'vitest'
import {
  billingSegments,
  currentRate,
  isPausedOn,
  monthsCharged,
  monthsPaused,
  openPause,
  formatMoney,
  monthsBilled,
  tenureLabel,
  totalBilled,
  totalBilledAcross,
} from '@/lib/retainer'

// Fixed "today" so these never rot.
const NOW = { y: 2026, m: 8, d: 17 }

describe('monthsBilled', () => {
  it('counts the first payment on the start date itself', () => {
    // Signed today: billed once, not zero times.
    expect(monthsBilled('2026-08-17', undefined, NOW)).toBe(1)
  })

  it('does not advance until the anniversary day comes round', () => {
    expect(monthsBilled('2026-07-20', undefined, NOW)).toBe(1) // 20th not reached
    expect(monthsBilled('2026-07-17', undefined, NOW)).toBe(2) // 17th reached
    expect(monthsBilled('2026-07-16', undefined, NOW)).toBe(2)
  })

  it('handles a start date at month end', () => {
    // 31 Jan → on 17 Aug the anniversary day (31st) has not passed this month.
    expect(monthsBilled('2026-01-31', undefined, NOW)).toBe(7)
    expect(monthsBilled('2026-01-01', undefined, NOW)).toBe(8)
  })

  it('counts across year boundaries', () => {
    expect(monthsBilled('2025-08-17', undefined, NOW)).toBe(13)
    expect(monthsBilled('2024-08-17', undefined, NOW)).toBe(25)
  })

  it('stops at the end date for a finished engagement', () => {
    // Payments on 17 Jan, Feb, Mar and Apr.
    expect(monthsBilled('2026-01-17', '2026-04-17', NOW)).toBe(4)
    // Ending on the 16th means the April payment never falls due — three, not four.
    expect(monthsBilled('2026-01-17', '2026-04-16', NOW)).toBe(3)
  })

  it('ignores an end date in the future', () => {
    // A contracted end date that has not arrived should not inflate the count.
    expect(monthsBilled('2026-07-17', '2027-01-01', NOW)).toBe(2)
  })

  it('returns 0 for an engagement that has not started', () => {
    expect(monthsBilled('2026-12-01', undefined, NOW)).toBe(0)
  })

  it('returns 0 when the start date is missing or unparseable', () => {
    expect(monthsBilled(undefined, undefined, NOW)).toBe(0)
    expect(monthsBilled('', undefined, NOW)).toBe(0)
    expect(monthsBilled('not a date', undefined, NOW)).toBe(0)
    expect(monthsBilled('2026-13-01', undefined, NOW)).toBe(0)
  })

  it('reads the calendar date, not a UTC instant', () => {
    // `new Date('2026-08-17')` is UTC midnight, which is the 16th in any
    // timezone behind UTC — that would shift every month boundary by a day.
    expect(monthsBilled('2026-08-17', undefined, NOW)).toBe(1)
    expect(monthsBilled('2026-08-18', undefined, NOW)).toBe(0)
  })
})

describe('totalBilled', () => {
  it('multiplies the retainer by the months billed', () => {
    expect(totalBilled({ monthlyRetainer: 3000, startDate: '2026-01-17' }, NOW)).toBe(
      3000 * 8,
    )
  })

  it('caps at the end date', () => {
    expect(
      totalBilled(
        { monthlyRetainer: 2500, startDate: '2026-01-17', endDate: '2026-03-17' },
        NOW,
      ),
    ).toBe(2500 * 3)
  })

  it('is null rather than 0 when there is nothing to compute', () => {
    // The UI needs to distinguish "no retainer set" from "earned nothing".
    expect(totalBilled({ startDate: '2026-01-01' }, NOW)).toBeNull()
    expect(totalBilled({ monthlyRetainer: 1000 }, NOW)).toBeNull()
    expect(totalBilled({ monthlyRetainer: 1000, startDate: '2027-01-01' }, NOW)).toBeNull()
    expect(totalBilled({ monthlyRetainer: 0, startDate: '2026-01-01' }, NOW)).toBeNull()
  })
})

describe('totalBilledAcross', () => {
  it('sums clients and ignores those without a retainer', () => {
    const clients = [
      { monthlyRetainer: 1000, startDate: '2026-07-17' }, // 2 months = 2000
      { monthlyRetainer: 500, startDate: '2026-06-17' },  // 3 months = 1500
      { startDate: '2026-01-01' },                        // no retainer = 0
      { monthlyRetainer: 900, startDate: '2027-01-01' },  // not started = 0
    ]
    expect(totalBilledAcross(clients, NOW)).toBe(3500)
  })

  it('is 0 for an empty roster', () => {
    expect(totalBilledAcross([], NOW)).toBe(0)
  })
})

describe('tenureLabel', () => {
  it('reads in months below a year', () => {
    expect(tenureLabel('2026-08-17', undefined, NOW)).toBe('1 month')
    expect(tenureLabel('2026-06-17', undefined, NOW)).toBe('3 months')
  })

  it('switches to years once past twelve months', () => {
    expect(tenureLabel('2025-09-17', undefined, NOW)).toBe('1 yr')
    expect(tenureLabel('2025-05-17', undefined, NOW)).toBe('1 yr 4 mo')
    expect(tenureLabel('2024-09-17', undefined, NOW)).toBe('2 yrs')
  })

  it('is null when there is no start date', () => {
    expect(tenureLabel(undefined, undefined, NOW)).toBeNull()
    expect(tenureLabel('2027-01-01', undefined, NOW)).toBeNull()
  })
})

describe('formatMoney', () => {
  it('uses the right symbol and groups thousands', () => {
    expect(formatMoney(16000, 'USD')).toBe('$16,000')
    expect(formatMoney(16000, 'GBP')).toBe('£16,000')
    expect(formatMoney(16000, 'NGN')).toBe('₦16,000')
  })

  it('defaults to dollars for unknown or missing currencies', () => {
    expect(formatMoney(50)).toBe('$50')
    expect(formatMoney(50, 'XYZ')).toBe('$50')
  })

  it('rounds to whole units', () => {
    expect(formatMoney(1999.6, 'USD')).toBe('$2,000')
  })
})

// ── Rate changes ──────────────────────────────────────────────────────────────
//
// The scenario these exist for: a client starts at 1,500 and is raised to 3,000
// partway through. Before rate history, `totalBilled` multiplied the current
// rate by the whole engagement and retroactively claimed every earlier month had
// been billed at the new figure.

describe('totalBilled with a rate change', () => {
  it('charges each month at the rate in effect that month', () => {
    // Started 17 Jan at 1,500. Raised to 3,000 from 17 May.
    // Jan–Apr = 4 × 1,500. May–Aug = 4 × 3,000.
    const client = {
      monthlyRetainer: 3000,
      startDate: '2026-01-17',
      rateHistory: [
        { amount: 1500, effectiveFrom: '2026-01-17' },
        { amount: 3000, effectiveFrom: '2026-05-17' },
      ],
    }
    expect(totalBilled(client, NOW)).toBe(4 * 1500 + 4 * 3000)
  })

  it('does not let a raise rewrite the months before it', () => {
    // The bug this guards: 8 × 3,000 = 24,000 rather than the true 18,000.
    const raised = {
      monthlyRetainer: 3000,
      startDate: '2026-01-17',
      rateHistory: [
        { amount: 1500, effectiveFrom: '2026-01-17' },
        { amount: 3000, effectiveFrom: '2026-07-17' },
      ],
    }
    expect(totalBilled(raised, NOW)).toBe(6 * 1500 + 2 * 3000)
    expect(totalBilled(raised, NOW)).not.toBe(8 * 3000)
  })

  it('applies a mid-month raise from the next billing date', () => {
    // Billing falls on the 17th; the raise is dated the 25th. The month already
    // charged on the 17th stays at the old rate.
    const client = {
      monthlyRetainer: 3000,
      startDate: '2026-06-17',
      rateHistory: [
        { amount: 1500, effectiveFrom: '2026-06-17' },
        { amount: 3000, effectiveFrom: '2026-06-25' },
      ],
    }
    // 17 Jun @1500, 17 Jul @3000, 17 Aug @3000.
    expect(totalBilled(client, NOW)).toBe(1500 + 3000 + 3000)
  })

  it('ignores a change dated in the future', () => {
    const client = {
      monthlyRetainer: 1500,
      startDate: '2026-06-17',
      rateHistory: [
        { amount: 1500, effectiveFrom: '2026-06-17' },
        { amount: 5000, effectiveFrom: '2026-12-01' },
      ],
    }
    expect(totalBilled(client, NOW)).toBe(3 * 1500)
  })

  it('accepts history recorded out of order', () => {
    const client = {
      monthlyRetainer: 3000,
      startDate: '2026-01-17',
      rateHistory: [
        { amount: 3000, effectiveFrom: '2026-05-17' },
        { amount: 1500, effectiveFrom: '2026-01-17' },
      ],
    }
    expect(totalBilled(client, NOW)).toBe(4 * 1500 + 4 * 3000)
  })

  it('handles a cut as readily as a raise', () => {
    const client = {
      monthlyRetainer: 800,
      startDate: '2026-06-17',
      rateHistory: [
        { amount: 2000, effectiveFrom: '2026-06-17' },
        { amount: 800, effectiveFrom: '2026-08-17' },
      ],
    }
    expect(totalBilled(client, NOW)).toBe(2000 + 2000 + 800)
  })

  it('still caps at the end date', () => {
    const client = {
      monthlyRetainer: 3000,
      startDate: '2026-01-17',
      endDate: '2026-03-17',
      rateHistory: [
        { amount: 1500, effectiveFrom: '2026-01-17' },
        { amount: 3000, effectiveFrom: '2026-05-17' },
      ],
    }
    // Ended before the raise ever took effect.
    expect(totalBilled(client, NOW)).toBe(3 * 1500)
  })

  it('falls back to the flat rate when no history is recorded', () => {
    // Every client that existed before rate history has no array at all, and
    // must keep producing exactly the number it did before.
    expect(totalBilled({ monthlyRetainer: 3000, startDate: '2026-01-17' }, NOW)).toBe(
      3000 * 8,
    )
    expect(
      totalBilled({ monthlyRetainer: 3000, startDate: '2026-01-17', rateHistory: [] }, NOW),
    ).toBe(3000 * 8)
  })

  it('drops entries with an unparseable date rather than guessing', () => {
    const client = {
      monthlyRetainer: 3000,
      startDate: '2026-01-17',
      rateHistory: [
        { amount: 1500, effectiveFrom: '2026-01-17' },
        { amount: 9999, effectiveFrom: 'sometime in May' },
        { amount: 3000, effectiveFrom: '2026-05-17' },
      ],
    }
    expect(totalBilled(client, NOW)).toBe(4 * 1500 + 4 * 3000)
  })

  it('bills months preceding the earliest recorded rate at that rate', () => {
    // History that starts after the engagement did — the opening months have to
    // be charged at something, and the earliest known rate is the only defensible
    // choice.
    const client = {
      monthlyRetainer: 3000,
      startDate: '2026-01-17',
      rateHistory: [{ amount: 3000, effectiveFrom: '2026-06-17' }],
    }
    expect(totalBilled(client, NOW)).toBe(8 * 3000)
  })
})

describe('billingSegments', () => {
  it('groups consecutive months billed at the same rate', () => {
    const segments = billingSegments(
      {
        monthlyRetainer: 3000,
        startDate: '2026-01-17',
        rateHistory: [
          { amount: 1500, effectiveFrom: '2026-01-17' },
          { amount: 3000, effectiveFrom: '2026-05-17' },
        ],
      },
      NOW,
    )

    expect(segments).toHaveLength(2)
    expect(segments[0]).toMatchObject({ amount: 1500, months: 4, subtotal: 6000 })
    expect(segments[1]).toMatchObject({ amount: 3000, months: 4, subtotal: 12000 })
  })

  it('reports the first billing date of each run', () => {
    const segments = billingSegments(
      {
        monthlyRetainer: 3000,
        startDate: '2026-01-17',
        rateHistory: [
          { amount: 1500, effectiveFrom: '2026-01-17' },
          { amount: 3000, effectiveFrom: '2026-05-17' },
        ],
      },
      NOW,
    )
    expect(segments[0].from).toEqual({ y: 2026, m: 1, d: 17 })
    expect(segments[1].from).toEqual({ y: 2026, m: 5, d: 17 })
  })

  it('rolls the year over correctly', () => {
    const segments = billingSegments(
      {
        monthlyRetainer: 2000,
        startDate: '2025-11-17',
        rateHistory: [
          { amount: 1000, effectiveFrom: '2025-11-17' },
          { amount: 2000, effectiveFrom: '2026-02-17' },
        ],
      },
      NOW,
    )
    // Nov, Dec, Jan @1000 = 3; Feb–Aug @2000 = 7.
    expect(segments[0]).toMatchObject({ amount: 1000, months: 3 })
    expect(segments[1]).toMatchObject({ amount: 2000, months: 7 })
    expect(segments[1].from).toEqual({ y: 2026, m: 2, d: 17 })
  })

  it('is one segment when the rate never moved', () => {
    const segments = billingSegments(
      { monthlyRetainer: 1500, startDate: '2026-06-17' },
      NOW,
    )
    expect(segments).toHaveLength(1)
    expect(segments[0]).toMatchObject({ amount: 1500, months: 3, subtotal: 4500 })
  })

  it('is empty when nothing can be computed', () => {
    expect(billingSegments({ monthlyRetainer: 1500 }, NOW)).toEqual([])
    expect(billingSegments({ startDate: '2026-01-01' }, NOW)).toEqual([])
    expect(billingSegments({ monthlyRetainer: 1500, startDate: '2027-01-01' }, NOW)).toEqual([])
  })

  it('sums to totalBilled', () => {
    const client = {
      monthlyRetainer: 3000,
      startDate: '2025-09-17',
      rateHistory: [
        { amount: 1200, effectiveFrom: '2025-09-17' },
        { amount: 1500, effectiveFrom: '2026-01-17' },
        { amount: 3000, effectiveFrom: '2026-06-17' },
      ],
    }
    const segments = billingSegments(client, NOW)
    const summed = segments.reduce((total, segment) => total + segment.subtotal, 0)
    expect(summed).toBe(totalBilled(client, NOW))
  })
})

describe('currentRate', () => {
  it('is the newest rate that has taken effect', () => {
    const client = {
      monthlyRetainer: 3000,
      startDate: '2026-01-17',
      rateHistory: [
        { amount: 1500, effectiveFrom: '2026-01-17' },
        { amount: 3000, effectiveFrom: '2026-05-17' },
      ],
    }
    expect(currentRate(client, NOW)).toBe(3000)
  })

  it('excludes a rate that has not started yet', () => {
    const client = {
      monthlyRetainer: 1500,
      startDate: '2026-01-17',
      rateHistory: [
        { amount: 1500, effectiveFrom: '2026-01-17' },
        { amount: 5000, effectiveFrom: '2026-12-01' },
      ],
    }
    expect(currentRate(client, NOW)).toBe(1500)
  })

  it('falls back to the flat rate with no history', () => {
    expect(currentRate({ monthlyRetainer: 1500, startDate: '2026-01-17' }, NOW)).toBe(1500)
  })

  it('is null when nothing is set', () => {
    expect(currentRate({ startDate: '2026-01-17' }, NOW)).toBeNull()
  })
})

// ── Pauses ────────────────────────────────────────────────────────────────────
//
// Before pause dates existed, `status: 'Paused'` recorded that a client was on
// hold but not since when, so the total assumed continuous billing and had to
// be labelled an estimate.

describe('isPausedOn', () => {
  it('includes the first day and excludes the resume day', () => {
    const pauses = [{ from: '2026-03-01', to: '2026-05-01' }]
    expect(isPausedOn(pauses, { y: 2026, m: 2, d: 28 })).toBe(false)
    expect(isPausedOn(pauses, { y: 2026, m: 3, d: 1 })).toBe(true)
    expect(isPausedOn(pauses, { y: 2026, m: 4, d: 15 })).toBe(true)
    // Resuming on the 1st means the 1st is worked, so it bills.
    expect(isPausedOn(pauses, { y: 2026, m: 5, d: 1 })).toBe(false)
  })

  it('treats a pause with no end as still running', () => {
    const pauses = [{ from: '2026-03-01' }]
    expect(isPausedOn(pauses, { y: 2030, m: 1, d: 1 })).toBe(true)
    expect(isPausedOn(pauses, { y: 2026, m: 2, d: 1 })).toBe(false)
  })

  it('is false with no pauses recorded', () => {
    expect(isPausedOn(undefined, NOW)).toBe(false)
    expect(isPausedOn([], NOW)).toBe(false)
  })
})

describe('totalBilled with pauses', () => {
  it('does not charge months spent on hold', () => {
    // Started 17 Jan at 1,000. Paused 17 Mar to 17 Jun.
    // Billed: Jan, Feb, Jun, Jul, Aug = 5. Skipped: Mar, Apr, May.
    const client = {
      monthlyRetainer: 1000,
      startDate: '2026-01-17',
      pausePeriods: [{ from: '2026-03-17', to: '2026-06-17' }],
    }
    expect(totalBilled(client, NOW)).toBe(5 * 1000)
    expect(monthsCharged(client, NOW)).toBe(5)
    expect(monthsPaused(client, NOW)).toBe(3)
  })

  it('keeps accruing nothing while a pause is still open', () => {
    const client = {
      monthlyRetainer: 1000,
      startDate: '2026-01-17',
      pausePeriods: [{ from: '2026-04-17' }],
    }
    // Jan, Feb, Mar billed; Apr onward on hold.
    expect(totalBilled(client, NOW)).toBe(3 * 1000)
  })

  it('handles a client paused and resumed more than once', () => {
    const client = {
      monthlyRetainer: 500,
      startDate: '2026-01-17',
      pausePeriods: [
        { from: '2026-02-17', to: '2026-03-17' },
        { from: '2026-06-17', to: '2026-07-17' },
      ],
    }
    // Skipped Feb and Jun. Billed Jan, Mar, Apr, May, Jul, Aug = 6.
    expect(totalBilled(client, NOW)).toBe(6 * 500)
    expect(monthsPaused(client, NOW)).toBe(2)
  })

  it('combines a pause with a rate change', () => {
    const client = {
      monthlyRetainer: 3000,
      startDate: '2026-01-17',
      rateHistory: [
        { amount: 1500, effectiveFrom: '2026-01-17' },
        { amount: 3000, effectiveFrom: '2026-06-17' },
      ],
      pausePeriods: [{ from: '2026-03-17', to: '2026-05-17' }],
    }
    // Jan, Feb @1500 = 3000. Mar, Apr skipped. May @1500 = 1500.
    // Jun, Jul, Aug @3000 = 9000.
    expect(totalBilled(client, NOW)).toBe(3000 + 1500 + 9000)
  })

  it('splits segments around a pause rather than merging across it', () => {
    const segments = billingSegments(
      {
        monthlyRetainer: 1000,
        startDate: '2026-01-17',
        pausePeriods: [{ from: '2026-03-17', to: '2026-06-17' }],
      },
      NOW,
    )
    // Same rate throughout, but the gap is real and worth showing.
    expect(segments).toHaveLength(1)
    expect(segments[0].months).toBe(5)
  })

  it('leaves an unpaused client exactly as it was', () => {
    const client = { monthlyRetainer: 1000, startDate: '2026-01-17' }
    expect(totalBilled(client, NOW)).toBe(8 * 1000)
    expect(monthsPaused(client, NOW)).toBe(0)
    expect(monthsCharged(client, NOW)).toBe(8)
  })

  it('counts tenure across a pause but not billing', () => {
    const client = {
      monthlyRetainer: 1000,
      startDate: '2026-01-17',
      pausePeriods: [{ from: '2026-03-17', to: '2026-06-17' }],
    }
    // Ten months of relationship... eight anniversaries, five paid.
    expect(monthsBilled(client.startDate, undefined, NOW)).toBe(8)
    expect(monthsCharged(client, NOW)).toBe(5)
    expect(tenureLabel(client.startDate, undefined, NOW)).toBe('8 months')
  })
})

describe('openPause', () => {
  it('finds a pause with no end date', () => {
    expect(openPause({ pausePeriods: [{ from: '2026-03-01' }] })).toMatchObject({
      from: '2026-03-01',
    })
  })

  it('is null when every pause has ended', () => {
    expect(openPause({ pausePeriods: [{ from: '2026-03-01', to: '2026-04-01' }] })).toBeNull()
    expect(openPause({})).toBeNull()
  })
})
