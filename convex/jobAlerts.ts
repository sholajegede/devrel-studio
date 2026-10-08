import { ConvexError, v } from 'convex/values'
import { internal } from './_generated/api'
import { Doc, Id } from './_generated/dataModel'
import { internalAction, internalMutation, internalQuery, mutation, query } from './_generated/server'
import { getCurrentUser, requireCurrentUser } from './model/auth'
import { matchesFilters } from './jobs'
import { formatSalary } from '../lib/jobs/salary'
import { alertLimit, canUseFrequency, proActive } from '../lib/jobs/pro'
import { logServerEvent } from './model/jobEvents'

const HOUR = 60 * 60 * 1000
const MIN_GAP: Record<'instant' | 'daily' | 'weekly', number> = { instant: 0, daily: 20 * HOUR, weekly: 6.5 * 24 * HOUR }
const MAX_JOBS_PER_EMAIL = 10

const alertFields = {
  name: v.string(),
  query: v.optional(v.string()),
  families: v.array(v.string()),
  seniority: v.array(v.string()),
  workplaces: v.array(v.string()),
  regions: v.array(v.string()),
  visaOnly: v.optional(v.boolean()),
  minSalaryUsd: v.optional(v.number()),
  frequency: v.union(v.literal('instant'), v.literal('daily'), v.literal('weekly')),
}

export const list = query({
  args: {},
  handler: async (ctx) => {
    const user = await getCurrentUser(ctx)
    if (!user) return null
    return ctx.db
      .query('jobAlerts')
      .withIndex('by_user', (q) => q.eq('userId', user._id))
      .collect()
  },
})

export const create = mutation({
  args: alertFields,
  handler: async (ctx, args) => {
    const user = await requireCurrentUser(ctx)
    const existing = await ctx.db
      .query('jobAlerts')
      .withIndex('by_user', (q) => q.eq('userId', user._id))
      .collect()
    const pro = proActive(user)
    if (existing.length >= alertLimit(pro)) {
      throw new ConvexError(
        pro ? `You can keep up to ${alertLimit(true)} alerts` : `Free accounts keep up to ${alertLimit(false)} alerts. Jobs Pro raises this to ${alertLimit(true)}.`,
      )
    }
    if (!canUseFrequency(pro, args.frequency)) throw new ConvexError('Instant alerts are part of Jobs Pro')
    const name = args.name.trim().slice(0, 80)
    if (!name) throw new ConvexError('Give the alert a name')
    await logServerEvent(ctx, user._id, { event: 'alert_created', label: args.frequency })
    return ctx.db.insert('jobAlerts', {
      ...args,
      userId: user._id,
      name,
      query: args.query?.trim() || undefined,
      enabled: true,
      createdAt: Date.now(),
    })
  },
})

export const update = mutation({
  args: {
    id: v.id('jobAlerts'),
    enabled: v.optional(v.boolean()),
    frequency: v.optional(v.union(v.literal('instant'), v.literal('daily'), v.literal('weekly'))),
  },
  handler: async (ctx, args) => {
    const user = await requireCurrentUser(ctx)
    if (args.frequency && !canUseFrequency(proActive(user), args.frequency)) {
      throw new ConvexError('Instant alerts are part of Jobs Pro')
    }
    const alert = await ctx.db.get(args.id)
    if (!alert || alert.userId !== user._id) throw new ConvexError('Not found')
    await ctx.db.patch(args.id, {
      ...(args.enabled !== undefined ? { enabled: args.enabled } : {}),
      ...(args.frequency ? { frequency: args.frequency } : {}),
    })
  },
})

export const remove = mutation({
  args: { id: v.id('jobAlerts') },
  handler: async (ctx, args) => {
    const user = await requireCurrentUser(ctx)
    const alert = await ctx.db.get(args.id)
    if (!alert || alert.userId !== user._id) throw new ConvexError('Not found')
    await logServerEvent(ctx, user._id, { event: 'alert_removed' })
    await ctx.db.delete(args.id)
  },
})

