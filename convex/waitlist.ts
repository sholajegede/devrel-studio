import { internalMutation, internalQuery, mutation } from './_generated/server'
import { internal } from './_generated/api'
import { v } from 'convex/values'

// Signup list — joining is the only public surface. Reading the list (names,
// emails, companies), counting it and removing entries are all internal until
// there is an admin role to check against.

export const getWaitlist = internalQuery({
  args: {},
  handler: async (ctx) => {
    return await ctx.db
      .query('waitlist')
      .order('desc')
      .collect()
  },
})

export const getWaitlistByEmail = internalQuery({
  args: { email: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query('waitlist')
      .filter((q) => q.eq(q.field('email'), args.email))
      .unique()
  },
})

export const addToWaitlist = mutation({
  args: {
    email: v.string(),
    name: v.optional(v.string()),
    company: v.optional(v.string()),
    role: v.optional(v.string()),
    useCase: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const email = args.email.trim().toLowerCase()

    const existing = await ctx.db
      .query('waitlist')
      .withIndex('by_email', (q) => q.eq('email', email))
      .first()

    // Signing up twice is not an error worth surfacing — the caller reports
    // success either way, and throwing here would also let anyone probe which
    // emails are already on the list.
    if (existing) {
      return { ok: true as const, alreadyJoined: true as const, id: existing._id }
    }

    const id = await ctx.db.insert('waitlist', {
      email,
      name: args.name,
      company: args.company,
      role: args.role,
      useCase: args.useCase
    })

    // Scheduled rather than awaited: an email provider having a bad minute must
    // not roll back a signup that already succeeded. Only new signups get mail,
    // so joining twice does not send twice.
    await ctx.scheduler.runAfter(0, internal.email.sendWaitlistConfirmation, {
      email,
      name: args.name,
    })

    return { ok: true as const, alreadyJoined: false as const, id }
  },
})

export const removeFromWaitlist = internalMutation({
  args: { id: v.id('waitlist') },
  handler: async (ctx, args) => {
    await ctx.db.delete(args.id)
    return args.id
  },
})

/**
 * Internal only. Signup totals are a business metric, not something a visitor
 * should be able to read off the public Convex API — and nothing in the UI has
 * ever called this. Reach it with `npx convex run waitlist:getWaitlistCount`.
 */
export const getWaitlistCount = internalQuery({
  args: {},
  handler: async (ctx) => {
    const entries = await ctx.db.query('waitlist').collect()
    return entries.length
  },
})