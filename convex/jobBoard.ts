import { ConvexError, v } from 'convex/values'
import { internal } from './_generated/api'
import { Doc, Id } from './_generated/dataModel'
import { MutationCtx, internalMutation, mutation, query } from './_generated/server'
import { getCurrentUser, requireCurrentUser } from './model/auth'
import { analyseCv } from '../lib/jobs/cv'
import { isStageId } from '../lib/jobs/stages'
import { isFamilyId, isSeniorityId } from '../lib/jobs/taxonomy'

const MAX_CV_BYTES = 5 * 1024 * 1024
const MAX_SKILLS = 60
const MAX_APPLICATIONS = 1000
const WORKPLACES = ['remote', 'hybrid', 'onsite']

function cleanList(values: string[], limit: number, maxLength = 40): string[] {
  return [...new Set(values.map((value) => value.trim().slice(0, maxLength)).filter(Boolean))].slice(0, limit)
}

export const myProfile = query({
  args: {},
  handler: async (ctx) => {
    const user = await getCurrentUser(ctx)
    if (!user) return null
    const row = await ctx.db
      .query('jobProfiles')
      .withIndex('by_user', (q) => q.eq('userId', user._id))
      .first()
    if (!row) return { exists: false as const }
    const { cvText, cvStorageId, ...rest } = row
    return { exists: true as const, ...rest, hasCv: Boolean(cvStorageId || cvText) }
  },
})

async function upsertProfile(
  ctx: MutationCtx,
  userId: Id<'users'>,
  patch: Partial<Omit<Doc<'jobProfiles'>, '_id' | '_creationTime' | 'userId'>>,
) {
  const existing = await ctx.db
    .query('jobProfiles')
    .withIndex('by_user', (q) => q.eq('userId', userId))
    .first()
  if (existing) {
    await ctx.db.patch(existing._id, { ...patch, updatedAt: Date.now() })
    return existing._id
  }
  return ctx.db.insert('jobProfiles', {
    userId,
    skills: [],
    families: [],
    workplaces: [],
    updatedAt: Date.now(),
    ...patch,
  })
}

export const saveProfile = mutation({
  args: {
    skills: v.array(v.string()),
    families: v.array(v.string()),
    seniority: v.optional(v.string()),
    workplaces: v.array(v.string()),
    country: v.optional(v.string()),
    minSalaryUsd: v.optional(v.number()),
    headline: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const user = await requireCurrentUser(ctx)
    if (args.seniority && !isSeniorityId(args.seniority)) throw new ConvexError('Unknown seniority')
    if (args.country && !/^[A-Z]{2}$/.test(args.country)) throw new ConvexError('Unknown country')
    if (args.minSalaryUsd !== undefined && (args.minSalaryUsd < 0 || args.minSalaryUsd > 2_000_000)) {
      throw new ConvexError('Enter a yearly figure in US dollars')
    }
    await upsertProfile(ctx, user._id, {
      skills: cleanList(args.skills, MAX_SKILLS),
      families: args.families.filter(isFamilyId),
      seniority: args.seniority,
      workplaces: args.workplaces.filter((value) => WORKPLACES.includes(value)),
      country: args.country,
      minSalaryUsd: args.minSalaryUsd,
      headline: args.headline?.trim().slice(0, 120) || undefined,
    })
  },
})

export const generateCvUploadUrl = mutation({
  args: {},
  handler: async (ctx) => {
    await requireCurrentUser(ctx)
    return ctx.storage.generateUploadUrl()
  },
})

export const attachCv = mutation({
  args: { storageId: v.id('_storage'), fileName: v.string(), contentType: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const user = await requireCurrentUser(ctx)
    const meta = await ctx.db.system.get(args.storageId)
    if (!meta || meta.size > MAX_CV_BYTES) {
      await ctx.storage.delete(args.storageId)
      throw new ConvexError('Files up to 5 MB, please')
    }

    const existing = await ctx.db
      .query('jobProfiles')
      .withIndex('by_user', (q) => q.eq('userId', user._id))
      .first()
    if (existing?.cvStorageId && existing.cvStorageId !== args.storageId) {
      await ctx.storage.delete(existing.cvStorageId)
    }

    await upsertProfile(ctx, user._id, {
      cvStorageId: args.storageId,
      cvFileName: args.fileName.slice(0, 120),
      cvStatus: 'processing',
    })
    await ctx.scheduler.runAfter(0, internal.jobCv.parseStoredCv, {
      userId: user._id,
      storageId: args.storageId,
      fileName: args.fileName,
      contentType: args.contentType,
    })
  },
})

