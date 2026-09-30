import { v } from 'convex/values'
import { internal } from './_generated/api'
import { Doc, Id } from './_generated/dataModel'
import {
  internalAction,
  internalMutation,
  MutationCtx,
  internalQuery,
} from './_generated/server'
import {
  HN_ITEM,
  HN_THREADS,
  REDDIT_LISTING,
  REMOTEOK_URL,
  WWR_URL,
  parseHnComments,
  parseHnThreadIds,
  parseReddit,
  parseRemoteOk,
  parseWwr,
} from '../lib/jobs/aggregators'
import {
  ASHBY_LIST,
  GREENHOUSE_DETAIL,
  GREENHOUSE_LIST,
  LEVER_LIST,
  parseAshby,
  parseGreenhouseJob,
  parseGreenhouseList,
  parseLever,
  type RawJob,
} from '../lib/jobs/adapters'
import { normalizeJob, slugify, type NormalizedJob } from '../lib/jobs/normalize'
import { SEED_SOURCES } from '../lib/jobs/seed'
import { classifyTitle } from '../lib/jobs/taxonomy'
import { computeStats } from '../lib/jobs/stats'

const USER_AGENT = 'DevRelStudioJobs/1.0 (+https://devrel.studio/jobs)'
const FETCH_TIMEOUT_MS = 25_000
const STAGGER_MS = 700
const VERIFY_AFTER_MS = 4 * 60 * 60 * 1000
const MAX_FAILURES = 12
const EXPIRED_RETENTION_MS = 30 * 24 * 60 * 60 * 1000

const normalizedJobValidator = v.object({
  externalId: v.string(),
  slug: v.string(),
  title: v.string(),
  role: v.string(),
  family: v.string(),
  seniority: v.string(),
  employmentType: v.string(),
  workplace: v.string(),
  remoteScope: v.optional(v.string()),
  locationLabel: v.string(),
  locations: v.array(v.string()),
  countries: v.array(v.string()),
  regions: v.array(v.string()),
  companyName: v.string(),
  companySlug: v.string(),
  salaryMin: v.optional(v.number()),
  salaryMax: v.optional(v.number()),
  salaryCurrency: v.optional(v.string()),
  salaryMinUsd: v.optional(v.number()),
  salaryMaxUsd: v.optional(v.number()),
  skills: v.array(v.string()),
  topics: v.array(v.string()),
  summary: v.string(),
  description: v.string(),
  applyUrl: v.string(),
  postedAt: v.number(),
  groupKey: v.string(),
  contentHash: v.string(),
  searchText: v.string(),
})

async function getJson(url: string): Promise<unknown> {
  const response = await fetch(url, {
    headers: { 'User-Agent': USER_AGENT, Accept: 'application/json' },
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
  })
  if (!response.ok) throw new Error(`${response.status} from ${new URL(url).host}`)
  return response.json()
}

async function getText(url: string): Promise<string> {
  const response = await fetch(url, {
    headers: { 'User-Agent': USER_AGENT },
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
  })
  if (!response.ok) throw new Error(`${response.status} from ${new URL(url).host}`)
  return response.text()
}

/** App-only token. Without credentials the Reddit source stays quiet rather than failing. */
async function redditToken(): Promise<string | null> {
  const id = process.env.REDDIT_CLIENT_ID
  const secret = process.env.REDDIT_CLIENT_SECRET
  if (!id || !secret) return null
  const response = await fetch('https://www.reddit.com/api/v1/access_token', {
    method: 'POST',
    headers: {
      Authorization: `Basic ${btoa(`${id}:${secret}`)}`,
      'Content-Type': 'application/x-www-form-urlencoded',
      'User-Agent': USER_AGENT,
    },
    body: 'grant_type=client_credentials',
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
  })
  if (!response.ok) throw new Error(`${response.status} from reddit.com`)
  const data = (await response.json()) as { access_token?: string }
  return data.access_token ?? null
}

