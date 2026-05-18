import { ConvexError, v } from 'convex/values'
import { mutation, query } from './_generated/server'

const statusValidator = v.union(
  v.literal('Active'),
  v.literal('Paused'),
  v.literal('Ended'),
)

const contractTypeValidator = v.optional(v.union(
  v.literal('Retainer'),
  v.literal('Project'),
  v.literal('Hourly'),
))

const clientFields = {
  name: v.string(),
  company: v.string(),
  email: v.optional(v.string()),
  website: v.optional(v.string()),
  monthlyRetainer: v.optional(v.number()),
  currency: v.optional(v.string()),
  startDate: v.optional(v.string()),
  endDate: v.optional(v.string()),
  status: statusValidator,
  contractType: contractTypeValidator,
  notes: v.optional(v.string()),
  slug: v.optional(v.string()),
}

export const getClients = query({
  args: { userId: v.id('users') },
  handler: async (ctx, args) => {
    return await ctx.db
      .query('clients')
      .withIndex('by_user', (q) => q.eq('userId', args.userId))
      .order('desc')
      .collect()
  },
})

export const getClientById = query({
  args: { clientId: v.id('clients') },
  handler: async (ctx, args) => {
    const client = await ctx.db.get(args.clientId)
    if (!client) throw new ConvexError('Client not found')
    return client
  },
})

export const createClient = mutation({
  args: {
    userId: v.id('users'),
    ...clientFields,
  },
  handler: async (ctx, args) => {
    const slug = args.slug ?? args.company.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '')
    return await ctx.db.insert('clients', {
      ...args,
      slug,
    })
  },
})

export const updateClient = mutation({
  args: {
    clientId: v.id('clients'),
    ...clientFields,
  },
  handler: async (ctx, args) => {
    const { clientId, ...fields } = args
    const existing = await ctx.db.get(clientId)
    if (!existing) throw new ConvexError('Client not found')
    await ctx.db.patch(clientId, fields)
    return clientId
  },
})

export const deleteClient = mutation({
  args: { clientId: v.id('clients') },
  handler: async (ctx, args) => {
    const client = await ctx.db.get(args.clientId)
    if (!client) throw new ConvexError('Client not found')
    await ctx.db.delete(args.clientId)
  },
})

export const getActiveClients = query({
  args: { userId: v.id('users') },
  handler: async (ctx, args) => {
    return await ctx.db
      .query('clients')
      .withIndex('by_user', (q) => q.eq('userId', args.userId))
      .filter((q) => q.eq(q.field('status'), 'Active'))
      .collect()
  },
})
