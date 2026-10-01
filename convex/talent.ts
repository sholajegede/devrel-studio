import { ConvexError, v } from 'convex/values'
import { internal } from './_generated/api'
import { Doc } from './_generated/dataModel'
import { action, internalMutation, internalQuery, mutation, query, QueryCtx } from './_generated/server'
import { getCurrentUser, getRealUser, requireCurrentUser } from './model/auth'
import { callClaude } from './model/claude'
import { enforceRateLimit } from './model/rateLimit'
import { extractJson } from '../lib/blog/draft'
import {
  TalentInput, cleanTalent, completeness, contactProblems, listingBlockers, summariseProof,
} from '../lib/hire/talent'

// ── /hire ─────────────────────────────────────────────────────────────────────
//
// A DevRel appears on /hire only after they switch it on, and only when the
// profile has the basics. Everything a public query returns is built by hand
// from `talentProfiles`, `users` and published `contentEntries`. Email addresses,
// CV text and private notes never leave through these queries.
//
// Contact goes through the platform: a recruiter fills a form and the DevRel
// receives an email with the recruiter's address as the reply-to. The DevRel's
// own address is never shown.

const experience = v.object({ company: v.string(), title: v.string(), start: v.optional(v.string()), end: v.optional(v.string()), summary: v.optional(v.string()) })
const education = v.object({ school: v.string(), degree: v.optional(v.string()), year: v.optional(v.string()) })
const project = v.object({ name: v.string(), url: v.optional(v.string()), summary: v.optional(v.string()) })
const community = v.object({ name: v.string(), role: v.optional(v.string()), url: v.optional(v.string()) })

const profileFields = {
  headline: v.optional(v.string()),
  summary: v.optional(v.string()),
  country: v.optional(v.string()),
  city: v.optional(v.string()),
  timezone: v.optional(v.string()),
  availability: v.optional(v.string()),
  workModes: v.array(v.string()),
  engagements: v.array(v.string()),
  seniority: v.optional(v.string()),
  families: v.array(v.string()),
  skills: v.array(v.string()),
  languages: v.array(v.string()),
  yearsExperience: v.optional(v.number()),
  experience: v.array(experience),
  education: v.array(education),
  projects: v.array(project),
  communities: v.array(community),
}

const toInput = (row: Doc<'talentProfiles'> | null): TalentInput => ({
  headline: row?.headline,
  summary: row?.summary,
  country: row?.country,
  city: row?.city,
  timezone: row?.timezone,
  availability: row?.availability,
  workModes: row?.workModes ?? [],
  engagements: row?.engagements ?? [],
  seniority: row?.seniority,
  families: row?.families ?? [],
  skills: row?.skills ?? [],
  languages: row?.languages ?? [],
  yearsExperience: row?.yearsExperience,
  experience: row?.experience ?? [],
  education: row?.education ?? [],
  projects: row?.projects ?? [],
  communities: row?.communities ?? [],
})

async function proofFor(ctx: QueryCtx, userId: Doc<'users'>['_id']) {
  const entries = await ctx.db
    .query('contentEntries')
    .withIndex('by_user', (q) => q.eq('userId', userId))
    .take(400)
  return summariseProof(entries.filter((entry) => entry.status === 'Published'))
}

async function publicShape(ctx: QueryCtx, row: Doc<'talentProfiles'>) {
  const user = await ctx.db.get(row.userId)
  if (!user?.handle) return null
  return {
    handle: user.handle,
    name: `${user.firstName ?? ''} ${user.lastName ?? ''}`.trim() || user.handle,
    imageUrl: user.imageUrl,
    githubUsername: user.githubUsername,
    twitterUsername: user.twitterUsername,
    websiteUrl: user.websiteUrl,
    openToWork: row.openToWork,
    headline: row.headline,
    summary: row.summary,
    country: row.country,
    city: row.city,
    timezone: row.timezone,
    availability: row.availability,
    workModes: row.workModes,
    engagements: row.engagements,
    seniority: row.seniority,
    families: row.families,
    skills: row.skills,
    languages: row.languages,
    yearsExperience: row.yearsExperience,
    experience: row.experience,
    education: row.education,
    projects: row.projects,
    communities: row.communities,
    proof: await proofFor(ctx, row.userId),
    updatedAt: row.updatedAt,
  }
}

// ── Public reads ──────────────────────────────────────────────────────────────

/** ⚠ PUBLIC. Everyone who chose to be listed. Ranking and filtering run in the browser. */
export const listTalent = query({
  args: {},
  handler: async (ctx) => {
    const rows = await ctx.db
      .query('talentProfiles')
      .withIndex('by_listed', (q) => q.eq('listed', true))
      .take(150)
    const out = []
    for (const row of rows) {
      const shaped = await publicShape(ctx, row)
      if (shaped) out.push(shaped)
    }
    return out
  },
})

