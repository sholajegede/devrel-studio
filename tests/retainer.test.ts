import { describe, expect, it } from 'vitest'
import {
  costPerPiece,
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

describe('costPerPiece', () => {
  it('divides total billed by the number of pieces', () => {
    // 8 months x 2000 = 16000 across 8 pieces
    expect(costPerPiece({ monthlyRetainer: 2000, startDate: '2026-01-17' }, 8, NOW)).toBe(
      2000,
    )
  })

  it('is null rather than Infinity when nothing has been logged', () => {
    expect(costPerPiece({ monthlyRetainer: 2000, startDate: '2026-01-17' }, 0, NOW)).toBeNull()
    expect(costPerPiece({ monthlyRetainer: 2000, startDate: '2026-01-17' }, -3, NOW)).toBeNull()
  })

  it('is null when there is no retainer', () => {
    expect(costPerPiece({ startDate: '2026-01-17' }, 5, NOW)).toBeNull()
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