async function fetchHn(slug: string): Promise<RawJob[]> {
  const freelancer = slug === 'freelancer'
  const search = await getJson(HN_THREADS(freelancer ? 'Freelancer? Seeking freelancer?' : 'Who is hiring?'))
  const ids = parseHnThreadIds(search, freelancer ? /seeking freelancer/i : /who is hiring/i)
  const jobs: RawJob[] = []
  for (const id of ids) jobs.push(...parseHnComments(await getJson(HN_ITEM(id)), freelancer ? 'freelancer' : 'hiring'))
  return jobs
}

async function mapLimit<T, R>(items: T[], limit: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const results: R[] = []
  let cursor = 0
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (cursor < items.length) {
      const index = cursor++
      results[index] = await fn(items[index])
    }
  })
  await Promise.all(workers)
  return results
}

async function fetchSource(
  source: Doc<'jobSources'>,
): Promise<{ total: number; raw: RawJob[] }> {
  if (source.kind === 'ashby') {
    const raw = parseAshby(await getJson(ASHBY_LIST(source.slug)))
    return { total: raw.length, raw }
  }
  if (source.kind === 'remoteok') {
    const raw = parseRemoteOk(await getJson(REMOTEOK_URL(source.slug)))
    return { total: raw.length, raw }
  }
  if (source.kind === 'wwr') {
    const raw = parseWwr(await getText(WWR_URL(source.slug)))
    return { total: raw.length, raw }
  }
  if (source.kind === 'hn') {
    const raw = await fetchHn(source.slug)
    return { total: raw.length, raw }
  }
  if (source.kind === 'reddit') {
    const token = await redditToken()
    if (!token) return { total: 0, raw: [] }
    const response = await fetch(REDDIT_LISTING(source.slug), {
      headers: { Authorization: `Bearer ${token}`, 'User-Agent': USER_AGENT },
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    })
    if (!response.ok) throw new Error(`${response.status} from reddit.com`)
    const raw = parseReddit(await response.json(), source.slug)
    return { total: raw.length, raw }
  }
  if (source.kind === 'lever') {
    const raw = parseLever(await getJson(LEVER_LIST(source.slug)))
    return { total: raw.length, raw }
  }

  const list = parseGreenhouseList(await getJson(GREENHOUSE_LIST(source.slug)))
  const candidates = list.filter((job) => classifyTitle(job.title) !== null)
  const details = await mapLimit(candidates, 4, async (job) => {
    try {
      return parseGreenhouseJob(await getJson(GREENHOUSE_DETAIL(source.slug, job.id)))
    } catch {
      return null
    }
  })
  return { total: list.length, raw: details.filter((job): job is RawJob => job !== null) }
}

export const getSource = internalQuery({
  args: { sourceId: v.id('jobSources') },
  handler: (ctx, args) => ctx.db.get(args.sourceId),
})

export const listActiveSourceIds = internalQuery({
  args: {},
  handler: async (ctx) => {
    const sources = await ctx.db
      .query('jobSources')
      .withIndex('by_active', (q) => q.eq('active', true))
      .collect()
    return sources.map((source) => source._id)
  },
})

export const seedSources = internalMutation({
  args: {},
  handler: async (ctx) => {
    let added = 0
    for (const seed of SEED_SOURCES) {
      const existing = await ctx.db
        .query('jobSources')
        .withIndex('by_kind_and_slug', (q) => q.eq('kind', seed.kind).eq('slug', seed.slug))
        .first()
      if (existing) continue
      await ctx.db.insert('jobSources', {
        kind: seed.kind,
        slug: seed.slug,
        name: seed.name,
        active: true,
        failures: 0,
        createdAt: Date.now(),
      })
      added++
    }
    return { added, total: SEED_SOURCES.length }
  },
})

export const syncAll = internalAction({
  args: {},
  handler: async (ctx): Promise<number> => {
    const ids: Id<'jobSources'>[] = await ctx.runQuery(internal.jobSync.listActiveSourceIds, {})
    for (let i = 0; i < ids.length; i++) {
      await ctx.scheduler.runAfter(i * STAGGER_MS, internal.jobSync.syncSource, {
        sourceId: ids[i],
      })
    }
    return ids.length
  },
})