interface Digest {
  alertId: Id<'jobAlerts'>
  email: string
  firstName?: string
  alertName: string
  jobs: { title: string; company: string; location: string; pay?: string; slug: string }[]
}

const frequencyArg = v.optional(v.array(v.union(v.literal('instant'), v.literal('daily'), v.literal('weekly'))))

export const collectDigests = internalQuery({
  args: { frequencies: frequencyArg },
  handler: async (ctx, args): Promise<Digest[]> => {
    const now = Date.now()
    const digests: Digest[] = []
    const active: Doc<'jobs'>[] = await ctx.db
      .query('jobs')
      .withIndex('by_status_and_posted', (q) => q.eq('status', 'active'))
      .order('desc')
      .take(1500)

    for (const frequency of args.frequencies ?? (['daily', 'weekly'] as const)) {
      const alerts = await ctx.db
        .query('jobAlerts')
        .withIndex('by_frequency', (q) => q.eq('enabled', true).eq('frequency', frequency))
        .collect()

      for (const alert of alerts) {
        if (alert.lastSentAt && now - alert.lastSentAt < MIN_GAP[frequency]) continue
        const since = alert.lastSentAt ?? alert.createdAt
        const user = await ctx.db.get(alert.userId)
        if (!user || user.pausedAt) continue
        if (frequency === 'instant' && !proActive(user, now)) continue

        const text = alert.query?.trim().toLowerCase()
        const matches = active
          .filter((job) => job.firstSeenAt > since)
          .filter((job) => !text || job.searchText.includes(text))
          .filter((job) =>
            matchesFilters(
              job,
              {
                families: alert.families,
                seniority: alert.seniority,
                workplaces: alert.workplaces,
                regions: alert.regions,
                visaOnly: alert.visaOnly,
                minSalaryUsd: alert.minSalaryUsd,
                includeAdjacent: true,
              },
              now,
            ),
          )
          .slice(0, MAX_JOBS_PER_EMAIL)

        if (matches.length === 0) continue
        digests.push({
          alertId: alert._id,
          email: user.email,
          firstName: user.firstName,
          alertName: alert.name,
          jobs: matches.map((job) => ({
            title: job.title,
            company: job.companyName,
            location: job.locationLabel,
            pay:
              job.salaryMin !== undefined && job.salaryMax !== undefined && job.salaryCurrency
                ? formatSalary({ min: job.salaryMin, max: job.salaryMax, currency: job.salaryCurrency })
                : undefined,
            slug: job.slug,
          })),
        })
      }
    }
    return digests
  },
})

export const markSent = internalMutation({
  args: { id: v.id('jobAlerts') },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.id, { lastSentAt: Date.now() })
  },
})

export const runAlerts = internalAction({
  args: { frequencies: frequencyArg },
  handler: async (ctx, args): Promise<number> => {
    const site = (process.env.SITE_URL ?? 'https://devrel.studio').replace(/\/$/, '')
    const digests: Digest[] = await ctx.runQuery(internal.jobAlerts.collectDigests, {
      frequencies: args.frequencies,
    })
    let sent = 0

    for (const digest of digests) {
      const result = await ctx.runAction(internal.email.sendJobAlert, {
        email: digest.email,
        firstName: digest.firstName,
        alertName: digest.alertName,
        jobs: digest.jobs.map((job) => ({
          title: job.title,
          company: job.company,
          location: job.location,
          pay: job.pay,
          url: `${site}/jobs/${job.slug}`,
        })),
        boardUrl: `${site}/dashboard/jobs`,
        manageUrl: `${site}/dashboard/jobs/alerts`,
      })
      if (result.ok) {
        await ctx.runMutation(internal.jobAlerts.markSent, { id: digest.alertId })
        sent++
      }
    }
    return sent
  },
})
