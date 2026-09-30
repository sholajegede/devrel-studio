import { ConvexError, v } from 'convex/values'
import { internal } from './_generated/api'
import { Doc, Id } from './_generated/dataModel'
import { internalAction, internalMutation, internalQuery, mutation, query } from './_generated/server'
import { getCurrentUser, requireCurrentUser } from './model/auth'
import { kitUsage } from './jobPro'
import { buildPrompt, kitText, parseKit, proofLines, repairPrompt, type KitOutput, type ProofItem } from '../lib/jobs/kit'
import { proActive, tailorGate } from '../lib/jobs/pro'
import { findSlop, ungroundedNumbers } from '../lib/jobs/slop'
import { logServerEvent } from './model/jobEvents'

const ENDPOINT = 'https://api.anthropic.com/v1/messages'

export const request = mutation({
  args: { jobId: v.id('jobs') },
  handler: async (ctx, args): Promise<Id<'jobKits'>> => {
    const user = await requireCurrentUser(ctx)
    const job = await ctx.db.get(args.jobId)
    if (!job) throw new ConvexError('Job not found')

    const profile = await ctx.db
      .query('jobProfiles')
      .withIndex('by_user', (q) => q.eq('userId', user._id))
      .first()
    if (!profile?.cvText || profile.cvText.trim().length < 200) {
      throw new ConvexError('Add your CV first, under CV & preferences')
    }

    const now = Date.now()
    const gate = tailorGate({ pro: proActive(user, now), ...(await kitUsage(ctx, user._id, now)) })
    if (!gate.allowed) {
      throw new ConvexError(
        gate.reason === 'free-used-up'
          ? 'You have used your 3 free tailorings. Jobs Pro unlocks more.'
          : 'You have reached this month\'s fair-use limit.',
      )
    }

    // One pending kit per role at a time, so a double click does not spend two.
    const existing = await ctx.db
      .query('jobKits')
      .withIndex('by_user_and_job', (q) => q.eq('userId', user._id).eq('jobId', job._id))
      .order('desc')
      .first()
    if (existing && existing.status === 'pending' && now - existing.createdAt < 2 * 60 * 1000) return existing._id

    await logServerEvent(ctx, user._id, { event: 'kit_requested', slug: job.slug, company: job.companySlug, label: proActive(user, now) ? 'pro' : 'free' })
    const id = await ctx.db.insert('jobKits', {
      userId: user._id,
      jobId: job._id,
      jobSlug: job.slug,
      title: job.title,
      company: job.companyName,
      status: 'pending',
      createdAt: now,
    })
    await ctx.scheduler.runAfter(0, internal.jobKit.run, { kitId: id })
    return id
  },
})

export const forJob = query({
  args: { jobId: v.id('jobs') },
  handler: async (ctx, args) => {
    const user = await getCurrentUser(ctx)
    if (!user) return null
    return ctx.db
      .query('jobKits')
      .withIndex('by_user_and_job', (q) => q.eq('userId', user._id).eq('jobId', args.jobId))
      .order('desc')
      .first()
  },
})

export const mine = query({
  args: {},
  handler: async (ctx) => {
    const user = await getCurrentUser(ctx)
    if (!user) return []
    return ctx.db
      .query('jobKits')
      .withIndex('by_user', (q) => q.eq('userId', user._id))
      .order('desc')
      .take(30)
  },
})

interface KitContext {
  job: { title: string; company: string; seniority: string; skills: string[]; description: string }
  profile: { headline?: string; skills: string[]; yearsExperience?: number; cvText: string }
  proof: ProofItem[]
}

export const context = internalQuery({
  args: { kitId: v.id('jobKits') },
  handler: async (ctx, args): Promise<KitContext | null> => {
    const kit = await ctx.db.get(args.kitId)
    if (!kit || !kit.jobId) return null
    const job = kit.jobId ? await ctx.db.get(kit.jobId) : null
    if (!job) return null
    const description = await ctx.db
      .query('jobDescriptions')
      .withIndex('by_job', (q) => q.eq('jobId', job._id))
      .first()
    const profile = await ctx.db
      .query('jobProfiles')
      .withIndex('by_user', (q) => q.eq('userId', kit.userId))
      .first()
    if (!profile?.cvText) return null

    const workspaces = await ctx.db
      .query('workspaces')
      .withIndex('by_owner', (q) => q.eq('ownerId', kit.userId))
      .take(10)
    const entries: Doc<'contentEntries'>[] = []
    for (const workspace of workspaces) {
      const rows = await ctx.db
        .query('contentEntries')
        .withIndex('by_workspace', (q) => q.eq('workspaceId', workspace._id))
        .take(200)
      entries.push(...rows.filter((row) => row.status === 'Published' && row.link))
    }
    const proof: ProofItem[] = entries
      .sort((a, b) => b.publicationDate.localeCompare(a.publicationDate))
      .slice(0, 15)
      .map((row) => ({
        title: row.title,
        category: row.category,
        platform: row.platform,
        date: row.publicationDate,
        views: row.views,
        link: row.link,
      }))

    return {
      job: {
        title: job.title,
        company: job.companyName,
        seniority: job.seniority,
        skills: job.skills,
        description: description?.text ?? job.summary,
      },
      profile: {
        headline: profile.headline,
        skills: profile.skills,
        yearsExperience: profile.yearsExperience,
        cvText: profile.cvText,
      },
      proof,
    }
  },
})

