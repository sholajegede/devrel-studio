import { v } from 'convex/values'
import { internalMutation, mutation, query } from './_generated/server'
import { internal } from './_generated/api'
import { requireAdmin } from './model/admin'
import { enforceRateLimit } from './model/rateLimit'
import { recordEvent, recordPresence } from './model/jobEvents'
import { EVENTS, SERVER_ONLY, cleanEvent, dayKey, windowStart, weekKey, type RawEvent } from '../lib/jobs/analytics'

const MAX_BATCH = 25
const DAY_MS = 86_400_000
const RAW_KEEP_DAYS = 14
const SEEN_KEEP_DAYS = 100

const clean = (value: string | undefined, max: number) => value?.replace(/[^\w.:@ -]/g, '').slice(0, max) || undefined

/**
 * The browser's events, sent through /api/jobs/track. The route holds the
 * secret, so this cannot be called straight from a page.
 */
export const ingest = mutation({
  args: {
    secret: v.string(),
    visitor: v.string(),
    session: v.optional(v.string()),
    device: v.optional(v.string()),
    ref: v.optional(v.string()),
    country: v.optional(v.string()),
    signedIn: v.optional(v.boolean()),
    events: v.array(v.any()),
  },
  handler: async (ctx, args) => {
    const expected = process.env.MANAGER_CODE_SECRET
    if (!expected || args.secret !== expected) return { stored: 0 }

    const visitor = clean(args.visitor, 64)
    if (!visitor) return { stored: 0 }
    try {
      await enforceRateLimit(ctx, 'job-track', visitor, 400, 'Slow down')
    } catch {
      return { stored: 0 }
    }

    const context = {
      device: clean(args.device, 10),
      ref: clean(args.ref, 60),
      country: clean(args.country, 2)?.toUpperCase(),
      signedIn: args.signedIn === true,
    }
    const events = args.events
      .slice(0, MAX_BATCH)
      .map(cleanEvent)
      .filter((event): event is RawEvent => event !== null && !SERVER_ONLY.includes(event.event))

    // The referrer belongs to the first page view of a session, not to every event.
    let first = true
    for (const event of events) {
      const sendRef = event.event === 'page_view' && first && context.ref
      await recordEvent(ctx, event, { visitor }, { ...context, ref: sendRef ? context.ref : undefined })
      if (event.event === 'page_view') first = false
    }
    if (events.length > 0) await recordPresence(ctx, visitor, clean(args.session, 64))
    return { stored: events.length }
  },
})

// ── Admin reports ─────────────────────────────────────────────────────────────

type Tally = Map<string, number>
const add = (map: Tally, key: string, by: number) => map.set(key, (map.get(key) ?? 0) + by)
const top = (map: Tally, limit: number) =>
  [...map.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).slice(0, limit).map(([name, count]) => ({ name, count }))

/** The server sees every redirect; the browser can be blocked. Take the larger. */
const applies = (counts: Record<string, number>) => Math.max(counts.apply_click ?? 0, counts.apply_redirect ?? 0)

const LABEL_EVENTS = [
  'search', 'no_results', 'filter_on', 'filter_off', 'sort_change', 'country_set', 'nav_click', 'cta_click',
  'outbound_click', 'link_copy', 'share_click', 'text_copy', 'link_menu', 'tour_start', 'tour_replay', 'tour_step',
  'tour_done', 'tour_skip', 'tracker_move', 'cv_failed', 'kit_failed', 'alert_created', 'job_open',
]

