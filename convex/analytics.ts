import { v } from 'convex/values'
import { internal } from './_generated/api'
import { internalAction, internalMutation, internalQuery, mutation, query } from './_generated/server'
import type { Doc, Id } from './_generated/dataModel'
import type { MutationCtx, QueryCtx } from './_generated/server'
import { getCurrentWorkspace, requireWorkspace } from './model/workspaces'
import type { WorkspaceContext } from './model/workspaces'
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
    surface: v.union(
      v.literal('dashboard'),
      v.literal('portfolio'),
      v.literal('site'),
    ),
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

    // A view of devrel.studio itself belongs to nobody's workspace — it is the
    // platform's own traffic, read only by the admin console. It skips the
    // ownership lookup below for the obvious reason that there is nothing to
    // look up, and keeps the same rate limit, deduplication and bot rules as
    // every other row.
    const owner =
      args.surface === 'site'
        ? { workspaceId: undefined, userId: undefined, clientId: undefined }
        : await resolveOwner(ctx, args.surface, target)

    // Nothing owns this slug or handle. The wildcard answers for every name
    // under the domain, so without this a script could fill the table by
    // hitting invented subdomains.
    if (!owner) return null

    const now = Date.now()

    // Asked as one indexed range rather than "the newest row for this visitor,
    // is it the same path, and was it recent enough".
    //
    // The old form was wrong twice over. It only ever saw the *latest* row, so
    // a visitor who opened two pages in the same second was deduplicated
    // against whichever landed last — hover three links and the middle one
    // matched nothing. And it read the visitor's entire history on this target,
    // so every concurrent write for that visitor conflicted with every other
    // one regardless of page. Bounding the read to this path and this window is
    // both the question dedupe means to ask and a range narrow enough that two
    // pages loading at once no longer collide.
    const duplicate = await ctx.db
      .query('pageViews')
      .withIndex('by_target_visitor_path_and_time', (q) =>
        q
          .eq('target', target)
          .eq('visitorHash', args.visitorHash)
          .eq('path', args.path)
          .gt('at', now - DEDUPE_WINDOW_MS),
      )
      .first()

    if (duplicate) return duplicate._id

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
  surface: 'dashboard' | 'portfolio' | 'site',
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

/**
 * The workspace whose numbers the caller may read — or why there isn't one.
 *
 * The read side of this file deliberately does not go through `requireWorkspace`.
 * These queries back panels on a page, and a panel has no business taking the
 * page down.
 *
 * Convex authentication is not a latch. The ID token rotates, the socket
 * reconnects when a laptop wakes, and Kinde rebuilds its client state on its own
 * schedule — each of those leaves the socket briefly without a verified
 * identity, and every mounted query re-runs inside that window. A query that
 * throws there throws during render, which unmounts the route: the reader sees
 * the dashboard break, reloads, and it works. That is what made this look
 * random rather than reproducible.
 *
 * The two ways of having no workspace want opposite answers, so they are
 * distinguished rather than collapsed:
 *
 *   'pending'  no verified identity on this socket *yet* — transient. Callers
 *              return null, and the page holds its loading state.
 *   'none'     a real account belonging to no workspace — stable until somebody
 *              invites them. Callers return an empty result, so the page renders
 *              its zero state instead of a skeleton that never resolves.
 */
type Viewer =
  | { state: 'ok'; context: WorkspaceContext }
  | { state: 'pending' }
  | { state: 'none' }

async function viewer(ctx: QueryCtx): Promise<Viewer> {
  const context = await getCurrentWorkspace(ctx)
  if (context) return { state: 'ok', context }

  // Only reached when there is nothing to read anyway, so telling the two
  // empty cases apart costs an extra call on the path that returns nothing.
  const identity = await ctx.auth.getUserIdentity()
  return { state: identity ? 'none' : 'pending' }
}

/** One empty bucket per day in the window, oldest first. */
function emptyDays(now: number, days: number) {
  const byDay = new Map<string, { views: number; visitors: Set<string> }>()
  for (let i = days - 1; i >= 0; i--) {
    const key = new Date(now - i * DAY_MS).toISOString().slice(0, 10)
    byDay.set(key, { views: 0, visitors: new Set<string>() })
  }
  return byDay
}

/**
 * `overview` with nothing in it.
 *
 * Every field the page reads is present and zeroed, including a full-width
 * series, so the chart keeps its axis and the tiles read "0" rather than the
 * layout collapsing to a different shape while there is no data.
 */
