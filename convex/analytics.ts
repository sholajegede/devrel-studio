import { v } from 'convex/values'
import { internalMutation, mutation, query } from './_generated/server'
import type { Doc, Id } from './_generated/dataModel'
import type { MutationCtx, QueryCtx } from './_generated/server'
import { requireWorkspace } from './model/workspaces'
import { enforceRateLimit } from './model/rateLimit'

// ── Reading the room ──────────────────────────────────────────────────────────
//
// Everything the DevRel's /dashboard/analytics section reads and writes.
//
// The write path is unauthenticated by necessity: the people being counted are
// managers with no account and anonymous portfolio readers, so nothing here can
// lean on ctx.auth. It is protected instead by being uninteresting to forge
// (the worst outcome is a wrong number on one person's own dashboard), by a
// rate limit, and by never accepting a workspace id from the caller — ownership
// is resolved server-side from the slug or handle.

const DAY_MS = 24 * 60 * 60 * 1000

/** A visitor still counts as "here" this long after their last page view. */
const LIVE_WINDOW_MS = 5 * 60 * 1000

/**
 * Two hits from the same visitor on the same path inside this window are one
 * view. Next prefetches links on hover and the proxy sees every one of them; a
 * manager who hovers the report link three times did not read it three times.
 */
const DEDUPE_WINDOW_MS = 10 * 1000

// ── Write ─────────────────────────────────────────────────────────────────────

/**
 * ⚠ PUBLIC — unauthenticated, called from the proxy and the portfolio beacon.
 *
 * Resolves who owns the viewed surface, decides whether the visitor can be
 * attributed to a named manager, and records one view.
 */
export const record = mutation({
  args: {
    surface: v.union(v.literal('dashboard'), v.literal('portfolio')),
    target: v.string(),
    path: v.string(),
    visitorHash: v.string(),
    /** Hashed manager session cookie, when the visitor presented one. */
    sessionTokenHash: v.optional(v.string()),
    country: v.optional(v.string()),
    referrer: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const target = args.target.toLowerCase()

    // A visitor hash is one IP+UA for one day. 600/hour is far above any real
    // browsing and still bounds what a script can insert.
    await enforceRateLimit(
      ctx,
      'analytics:record',
      args.visitorHash,
      600,
      'Too many requests',
    )

    const owner = await resolveOwner(ctx, args.surface, target)
    // Nothing owns this slug or handle. The wildcard answers for every name
    // under the domain, so without this a script could fill the table by
    // hitting invented subdomains.
    if (!owner) return null

    const recent = await ctx.db
      .query('pageViews')
      .withIndex('by_target_and_visitor', (q) =>
        q.eq('target', target).eq('visitorHash', args.visitorHash),
      )
      .order('desc')
      .first()

    const now = Date.now()
    if (
      recent &&
      recent.path === args.path &&
      now - recent.at < DEDUPE_WINDOW_MS
    ) {
      return recent._id
    }

    // A session cookie only proves manager access for the client it was issued
    // to. Checking the clientId matches stops a code for one dashboard being
    // presented at another and showing up as that client's manager.
    let identity: 'manager' | 'anonymous' = 'anonymous'
    if (args.sessionTokenHash && owner.clientId) {
      const session = await ctx.db
        .query('managerSessions')
        .withIndex('by_token_hash', (q) => q.eq('tokenHash', args.sessionTokenHash!))
        .first()
      if (session && session.expiresAt > now && session.clientId === owner.clientId) {
        identity = 'manager'
      }
    }

    return await ctx.db.insert('pageViews', {
      surface: args.surface,
      workspaceId: owner.workspaceId,
      userId: owner.userId,
      clientId: owner.clientId,
      target,
      path: args.path,
      identity,
      visitorHash: args.visitorHash,
      country: args.country,
      referrer: args.referrer,
      at: now,
    })
  },
})

/**
 * ⚠ PUBLIC — records how long a visit lasted.
 *
 * Sent on unload, so it arrives separately from the view it belongs to and has
 * to find it again. Dwell time is the single most valuable number here: it is
 * what separates "the report was opened" from "the report was read".
 */
export const recordDuration = mutation({
  args: {
    target: v.string(),
    visitorHash: v.string(),
    durationMs: v.number(),
  },
  handler: async (ctx, args) => {
    // A page open for over an hour is a forgotten tab, not attention.
    if (args.durationMs <= 0 || args.durationMs > 60 * 60 * 1000) return

    const view = await ctx.db
      .query('pageViews')
      .withIndex('by_target_and_visitor', (q) =>
        q.eq('target', args.target.toLowerCase()).eq('visitorHash', args.visitorHash),
      )
      .order('desc')
      .first()

    if (!view) return
    // Only ever extend. Two beacons can race on the same view, and the longer
    // of the two is the one that reflects the whole visit.
    if (view.durationMs && view.durationMs >= args.durationMs) return
    await ctx.db.patch(view._id, { durationMs: args.durationMs })
  },
})

