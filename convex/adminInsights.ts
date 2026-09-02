import { v } from 'convex/values'
import { query } from './_generated/server'
import { Doc, Id } from './_generated/dataModel'
import { requireAdmin } from './model/admin'

// ── Admin: the platform's own traffic, and everything on it ───────────────────
//
// Two questions the console could not answer, both about the product rather
// than about its customers:
//
//   Which of my own pages do people actually open?
//   What is everybody putting into this thing?
//
// The first was invisible: the view counter had been sitting in the proxy since
// the analytics phase, seeing every request, and recording only client
// dashboards and portfolios. The second was visible one workspace at a time and
// never in aggregate, which is the shape that tells you what the product is
// really for.

const DAY = 86_400_000

/**
 * Traffic to devrel.studio itself.
 *
 * Reads the same `pageViews` table every other view goes into, filtered to the
 * 'site' surface. Rows carry a route rather than a URL — `/dashboard/edit/:id`,
 * not the id — because a table keyed on identifiers is one nobody can group and
 * one somebody could work backwards from.
 *
 * Uniques are counted on the daily-rotating visitor hash, so the number means
 * "distinct people today" and cannot be joined across days by design. Two days
 * of traffic from one person is two uniques, and that is the honest reading of
 * a hash that deliberately does not persist.
 */