export const report = query({
  args: { weeks: v.number() },
  handler: async (ctx, args) => {
    await requireAdmin(ctx)
    const weeks = Math.min(Math.max(Math.round(args.weeks), 1), 13)
    const now = Date.now()
    const startDay = windowStart(now, weeks)

    const daily = await ctx.db
      .query('jobMetrics')
      .withIndex('by_kind_and_bucket', (q) => q.eq('kind', 'all').gte('bucket', startDay))
      .take(12_000)

    const totals = new Map<string, number>()
    const byDay = new Map<string, Record<string, number>>()
    for (const row of daily) {
      add(totals, row.event, row.count)
      const entry = byDay.get(row.bucket) ?? {}
      entry[row.event] = (entry[row.event] ?? 0) + row.count
      byDay.set(row.bucket, entry)
    }

    const days: { day: string; values: Record<string, number> }[] = []
    for (let cursor = new Date(`${startDay}T00:00:00Z`).getTime(); cursor <= now; cursor += DAY_MS) {
      const day = dayKey(cursor)
      days.push({ day, values: byDay.get(day) ?? {} })
    }

    const weekly = await ctx.db
      .query('jobMetrics')
      .withIndex('by_kind_and_bucket', (q) => q.eq('kind', 'week').gte('bucket', startDay))
      .take(200)

    const read = async (kind: string) =>
      ctx.db
        .query('jobMetrics')
        .withIndex('by_kind_and_bucket', (q) => q.eq('kind', kind).gte('bucket', startDay))
        .take(12_000)

    const [jobRows, companyRows, labelRows, pathRows, refRows, deviceRows, countryRows, authRows] = await Promise.all([
      read('job'), read('company'), read('label'), read('path'), read('ref'), read('device'), read('country'), read('auth'),
    ])

    const jobs = new Map<string, Record<string, number>>()
    for (const row of jobRows) {
      const entry = jobs.get(row.dim) ?? {}
      entry[row.event] = (entry[row.event] ?? 0) + row.count
      jobs.set(row.dim, entry)
    }
    const ranked = [...jobs.entries()]
      .sort((a, b) => applies(b[1]) - applies(a[1]) || (b[1].job_view ?? 0) - (a[1].job_view ?? 0))
      .slice(0, 20)
    const topJobs = await Promise.all(
      ranked.map(async ([slug, counts]) => {
        const job = await ctx.db.query('jobs').withIndex('by_slug', (q) => q.eq('slug', slug)).first()
        return { slug, title: job?.title ?? slug, company: job?.companyName ?? '', counts }
      }),
    )

    const companies = new Map<string, Record<string, number>>()
    for (const row of companyRows) {
      const entry = companies.get(row.dim) ?? {}
      entry[row.event] = (entry[row.event] ?? 0) + row.count
      companies.set(row.dim, entry)
    }
    const topCompanies = [...companies.entries()]
      .sort((a, b) => applies(b[1]) - applies(a[1]) || (b[1].company_click ?? 0) - (a[1].company_click ?? 0))
      .slice(0, 15)
      .map(([name, counts]) => ({ name, counts }))

    const labels: Record<string, { name: string; count: number }[]> = {}
    for (const event of LABEL_EVENTS) {
      const tally: Tally = new Map()
      for (const row of labelRows) if (row.event === event) add(tally, row.dim, row.count)
      if (tally.size) labels[event] = top(tally, 15)
    }

    const pageViews = new Map<string, number>()
    for (const row of pathRows) if (row.event === 'page_view') add(pageViews, row.dim, row.count)
    const refs = new Map<string, number>()
    for (const row of refRows) if (row.event === 'page_view') add(refs, row.dim, row.count)
    const devices = new Map<string, number>()
    for (const row of deviceRows) if (row.event === 'page_view') add(devices, row.dim, row.count)
    const countries = new Map<string, number>()
    for (const row of countryRows) if (row.event === 'page_view') add(countries, row.dim, row.count)
    const auth = new Map<string, number>()
    for (const row of authRows) if (row.event === 'page_view') add(auth, row.dim, row.count)

    return {
      weeks,
      from: startDay,
      totals: Object.fromEntries(totals),
      days,
      weeklyVisitors: weekly.filter((row) => row.event === 'visitor').map((row) => ({ week: row.bucket, count: row.count })),
      topJobs,
      topCompanies,
      labels,
      pages: top(pageViews, 15),
      referrers: top(refs, 12),
      devices: top(devices, 5),
      countries: top(countries, 15),
      audience: top(auth, 2),
      truncated: jobRows.length >= 12_000 || daily.length >= 12_000,
      thisWeek: weekKey(now),
    }
  },
})

/** The newest events, and who is on the site right now. */
export const live = query({
  args: { limit: v.optional(v.number()) },
  handler: async (ctx, args) => {
    await requireAdmin(ctx)
    const rows = await ctx.db.query('jobEvents').order('desc').take(Math.min(args.limit ?? 80, 200))
    const fiveMinutes = Date.now() - 5 * 60_000
    const online = new Set(rows.filter((row) => row.ts >= fiveMinutes && !row.visitor.startsWith('user:') && row.visitor !== 'system').map((row) => row.visitor))
    return {
      online: online.size,
      events: rows.map((row) => ({
        id: row._id,
        ts: row.ts,
        event: row.event,
        label: EVENTS[row.event as keyof typeof EVENTS]?.label ?? row.event,
        path: row.path,
        slug: row.slug,
        company: row.company,
        detail: row.label,
        n: row.n,
        device: row.device,
        country: row.country,
        who: row.userId ? 'account' : row.visitor === 'system' ? 'system' : row.visitor.slice(0, 6),
      })),
    }
  },
})

/** Old raw events and visitor markers go. The counters stay. */
export const prune = internalMutation({
  args: {},
  handler: async (ctx) => {
    const cutoff = Date.now() - RAW_KEEP_DAYS * DAY_MS
    const old = await ctx.db.query('jobEvents').withIndex('by_creation_time', (q) => q.lt('_creationTime', cutoff)).take(400)
    for (const row of old) await ctx.db.delete(row._id)

    const seenCutoff = Date.now() - SEEN_KEEP_DAYS * DAY_MS
    const seen = await ctx.db.query('jobVisitorSeen').withIndex('by_creation_time', (q) => q.lt('_creationTime', seenCutoff)).take(400)
    for (const row of seen) await ctx.db.delete(row._id)

    if (old.length === 400 || seen.length === 400) await ctx.scheduler.runAfter(0, internal.jobAnalytics.prune, {})
  },
})