function emptyOverview(days: number) {
  const now = Date.now()
  const empty: { label: string; count: number }[] = []

  return {
    days,
    tiles: {
      viewsToday: 0,
      visitors7d: 0,
      views7d: 0,
      dashboardViews7d: 0,
      portfolioViews7d: 0,
      managerViews7d: 0,
      medianDwellMs: null as number | null,
      peakDay: null as { date: string; views: number } | null,
      allTimeViews: 0,
      allTimeVisitors: 0,
      reportsRead: 0,
      since: null as number | null,
    },
    series: [...emptyDays(now, days).keys()].map((date) => ({
      date,
      views: 0,
      visitors: 0,
    })),
    breakdowns: {
      byClient: empty,
      byReferrer: empty,
      byCountry: empty,
      byPath: empty,
    },
  }
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
    const days = args.days ?? 14

    const seen = await viewer(ctx)
    if (seen.state !== 'ok') {
      return seen.state === 'pending' ? null : emptyOverview(days)
    }
    const context = seen.context

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
    const byDay = emptyDays(now, days)
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

    // The breakdowns follow the range selector; the tiles above them do not.
    //
    // They used to be computed from `last7` whatever the selector said, so
    // choosing 90 days changed the chart and left every list beneath it showing
    // one week — a range control that silently governed half the page. The
    // tiles keep their fixed seven-day window because each one names it
    // ("visitors · 7d"), which is a promise about a number rather than a
    // filter somebody set.
    const windowedDashboard = windowed.filter((view) => view.surface === 'dashboard')
    const windowedPortfolio = windowed.filter((view) => view.surface === 'portfolio')

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
        byClient: tally(windowedDashboard, (view) => view.target),
        byReferrer: tally(windowed, (view) => view.referrer ?? 'direct'),
        byCountry: tally(windowed, (view) => view.country),
        byPath: tally(windowedPortfolio, (view) => view.path),
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
    const seen = await viewer(ctx)
    // An empty log, not a thrown error: see `viewer`.
    if (seen.state !== 'ok') return []
    const context = seen.context

    // Raised from 100. A busy client dashboard produces a hundred views in a
    // few days, so the old ceiling meant "everything" reached back less than a
    // week however far the reader scrolled — a log that quietly stopped rather
    // than saying it had ended.
    const limit = Math.min(args.limit ?? 40, 400)

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
 * The week's attention, per workspace owner, for the digest.
 *
 * An `internalAction` sends the mail; this is the read it works from, and it
 * returns only workspaces with something worth saying. A digest that arrives
 * every Monday reading "0 views" teaches its reader to delete it unopened, and
 * takes the weeks that matter with it.
 *
 * Scans `pageViews` once over the window and groups in memory rather than
 * querying per workspace: at these volumes one indexed range read beats N.
 */
export const weeklyDigestRecipients = internalQuery({
  args: {},
  handler: async (ctx) => {
    const since = Date.now() - 7 * DAY_MS

    const views = await ctx.db
      .query('pageViews')
      .withIndex('by_time', (q) => q.gte('at', since))
      .collect()

    interface Bucket {
      views: number
      visitors: Set<string>
      managerViews: number
      reportsRead: number
      byClient: Map<string, number>
    }

    const byWorkspace = new Map<string, Bucket>()

    for (const view of views) {
      // Platform traffic belongs to nobody's workspace, and a portfolio view is
      // not somebody reading a client's report — the digest is about the work
      // being delivered under an engagement.
      if (!view.workspaceId) continue

      const bucket = byWorkspace.get(view.workspaceId) ?? {
        views: 0,
        visitors: new Set<string>(),
        managerViews: 0,
        reportsRead: 0,
        byClient: new Map<string, number>(),
      }

      bucket.views += 1
      bucket.visitors.add(view.visitorHash)
      if (view.identity === 'manager') bucket.managerViews += 1
      if (view.surface === 'dashboard' && isReportPath(view.path)) bucket.reportsRead += 1
      if (view.surface === 'dashboard') {
        bucket.byClient.set(view.target, (bucket.byClient.get(view.target) ?? 0) + 1)
      }

      byWorkspace.set(view.workspaceId, bucket)
    }

    const recipients = []

    for (const [workspaceId, bucket] of byWorkspace) {
      const workspace = await ctx.db.get(workspaceId as Id<'workspaces'>)
      if (!workspace) continue

      const owner = await ctx.db.get(workspace.ownerId)
      // A paused account is not sent mail about a product it cannot open.
      if (!owner || owner.pausedAt) continue

      recipients.push({
        email: owner.email,
        firstName: owner.firstName,
        views: bucket.views,
        visitors: bucket.visitors.size,
        managerViews: bucket.managerViews,
        reportsRead: bucket.reportsRead,
        clients: [...bucket.byClient.entries()]
          .map(([name, count]) => ({ name, views: count }))
          .sort((a, b) => b.views - a.views)
          .slice(0, 5),
      })
    }

    return recipients
  },
})

/**
 * What has happened since this account last opened the dashboard.
 *
 * The one thing that makes a workspace feel alive rather than static: a product
 * that says what moved while you were away is answering a question you had, and
 * one that looks identical every visit is not.
 *
 * Returns null on a first visit rather than counting everything since the
 * beginning of time — "12 people read your work since you were last here" is a
 * lie when the last time was never.
 */
export const sinceLastVisit = query({
  args: {},
  handler: async (ctx) => {
    // The query Sentry kept reporting. It runs on /dashboard, the first page of
    // the app, which is precisely where an identity is most likely to still be
    // in flight — see `viewer`.
    const seen = await viewer(ctx)
    if (seen.state !== 'ok') return null
    const context = seen.context

    const since = context.user.lastSeenAt
    if (!since) return null

    // A visit that ended a minute ago is still this visit. Without a floor the
    // line would read "nothing since you were last here" for anybody who
    // refreshes, which is technically true and useless.
    const elapsed = Date.now() - since
    if (elapsed < 5 * 60 * 1000) return null

    const views = await ctx.db
      .query('pageViews')
      .withIndex('by_workspace_and_time', (q) =>
        q.eq('workspaceId', context.workspaceId).gt('at', since),
      )
      .collect()

    if (views.length === 0) return null

    return {
      since,
      views: views.length,
      visitors: uniqueBy(views, (view) => view.visitorHash),
      managerViews: views.filter((view) => view.identity === 'manager').length,
      reportsRead: views.filter(
        (view) => view.surface === 'dashboard' && isReportPath(view.path),
      ).length,
    }
  },
})

/**
 * Note that this account has been here.
 *
 * Called by the dashboard when it loads, and only moves the mark forward — a
 * clock that could go backwards would make the panel above replay events the
 * reader has already seen.
 *
 * Throttled to once an hour. The alternative is a write on every navigation, on
 * a field whose entire purpose is to be coarse.
 */
export const markSeen = mutation({
  args: {},
  handler: async (ctx) => {
    const context = await requireWorkspace(ctx)
    const now = Date.now()
    const last = context.user.lastSeenAt ?? 0

    if (now - last < 60 * 60 * 1000) return { moved: false }

    await ctx.db.patch(context.user._id, { lastSeenAt: now })
    return { moved: true }
  },
})

/**
 * Send this week's digests.
 *
 * An action rather than a mutation because it sends mail, and one send failing
 * must not roll back the others — each recipient is independent, and a provider
 * having a bad minute should cost one email rather than the whole run.
 */
export const sendWeeklyDigests = internalAction({
  args: {},
  handler: async (ctx): Promise<{ sent: number; failed: number }> => {
    const recipients: {
      email: string
      firstName?: string
      views: number
      visitors: number
      managerViews: number
      reportsRead: number
      clients: { name: string; views: number }[]
    }[] = await ctx.runQuery(internal.analytics.weeklyDigestRecipients, {})

    const dashboardUrl = `${process.env.SITE_URL ?? 'https://devrel.studio'}/dashboard/analytics`

    let sent = 0
    let failed = 0

    for (const recipient of recipients) {
      try {
        await ctx.runAction(internal.email.sendWeeklyDigest, {
          ...recipient,
          dashboardUrl,
        })
        sent += 1
      } catch {
        // One address failing is one email lost, not a run abandoned partway
        // through with no record of who already had theirs.
        failed += 1
      }
    }

    return { sent, failed }
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
    const seen = await viewer(ctx)
    // Nobody is reading, as far as this socket can currently tell.
    if (seen.state !== 'ok') return { count: 0, countries: [] as string[] }
    const context = seen.context

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
