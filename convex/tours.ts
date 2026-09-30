import { v } from 'convex/values'
import { mutation, query, MutationCtx, QueryCtx } from './_generated/server'
import { getCurrentUser } from './model/auth'

const MAX_RUNS = 10
const TOURS = ['jobs-public', 'jobs-discover', 'jobs-tracker']

async function find(ctx: QueryCtx, subject: string, tour: string) {
  return ctx.db
    .query('tourState')
    .withIndex('by_subject_and_tour', (q) => q.eq('subject', subject).eq('tour', tour))
    .first()
}

async function record(ctx: MutationCtx, subject: string, tour: string, event: 'start' | 'done') {
  if (!TOURS.includes(tour)) return
  const row = await find(ctx, subject, tour)
  const now = Date.now()
  if (!row) {
    await ctx.db.insert('tourState', {
      subject,
      tour,
      runs: event === 'start' ? 1 : 0,
      done: event === 'done',
      updatedAt: now,
    })
    return
  }
  await ctx.db.patch(row._id, {
    runs: event === 'start' ? Math.min(MAX_RUNS, row.runs + 1) : row.runs,
    done: row.done || event === 'done',
    updatedAt: now,
  })
}

// ── Signed-in accounts ────────────────────────────────────────────────────────

export const mine = query({
  args: { tour: v.string() },
  handler: async (ctx, args) => {
    const user = await getCurrentUser(ctx)
    if (!user) return null
    const row = await find(ctx, `user:${user._id}`, args.tour)
    return { runs: row?.runs ?? 0, done: row?.done ?? false }
  },
})

export const mark = mutation({
  args: { tour: v.string(), event: v.union(v.literal('start'), v.literal('done')) },
  handler: async (ctx, args) => {
    const user = await getCurrentUser(ctx)
    if (!user) return
    await record(ctx, `user:${user._id}`, args.tour, args.event)
  },
})

// ── Hashed IP addresses, called only by the site's own /api/tours route ──────

function allowed(secret: string): boolean {
  const expected = process.env.TOURS_SECRET
  return Boolean(expected) && secret === expected
}

export const ipGet = query({
  args: { secret: v.string(), hash: v.string(), tour: v.string() },
  handler: async (ctx, args) => {
    if (!allowed(args.secret) || args.hash.length > 128) return { runs: 0, done: false }
    const row = await find(ctx, `ip:${args.hash}`, args.tour)
    return { runs: row?.runs ?? 0, done: row?.done ?? false }
  },
})

export const ipMark = mutation({
  args: {
    secret: v.string(),
    hash: v.string(),
    tour: v.string(),
    event: v.union(v.literal('start'), v.literal('done')),
  },
  handler: async (ctx, args) => {
    if (!allowed(args.secret) || args.hash.length > 128) return
    await record(ctx, `ip:${args.hash}`, args.tour, args.event)
  },
})
