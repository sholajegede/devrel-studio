// ── Plans ─────────────────────────────────────────────────────────────────────
//
// One definition of what each plan allows, imported by both the Convex
// functions that enforce the limits and the UI that displays them — so the
// pricing page and the actual gate can never drift apart.
//
// Plans are a one-time purchase, not a subscription, which is why there is no
// renewal or cancellation state here: an account either bought a plan or is on
// the free trial.

export type PlanId = 'free' | 'starter' | 'pro' | 'agency'

export const PLAN_IDS: PlanId[] = ['free', 'starter', 'pro', 'agency']

export interface PlanDefinition {
  id: PlanId
  name: string
  /** One-time price in whole dollars. */
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
    price: 49,
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
    price: 149,
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
    price: 349,
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
