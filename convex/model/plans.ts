// ── Plans ─────────────────────────────────────────────────────────────────────
//
// One definition of what each plan allows, imported by both the Convex
// functions that enforce the limits and the UI that displays them — so the
// pricing page and the actual gate can never drift apart.
//
// Prices are monthly, sold in terms. Access itself is a window (see accessOf
// below), so the term is just how far the window is pushed out.
//
// The numbers are set against the client-reporting tools this competes with,
// not against DevRel community platforms — Common Room and Orbit start around
// $500/month and sell to companies, while this sells to one consultant:
//
//   DashThis          $44/mo   3 dashboards
//   Swydo             $69/mo   unlimited reports
//   AgencyAnalytics   $79/mo   freelancer tier, ~$20/client/mo annually
//   Whatagraph       $286/mo   agency only
//
// Pro sits below every one of them while covering five clients, which is the
// case a DevRel consultant actually has. Against a $1,500/month retainer it is
// under 4% — small enough that the reporting time it saves settles the
// argument on its own.
//
// The floor is $29 rather than $19 deliberately: every payment is collected by
// hand, so the fixed admin cost per customer is the same whatever they pay, and
// a $19 quarterly block is barely worth the bank transfer.

export type PlanId = 'free' | 'starter' | 'pro' | 'agency'

export const PLAN_IDS: PlanId[] = ['free', 'starter', 'pro', 'agency']

export interface PlanDefinition {
  id: PlanId
  name: string
  /** Price per month in whole dollars, before any term discount. */
  price: number
  description: string
  /** `null` means unlimited. */
  maxClients: number | null
  maxEntries: number | null
  seats: number
  features: string[]
}

export const PLANS: Record<PlanId, PlanDefinition> = {
  free: {
    id: 'free',
    name: 'Free Trial',
    price: 0,
    description: 'Try DevRel Studio with a single client.',
    maxClients: 1,
    maxEntries: 10,
    seats: 1,
    features: [
      '1 client workspace',
      'Up to 10 content entries',
      'All 6 content categories',
      'Live client dashboard',
    ],
  },
  starter: {
    id: 'starter',
    name: 'Starter',
    price: 29,
    description: 'Perfect for freelancers managing one client.',
    maxClients: 1,
    maxEntries: null,
    seats: 1,
    features: [
      '1 client workspace',
      'Unlimited content entries',
      'All 6 content categories',
      'Live client dashboard',
      'UTM tracking & reshares',
      'CSV and PDF export',
      'Email support',
    ],
  },
  pro: {
    id: 'pro',
    name: 'Pro',
    price: 59,
    description: 'Built for consultants with multiple clients.',
    maxClients: 5,
    maxEntries: null,
    seats: 1,
    features: [
      'Up to 5 client workspaces',
      'Everything in Starter',
      'Public portfolio',
      'Automatic npm & GitHub sync',
      'Priority support',
    ],
  },
  agency: {
    id: 'agency',
    name: 'Agency',
    price: 119,
    description: 'Unlimited clients for growing agencies.',
    maxClients: null,
    maxEntries: null,
    seats: 5,
    features: [
      'Unlimited client workspaces',
      'Everything in Pro',
      'Up to 5 team seats',
      'Onboarding call',
      'Priority SLA support',
    ],
  },
}

// ── Terms ─────────────────────────────────────────────────────────────────────
//
// Sold in blocks rather than renewed monthly. Every payment is a bank transfer
// and a manual grant, so twelve collections a year per customer is twelve times
// the work of one — the discount buys down that overhead as much as it rewards
// commitment.

export interface Term {
  months: number
  label: string
  /** Percentage off the monthly rate. */
  discount: number
}

export const TERMS: Term[] = [
  { months: 1, label: '1 month', discount: 0 },
  { months: 3, label: '3 months', discount: 10 },
  { months: 6, label: '6 months', discount: 15 },
  { months: 12, label: '12 months', discount: 20 },
]

/** What a term actually costs, rounded to whole dollars. */
export function termPrice(plan: PlanDefinition, term: Term): number {
  return Math.round(plan.price * term.months * (1 - term.discount / 100))
}

/** The effective monthly rate on a term — what the discount is worth. */
export function termMonthly(plan: PlanDefinition, term: Term): number {
  return Math.round(termPrice(plan, term) / term.months)
}

