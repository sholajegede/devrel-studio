import { Infer, v } from 'convex/values'

// ── Access windows and request status ─────────────────────────────────────────
//
// The arithmetic and vocabulary shared by everything that opens somebody's
// access window: the admin console's approve action, and the `migrations`
// command still typed by hand.
//
// It lives here rather than in either caller because the two must agree. A
// console that computes an expiry one way and a terminal command that computes
// it another produces two customers with the same purchase and different end
// dates, and no way to tell which is right.

/**
 * What an access request can be.
 *
 * `open` until somebody acts on it; `cancelled` is the buyer withdrawing,
 * `granted` and `declined` are the owner answering. Held as a validator rather
 * than a bare string so a typo is rejected at the write instead of surfacing
 * months later as a row no query matches — the failure mode `reconcileRequests`
 * had to go looking for.
 */
export const requestStatusValidator = v.union(
  v.literal('open'),
  v.literal('granted'),
  v.literal('declined'),
  v.literal('cancelled'),
)

export type RequestStatus = Infer<typeof requestStatusValidator>

/** Every status, for exhaustive checks and for reconciliation. */
export const REQUEST_STATUSES: RequestStatus[] = ['open', 'granted', 'declined', 'cancelled']

/** A status a request can move to once it has been acted on. */
export type SettledStatus = Exclude<RequestStatus, 'open'>

/**
 * The longest term anyone can be granted in one go.
 *
 * Not a business rule so much as a guard against a slipped decimal: a fat
 * finger that types 360 instead of 36 grants thirty years of access, and
 * nothing downstream would question it.
 */
export const MAX_ACCESS_MONTHS = 60

export interface AccessWindow {
  /** Where the new term starts counting. */
  from: number
  /** When it ends. */
  until: number
  /** True when an unexpired window was extended rather than a new one opened. */
  extended: boolean
}

/**
 * Where an account's access should end after buying `months` more.
 *
 * Extends from the later of today and the current expiry, so renewing early
 * adds to what is left instead of throwing it away — otherwise the safest
 * moment to renew would be the day after being locked out.
 *
 * Calendar months, not 30-day blocks. `setMonth` rolls a short month forward
 * rather than clamping it: three months from 31 January lands on 3 May, not 30
 * April. That favours the buyer by a couple of days, which is the right
 * direction for the mistake to go, and it is pinned by a test so it stays a
 * decision rather than an accident.
 */
export function extendAccessWindow(
  currentUntil: number | undefined | null,
  months: number,
  now: number = Date.now(),
): AccessWindow {
  const extended = Boolean(currentUntil && currentUntil > now)
  const from = extended ? (currentUntil as number) : now

  const until = new Date(from)
  until.setMonth(until.getMonth() + months)

  return { from, until: until.getTime(), extended }
}

/**
 * Whether a term is one we will actually grant.
 *
 * Returns the reason rather than throwing, so a caller can put it in front of
 * the person who typed it.
 */
export function checkMonths(months: number): string | null {
  if (!Number.isInteger(months)) return 'Months must be a whole number'
  if (months <= 0) return 'Months must be at least 1'
  if (months > MAX_ACCESS_MONTHS) return `Months must be ${MAX_ACCESS_MONTHS} or fewer`
  return null
}

/**
 * The fields that close somebody's access window.
 *
 * Shared for the same reason as the arithmetic above: revoke exists in two
 * places — the console's owner-only action and the `migrations` command still
 * typed by hand — and the two must agree on what revoked *means*. One clearing
 * `accessUntil` while the other set it to `now` would leave two accounts in
 * visibly different states after the same decision, and `accessOf` treats a
 * past timestamp and an absent one differently in what it reports as `until`.
 *
 * `plan` is deliberately left alone. It records what was bought, not what is
 * currently allowed; `accessOf` already falls back to the trial's limits once
 * the window is shut, and erasing the plan would lose the only record of what
 * the refund was for.
 */
export function revokedPatch(reason?: string): {
  accessUntil: undefined
  planStatus: string
  accessNote: string
} {
  return {
    accessUntil: undefined,
    planStatus: 'revoked',
    accessNote: reason?.trim() ? `Access revoked — ${reason.trim()}` : 'Access revoked',
  }
}
