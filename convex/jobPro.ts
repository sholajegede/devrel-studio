import { ConvexError, v } from 'convex/values'
import { internal } from './_generated/api'
import { Doc } from './_generated/dataModel'
import { mutation, query, QueryCtx } from './_generated/server'
import { getCurrentUser, requireCurrentUser } from './model/auth'
import { benchmarkFor, hiringSignals, type InsightJob } from '../lib/jobs/insights'
import { PRO_MONTHS, PRO_PRICE, proActive, tailorGate } from '../lib/jobs/pro'
import { logServerEvent } from './model/jobEvents'

const MONTH_MS = 30 * 24 * 60 * 60 * 1000

function toInsight(job: Doc<'jobs'>): InsightJob {
  return {
    title: job.title,
    family: job.family,
    seniority: job.seniority,
    regions: job.regions,
    workplace: job.workplace,
    companySlug: job.companySlug,
    companyName: job.companyName,
    slug: job.slug,
    postedAt: job.postedAt,
    salaryMinUsd: job.salaryMinUsd,
    salaryMaxUsd: job.salaryMaxUsd,
  }
}

/** Kits made so far, for the free allowance and the monthly fair-use cap. */
export async function kitUsage(ctx: QueryCtx, userId: Doc<'users'>['_id'], now: number) {
  const kits = await ctx.db
    .query('jobKits')
    .withIndex('by_user', (q) => q.eq('userId', userId))
    .order('desc')
    .take(400)
  const counted = kits.filter((kit) => kit.status !== 'failed')
  return {
    used: counted.length,
    usedThisMonth: counted.filter((kit) => now - kit.createdAt < MONTH_MS).length,
  }
}

export const status = query({
  args: {},
  handler: async (ctx) => {
    const user = await getCurrentUser(ctx)
    if (!user) return null
    const now = Date.now()
    const pro = proActive(user, now)
    const usage = await kitUsage(ctx, user._id, now)
    const requests = await ctx.db
      .query('jobProRequests')
      .withIndex('by_user', (q) => q.eq('userId', user._id))
      .collect()
    const open = requests.find((request) => request.status === 'open')
    return {
      pro,
      comped: Boolean(user.comped),
      until: user.jobsProUntil ?? null,
      gate: tailorGate({ pro, ...usage }),
      used: usage.used,
      request: open ? { currency: open.currency, amount: open.amount, createdAt: open.createdAt } : null,
    }
  },
})

export const requestPro = mutation({
  args: { currency: v.union(v.literal('USD'), v.literal('GBP'), v.literal('NGN')) },
  handler: async (ctx, args) => {
    const user = await requireCurrentUser(ctx)
    if (proActive(user)) throw new ConvexError('You already have Jobs Pro')
    const amount = PRO_PRICE[args.currency]
    await logServerEvent(ctx, user._id, { event: 'pro_requested', label: args.currency.toLowerCase() })
    const existing = await ctx.db
      .query('jobProRequests')
      .withIndex('by_user', (q) => q.eq('userId', user._id))
      .collect()
    const open = existing.find((request) => request.status === 'open')
    if (open) {
      await ctx.db.patch(open._id, { currency: args.currency, amount, createdAt: Date.now() })
      return open._id
    }
    const id = await ctx.db.insert('jobProRequests', {
      userId: user._id,
      email: user.email,
      name: [user.firstName, user.lastName].filter(Boolean).join(' ') || undefined,
      currency: args.currency,
      amount,
      months: PRO_MONTHS,
      status: 'open',
      createdAt: Date.now(),
    })
    await ctx.scheduler.runAfter(0, internal.email.sendAccessRequest, {
      email: user.email,
      name: [user.firstName, user.lastName].filter(Boolean).join(' ') || undefined,
      planName: 'Jobs Pro',
      months: PRO_MONTHS,
      currency: args.currency,
      amount,
    })
    return id
  },
})

export const cancelRequest = mutation({
  args: {},
  handler: async (ctx) => {
    const user = await requireCurrentUser(ctx)
    const requests = await ctx.db
      .query('jobProRequests')
      .withIndex('by_user', (q) => q.eq('userId', user._id))
      .collect()
    const open = requests.find((request) => request.status === 'open')
    if (open) await ctx.db.patch(open._id, { status: 'cancelled' })
  },
})

async function requirePro(ctx: QueryCtx) {
  const user = await getCurrentUser(ctx)
  if (!user) throw new ConvexError('Sign in first')
  if (!proActive(user)) throw new ConvexError('This is part of Jobs Pro')
  return user
}

export const benchmark = query({
  args: {
    family: v.string(),
    seniority: v.optional(v.string()),
    region: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await requirePro(ctx)
    const active = await ctx.db
      .query('jobs')
      .withIndex('by_status_and_posted', (q) => q.eq('status', 'active'))
      .take(3000)
    return benchmarkFor(active.map(toInsight), args)
  },
})

export const hiring = query({
  args: {},
  handler: async (ctx) => {
    await requirePro(ctx)
    const now = Date.now()
    const active = await ctx.db
      .query('jobs')
      .withIndex('by_status_and_posted', (q) => q.eq('status', 'active'))
      .take(3000)
    const expired = await ctx.db
      .query('jobs')
      .withIndex('by_status_and_posted', (q) => q.eq('status', 'expired'))
      .order('desc')
      .take(1500)
    const closed = expired.filter((job) => job.expiredAt && now - job.expiredAt < MONTH_MS)
    return hiringSignals(active.map(toInsight), closed, now)
  },
})