export const traffic = query({
  args: { days: v.optional(v.number()) },
  handler: async (ctx, args) => {
    await requireAdmin(ctx)

    const days = Math.min(Math.max(args.days ?? 30, 1), 90)
    const since = Date.now() - days * DAY

    const views = await ctx.db
      .query('pageViews')
      .withIndex('by_time', (q) => q.gte('at', since))
      .collect()

    const site = views.filter((view) => view.surface === 'site')

    const routes = new Map<string, { views: number; visitors: Set<string> }>()
    const referrers = new Map<string, number>()
    const countries = new Map<string, number>()
    const byDay = new Map<string, { views: number; visitors: Set<string> }>()
    const visitors = new Set<string>()

    for (const view of site) {
      visitors.add(view.visitorHash)

      const route = routes.get(view.path) ?? { views: 0, visitors: new Set<string>() }
      route.views += 1
      route.visitors.add(view.visitorHash)
      routes.set(view.path, route)

      if (view.referrer) referrers.set(view.referrer, (referrers.get(view.referrer) ?? 0) + 1)
      if (view.country) countries.set(view.country, (countries.get(view.country) ?? 0) + 1)

      const day = new Date(view.at).toISOString().slice(0, 10)
      const bucket = byDay.get(day) ?? { views: 0, visitors: new Set<string>() }
      bucket.views += 1
      bucket.visitors.add(view.visitorHash)
      byDay.set(day, bucket)
    }

    // Every day in the window, including the quiet ones. A series with gaps
    // where nothing happened draws a chart that lies about its own shape.
    const series: { day: string; views: number; visitors: number }[] = []
    for (let index = days - 1; index >= 0; index--) {
      const day = new Date(Date.now() - index * DAY).toISOString().slice(0, 10)
      const bucket = byDay.get(day)
      series.push({ day, views: bucket?.views ?? 0, visitors: bucket?.visitors.size ?? 0 })
    }

    return {
      days,
      views: site.length,
      visitors: visitors.size,
      routes: [...routes.entries()]
        .map(([path, stats]) => ({ path, views: stats.views, visitors: stats.visitors.size }))
        .sort((a, b) => b.views - a.views)
        .slice(0, 25),
      referrers: [...referrers.entries()]
        .map(([host, count]) => ({ host, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 10),
      countries: [...countries.entries()]
        .map(([code, count]) => ({ code, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 10),
      series,
      /** What the other two surfaces did in the same window, for context. */
      elsewhere: {
        dashboards: views.filter((view) => view.surface === 'dashboard').length,
        portfolios: views.filter((view) => view.surface === 'portfolio').length,
      },
    }
  },
})

/**
 * Everything anybody has logged, across every workspace.
 *
 * Not a reading tool. An admin does not need to know what a customer wrote, and
 * the row here carries a title and a link because those are what make an entry
 * identifiable when somebody writes in about it — the metrics beside it are the
 * point: what people track, on which platforms, and whether the product is being
 * used for what it was built for.
 *
 * Bounded by `take`, newest first, because this is the one table that grows with
 * every customer's daily work rather than with the number of customers.
 */
export const content = query({
  args: {
    limit: v.optional(v.number()),
    // Typed as the schema types them, not as strings: a filter that can hold a
    // value the column cannot is a filter that silently returns nothing.
    category: v.optional(
      v.union(
        v.literal('Written'),
        v.literal('Video'),
        v.literal('Event'),
        v.literal('Podcast'),
        v.literal('Package'),
        v.literal('Demo'),
      ),
    ),
    status: v.optional(
      v.union(
        v.literal('Published'),
        v.literal('Draft'),
        v.literal('Waiting Approval'),
        v.literal('Scheduled'),
      ),
    ),
  },
  handler: async (ctx, args) => {
    await requireAdmin(ctx)

    const limit = Math.min(Math.max(args.limit ?? 50, 1), 200)

    // Filtered reads go through the indexes that exist for them; the unfiltered
    // one takes the newest page in insertion order.
    const rows = args.category
      ? await ctx.db
          .query('contentEntries')
          .withIndex('by_category', (q) => q.eq('category', args.category!))
          .order('desc')
          .take(limit)
      : args.status
        ? await ctx.db
            .query('contentEntries')
            .withIndex('by_status', (q) => q.eq('status', args.status!))
            .order('desc')
            .take(limit)
        : await ctx.db.query('contentEntries').order('desc').take(limit)

    // Resolved once per distinct workspace rather than once per row: fifty
    // entries from one workspace is one read, not fifty.
    const workspaceNames = new Map<string, string>()
    const resolve = async (id: Id<'workspaces'> | undefined) => {
      if (!id) return null
      const cached = workspaceNames.get(id)
      if (cached) return cached
      const workspace = await ctx.db.get(id)
      const name = workspace?.name ?? 'deleted workspace'
      workspaceNames.set(id, name)
      return name
    }

    const entries = await Promise.all(
      rows.map(async (entry: Doc<'contentEntries'>) => ({
        id: entry._id,
        title: entry.title,
        url: entry.link || null,
        category: entry.category,
        platform: entry.platform ?? null,
        status: entry.status ?? null,
        client: entry.client ?? null,
        publicationDate: entry.publicationDate ?? null,
        workspaceId: entry.workspaceId ?? null,
        workspace: await resolve(entry.workspaceId),
        at: entry._creationTime,
      })),
    )

    return { entries }
  },
})

/**
 * The shape of what is in the product, rather than a page of it.
 *
 * Counted over the whole table on purpose: a distribution taken from the newest
 * fifty rows is a distribution of this week, which is exactly the number
 * somebody would misread as the distribution of everything.
 */
export const contentShape = query({
  args: {},
  handler: async (ctx) => {
    await requireAdmin(ctx)

    const entries = await ctx.db.query('contentEntries').collect()

    const tally = (pick: (entry: Doc<'contentEntries'>) => string | undefined) => {
      const counts = new Map<string, number>()
      for (const entry of entries) {
        const key = pick(entry)
        if (!key) continue
        counts.set(key, (counts.get(key) ?? 0) + 1)
      }
      return [...counts.entries()]
        .map(([key, count]) => ({ key, count }))
        .sort((a, b) => b.count - a.count)
    }

    const now = Date.now()
    const lastWeek = entries.filter((entry) => now - entry._creationTime < 7 * DAY).length
    const lastMonth = entries.filter((entry) => now - entry._creationTime < 30 * DAY).length

    return {
      total: entries.length,
      lastWeek,
      lastMonth,
      categories: tally((entry) => entry.category),
      platforms: tally((entry) => entry.platform),
      statuses: tally((entry) => entry.status),
    }
  },
})

/**
 * Accounts created over time.
 *
 * The one growth number the console had no way to show. Read from
 * `_creationTime`, which every Convex row carries and nothing can rewrite — a
 * signup count kept in a counter somewhere would be a number that drifts.
 */
export const signups = query({
  args: { days: v.optional(v.number()) },
  handler: async (ctx, args) => {
    await requireAdmin(ctx)

    const days = Math.min(Math.max(args.days ?? 30, 1), 365)
    const since = Date.now() - days * DAY

    const users = await ctx.db.query('users').collect()
    const recent = users.filter((user) => user._creationTime >= since)

    const byDay = new Map<string, number>()
    for (const user of recent) {
      const day = new Date(user._creationTime).toISOString().slice(0, 10)
      byDay.set(day, (byDay.get(day) ?? 0) + 1)
    }

    const series: { day: string; count: number }[] = []
    for (let index = days - 1; index >= 0; index--) {
      const day = new Date(Date.now() - index * DAY).toISOString().slice(0, 10)
      series.push({ day, count: byDay.get(day) ?? 0 })
    }

    return { days, total: users.length, inPeriod: recent.length, series }
  },
})