/**
 * Which workspace a viewed surface belongs to.
 *
 * Resolved here rather than trusted from the caller — it is the only thing
 * stopping an unauthenticated write from landing in someone else's analytics.
 */
async function resolveOwner(
  ctx: MutationCtx,
  surface: 'dashboard' | 'portfolio',
  target: string,
): Promise<{
  workspaceId?: Id<'workspaces'>
  userId?: Id<'users'>
  clientId?: Id<'clients'>
} | null> {
  if (surface === 'dashboard') {
    const client = await ctx.db
      .query('clients')
      .withIndex('by_slug', (q) => q.eq('slug', target))
      .first()
    if (!client) return null
    return {
      workspaceId: client.workspaceId,
      userId: client.userId,
      clientId: client._id,
    }
  }

  const user = await ctx.db
    .query('users')
    .withIndex('by_handle', (q) => q.eq('handle', target))
    .first()
  if (!user) return null

  // A portfolio belongs to a person, not a client. Attributing it to their
  // active workspace is what puts it on the same page as their client numbers.
  const membership = await ctx.db
    .query('memberships')
    .withIndex('by_user', (q) => q.eq('userId', user._id))
    .first()

  return {
    workspaceId: user.activeWorkspaceId ?? membership?.workspaceId,
    userId: user._id,
  }
}

// ── Read ──────────────────────────────────────────────────────────────────────

/** Views for the signed-in workspace, newest first, within `days`. */
async function viewsInWindow(
  ctx: QueryCtx,
  workspaceId: Id<'workspaces'>,
  days: number,
): Promise<Doc<'pageViews'>[]> {
  const since = Date.now() - days * DAY_MS
  return await ctx.db
    .query('pageViews')
    .withIndex('by_workspace_and_time', (q) =>
      q.eq('workspaceId', workspaceId).gte('at', since),
    )
    .order('desc')
    .collect()
}

function uniqueBy<T>(rows: T[], key: (row: T) => string): number {
  return new Set(rows.map(key)).size
}

function tally<T>(rows: T[], key: (row: T) => string | undefined) {
  const counts = new Map<string, number>()
  for (const row of rows) {
    const k = key(row)
    if (!k) continue
    counts.set(k, (counts.get(k) ?? 0) + 1)
  }
  return [...counts.entries()]
    .map(([label, count]) => ({ label, count }))
    .sort((a, b) => b.count - a.count)
}

/**
 * Everything the stat tiles, the chart and the breakdown lists need, in one
 * query — the whole section reads a single subscription rather than seven, so
 * a new view animates every panel at once instead of in a ripple.
 */
export const overview = query({
  args: { days: v.optional(v.number()) },
  handler: async (ctx, args) => {
    const context = await requireWorkspace(ctx)
    const days = args.days ?? 14

    // The window is fetched twice: once for the chart, once for all-time
    // totals. All-time is capped at a year so a long-lived workspace does not
    // grow an unbounded read.
    const windowed = await viewsInWindow(ctx, context.workspaceId, days)
    const allTime = await viewsInWindow(ctx, context.workspaceId, 365)

    const now = Date.now()
    const last7 = windowed.filter((view) => view.at >= now - 7 * DAY_MS)

    // Days are bucketed in UTC, which is what "views today · since midnight
    // UTC" in the tile means. Local-day bucketing would make the number move
    // when the DevRel travels.
    const byDay = new Map<string, { views: number; visitors: Set<string> }>()
    for (let i = days - 1; i >= 0; i--) {
      const key = new Date(now - i * DAY_MS).toISOString().slice(0, 10)
      byDay.set(key, { views: 0, visitors: new Set() })
    }
    for (const view of windowed) {
      const key = new Date(view.at).toISOString().slice(0, 10)
      const bucket = byDay.get(key)
      if (!bucket) continue
      bucket.views += 1
      bucket.visitors.add(view.visitorHash)
    }

    const series = [...byDay.entries()].map(([date, bucket]) => ({
      date,
      views: bucket.views,
      visitors: bucket.visitors.size,
    }))

    const todayKey = new Date(now).toISOString().slice(0, 10)
    const today = series.find((point) => point.date === todayKey)

    // Peak day is computed over all-time rather than the visible window, so the
    // tile does not silently reset when the range selector changes.
    const allTimeByDay = new Map<string, number>()
    for (const view of allTime) {
      const key = new Date(view.at).toISOString().slice(0, 10)
      allTimeByDay.set(key, (allTimeByDay.get(key) ?? 0) + 1)
    }
    const peak = [...allTimeByDay.entries()].sort((a, b) => b[1] - a[1])[0]

    const dashboardViews = last7.filter((view) => view.surface === 'dashboard')
    const portfolioViews = last7.filter((view) => view.surface === 'portfolio')

    // Only views that reported a duration can contribute — a visitor who
    // closed the tab abruptly sent no beacon, and averaging their visit in as
    // zero would understate every other one.
    const timed = last7.filter((view) => typeof view.durationMs === 'number')
    const medianDwellMs = median(timed.map((view) => view.durationMs!))

    return {
      days,
      tiles: {
        viewsToday: today?.views ?? 0,
        visitors7d: uniqueBy(last7, (view) => view.visitorHash),
        views7d: last7.length,
        dashboardViews7d: dashboardViews.length,
        portfolioViews7d: portfolioViews.length,
        managerViews7d: last7.filter((view) => view.identity === 'manager').length,
        medianDwellMs,
        peakDay: peak ? { date: peak[0], views: peak[1] } : null,
        allTimeViews: allTime.length,
        allTimeVisitors: uniqueBy(allTime, (view) => view.visitorHash),

        /**
         * All-time opens of a monthly report page.
         *
         * The most product-specific number on the page: it counts the thing the
         * whole engagement is judged on actually being read, rather than the
         * dashboard merely being loaded. `/reports` (the archive index) is
         * excluded — browsing the list is not reading a report.
         */
        reportsRead: allTime.filter(
          (view) => view.surface === 'dashboard' && isReportPath(view.path),
        ).length,

        since: allTime.length ? allTime[allTime.length - 1].at : null,
      },
      series,
      breakdowns: {
        byClient: tally(dashboardViews, (view) => view.target),
        byReferrer: tally(last7, (view) => view.referrer ?? 'direct'),
        byCountry: tally(last7, (view) => view.country),
        byPath: tally(portfolioViews, (view) => view.path),
      },
    }
  },
})