/** Plans that can be bought, in upgrade order. */
export const PURCHASABLE_PLANS: PlanId[] = ['starter', 'pro', 'agency']

/**
 * Accounts granted the top plan without a purchase — owner and internal
 * accounts. Keyed on the `users` document id, which the browser cannot forge:
 * every gate resolves the caller's own document through `getCurrentUser`, so
 * listing an id here is the only way in.
 */
export const COMPED_USER_IDS: readonly string[] = [
  'jd767m6hpf3jqhdcs5rb9d6v8581r92k',
]

export function isComped(
  user: { _id?: string; kindeId?: string } | null | undefined,
): boolean {
  if (!user) return false
  // Matched against either id so the list works whether an entry was copied
  // from the Convex dashboard or from Kinde.
  return (
    (!!user._id && COMPED_USER_IDS.includes(user._id)) ||
    (!!user.kindeId && COMPED_USER_IDS.includes(user.kindeId))
  )
}

export function isPlanId(value: unknown): value is PlanId {
  return typeof value === 'string' && (PLAN_IDS as string[]).includes(value)
}

// ── Access windows ────────────────────────────────────────────────────────────
//
// Access is time-limited. Card payments are not available — Stripe needs a US
// entity, and this is run from Nigeria — so a buyer emails, pays out of band,
// and an operator extends their window by hand.
//
// The window is just a timestamp, which is what makes the commercial model a
// decision rather than a rewrite: selling a month, a year, or a perpetual
// licence is the same field with a different number in it.

export const TRIAL_DAYS = 14

export type AccessState = 'comped' | 'active' | 'trial' | 'expired'

export interface Access {
  state: AccessState
  plan: PlanDefinition
  /** Epoch ms the current window closes, or null when it does not. */
  until: number | null
  daysLeft: number | null
  /** Whether the account may still create and edit. */
  canWrite: boolean
}

function daysUntil(timestamp: number, now: number): number {
  return Math.max(0, Math.ceil((timestamp - now) / 86_400_000))
}

/**
 * What an account is currently entitled to.
 *
 * Order matters: a comped account outranks everything, then paid access, then
 * the trial. An expired account keeps its plan's *shape* for display but loses
 * the right to write — their existing work stays readable, and their clients'
 * dashboards stay up, because punishing a client for their DevRel's lapsed
 * payment would be the wrong party.
 */
export function accessOf(
  user:
    | {
        _id?: string
        kindeId?: string
        plan?: string
        planStatus?: string
        trialEndsAt?: number
        accessUntil?: number
      }
    | null,
  now: number = Date.now(),
): Access {
  if (isComped(user)) {
    return { state: 'comped', plan: PLANS.agency, until: null, daysLeft: null, canWrite: true }
  }

  const plan = user?.plan && isPlanId(user.plan) ? PLANS[user.plan] : PLANS.free

  if (user?.accessUntil && user.accessUntil > now) {
    return {
      state: 'active',
      plan,
      until: user.accessUntil,
      daysLeft: daysUntil(user.accessUntil, now),
      canWrite: true,
    }
  }

  if (user?.trialEndsAt && user.trialEndsAt > now) {
    return {
      state: 'trial',
      plan: PLANS.free,
      until: user.trialEndsAt,
      daysLeft: daysUntil(user.trialEndsAt, now),
      canWrite: true,
    }
  }

  return {
    state: 'expired',
    plan: PLANS.free,
    until: user?.accessUntil ?? user?.trialEndsAt ?? null,
    daysLeft: 0,
    canWrite: false,
  }
}

export function planOf(
  user: { _id?: string; kindeId?: string; plan?: string; planStatus?: string } | null,
): PlanDefinition {
  // Comped accounts get the top plan regardless of what `plan` says, so every
  // limit check downstream (clients, entries, seats) passes untouched.
  // Delegates to accessOf so limits and entitlement cannot disagree — an
  // account whose window has closed falls back to the trial's limits.
  return accessOf(
    user as Parameters<typeof accessOf>[0],
  ).plan
}

/** Upgrades only ever move up this list, which is what makes pricing deltas work. */
export function planRank(plan: PlanId): number {
  return PLAN_IDS.indexOf(plan)
}
