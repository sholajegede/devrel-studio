import { ConvexError, v } from 'convex/values'
import { internal } from './_generated/api'
import { mutation, query } from './_generated/server'
import { getAdmin, requireAdmin } from './model/admin'

const SLUG = /^[a-z0-9][a-z0-9._-]{0,60}$/i

const kindValidator = v.union(v.literal('greenhouse'), v.literal('lever'), v.literal('ashby'))

export const overview = query({
  args: {},
  handler: async (ctx) => {
    if (!(await getAdmin(ctx))) return null

    const sources = await ctx.db.query('jobSources').collect()
    const stats = await ctx.db
      .query('jobStats')
      .withIndex('by_key', (q) => q.eq('key', 'current'))
      .first()

    const jobs = await ctx.db
      .query('jobs')
      .withIndex('by_status_and_posted', (q) => q.eq('status', 'active'))
      .take(5000)
    const clicks = jobs.reduce((total, job) => total + (job.clicks ?? 0), 0)
    const topClicked = [...jobs]
      .filter((job) => (job.clicks ?? 0) > 0)
      .sort((a, b) => (b.clicks ?? 0) - (a.clicks ?? 0))
      .slice(0, 10)
      .map((job) => ({ slug: job.slug, title: job.title, company: job.companyName, clicks: job.clicks ?? 0 }))

    return {
      activeJobs: jobs.length,
      clicks,
      topClicked,
      statsUpdatedAt: stats?.updatedAt ?? null,
      sources: sources
        .map((source) => ({
          _id: source._id,
          kind: source.kind,
          slug: source.slug,
          name: source.name,
          active: source.active,
          lastSyncedAt: source.lastSyncedAt ?? null,
          lastOk: source.lastOk ?? null,
          lastError: source.lastError ?? null,
          totalFetched: source.totalFetched ?? null,
          relevantCount: source.relevantCount ?? null,
          failures: source.failures,
        }))
        .sort((a, b) => (b.relevantCount ?? -1) - (a.relevantCount ?? -1) || a.name.localeCompare(b.name)),
    }
  },
})

export const seed = mutation({
  args: {},
  handler: async (ctx): Promise<{ added: number; total: number }> => {
    await requireAdmin(ctx, 'owner')
    const result: { added: number; total: number } = await ctx.runMutation(
      internal.jobSync.seedSources,
      {},
    )
    await ctx.scheduler.runAfter(0, internal.jobSync.syncAll, {})
    return result
  },
})

export const syncNow = mutation({
  args: { sourceId: v.optional(v.id('jobSources')) },
  handler: async (ctx, args) => {
    await requireAdmin(ctx)
    if (args.sourceId) {
      await ctx.db.patch(args.sourceId, { active: true })
      await ctx.scheduler.runAfter(0, internal.jobSync.syncSource, { sourceId: args.sourceId })
    } else {
      await ctx.scheduler.runAfter(0, internal.jobSync.syncAll, {})
    }
    await ctx.scheduler.runAfter(10 * 60 * 1000, internal.jobSync.refreshStats, {})
  },
})

export const refreshStatsNow = mutation({
  args: {},
  handler: async (ctx) => {
    await requireAdmin(ctx)
    await ctx.scheduler.runAfter(0, internal.jobSync.refreshStats, {})
  },
})

export const setActive = mutation({
  args: { sourceId: v.id('jobSources'), active: v.boolean() },
  handler: async (ctx, args) => {
    await requireAdmin(ctx, 'owner')
    await ctx.db.patch(args.sourceId, { active: args.active, failures: 0 })
  },
})

export const addSource = mutation({
  args: { kind: kindValidator, slug: v.string(), name: v.string() },
  handler: async (ctx, args) => {
    await requireAdmin(ctx, 'owner')
    const slug = args.slug.trim()
    const name = args.name.trim().slice(0, 80)
    if (!SLUG.test(slug) || !name) throw new ConvexError('Enter the board slug and a company name')

    const existing = await ctx.db
      .query('jobSources')
      .withIndex('by_kind_and_slug', (q) => q.eq('kind', args.kind).eq('slug', slug))
      .first()
    if (existing) throw new ConvexError('That board is already tracked')

    const sourceId = await ctx.db.insert('jobSources', {
      kind: args.kind,
      slug,
      name,
      active: true,
      failures: 0,
      createdAt: Date.now(),
    })
    await ctx.scheduler.runAfter(0, internal.jobSync.syncSource, { sourceId })
    return sourceId
  },
})
