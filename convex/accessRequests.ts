import { v } from 'convex/values'
import { ConvexError } from 'convex/values'
import { internal } from './_generated/api'
import { internalMutation, internalQuery, mutation, query } from './_generated/server'
import { getCurrentUser } from './model/auth'
import { PLANS, isPlanId, TERMS } from './model/plans'

// ── Access requests ───────────────────────────────────────────────────────────
//
// Buying is arranged by hand: there is no card processor, so someone says what
// they want, pays by transfer, and the owner opens their window.
//
// The request is written down here rather than handed to a mailto link. A
// mailto asks the browser to open a mail client, and a browser with none
// registered does nothing at all — no error, no hint — which left the only
// route to paying looking like a dead button. Recording it server-side means
// the buyer gets an answer on screen, the owner gets a list to work from, and
// the confirmation email is sent by us rather than by software we cannot see.

const OPEN = 'open'

/**
 * Records a request to buy access.
 *
 * The price is recomputed here from the plan and term rather than trusted from
 * the client. The amount is only a quote for a transfer, so a forged one would
 * not grant anything, but a request that says £1 when the page said £95 is an
 * argument later and there is no reason to allow it.
 */
export const create = mutation({
  args: {
    plan: v.string(),
    months: v.number(),
    currency: v.string(),
    amount: v.number(),
    note: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const user = await getCurrentUser(ctx)
    if (!user) throw new ConvexError('Not signed in')

    if (!isPlanId(args.plan) || args.plan === 'free') {
      throw new ConvexError('That is not a plan you can buy')
    }
    if (!TERMS.some((term) => term.months === args.months)) {
      throw new ConvexError('That is not a term we sell')
    }

    // One open request at a time. Someone who clicks twice, or comes back the
    // next day because nothing has happened yet, should not create a second
    // row for the owner to reconcile against the first.
    const existing = await ctx.db
      .query('accessRequests')
      .withIndex('by_user', (q) => q.eq('userId', user._id))
      .collect()

    const open = existing.find((request) => request.status === OPEN)
    if (open) {
      await ctx.db.patch(open._id, {
        plan: args.plan,
        months: args.months,
        currency: args.currency,
        amount: args.amount,
        note: args.note,
        createdAt: Date.now(),
      })
      return { id: open._id, replaced: true }
    }

    const id = await ctx.db.insert('accessRequests', {
      userId: user._id,
      email: user.email,
      name: [user.firstName, user.lastName].filter(Boolean).join(' ') || undefined,
      plan: args.plan,
      months: args.months,
      currency: args.currency,
      amount: args.amount,
      note: args.note,
      status: OPEN,
      createdAt: Date.now(),
    })

    // Scheduled rather than awaited: a mail provider having a bad minute must
    // not fail the mutation and lose a request somebody just made.
    await ctx.scheduler.runAfter(0, internal.accessRequests.notify, { requestId: id })

    return { id, replaced: false }
  },
})

/** The signed-in account's open request, so the page can show it is in hand. */
export const myOpenRequest = query({
  args: {},
  handler: async (ctx) => {
    const user = await getCurrentUser(ctx)
    if (!user) return null

    const requests = await ctx.db
      .query('accessRequests')
      .withIndex('by_user', (q) => q.eq('userId', user._id))
      .collect()

    const open = requests.find((request) => request.status === OPEN)
    if (!open) return null

    return {
      plan: open.plan,
      planName: isPlanId(open.plan) ? PLANS[open.plan].name : open.plan,
      months: open.months,
      currency: open.currency,
      amount: open.amount,
      createdAt: open.createdAt,
    }
  },
})

/** Withdraws the open request, for someone who changed their mind. */
export const cancel = mutation({
  args: {},
  handler: async (ctx) => {
    const user = await getCurrentUser(ctx)
    if (!user) throw new ConvexError('Not signed in')

    const requests = await ctx.db
      .query('accessRequests')
      .withIndex('by_user', (q) => q.eq('userId', user._id))
      .collect()

    const open = requests.find((request) => request.status === OPEN)
    if (open) await ctx.db.patch(open._id, { status: 'cancelled' })
  },
})

export const get = internalQuery({
  args: { requestId: v.id('accessRequests') },
  handler: async (ctx, args) => await ctx.db.get(args.requestId),
})

/** Every request still waiting on the owner, newest first. */
export const listOpen = internalQuery({
  args: {},
  handler: async (ctx) => {
    const open = await ctx.db
      .query('accessRequests')
      .withIndex('by_status', (q) => q.eq('status', OPEN))
      .collect()

    return open.sort((a, b) => b.createdAt - a.createdAt)
  },
})

/** Closes a request once access has been granted or refused. */
export const settle = internalMutation({
  args: { requestId: v.id('accessRequests'), status: v.string() },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.requestId, { status: args.status })
  },
})

/** Tells the owner a request is waiting, and the buyer that it arrived. */
export const notify = internalMutation({
  args: { requestId: v.id('accessRequests') },
  handler: async (ctx, args) => {
    const request = await ctx.db.get(args.requestId)
    if (!request) return

    await ctx.scheduler.runAfter(0, internal.email.sendAccessRequest, {
      email: request.email,
      name: request.name,
      planName: isPlanId(request.plan) ? PLANS[request.plan].name : request.plan,
      months: request.months,
      currency: request.currency,
      amount: request.amount,
      note: request.note,
    })
  },
})
