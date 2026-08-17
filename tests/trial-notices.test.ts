import { describe, expect, it } from 'vitest'
import {
  canReceiveMail,
  NOTICE_GRACE_DAYS,
  NOTICE_LEAD_DAYS,
  daysLeftOn,
  trialNoticeFor,
  type TrialUser,
} from '@/convex/model/trialNotices'

const NOW = Date.parse('2026-08-17T09:00:00Z')
const DAY = 86_400_000

/** A trial account with `days` left to run, and nothing else notable. */
function trialist(days: number, extra: Partial<TrialUser> = {}): TrialUser {
  return { email: 'someone@example.com', trialEndsAt: NOW + days * DAY, ...extra }
}

describe('trialNoticeFor', () => {
  it('says nothing early in the trial', () => {
    for (const days of [14, 10, 7, 4]) {
      expect(trialNoticeFor(trialist(days), NOW)).toBeNull()
    }
  })

  it('warns once the trial is inside the lead window', () => {
    expect(NOTICE_LEAD_DAYS).toBe(3)
    for (const days of [3, 2, 1]) {
      expect(trialNoticeFor(trialist(days), NOW)).toBe('ending')
    }
  })

  it('switches to the closing notice once the date has passed', () => {
    expect(trialNoticeFor(trialist(-0.5), NOW)).toBe('ended')
    expect(trialNoticeFor(trialist(-2), NOW)).toBe('ended')
  })

  // Deploying this feature must not mail everyone whose trial lapsed months
  // ago. Each of them would read it as news about today.
  it('drops a notice that missed its moment', () => {
    expect(NOTICE_GRACE_DAYS).toBe(3)
    expect(trialNoticeFor(trialist(-4), NOW)).toBeNull()
    expect(trialNoticeFor(trialist(-30), NOW)).toBeNull()
    expect(trialNoticeFor(trialist(-400), NOW)).toBeNull()
  })

  // The cron runs daily and may be retried. Sending twice is the failure that
  // actually costs something, so a recorded notice is never repeated.
  it('never repeats a notice it has already sent', () => {
    expect(trialNoticeFor(trialist(2, { trialNoticesSent: ['ending'] }), NOW)).toBeNull()
    expect(trialNoticeFor(trialist(-1, { trialNoticesSent: ['ended'] }), NOW)).toBeNull()
  })

  it('still sends the closing notice to someone who got the warning', () => {
    expect(trialNoticeFor(trialist(-1, { trialNoticesSent: ['ending'] }), NOW)).toBe('ended')
  })

  it('sends the closing notice alone when the warning was missed', () => {
    // A trial shorter than the lead window, or a cron that did not run.
    expect(trialNoticeFor(trialist(-1, { trialNoticesSent: [] }), NOW)).toBe('ended')
  })

  it('ignores an account with no trial at all', () => {
    expect(trialNoticeFor({ email: 'x@example.com' }, NOW)).toBeNull()
  })

  // Telling a paying customer their trial is ending misdescribes what they
  // bought, and it is the sort of email that loses one.
  it('leaves paying customers alone', () => {
    const paid = trialist(1, { accessUntil: NOW + 60 * DAY, plan: 'pro' })
    expect(trialNoticeFor(paid, NOW)).toBeNull()
  })

  // A customer whose purchase lapsed is not a trialist. They need a different
  // message than this one, so this one stays quiet.
  it('leaves a lapsed customer alone rather than calling them a trialist', () => {
    const lapsed = trialist(-1, { accessUntil: NOW - 10 * DAY, plan: 'pro' })
    expect(trialNoticeFor(lapsed, NOW)).toBeNull()
  })

  it('leaves comped accounts alone', () => {
    // COMPED_USER_IDS is matched on the account id by accessOf.
    const comped = trialist(1, { _id: 'jd767m6hpf3jqhdcs5rb9d6v8581r92k' })
    expect(trialNoticeFor(comped, NOW)).toBeNull()
  })

  it('treats the exact moment of expiry as ended, not ending', () => {
    expect(trialNoticeFor(trialist(0), NOW)).toBe('ended')
  })
})

describe('daysLeftOn', () => {
  it('counts whole days remaining', () => {
    expect(daysLeftOn(trialist(3), NOW)).toBe(3)
    expect(daysLeftOn(trialist(1), NOW)).toBe(1)
  })

  it('never counts below zero', () => {
    expect(daysLeftOn(trialist(-5), NOW)).toBe(0)
    expect(daysLeftOn({ email: 'x@example.com' }, NOW)).toBe(0)
  })
})

describe('canReceiveMail', () => {
  it('accepts an ordinary address', () => {
    expect(canReceiveMail({ email: 'someone@example.org' })).toBe(true)
    expect(canReceiveMail({ email: 'shola+work@gmail.com' })).toBe(true)
  })

  // Fixtures share a table with real accounts. Every hard bounce counts against
  // the sending domain, and a batch that is a quarter fixtures hurts delivery
  // for the real users sitting in the same batch.
  it('refuses reserved domains that can never take delivery', () => {
    expect(canReceiveMail({ email: 'admin@ci-demo.test' })).toBe(false)
    expect(canReceiveMail({ email: 'a@thing.example' })).toBe(false)
    expect(canReceiveMail({ email: 'a@thing.invalid' })).toBe(false)
    expect(canReceiveMail({ email: 'root@localhost' })).toBe(false)
  })

  it('refuses the seeded demo account', () => {
    expect(
      canReceiveMail({ email: 'demo@devrel.studio', kindeId: 'demo-account-not-a-real-login' }),
    ).toBe(false)
  })

  it('refuses a missing or malformed address', () => {
    expect(canReceiveMail({})).toBe(false)
    expect(canReceiveMail({ email: '' })).toBe(false)
    expect(canReceiveMail({ email: 'not-an-address' })).toBe(false)
  })

  it('keeps undeliverable accounts out of the notice queue entirely', () => {
    const fixture = { email: 'admin@ci-demo.test', trialEndsAt: NOW + 2 * DAY }
    expect(trialNoticeFor(fixture, NOW)).toBeNull()
  })
})