export const save = internalMutation({
  args: {
    kitId: v.id('jobKits'),
    summary: v.string(),
    bullets: v.array(v.string()),
    coverNote: v.string(),
    gaps: v.array(v.string()),
    flags: v.array(v.string()),
  },
  handler: async (ctx, { kitId, ...rest }) => {
    await ctx.db.patch(kitId, { ...rest, status: 'ready' })
    const kit = await ctx.db.get(kitId)
    if (kit) {
      const job = kit.jobId ? await ctx.db.get(kit.jobId) : null
      await logServerEvent(ctx, kit.userId, { event: 'kit_done', slug: kit.jobSlug, company: job?.companySlug, n: rest.flags.length })
    }
  },
})

export const fail = internalMutation({
  args: { kitId: v.id('jobKits'), error: v.string() },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.kitId, { status: 'failed', error: args.error.slice(0, 300) })
    const kit = await ctx.db.get(args.kitId)
    if (kit) {
      const job = kit.jobId ? await ctx.db.get(kit.jobId) : null
      await logServerEvent(ctx, kit.userId, { event: 'kit_failed', slug: kit.jobSlug, company: job?.companySlug, label: args.error.slice(0, 60) })
    }
  },
})

async function callModel(system: string, user: string): Promise<string> {
  const key = process.env.ANTHROPIC_API_KEY
  if (!key) throw new Error('ANTHROPIC_API_KEY is not set on Convex')
  const response = await fetch(ENDPOINT, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-api-key': key, 'anthropic-version': '2023-06-01' },
    body: JSON.stringify({
      model: process.env.JOBS_AI_MODEL ?? 'claude-sonnet-4-5',
      max_tokens: 1800,
      temperature: 0.4,
      system,
      messages: [{ role: 'user', content: user }],
    }),
  })
  if (!response.ok) throw new Error(`Model request failed (${response.status})`)
  const data = (await response.json()) as { content?: { type: string; text?: string }[] }
  return data.content?.filter((part) => part.type === 'text').map((part) => part.text ?? '').join('') ?? ''
}

function problemsIn(output: KitOutput, sources: string[]): string[] {
  const text = kitText(output)
  const problems = findSlop(text).map((hit) => `${hit.rule}: "${hit.match}"`)
  const numbers = ungroundedNumbers(text, sources)
  if (numbers.length) problems.push(`numbers not in the CV or tracked work: ${numbers.join(', ')}. Remove them.`)
  return problems
}

export const run = internalAction({
  args: { kitId: v.id('jobKits') },
  handler: async (ctx, args): Promise<void> => {
    try {
      const data: KitContext | null = await ctx.runQuery(internal.jobKit.context, { kitId: args.kitId })
      if (!data) throw new Error('Missing role or CV')

      const { system, user } = buildPrompt(data.job, data.profile, data.proof)
      let output = parseKit(await callModel(system, user))
      if (!output) throw new Error('The model did not return a usable kit')

      const sources = [data.profile.cvText, ...proofLines(data.proof), String(data.profile.yearsExperience ?? ''), data.job.title, data.job.company]
      let problems = problemsIn(output, sources)
      for (let pass = 0; pass < 2 && problems.length > 0; pass++) {
        const repaired = parseKit(await callModel(system, repairPrompt(output, problems)))
        if (!repaired) break
        output = repaired
        problems = problemsIn(output, sources)
      }

      await ctx.runMutation(internal.jobKit.save, {
        kitId: args.kitId,
        summary: output.summary,
        bullets: output.bullets,
        coverNote: output.coverNote,
        gaps: output.gaps,
        flags: problems,
      })
    } catch (error) {
      await ctx.runMutation(internal.jobKit.fail, {
        kitId: args.kitId,
        error: error instanceof Error ? error.message : 'Could not build the kit',
      })
    }
  },
})
