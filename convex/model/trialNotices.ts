import { accessOf } from './plans'

// ── Trial notices ─────────────────────────────────────────────────────────────
//
// Two emails over a 14-day trial: one a few days before it closes, one when it
// has. Two rather than a sequence, because there is nothing to say on day 4 that
// the dashboard does not already say better, and a trial short enough to hold in
// your head does not need chasing.
//
// The whole point of this module is deciding who is owed which notice. A cron
// that mails people is the kind of code that is embarrassing when it is wrong,
// so the decision is pure and tested and the action that sends does no thinking
// of its own.

export type TrialNotice = 'ending' | 'ended'

/** How many days before the trial closes the first notice goes out. */
export const NOTICE_LEAD_DAYS = 3

/**
 * How long after a trial closes the second notice may still be sent.
 *
 * Without this window, deploying the feature would mail every account whose
 * trial lapsed months ago, and each of them would read it as a message about
 * something that happened today. A notice that missed its moment is better
 * dropped than sent late.
 */
export const NOTICE_GRACE_DAYS = 3

const DAY = 86_400_000

export interface TrialUser {
  _id?: string
  kindeId?: string
  email?: string
  plan?: string
  planStatus?: string
  trialEndsAt?: number
  accessUntil?: number
  /** Notices already sent to this account. Absent on accounts predating this. */
  trialNoticesSent?: string[]
}

/**
 * Which notice this account is owed right now, if any.
 *
 * Returns one notice at a time. An account that somehow becomes eligible for
 * both on the same run gets the later one, since 'ended' is the truer statement
 * once the date has passed.
 */
export function trialNoticeFor(user: TrialUser, now: number = Date.now()): TrialNotice | null {
  const endsAt = user.trialEndsAt
  if (!endsAt) return null

  // Anyone who has ever bought access is out. Their window is a purchase, not a
  // trial, and telling a paying customer their trial is ending is worse than
  // saying nothing. This holds even once that purchase lapses: a lapsed
  // customer needs a different message than a trialist, and sending this one
  // would misdescribe what they had.
  if (user.accessUntil !== undefined) return null

  // Comped accounts have no expiry to warn about.
  const access = accessOf(user, now)
  if (access.state === 'comped' || access.state === 'active') return null

  const already = user.trialNoticesSent ?? []
  const elapsed = now - endsAt

  if (elapsed >= 0) {
    if (elapsed > NOTICE_GRACE_DAYS * DAY) return null
    return already.includes('ended') ? null : 'ended'
  }

  const daysLeft = Math.ceil(-elapsed / DAY)
  if (daysLeft > NOTICE_LEAD_DAYS) return null
  return already.includes('ending') ? null : 'ending'
}

/** Whole days until the trial closes. Zero once it has. */
export function daysLeftOn(user: TrialUser, now: number = Date.now()): number {
  if (!user.trialEndsAt) return 0
  return Math.max(0, Math.ceil((user.trialEndsAt - now) / DAY))
}