/**
 * A single monthly report, not the archive that lists them.
 *
 * `/reports` starts with `/report`, so a naive prefix test counts every visit to
 * the index as a report being read.
 */
export function isReportPath(path: string): boolean {
  return path === '/report' || path.startsWith('/report/')
}

function median(values: number[]): number | null {
  if (!values.length) return null
  const sorted = [...values].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  return sorted.length % 2
    ? sorted[mid]
    : Math.round((sorted[mid - 1] + sorted[mid]) / 2)
}

/**
 * The attention log — one row per view, newest first.
 *
 * This is the panel the section exists for. At this volume an individual event
 * carries more than any aggregate: "Acme's manager read the January report for
 * six minutes on Tuesday afternoon" is the thing a DevRel wants to know, and no
 * chart of 40 monthly views will ever say it.
 */
export const recentActivity = query({
  args: { limit: v.optional(v.number()) },
  handler: async (ctx, args) => {
    const context = await requireWorkspace(ctx)
    const limit = Math.min(args.limit ?? 40, 100)

    const views = await ctx.db
      .query('pageViews')
      .withIndex('by_workspace_and_time', (q) => q.eq('workspaceId', context.workspaceId))
      .order('desc')
      .take(limit)

    // Client names are looked up once per distinct client rather than per row.
    const names = new Map<string, string>()
    for (const view of views) {
      if (!view.clientId || names.has(view.clientId)) continue
      const client = await ctx.db.get(view.clientId)
      if (client) names.set(view.clientId, client.company || client.name)
    }

    return views.map((view) => ({
      id: view._id,
      surface: view.surface,
      target: view.target,
      path: view.path,
      identity: view.identity,
      country: view.country,
      referrer: view.referrer,
      durationMs: view.durationMs,
      at: view.at,
      clientName: view.clientId ? names.get(view.clientId) : undefined,
    }))
  },
})

/**
 * Drop views older than a year, a bounded batch at a time.
 *
 * The batch cap matters more than the schedule: a workspace that has been
 * running for years must not produce a single transaction large enough to fail.
 * Anything left over is collected by tomorrow's run.
 */
export const pruneOldViews = internalMutation({
  args: {},
  handler: async (ctx) => {
    const cutoff = Date.now() - 365 * DAY_MS
    const stale = await ctx.db
      .query('pageViews')
      .withIndex('by_time', (q) => q.lt('at', cutoff))
      .take(500)

    for (const view of stale) {
      await ctx.db.delete(view._id)
    }
    return { deleted: stale.length }
  },
})

/**
 * Who is reading right now.
 *
 * Convex subscriptions make this close to free — the panel re-renders when a
 * row lands, with no polling and no socket of our own.
 */
export const liveNow = query({
  args: {},
  handler: async (ctx) => {
    const context = await requireWorkspace(ctx)
    const since = Date.now() - LIVE_WINDOW_MS

    const views = await ctx.db
      .query('pageViews')
      .withIndex('by_workspace_and_time', (q) =>
        q.eq('workspaceId', context.workspaceId).gte('at', since),
      )
      .collect()

    return {
      count: uniqueBy(views, (view) => view.visitorHash),
      countries: [...new Set(views.map((view) => view.country).filter(Boolean))] as string[],
    }
  },
})
