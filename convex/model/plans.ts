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

export function planOf(
  user: { _id?: string; kindeId?: string; plan?: string; planStatus?: string } | null,
): PlanDefinition {
  // Comped accounts get the top plan regardless of what `plan` says, so every
  // limit check downstream (clients, entries, seats) passes untouched.
  if (isComped(user)) return PLANS.agency
  if (!user?.plan || !isPlanId(user.plan)) return PLANS.free
  if (user.planStatus && user.planStatus !== 'active') return PLANS.free
  return PLANS[user.plan]
}

/** Upgrades only ever move up this list, which is what makes pricing deltas work. */
export function planRank(plan: PlanId): number {
  return PLAN_IDS.indexOf(plan)
}
