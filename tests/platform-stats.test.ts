import { describe, expect, it } from 'vitest'
import {
  isEvidenceType,
  isMonthKey,
  missingEvidence,
  monthKey,
  monthLabel,
  platformsInUse,
  previousMonth,
  viewGap,
} from '@/lib/platform-stats'

describe('months', () => {
  it('keys a date by its UTC month', () => {
    expect(monthKey(new Date('2026-11-30T23:00:00Z'))).toBe('2026-11')
  })

  it('steps back a month, across a year', () => {
    expect(previousMonth('2026-12')).toBe('2026-11')
    expect(previousMonth('2027-01')).toBe('2026-12')
  })

  it('accepts only YYYY-MM', () => {
    expect(isMonthKey('2026-11')).toBe(true)
    expect(isMonthKey('2026-13')).toBe(false)
    expect(isMonthKey('2026-1')).toBe(false)
  })

  it('names a month', () => {
    expect(monthLabel('2026-11')).toBe('November 2026')
  })
})

describe('evidence', () => {
  it('accepts screenshots and exports only', () => {
    expect(isEvidenceType('image/png')).toBe(true)
    expect(isEvidenceType('text/csv')).toBe(true)
    expect(isEvidenceType('application/pdf')).toBe(true)
    expect(isEvidenceType('image/gif')).toBe(false)
    expect(isEvidenceType(undefined)).toBe(false)
  })

  it('asks only for the platforms a client publishes on', () => {
    expect(platformsInUse([{ platform: 'Dev.to' }, { platform: 'freeCodeCamp' }, { platform: 'Hashnode' }])).toEqual([
      'Dev.to',
      'Hashnode',
    ])
  })

  it('lists platforms with no file for the month', () => {
    expect(
      missingEvidence(['Dev.to', 'Medium', 'Hashnode'], [
        { platform: 'Dev.to', evidenceStorageId: 'abc' },
        { platform: 'Medium', evidenceStorageId: null },
      ]),
    ).toEqual(['Medium', 'Hashnode'])
  })
})

describe('viewGap', () => {
  it('measures the gap as a share of the platform total', () => {
    expect(viewGap(1000, 850)).toBeCloseTo(0.15)
  })

  it('is null when a side is missing', () => {
    expect(viewGap(null, 10)).toBeNull()
    expect(viewGap(0, 10)).toBeNull()
  })
})
