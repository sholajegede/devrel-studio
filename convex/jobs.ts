import { ConvexError, v } from 'convex/values'
import { Doc } from './_generated/dataModel'
import { QueryCtx, mutation, query } from './_generated/server'
import { enforceRateLimit } from './model/rateLimit'
import { eligibility } from '../lib/jobs/locations'
import { FAMILY_BY_ID } from '../lib/jobs/taxonomy'

const DEFAULT_LIMIT = 40
const MAX_LIMIT = 500
const SCAN_LIMIT = 2500
const DAY_MS = 24 * 60 * 60 * 1000

export function toCard(job: Doc<'jobs'>) {
  return {
    _id: job._id,
    slug: job.slug,
    title: job.title,
    role: job.role,
    family: job.family,
    seniority: job.seniority,
    employmentType: job.employmentType,
    workplace: job.workplace,
    remoteScope: job.remoteScope ?? null,
    locationLabel: job.locationLabel,
    locations: job.locations,
    countries: job.countries,
    regions: job.regions,
    companyName: job.companyName,
    companySlug: job.companySlug,
    salaryMin: job.salaryMin ?? null,
    salaryMax: job.salaryMax ?? null,
    salaryCurrency: job.salaryCurrency ?? null,
    salaryMinUsd: job.salaryMinUsd ?? null,
    salaryMaxUsd: job.salaryMaxUsd ?? null,
    skills: job.skills,
    topics: job.topics,
    summary: job.summary,
    postedAt: job.postedAt,
    lastVerifiedAt: job.lastVerifiedAt,
    status: job.status,
  }
}

export type JobCard = ReturnType<typeof toCard>

export const filterArgs = {
  q: v.optional(v.string()),
  families: v.optional(v.array(v.string())),
  seniority: v.optional(v.array(v.string())),
  workplaces: v.optional(v.array(v.string())),
  employment: v.optional(v.array(v.string())),
  regions: v.optional(v.array(v.string())),
  skills: v.optional(v.array(v.string())),
  country: v.optional(v.string()),
  company: v.optional(v.string()),
  minSalaryUsd: v.optional(v.number()),
  salaryOnly: v.optional(v.boolean()),
  includeAdjacent: v.optional(v.boolean()),
  postedWithinDays: v.optional(v.number()),
}

type Filters = {
  q?: string
  families?: string[]
  seniority?: string[]
  workplaces?: string[]
  employment?: string[]
  regions?: string[]
  skills?: string[]
  country?: string
  company?: string
  minSalaryUsd?: number
  salaryOnly?: boolean
  includeAdjacent?: boolean
  postedWithinDays?: number
}

export function matchesFilters(job: Doc<'jobs'>, filters: Filters, now: number): boolean {
  if (filters.families?.length) {
    if (!filters.families.includes(job.family)) return false
  } else if (!filters.includeAdjacent && !filters.q?.trim() && !filters.company && !FAMILY_BY_ID[job.family as keyof typeof FAMILY_BY_ID]?.core) {
    return false
  }
  if (filters.seniority?.length && !filters.seniority.includes(job.seniority)) return false
  if (filters.workplaces?.length && !filters.workplaces.includes(job.workplace)) return false
  if (filters.employment?.length && !filters.employment.includes(job.employmentType)) return false
  if (filters.regions?.length && !filters.regions.some((region) => job.regions.includes(region))) return false
  if (filters.skills?.length && !filters.skills.every((skill) => job.skills.includes(skill))) return false
  if (filters.salaryOnly && job.salaryMaxUsd === undefined) return false
  if (filters.minSalaryUsd && (job.salaryMaxUsd ?? 0) < filters.minSalaryUsd) return false
  if (filters.postedWithinDays && now - job.postedAt > filters.postedWithinDays * DAY_MS) return false
  if (filters.country) {
    const fit = eligibility(
      {
        workplace: job.workplace as 'remote' | 'hybrid' | 'onsite' | 'unknown',
        remoteScope: job.remoteScope as never,
        countries: job.countries,
        regions: job.regions,
      },
      filters.country,
    )
    if (fit === 'no') return false
  }
  return true
}