export const syncSource = internalAction({
  args: { sourceId: v.id('jobSources') },
  handler: async (ctx, args): Promise<void> => {
    const source: Doc<'jobSources'> | null = await ctx.runQuery(internal.jobSync.getSource, {
      sourceId: args.sourceId,
    })
    if (!source || !source.active) return

    try {
      const { total, raw } = await fetchSource(source)
      const now = Date.now()
      const jobs = raw
        .map((job) => {
          const name = job.company?.trim() || source.name
          return normalizeJob(job, { name, slug: slugify(name) }, now)
        })
        .filter((job): job is NormalizedJob => job !== null)

      await ctx.runMutation(internal.jobSync.applyResult, {
        sourceId: source._id,
        totalFetched: total,
        jobs,
      })
    } catch (error) {
      await ctx.runMutation(internal.jobSync.recordFailure, {
        sourceId: source._id,
        error: error instanceof Error ? error.message : String(error),
      })
    }
  },
})

export const recordFailure = internalMutation({
  args: { sourceId: v.id('jobSources'), error: v.string() },
  handler: async (ctx, args) => {
    const source = await ctx.db.get(args.sourceId)
    if (!source) return
    const failures = source.failures + 1
    await ctx.db.patch(source._id, {
      failures,
      lastOk: false,
      lastError: args.error.slice(0, 300),
      lastSyncedAt: Date.now(),
      active: failures < MAX_FAILURES,
    })
  },
})

export const applyResult = internalMutation({
  args: {
    sourceId: v.id('jobSources'),
    totalFetched: v.number(),
    jobs: v.array(normalizedJobValidator),
  },
  handler: async (ctx, args) => {
    const source = await ctx.db.get(args.sourceId)
    if (!source) return
    const now = Date.now()

    const suspicious =
      args.totalFetched === 0 && (source.relevantCount ?? 0) > 0 && args.jobs.length === 0
    if (suspicious) {
      await ctx.db.patch(source._id, {
        failures: source.failures + 1,
        lastOk: false,
        lastError: 'Feed returned no jobs; kept existing listings',
        lastSyncedAt: now,
      })
      return
    }

    const seen = new Set<string>()
    let created = 0
    let updated = 0
    let reactivated = 0

    for (const job of args.jobs) {
      seen.add(job.externalId)
      const { description, ...fields } = job

      const existing = await ctx.db
        .query('jobs')
        .withIndex('by_source_and_external', (q) =>
          q.eq('sourceId', source._id).eq('externalId', job.externalId),
        )
        .first()

      if (!existing) {
        let slug = fields.slug
        const clash = await ctx.db
          .query('jobs')
          .withIndex('by_slug', (q) => q.eq('slug', slug))
          .first()
        if (clash) slug = `${slug}-${now.toString(36).slice(-3)}`

        const jobId = await ctx.db.insert('jobs', {
          ...fields,
          slug,
          sourceId: source._id,
          firstSeenAt: now,
          lastVerifiedAt: now,
          status: 'active',
        })
        await ctx.db.insert('jobDescriptions', { jobId, text: description })
        created++
        continue
      }

      if (existing.contentHash !== fields.contentHash) {
        await ctx.db.replace(existing._id, {
          ...fields,
          slug: existing.slug,
          sourceId: source._id,
          firstSeenAt: existing.firstSeenAt,
          postedAt: existing.postedAt,
          lastVerifiedAt: now,
          status: 'active',
          ...(existing.clicks ? { clicks: existing.clicks } : {}),
        })
        const descriptionRow = await ctx.db
          .query('jobDescriptions')
          .withIndex('by_job', (q) => q.eq('jobId', existing._id))
          .first()
        if (descriptionRow) await ctx.db.patch(descriptionRow._id, { text: description })
        else await ctx.db.insert('jobDescriptions', { jobId: existing._id, text: description })
        updated++
      } else if (existing.status === 'expired') {
        await ctx.db.patch(existing._id, { status: 'active', expiredAt: undefined, lastVerifiedAt: now })
        reactivated++
      } else if (now - existing.lastVerifiedAt > VERIFY_AFTER_MS) {
        await ctx.db.patch(existing._id, { lastVerifiedAt: now })
      }
    }

    const active = await ctx.db
      .query('jobs')
      .withIndex('by_source_and_status', (q) => q.eq('sourceId', source._id).eq('status', 'active'))
      .collect()
    let expired = 0
    for (const job of active) {
      if (seen.has(job.externalId)) continue
      await ctx.db.patch(job._id, { status: 'expired', expiredAt: now })
      expired++
    }

    await ctx.db.patch(source._id, {
      lastSyncedAt: now,
      lastOk: true,
      lastError: undefined,
      failures: 0,
      totalFetched: args.totalFetched,
      relevantCount: args.jobs.length,
    })

    if (created + updated + expired + reactivated > 0) await ctx.scheduler.runAfter(0, internal.jobSync.recountStats, {})

    return { created, updated, expired }
  },
})

