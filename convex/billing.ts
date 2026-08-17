import { v } from 'convex/values'
import { internalMutation, internalQuery, query } from './_generated/server'
import { getCurrentUser } from './model/auth'
import { accessOf } from './model/plans'
import { PLANS, isComped, planOf } from './model/plans'

// ── Billing ───────────────────────────────────────────────────────────────────
//
// Plans are a one-time purchase made through Stripe Checkout. The only writer
// of `plan` is the Stripe webhook (convex/http.ts → recordPurchase), reached
// through an internal mutation: nothing the browser can call is allowed to
// change an account's plan, or a user could grant themselves Agency by hand.

/** The signed-in account's plan and how much of it is in use. */
export const getMyPlan = query({
  args: {},
  handler: async (ctx) => {
    const user = await getCurrentUser(ctx)
    if (!user) return null

    const plan = planOf(user)

    const clients = await ctx.db
      .query('clients')
      .withIndex('by_user', (q) => q.eq('userId', user._id))
      .collect()

    const entries = await ctx.db
      .query('contentEntries')
      .withIndex('by_user', (q) => q.eq('userId', user._id))
      .collect()

    const access = accessOf(user)

    return {
      plan: plan.id,
      planName: plan.name,
      // The access window is the truth about what this account may do; `plan`
      // only says which tier's limits apply while it is open.
      status: access.state,
      accessUntil: access.until,
      daysLeft: access.daysLeft,
      canWrite: access.canWrite,
      purchasedAt: user.planPurchasedAt ?? null,
      isPaid: access.state === 'active' || access.state === 'comped',
      limits: {
        maxClients: plan.maxClients,
        maxEntries: plan.maxEntries,
        seats: plan.seats,
      },
      usage: {
        clients: clients.length,
        entries: entries.length,
      },
    }
  },
})

// ── Internal: written only by the Stripe webhook ──────────────────────────────

export const userByStripeCustomer = internalQuery({
  args: { stripeCustomerId: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query('users')
      .withIndex('by_stripe_customer', (q) =>
        q.eq('stripeCustomerId', args.stripeCustomerId),
      )
      .first()
  },
})

export const userByEmail = internalQuery({
  args: { email: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query('users')
      .filter((q) => q.eq(q.field('email'), args.email))
      .first()
  },
})

export const userByKindeId = internalQuery({
  args: { kindeId: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query('users')
      .withIndex('by_kinde_id', (q) => q.eq('kindeId', args.kindeId))
      .unique()
  },
})

/**
 * Apply a completed Stripe Checkout to an account.
 *
 * Idempotent on the checkout session id — Stripe retries webhooks, and a retry
 * must not look like a second purchase. Downgrades are ignored so a replayed
 * older event cannot take a plan away.
 */
export const recordPurchase = internalMutation({
  args: {
    kindeId: v.optional(v.string()),
    email: v.optional(v.string()),
    stripeCustomerId: v.optional(v.string()),
    checkoutSessionId: v.string(),
    plan: v.string(),
  },
  handler: async (ctx, args) => {
    // Prefer the id we put in the session metadata; fall back to customer, then
    // email, for sessions created outside the app (a payment link, say).
    let user = args.kindeId
      ? await ctx.db
          .query('users')
          .withIndex('by_kinde_id', (q) => q.eq('kindeId', args.kindeId!))
          .unique()
      : null

    if (!user && args.stripeCustomerId) {
      user = await ctx.db
        .query('users')
        .withIndex('by_stripe_customer', (q) =>
          q.eq('stripeCustomerId', args.stripeCustomerId!),
        )
        .first()
    }

    if (!user && args.email) {
      user = await ctx.db
        .query('users')
        .filter((q) => q.eq(q.field('email'), args.email!))
        .first()
    }

    if (!user) {
      console.error('[billing] no account matched checkout', args.checkoutSessionId)
      return { ok: false as const, reason: 'no-matching-user' as const }
    }

    if (user.lastCheckoutSessionId === args.checkoutSessionId) {
      return { ok: true as const, alreadyApplied: true as const }
    }

    const purchased = PLANS[args.plan as keyof typeof PLANS]
    if (!purchased) {
      console.error('[billing] unknown plan in checkout metadata:', args.plan)
      return { ok: false as const, reason: 'unknown-plan' as const }
    }

    await ctx.db.patch(user._id, {
      plan: purchased.id,
      planStatus: 'active',
      planPurchasedAt: new Date().toISOString(),
      lastCheckoutSessionId: args.checkoutSessionId,
      ...(args.stripeCustomerId ? { stripeCustomerId: args.stripeCustomerId } : {}),
    })

    return { ok: true as const, alreadyApplied: false as const, plan: purchased.id }
  },
})

/** Remembers the Stripe customer so a second purchase reuses it. */
export const linkStripeCustomer = internalMutation({
  args: { kindeId: v.string(), stripeCustomerId: v.string() },
  handler: async (ctx, args) => {
    const user = await ctx.db
      .query('users')
      .withIndex('by_kinde_id', (q) => q.eq('kindeId', args.kindeId))
      .unique()

    if (!user) return { ok: false }
    await ctx.db.patch(user._id, { stripeCustomerId: args.stripeCustomerId })
    return { ok: true }
  },
})