/** ⚠ PUBLIC. One listed profile, or null. */
export const getTalent = query({
  args: { handle: v.string() },
  handler: async (ctx, args) => {
    const user = await ctx.db
      .query('users')
      .withIndex('by_handle', (q) => q.eq('handle', args.handle.toLowerCase()))
      .first()
    if (!user) return null
    const row = await ctx.db
      .query('talentProfiles')
      .withIndex('by_user', (q) => q.eq('userId', user._id))
      .first()
    if (!row?.listed) return null
    return await publicShape(ctx, row)
  },
})

// ── The owner's own profile ───────────────────────────────────────────────────

export const mine = query({
  args: {},
  handler: async (ctx) => {
    const user = await getCurrentUser(ctx)
    if (!user) return null
    const row = await ctx.db
      .query('talentProfiles')
      .withIndex('by_user', (q) => q.eq('userId', user._id))
      .first()
    const proof = await proofFor(ctx, user._id)
    const input = toInput(row)
    const jobProfile = await ctx.db
      .query('jobProfiles')
      .withIndex('by_user', (q) => q.eq('userId', user._id))
      .first()
    return {
      handle: user.handle ?? null,
      listed: row?.listed ?? false,
      openToWork: row?.openToWork ?? false,
      profile: input,
      blockers: [...(user.handle ? [] : ['Choose a handle in Settings.']), ...listingBlockers(input)],
      completeness: completeness(input, proof.published > 0),
      proof,
      hasCv: Boolean(jobProfile?.cvText && jobProfile.cvText.length > 80),
      // Suggested starting points from the job profile, used when the form is empty.
      jobSkills: jobProfile?.skills ?? [],
      jobFamilies: jobProfile?.families ?? [],
      jobSeniority: jobProfile?.seniority,
      jobCountry: jobProfile?.country,
      jobYears: jobProfile?.yearsExperience,
    }
  },
})

export const save = mutation({
  args: profileFields,
  handler: async (ctx, args) => {
    const user = await requireCurrentUser(ctx)
    const clean = cleanTalent(args as TalentInput)
    const existing = await ctx.db
      .query('talentProfiles')
      .withIndex('by_user', (q) => q.eq('userId', user._id))
      .first()
    if (existing) {
      await ctx.db.patch(existing._id, { ...clean, updatedAt: Date.now() })
      // Editing a listed profile into a state that no longer qualifies takes it down.
      if (existing.listed && listingBlockers(clean).length > 0) {
        await ctx.db.patch(existing._id, { listed: false })
      }
      return
    }
    await ctx.db.insert('talentProfiles', { userId: user._id, listed: false, openToWork: false, ...clean, updatedAt: Date.now() })
  },
})

export const setListing = mutation({
  args: { listed: v.boolean(), openToWork: v.boolean() },
  handler: async (ctx, args) => {
    const user = await requireCurrentUser(ctx)
    const row = await ctx.db
      .query('talentProfiles')
      .withIndex('by_user', (q) => q.eq('userId', user._id))
      .first()
    if (!row) throw new ConvexError('Save your profile first')
    if (args.listed) {
      if (!user.handle) throw new ConvexError('Choose a handle in Settings first')
      const blockers = listingBlockers(toInput(row))
      if (blockers.length) throw new ConvexError(blockers[0])
    }
    await ctx.db.patch(row._id, {
      listed: args.listed,
      openToWork: args.listed ? args.openToWork : false,
      listedAt: args.listed && !row.listed ? Date.now() : row.listedAt,
      updatedAt: Date.now(),
    })
  },
})

export const myContacts = query({
  args: {},
  handler: async (ctx) => {
    const user = await getCurrentUser(ctx)
    if (!user) return []
    const rows = await ctx.db
      .query('talentContacts')
      .withIndex('by_talent', (q) => q.eq('talentUserId', user._id))
      .order('desc')
      .take(50)
    return rows.map((row) => ({ id: row._id, name: row.name, email: row.email, company: row.company, message: row.message, createdAt: row.createdAt }))
  },
})

// ── Contact ───────────────────────────────────────────────────────────────────

export const contact = mutation({
  args: {
    handle: v.string(),
    name: v.string(),
    email: v.string(),
    company: v.string(),
    message: v.string(),
    // Honeypot. A person never sees this field, so a value means a script.
    website: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const problems = contactProblems(args)
    if (problems.length) throw new ConvexError(problems[0])

    const user = await ctx.db
      .query('users')
      .withIndex('by_handle', (q) => q.eq('handle', args.handle.toLowerCase()))
      .first()
    const row = user
      ? await ctx.db.query('talentProfiles').withIndex('by_user', (q) => q.eq('userId', user._id)).first()
      : null
    if (!user || !row?.listed) throw new ConvexError('This profile is not available')

    const email = args.email.trim().toLowerCase()
    await enforceRateLimit(ctx, 'talent-contact-email', email, 3, 'You have sent several messages. Try again in an hour.')
    await enforceRateLimit(ctx, 'talent-contact-profile', user._id, 12, 'This person has had many messages already. Try again later.')

    const message = {
      talentUserId: user._id,
      name: args.name.trim().slice(0, 80),
      email,
      company: args.company.trim().slice(0, 100),
      message: args.message.trim(),
      createdAt: Date.now(),
    }
    await ctx.db.insert('talentContacts', message)
    await ctx.scheduler.runAfter(0, internal.email.sendTalentContact, {
      to: user.email,
      talentName: user.firstName ?? user.handle ?? 'there',
      fromName: message.name,
      fromEmail: message.email,
      company: message.company,
      message: message.message,
    })
  },
})