function analysisPatch(text: string) {
  const analysis = analyseCv(text)
  return {
    cvText: text.slice(0, 60_000),
    skills: analysis.skills.slice(0, MAX_SKILLS),
    families: analysis.families,
    seniority: analysis.seniority,
    yearsExperience: analysis.yearsExperience,
    headline: analysis.headline,
    cvStatus: 'ready',
  }
}

export const applyCvText = internalMutation({
  args: {
    userId: v.id('users'),
    storageId: v.id('_storage'),
    fileName: v.string(),
    text: v.string(),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query('jobProfiles')
      .withIndex('by_user', (q) => q.eq('userId', args.userId))
      .first()
    if (!existing || existing.cvStorageId !== args.storageId) return

    if (args.text.trim().length < 80) {
      await ctx.db.patch(existing._id, { cvStatus: 'unreadable', updatedAt: Date.now() })
      return
    }
    await ctx.db.patch(existing._id, { ...analysisPatch(args.text), updatedAt: Date.now() })
  },
})

export const setCvText = mutation({
  args: { text: v.string() },
  handler: async (ctx, args) => {
    const user = await requireCurrentUser(ctx)
    if (args.text.trim().length < 80) throw new ConvexError('Paste a little more of your CV')
    const existing = await ctx.db
      .query('jobProfiles')
      .withIndex('by_user', (q) => q.eq('userId', user._id))
      .first()
    if (existing?.cvStorageId) await ctx.storage.delete(existing.cvStorageId)
    await upsertProfile(ctx, user._id, {
      ...analysisPatch(args.text),
      cvStorageId: undefined,
      cvFileName: 'Pasted text',
    })
  },
})

export const removeCv = mutation({
  args: {},
  handler: async (ctx) => {
    const user = await requireCurrentUser(ctx)
    const existing = await ctx.db
      .query('jobProfiles')
      .withIndex('by_user', (q) => q.eq('userId', user._id))
      .first()
    if (!existing) return
    if (existing.cvStorageId) await ctx.storage.delete(existing.cvStorageId)
    await ctx.db.patch(existing._id, {
      cvStorageId: undefined,
      cvFileName: undefined,
      cvText: undefined,
      cvStatus: undefined,
      updatedAt: Date.now(),
    })
  },
})

// ── Tracker ───────────────────────────────────────────────────────────────────

export const applications = query({
  args: {},
  handler: async (ctx) => {
    const user = await getCurrentUser(ctx)
    if (!user) return null
    const rows = await ctx.db
      .query('jobApplications')
      .withIndex('by_user', (q) => q.eq('userId', user._id))
      .order('desc')
      .take(MAX_APPLICATIONS)

    return Promise.all(
      rows.map(async (row) => {
        const job = row.jobId ? await ctx.db.get(row.jobId) : null
        return {
          ...row,
          listing: row.jobId
            ? job
              ? { slug: job.slug, status: job.status, lastVerifiedAt: job.lastVerifiedAt }
              : { slug: null, status: 'gone' as const, lastVerifiedAt: null }
            : null,
        }
      }),
    )
  },
})

async function ensureRoom(ctx: MutationCtx, userId: Id<'users'>) {
  const rows = await ctx.db
    .query('jobApplications')
    .withIndex('by_user', (q) => q.eq('userId', userId))
    .take(MAX_APPLICATIONS)
  if (rows.length >= MAX_APPLICATIONS) throw new ConvexError('Tracker is full')
}

