import { mutation, query } from './_generated/server'
import { v } from 'convex/values'

export const getWaitlist = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db
      .query('waitlist')
      .order('desc')
      .collect()
  },
})

export const getWaitlistByEmail = query({
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
    const existing = await ctx.db
      .query('waitlist')
      .filter((q) => q.eq(q.field('email'), args.email))
      .unique()

    if (existing) {
      throw new Error('Email already on waitlist')
    }

    const id = await ctx.db.insert('waitlist', {
      email: args.email,
      name: args.name,
      company: args.company,
      role: args.role,
      useCase: args.useCase
    })

    return id
  },
})

export const removeFromWaitlist = mutation({
  args: { id: v.id('waitlist') },
  handler: async (ctx, args) => {
    await ctx.db.delete(args.id)
    return args.id
  },
})

export const getWaitlistCount = query({
  args: {},
  handler: async (ctx) => {
    const entries = await ctx.db.query('waitlist').collect()
    return entries.length
  },
})