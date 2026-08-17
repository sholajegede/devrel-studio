// ── Report scheduling ─────────────────────────────────────────────────────────
//
// Convex crons are fixed at deploy time, so a per-client schedule cannot be
// registered as its own cron job. Instead one hourly job asks every schedule
// "is it your hour?", which is what makes the timing configurable from the
// dashboard rather than from a source file.
//
// Kept free of Convex imports so the date arithmetic can be tested directly —
// this decides whether a client's report goes out, and an off-by-one hour on a
// timezone boundary sends it on the wrong day.

export interface ScheduleShape {
  enabled: boolean
  dayOfMonth: number
  hourLocal: number
  timezone: string
  lastSentPeriod?: string
}

export interface LocalMoment {
  year: number
  month: number
  day: number
  hour: number
}

/**
 * The wall-clock moment in a given timezone.
 *
 * `Intl` rather than manual offset arithmetic: offsets change twice a year in
 * most of the world, and a hand-rolled version is wrong for two weeks every
 * spring and autumn.
 */
export function localMoment(at: Date, timezone: string): LocalMoment {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(at)

  const read = (type: string) =>
    Number(parts.find((part) => part.type === type)?.value ?? '0')

  return {
    year: read('year'),
    month: read('month'),
    day: read('day'),
    hour: read('hour'),
  }
}

/** The month before the one given, as `YYYY-MM`. */
export function periodBefore(moment: LocalMoment): string {
  return moment.month === 1
    ? `${moment.year - 1}-12`
    : `${moment.year}-${String(moment.month - 1).padStart(2, '0')}`
}

/**
 * Whether this schedule should fire now, and for which period.
 *
 * Reports cover the month that has closed, so a run on 1 September sends the
 * August report.
 *
 * `lastSentPeriod` is the guard against duplicates. The hourly job may run more
 * than once inside the matching hour — a retry, a redeploy — and a client
 * receiving the same report twice is worse than receiving it an hour late.
 */
export function dueNow(
  schedule: ScheduleShape,
  at: Date = new Date(),
): { due: boolean; period: string; reason: string } {
  const moment = localMoment(at, schedule.timezone)
  const period = periodBefore(moment)

  if (!schedule.enabled) return { due: false, period, reason: 'disabled' }
  if (moment.day !== schedule.dayOfMonth) return { due: false, period, reason: 'wrong-day' }
  if (moment.hour !== schedule.hourLocal) return { due: false, period, reason: 'wrong-hour' }
  if (schedule.lastSentPeriod === period) {
    return { due: false, period, reason: 'already-sent' }
  }

  return { due: true, period, reason: 'due' }
}

/** Sensible defaults for a client that has never been configured. */
export const DEFAULT_SCHEDULE = {
  enabled: false,
  dayOfMonth: 1,
  hourLocal: 9,
  timezone: 'Africa/Lagos',
} as const

/** Offered in the picker. Deliberately short — a long list is worse than a search. */
export const COMMON_TIMEZONES = [
  'Africa/Lagos',
  'Africa/Nairobi',
  'Africa/Johannesburg',
  'Europe/London',
  'Europe/Berlin',
  'America/New_York',
  'America/Chicago',
  'America/Los_Angeles',
  'Asia/Dubai',
  'Asia/Kolkata',
  'Asia/Singapore',
  'Australia/Sydney',
  'UTC',
]