export const saveJob = mutation({
  args: { jobId: v.id('jobs') },
  handler: async (ctx, args) => {
    const user = await requireCurrentUser(ctx)
    const existing = await ctx.db
      .query('jobApplications')
      .withIndex('by_user_and_job', (q) => q.eq('userId', user._id).eq('jobId', args.jobId))
      .first()
    if (existing) return existing._id

    const job = await ctx.db.get(args.jobId)
    if (!job) throw new ConvexError('Job not found')
    await ensureRoom(ctx, user._id)

    const now = Date.now()
    return ctx.db.insert('jobApplications', {
      userId: user._id,
      jobId: job._id,
      title: job.title,
      company: job.companyName,
      url: job.applyUrl,
      location: job.locationLabel,
      stage: 'saved',
      history: [{ stage: 'saved', at: now }],
      createdAt: now,
      updatedAt: now,
    })
  },
})

export const addManual = mutation({
  args: {
    title: v.string(),
    company: v.string(),
    url: v.optional(v.string()),
    location: v.optional(v.string()),
    stage: v.optional(v.string()),
    notes: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const user = await requireCurrentUser(ctx)
    const title = args.title.trim().slice(0, 140)
    const company = args.company.trim().slice(0, 100)
    if (!title || !company) throw new ConvexError('Add a role and a company')
    const stage = args.stage ?? 'applied'
    if (!isStageId(stage)) throw new ConvexError('Unknown stage')
    const url = args.url?.trim()
    if (url && !/^https?:\/\//i.test(url)) throw new ConvexError('Links start with https://')
    await ensureRoom(ctx, user._id)

    const now = Date.now()
    return ctx.db.insert('jobApplications', {
      userId: user._id,
      title,
      company,
      url: url || undefined,
      location: args.location?.trim().slice(0, 100) || undefined,
      stage,
      appliedAt: stage === 'saved' ? undefined : now,
      notes: args.notes?.trim().slice(0, 4000) || undefined,
      history: [{ stage, at: now }],
      createdAt: now,
      updatedAt: now,
    })
  },
})

async function ownApplication(ctx: MutationCtx, id: Id<'jobApplications'>) {
  const user = await requireCurrentUser(ctx)
  const row = await ctx.db.get(id)
  if (!row || row.userId !== user._id) throw new ConvexError('Not found')
  return row
}

export const setStage = mutation({
  args: { id: v.id('jobApplications'), stage: v.string() },
  handler: async (ctx, args) => {
    const row = await ownApplication(ctx, args.id)
    if (!isStageId(args.stage)) throw new ConvexError('Unknown stage')
    if (row.stage === args.stage) return
    const now = Date.now()
    await ctx.db.patch(row._id, {
      stage: args.stage,
      appliedAt: row.appliedAt ?? (args.stage === 'saved' ? undefined : now),
      history: [...row.history, { stage: args.stage, at: now }].slice(-40),
      updatedAt: now,
    })
  },
})

export const updateApplication = mutation({
  args: {
    id: v.id('jobApplications'),
    notes: v.optional(v.string()),
    nextStep: v.optional(v.string()),
    nextStepAt: v.optional(v.union(v.number(), v.null())),
    contact: v.optional(v.string()),
    salaryNote: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const row = await ownApplication(ctx, args.id)
    const text = (value: string | undefined, max: number) =>
      value === undefined ? undefined : value.trim().slice(0, max) || undefined
    await ctx.db.patch(row._id, {
      ...(args.notes !== undefined ? { notes: text(args.notes, 4000) } : {}),
      ...(args.nextStep !== undefined ? { nextStep: text(args.nextStep, 200) } : {}),
      ...(args.nextStepAt !== undefined ? { nextStepAt: args.nextStepAt ?? undefined } : {}),
      ...(args.contact !== undefined ? { contact: text(args.contact, 200) } : {}),
      ...(args.salaryNote !== undefined ? { salaryNote: text(args.salaryNote, 200) } : {}),
      updatedAt: Date.now(),
    })
  },
})

export const removeApplication = mutation({
  args: { id: v.id('jobApplications') },
  handler: async (ctx, args) => {
    const row = await ownApplication(ctx, args.id)
    await ctx.db.delete(row._id)
  },
})