async function candidates(ctx: QueryCtx, filters: Filters): Promise<Doc<'jobs'>[]> {
  const text = filters.q?.trim()
  if (text) {
    return ctx.db
      .query('jobs')
      .withSearchIndex('search_text', (q) => q.search('searchText', text.toLowerCase()).eq('status', 'active'))
      .take(300)
  }
  if (filters.company) {
    const company = filters.company
    return ctx.db
      .query('jobs')
      .withIndex('by_company_and_status', (q) => q.eq('companySlug', company).eq('status', 'active'))
      .order('desc')
      .take(300)
  }
  return ctx.db
    .query('jobs')
    .withIndex('by_status_and_posted', (q) => q.eq('status', 'active'))
    .order('desc')
    .take(SCAN_LIMIT)
}

export const list = query({
  args: {
    ...filterArgs,
    sort: v.optional(v.union(v.literal('newest'), v.literal('salary'))),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const now = Date.now()
    const limit = Math.min(Math.max(args.limit ?? DEFAULT_LIMIT, 1), MAX_LIMIT)
    const rows = (await candidates(ctx, args)).filter((job) => matchesFilters(job, args, now))

    if (args.sort === 'salary') {
      rows.sort((a, b) => (b.salaryMaxUsd ?? -1) - (a.salaryMaxUsd ?? -1) || b.postedAt - a.postedAt)
    } else if (args.q?.trim()) {
      rows.sort((a, b) => b.postedAt - a.postedAt)
    }

    return {
      total: rows.length,
      hasMore: rows.length > limit,
      items: rows.slice(0, limit).map(toCard),
    }
  },
})

export const stats = query({
  args: {},
  handler: async (ctx) =>
    ctx.db
      .query('jobStats')
      .withIndex('by_key', (q) => q.eq('key', 'current'))
      .first(),
})

export const bySlug = query({
  args: { slug: v.string() },
  handler: async (ctx, args) => {
    const job = await ctx.db
      .query('jobs')
      .withIndex('by_slug', (q) => q.eq('slug', args.slug))
      .first()
    if (!job) return null

    const description = await ctx.db
      .query('jobDescriptions')
      .withIndex('by_job', (q) => q.eq('jobId', job._id))
      .first()

    const siblings = await ctx.db
      .query('jobs')
      .withIndex('by_group', (q) => q.eq('groupKey', job.groupKey))
      .take(20)

    const atCompany = await ctx.db
      .query('jobs')
      .withIndex('by_company_and_status', (q) => q.eq('companySlug', job.companySlug).eq('status', 'active'))
      .order('desc')
      .take(12)

    const recent = await ctx.db
      .query('jobs')
      .withIndex('by_status_and_posted', (q) => q.eq('status', 'active'))
      .order('desc')
      .take(400)
    const similar = recent
      .filter((other) => other.family === job.family && other.companySlug !== job.companySlug)
      .slice(0, 6)

    const statsRow = await ctx.db
      .query('jobStats')
      .withIndex('by_key', (q) => q.eq('key', 'current'))
      .first()
    const benchmarks = statsRow?.salaries ?? []
    const exact = benchmarks.find((row) => row.family === job.family && row.seniority === job.seniority)
    const benchmark = exact ?? benchmarks.find((row) => row.family === job.family && row.seniority === 'all') ?? null

    return {
      job: toCard(job),
      description: description?.text ?? '',
      applyUrl: job.applyUrl,
      expiredAt: job.expiredAt ?? null,
      alsoOpenIn: siblings
        .filter((other) => other._id !== job._id && other.status === 'active')
        .map((other) => ({ slug: other.slug, locationLabel: other.locationLabel })),
      moreAtCompany: atCompany.filter((other) => other._id !== job._id).slice(0, 6).map(toCard),
      similar: similar.map(toCard),
      benchmark: benchmark
        ? { ...benchmark, exact: Boolean(exact) }
        : null,
    }
  },
})

export const sitemapEntries = query({
  args: {},
  handler: async (ctx) => {
    const rows = await ctx.db
      .query('jobs')
      .withIndex('by_status_and_posted', (q) => q.eq('status', 'active'))
      .order('desc')
      .take(5000)
    return rows.map((job) => ({ slug: job.slug, lastVerifiedAt: job.lastVerifiedAt }))
  },
})

export const recordClick = mutation({
  args: { slug: v.string(), bucket: v.string() },
  handler: async (ctx, args) => {
    await enforceRateLimit(ctx, 'job-click', args.bucket, 60, 'Too many requests')
    const job = await ctx.db
      .query('jobs')
      .withIndex('by_slug', (q) => q.eq('slug', args.slug))
      .first()
    if (!job) throw new ConvexError('Not found')
    await ctx.db.patch(job._id, { clicks: (job.clicks ?? 0) + 1 })
    return job.applyUrl
  },
})
