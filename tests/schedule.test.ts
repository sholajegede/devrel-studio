import { describe, expect, it } from 'vitest'
import {
  dueNow,
  localMoment,
  periodBefore,
  type ScheduleShape,
} from '@/lib/schedule'

const schedule = (over: Partial<ScheduleShape> = {}): ScheduleShape => ({
  enabled: true,
  dayOfMonth: 1,
  hourLocal: 9,
  timezone: 'Africa/Lagos',
  ...over,
})

describe('localMoment', () => {
  it('reads the wall clock in the given zone', () => {
    // 08:30 UTC on 1 September 2026.
    const at = new Date('2026-09-01T08:30:00Z')
    expect(localMoment(at, 'UTC')).toEqual({ year: 2026, month: 9, day: 1, hour: 8 })
    // Lagos is UTC+1 year-round.
    expect(localMoment(at, 'Africa/Lagos')).toEqual({ year: 2026, month: 9, day: 1, hour: 9 })
  })

  it('crosses the date boundary rather than only shifting the hour', () => {
    // 02:00 UTC is still the previous evening in New York.
    const at = new Date('2026-09-01T02:00:00Z')
    expect(localMoment(at, 'America/New_York')).toMatchObject({ month: 8, day: 31, hour: 22 })
    expect(localMoment(at, 'Asia/Tokyo')).toMatchObject({ month: 9, day: 1, hour: 11 })
  })

  it('follows daylight saving rather than a fixed offset', () => {
    // New York is UTC-4 in July and UTC-5 in January. A hand-rolled offset gets
    // one of these wrong.
    expect(localMoment(new Date('2026-07-01T16:00:00Z'), 'America/New_York').hour).toBe(12)
    expect(localMoment(new Date('2026-01-01T16:00:00Z'), 'America/New_York').hour).toBe(11)
  })
})

describe('periodBefore', () => {
  it('returns the month that just closed', () => {
    expect(periodBefore({ year: 2026, month: 9, day: 1, hour: 9 })).toBe('2026-08')
  })

  it('wraps to December of the previous year in January', () => {
    expect(periodBefore({ year: 2026, month: 1, day: 1, hour: 9 })).toBe('2025-12')
  })

  it('pads the month so it matches a period key', () => {
    expect(periodBefore({ year: 2026, month: 10, day: 1, hour: 9 })).toBe('2026-09')
    expect(periodBefore({ year: 2026, month: 3, day: 1, hour: 9 })).toBe('2026-02')
  })
})

describe('dueNow', () => {
  it('fires on the configured day and hour, for the closed month', () => {
    // 08:00 UTC = 09:00 in Lagos, on the 1st.
    const result = dueNow(schedule(), new Date('2026-09-01T08:00:00Z'))
    expect(result.due).toBe(true)
    expect(result.period).toBe('2026-08')
  })

  it('does not fire an hour early or an hour late', () => {
    expect(dueNow(schedule(), new Date('2026-09-01T07:00:00Z')).due).toBe(false)
    expect(dueNow(schedule(), new Date('2026-09-01T09:00:00Z')).due).toBe(false)
  })

  it('does not fire on the wrong day', () => {
    expect(dueNow(schedule(), new Date('2026-09-02T08:00:00Z')).reason).toBe('wrong-day')
  })

  it('is silent when disabled', () => {
    expect(dueNow(schedule({ enabled: false }), new Date('2026-09-01T08:00:00Z')).due).toBe(
      false,
    )
  })

  it('will not send the same period twice', () => {
    // The hourly job can run more than once in the matching hour — a retry, a
    // redeploy — and a duplicate report is worse than a late one.
    const result = dueNow(
      schedule({ lastSentPeriod: '2026-08' }),
      new Date('2026-09-01T08:00:00Z'),
    )
    expect(result.due).toBe(false)
    expect(result.reason).toBe('already-sent')
  })

  it('sends again the following month', () => {
    const result = dueNow(
      schedule({ lastSentPeriod: '2026-08' }),
      new Date('2026-10-01T08:00:00Z'),
    )
    expect(result.due).toBe(true)
    expect(result.period).toBe('2026-09')
  })

  it('respects the client’s timezone, not the server’s', () => {
    // 13:00 UTC is 09:00 in New York during summer, and 14:00 in Lagos.
    const at = new Date('2026-09-01T13:00:00Z')
    expect(dueNow(schedule({ timezone: 'America/New_York' }), at).due).toBe(true)
    expect(dueNow(schedule({ timezone: 'Africa/Lagos' }), at).due).toBe(false)
  })

  it('uses the local date when zones disagree about which day it is', () => {
    // 23:00 UTC on 31 August is already 1 September in Tokyo at 08:00.
    const at = new Date('2026-08-31T23:00:00Z')
    const tokyo = dueNow(schedule({ timezone: 'Asia/Tokyo', hourLocal: 8 }), at)
    expect(tokyo.due).toBe(true)
    expect(tokyo.period).toBe('2026-08')
  })
})