// ── Fill from CV ──────────────────────────────────────────────────────────────

export const cvForCaller = internalQuery({
  args: {},
  handler: async (ctx) => {
    const user = await getRealUser(ctx)
    if (!user) return null
    const row = await ctx.db.query('jobProfiles').withIndex('by_user', (q) => q.eq('userId', user._id)).first()
    return { userId: user._id, text: row?.cvText ?? '' }
  },
})

export const claimCvFill = internalMutation({
  args: { userId: v.id('users') },
  handler: async (ctx, args) => {
    await enforceRateLimit(ctx, 'talent-cv-fill', args.userId, 6, 'You have used the CV reader several times. Try again in an hour.')
  },
})

const CV_SYSTEM = `You read a CV and fill in a profile for a developer relations professional. Return one JSON object and nothing else.
Rules:
- Use only what the CV says. Never add an employer, date, school, project, community, number or claim that is not in it. If a field is missing, leave it empty.
- Write the summary in first person, in plain words, 2 to 4 sentences, built only from facts in the CV. No words like passionate, driven, innovative or results-oriented.
- The headline is a plain role line under 100 characters, for example "Developer advocate for developer infrastructure and AI".
- Dates as written in the CV, such as "Mar 2023" or "2021". Use "Present" for a current role.
- Communities are groups the person belongs to or runs (for example a developer community or champion program). Do not list employers.
Shape: {"headline":string,"summary":string,"yearsExperience":number|null,"languages":string[],"experience":[{"company":string,"title":string,"start":string,"end":string,"summary":string}],"education":[{"school":string,"degree":string,"year":string}],"projects":[{"name":string,"url":string,"summary":string}],"communities":[{"name":string,"role":string,"url":string}]}
Keep experience summaries to one sentence each. At most 8 experience rows, 5 education rows, 6 projects and 8 communities.`

/** Reads the saved CV and returns a suggestion. Nothing is saved until the owner reviews it. */
export const fillFromCv = action({
  args: {},
  handler: async (ctx): Promise<Partial<TalentInput>> => {
    const source = await ctx.runQuery(internal.talent.cvForCaller, {})
    if (!source) throw new ConvexError('Sign in first')
    if (source.text.trim().length < 120) throw new ConvexError('Upload your CV under Jobs, CV & preferences first')
    await ctx.runMutation(internal.talent.claimCvFill, { userId: source.userId })

    const raw = await callClaude({ system: CV_SYSTEM, user: `CV:\n${source.text.slice(0, 24000)}`, maxTokens: 3500 })
    const parsed = extractJson<Record<string, unknown>>(raw)
    if (!parsed) throw new ConvexError('The CV could not be read. Try again.')

    const blank: TalentInput = { workModes: [], engagements: [], families: [], skills: [], languages: [], experience: [], education: [], projects: [], communities: [] }
    const arr = <T,>(value: unknown): T[] => (Array.isArray(value) ? (value as T[]) : [])
    const str = (value: unknown) => (typeof value === 'string' ? value : undefined)
    const cleaned = cleanTalent({
      ...blank,
      headline: str(parsed.headline),
      summary: str(parsed.summary),
      yearsExperience: typeof parsed.yearsExperience === 'number' ? parsed.yearsExperience : undefined,
      languages: arr<string>(parsed.languages).filter((item) => typeof item === 'string'),
      experience: arr<Record<string, unknown>>(parsed.experience).map((row) => ({ company: str(row.company) ?? '', title: str(row.title) ?? '', start: str(row.start), end: str(row.end), summary: str(row.summary) })),
      education: arr<Record<string, unknown>>(parsed.education).map((row) => ({ school: str(row.school) ?? '', degree: str(row.degree), year: str(row.year) })),
      projects: arr<Record<string, unknown>>(parsed.projects).map((row) => ({ name: str(row.name) ?? '', url: str(row.url), summary: str(row.summary) })),
      communities: arr<Record<string, unknown>>(parsed.communities).map((row) => ({ name: str(row.name) ?? '', role: str(row.role), url: str(row.url) })),
    })
    return {
      headline: cleaned.headline,
      summary: cleaned.summary,
      yearsExperience: cleaned.yearsExperience,
      languages: cleaned.languages,
      experience: cleaned.experience,
      education: cleaned.education,
      projects: cleaned.projects,
      communities: cleaned.communities,
    }
  },
})

/** For the sitemap: handles of everyone listed. */
export const listedHandles = query({
  args: {},
  handler: async (ctx) => {
    const rows = await ctx.db.query('talentProfiles').withIndex('by_listed', (q) => q.eq('listed', true)).take(500)
    const out: { handle: string; updatedAt: number }[] = []
    for (const row of rows) {
      const user = await ctx.db.get(row.userId)
      if (user?.handle) out.push({ handle: user.handle, updatedAt: row.updatedAt })
    }
    return out
  },
})