async function writeStats(ctx: MutationCtx): Promise<number> {
  const active = await ctx.db
    .query('jobs')
    .withIndex('by_status_and_posted', (q) => q.eq('status', 'active'))
    .collect()

  const stats = computeStats(active, Date.now())
  const existing = await ctx.db
    .query('jobStats')
    .withIndex('by_key', (q) => q.eq('key', 'current'))
    .first()

  if (existing) await ctx.db.replace(existing._id, { key: 'current', ...stats })
  else await ctx.db.insert('jobStats', { key: 'current', ...stats })
  return stats.total
}

/**
 * The counts on the board come from this snapshot. It is rewritten whenever a
 * feed changes the set of live roles, so the number in the page header and the
 * number beside each filter match what the list shows.
 */
export const recountStats = internalMutation({
  args: {},
  handler: async (ctx) => writeStats(ctx),
})

export const refreshStats = internalMutation({
  args: {},
  handler: async (ctx) => {
    // New roles are in by now: tell Pro accounts straight away.
    await ctx.scheduler.runAfter(0, internal.jobAlerts.runAlerts, { frequencies: ['instant'] })
    const total = await writeStats(ctx)
    await ctx.scheduler.runAfter(0, internal.jobSync.pingSite, {})
    return total
  },
})

export const pingSite = internalAction({
  args: {},
  handler: async (): Promise<void> => {
    const site = process.env.SITE_URL
    const secret = process.env.JOBS_REVALIDATE_SECRET
    if (!site || !secret) return
    try {
      await fetch(`${site.replace(/\/$/, '')}/api/jobs/revalidate`, {
        method: 'POST',
        headers: { 'x-revalidate-secret': secret },
        signal: AbortSignal.timeout(10_000),
      })
    } catch (error) {
      console.error('[jobs] could not refresh the site cache:', error)
    }
  },
})

export const pruneExpired = internalMutation({
  args: {},
  handler: async (ctx) => {
    const cutoff = Date.now() - EXPIRED_RETENTION_MS
    const sources = await ctx.db.query('jobSources').collect()
    let removed = 0

    for (const source of sources) {
      const expired = await ctx.db
        .query('jobs')
        .withIndex('by_source_and_status', (q) => q.eq('sourceId', source._id).eq('status', 'expired'))
        .take(100)
      for (const job of expired) {
        if ((job.expiredAt ?? 0) > cutoff) continue
        const rows = await ctx.db
          .query('jobDescriptions')
          .withIndex('by_job', (q) => q.eq('jobId', job._id))
          .collect()
        for (const row of rows) await ctx.db.delete(row._id)
        await ctx.db.delete(job._id)
        removed++
      }
    }
    return removed
  },
})

export type SourceId = Id<'jobSources'>
