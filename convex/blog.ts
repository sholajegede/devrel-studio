import { ConvexError, v } from 'convex/values'
import { internal } from './_generated/api'
import { Doc, Id } from './_generated/dataModel'
import { ActionCtx, MutationCtx, internalAction, internalMutation, internalQuery, mutation, query } from './_generated/server'
import { requireAdmin } from './model/admin'
import { callClaude } from './model/claude'
import {
  FACT_CHECK_SYSTEM, PRODUCT_FACTS, factCheckUser, factRepairUser, repairUser, researchPrompt, topicPrompt, writerSystem, writerUser, AVOID_AI_SYSTEM, polishUser,
} from '../lib/blog/prompts'
import { Claim, Draft, checkDraft, draftToText, extractJson, parseClaims, parseDraft } from '../lib/blog/draft'
import { parseMarkdown, plainText, readingMinutes, wordCount } from '../lib/blog/markdown'
import { sanitizeSvg } from '../lib/blog/svg'
import { BACKLOG, findDuplicate } from '../lib/blog/topics'
import { newToken, sameHash, sha256 } from '../lib/blog/token'

// ── The blog ──────────────────────────────────────────────────────────────────
//
// Monday, Wednesday and Friday a cron picks a topic, researches it, writes it,
// checks the style, fact-checks every claim against the web, and emails the
// result for review. Nothing is public until a person publishes it.

const REVIEW_TO = () => process.env.BLOG_REVIEW_EMAIL ?? 'me@sholajegede.com'
const siteUrl = () => (process.env.SITE_URL ?? 'https://devrel.studio').replace(/\/$/, '')

// ── Public reads ──────────────────────────────────────────────────────────────

const card = (post: Doc<'blogPosts'>) => ({
  slug: post.slug,
  title: post.title,
  description: post.description,
  keyword: post.keyword,
  publishedAt: post.publishedAt ?? post.createdAt,
  readingMinutes: post.readingMinutes,
})

export const list = query({
  args: {},
  handler: async (ctx) => {
    const rows = await ctx.db
      .query('blogPosts')
      .withIndex('by_status_and_published', (q) => q.eq('status', 'published'))
      .order('desc')
      .take(200)
    return rows.map(card)
  },
})

export const bySlug = query({
  args: { slug: v.string() },
  handler: async (ctx, args) => {
    const post = await ctx.db.query('blogPosts').withIndex('by_slug', (q) => q.eq('slug', args.slug)).first()
    if (!post || post.status !== 'published') return null
    const more = await ctx.db
      .query('blogPosts')
      .withIndex('by_status_and_published', (q) => q.eq('status', 'published'))
      .order('desc')
      .take(4)
    return {
      ...card(post),
      body: post.body,
      faq: post.faq,
      sources: post.sources,
      updatedAt: post.updatedAt,
      more: more.filter((row) => row.slug !== post.slug).slice(0, 3).map(card),
    }
  },
})

// ── Review ────────────────────────────────────────────────────────────────────

async function matchesToken(post: Doc<'blogPosts'>, token: string): Promise<boolean> {
  if (!post.reviewTokenHash || token.length < 20) return false
  return sameHash(post.reviewTokenHash, await sha256(token))
}

const reviewView = (post: Doc<'blogPosts'>) => ({
  id: post._id,
  slug: post.slug,
  title: post.title,
  description: post.description,
  keyword: post.keyword,
  body: post.body,
  faq: post.faq,
  status: post.status,
  whyNow: post.whyNow,
  sources: post.sources,
  claims: post.claims,
  problems: post.problems,
  words: post.words,
})

export const forReview = query({
  args: { id: v.id('blogPosts'), token: v.string() },
  handler: async (ctx, args) => {
    const post = await ctx.db.get(args.id)
    if (!post || !(await matchesToken(post, args.token))) return null
    return reviewView(post)
  },
})

function validateForPublish(body: string): void {
  for (const block of parseMarkdown(body)) {
    if (block.t === 'svg' && !sanitizeSvg(block.v)) throw new ConvexError('A diagram is not valid SVG. Fix or remove it.')
  }
}

async function uniqueSlug(ctx: MutationCtx, wanted: string, self?: Id<'blogPosts'>): Promise<string> {
  let slug = wanted
  for (let n = 2; n < 50; n++) {
    const clash = await ctx.db.query('blogPosts').withIndex('by_slug', (q) => q.eq('slug', slug)).first()
    if (!clash || clash._id === self) return slug
    slug = `${wanted}-${n}`
  }
  return `${wanted}-${Date.now()}`
}

const edits = {
  title: v.optional(v.string()),
  description: v.optional(v.string()),
  body: v.optional(v.string()),
}

async function applyEdits(ctx: MutationCtx, post: Doc<'blogPosts'>, changes: { title?: string; description?: string; body?: string }) {
  const title = changes.title?.trim().slice(0, 120) || post.title
  const description = changes.description?.trim().slice(0, 200) || post.description
  const body = changes.body?.trim() || post.body
  if (body.length < 500) throw new ConvexError('The body is too short')
  const words = wordCount(plainText(parseMarkdown(body)))
  await ctx.db.patch(post._id, { title, description, body, words, readingMinutes: readingMinutes(words), updatedAt: Date.now() })
}

async function publish(ctx: MutationCtx, id: Id<'blogPosts'>) {
  const post = await ctx.db.get(id)
  if (!post) throw new ConvexError('Not found')
  validateForPublish(post.body)
  const now = Date.now()
  const slug = await uniqueSlug(ctx, post.slug, post._id)
  await ctx.db.patch(id, { status: 'published', slug, publishedAt: post.publishedAt ?? now, reviewedAt: now, reviewTokenHash: undefined, updatedAt: now })
  await ctx.scheduler.runAfter(0, internal.jobSync.pingSite, {})
}

/** The review page: edit, publish or reject. The token is the credential. */
export const review = mutation({
  args: { id: v.id('blogPosts'), token: v.string(), decision: v.union(v.literal('publish'), v.literal('reject'), v.literal('save')), ...edits },
  handler: async (ctx, args) => {
    const post = await ctx.db.get(args.id)
    if (!post || !(await matchesToken(post, args.token))) throw new ConvexError('This link is not valid any more')
    if (post.status !== 'pending') throw new ConvexError('This post was already decided')

    if (args.decision !== 'reject') await applyEdits(ctx, post, args)
    if (args.decision === 'publish') {
      await publish(ctx, post._id)
      return { status: 'published' as const }
    }
    if (args.decision === 'reject') {
      await ctx.db.patch(post._id, { status: 'rejected', reviewedAt: Date.now(), reviewTokenHash: undefined, updatedAt: Date.now() })
      return { status: 'rejected' as const }
    }
    return { status: 'pending' as const }
  },
})

// ── Admin ─────────────────────────────────────────────────────────────────────

export const adminList = query({
  args: {},
  handler: async (ctx) => {
    await requireAdmin(ctx)
    const rows = await ctx.db.query('blogPosts').order('desc').take(100)
    return rows.map((post) => ({
      id: post._id,
      slug: post.slug,
      title: post.title,
      status: post.status,
      words: post.words,
      keyword: post.keyword,
      createdAt: post.createdAt,
      publishedAt: post.publishedAt,
      error: post.error,
      updatedAt: post.updatedAt,
      hasDraft: post.body.length >= 500,
      verified: post.claims.filter((claim) => claim.verdict === 'verified').length,
      flagged: post.claims.filter((claim) => claim.verdict !== 'verified').length,
      problems: post.problems.length,
    }))
  },
})

export const adminGet = query({
  args: { id: v.id('blogPosts') },
  handler: async (ctx, args) => {
    await requireAdmin(ctx)
    const post = await ctx.db.get(args.id)
    return post ? reviewView(post) : null
  },
})

export const adminDecide = mutation({
  args: { id: v.id('blogPosts'), decision: v.union(v.literal('publish'), v.literal('reject'), v.literal('unpublish'), v.literal('save')), ...edits },
  handler: async (ctx, args) => {
    await requireAdmin(ctx, 'owner')
    const post = await ctx.db.get(args.id)
    if (!post) throw new ConvexError('Not found')
    if (args.decision !== 'reject' && args.decision !== 'unpublish') await applyEdits(ctx, post, args)
    if (args.decision === 'publish') await publish(ctx, post._id)
    if (args.decision === 'reject') await ctx.db.patch(post._id, { status: 'rejected', reviewedAt: Date.now(), reviewTokenHash: undefined, updatedAt: Date.now() })
    if (args.decision === 'unpublish') {
      await ctx.db.patch(post._id, { status: 'rejected', updatedAt: Date.now() })
      await ctx.scheduler.runAfter(0, internal.jobSync.pingSite, {})
    }
  },
})

/**
 * Tries a failed or stuck post again. A post that already has a draft keeps its
 * title, text and research, and only the fact check runs again. A post that
 * failed before any draft existed starts a new run.
 */
export const retry = mutation({
  args: { id: v.id('blogPosts') },
  handler: async (ctx, args) => {
    await requireAdmin(ctx, 'owner')
    const post = await ctx.db.get(args.id)
    if (!post) throw new ConvexError('Not found')
    const stuck = post.status === 'checking' && Date.now() - post.updatedAt > 12 * 60_000
    if (post.status !== 'failed' && !stuck) throw new ConvexError('Only a failed or stuck post can be retried')

    if (post.body.length >= 500) {
      await ctx.db.patch(post._id, { status: 'checking', error: undefined, updatedAt: Date.now() })
      await ctx.scheduler.runAfter(0, internal.blog.factCheck, { id: post._id })
    } else {
      await ctx.scheduler.runAfter(0, internal.blog.draftNext, { force: true })
    }
  },
})

/** Called when a check fails for a reason that usually passes on a second try. */
export const scheduleRetry = internalMutation({
  args: { id: v.id('blogPosts') },
  handler: async (ctx, args) => {
    const post = await ctx.db.get(args.id)
    if (!post) return false
    const attempts = post.attempts ?? 0
    if (attempts >= 2) return false
    await ctx.db.patch(post._id, { attempts: attempts + 1, status: 'checking', updatedAt: Date.now() })
    await ctx.scheduler.runAfter(2 * 60_000, internal.blog.factCheck, { id: post._id })
    return true
  },
})

export const draftNow = mutation({
  args: {},
  handler: async (ctx) => {
    await requireAdmin(ctx, 'owner')
    await ctx.scheduler.runAfter(0, internal.blog.draftNext, { force: true })
  },
})

/** A fresh review link, for when the first email was lost or the link was used. */
export const resendReview = mutation({
  args: { id: v.id('blogPosts') },
  handler: async (ctx, args) => {
    await requireAdmin(ctx, 'owner')
    const post = await ctx.db.get(args.id)
    if (!post || post.status !== 'pending') throw new ConvexError('Only a post waiting for review can be sent again')
    await ctx.scheduler.runAfter(0, internal.blog.sendReview, { id: args.id })
  },
})

// ── Pipeline: storage ─────────────────────────────────────────────────────────

export const writtenList = internalQuery({
  args: {},
  handler: async (ctx) => {
    const rows = await ctx.db.query('blogPosts').order('desc').take(400)
    return rows.filter((post) => post.status !== 'failed').map((post) => ({ title: post.title, keyword: post.keyword, status: post.status, runDay: post.runDay }))
  },
})

export const runToday = internalQuery({
  args: { day: v.string() },
  handler: async (ctx, args) => {
    const rows = await ctx.db.query('blogPosts').withIndex('by_run_day', (q) => q.eq('runDay', args.day)).collect()
    return rows.some((post) => post.status !== 'failed')
  },
})

/** Real numbers from the job board. A data-led post may use these and nothing else numeric. */
export const dataBlock = internalQuery({
  args: {},
  handler: async (ctx) => {
    const stats = await ctx.db.query('jobStats').withIndex('by_key', (q) => q.eq('key', 'current')).first()
    if (!stats) return 'No job board data yet.'
    const label = (id: string) => id.replace(/-/g, ' ')
    const lines = [
      `Open DevRel-related roles on the board: ${stats.total}`,
      `Companies hiring: ${stats.byCompany.length}`,
      `Remote roles: ${stats.remote} (${stats.total ? Math.round((stats.remote / stats.total) * 100) : 0}%)`,
      `Roles that show pay: ${stats.withSalary}`,
      `Roles posted in the last 7 days: ${stats.postedThisWeek}`,
      `Roles by type: ${stats.byFamily.map((row) => `${label(row.id)} ${row.count}`).join(', ')}`,
      `Roles by level: ${stats.bySeniority.map((row) => `${label(row.id)} ${row.count}`).join(', ')}`,
    ]
    const pay = stats.salaries.filter((row) => row.seniority === 'all').slice(0, 8)
    if (pay.length) {
      lines.push(
        'Yearly pay in US dollars from listings that show pay (25th percentile, median, 75th percentile, number of listings):',
        ...pay.map((row) => `  ${label(row.family)}: ${row.p25}, ${row.median}, ${row.p75} (n=${row.n})`),
      )
    }
    lines.push(`Board data updated: ${new Date(stats.updatedAt).toISOString().slice(0, 10)}`)
    return lines.join('\n')
  },
})

export const createRun = internalMutation({
  args: { day: v.string() },
  handler: async (ctx, args) => {
    const now = Date.now()
    return ctx.db.insert('blogPosts', {
      slug: `draft-${now}`, title: 'Drafting', description: '', keyword: '', body: '', faq: [], status: 'drafting',
      sources: [], claims: [], problems: [], words: 0, readingMinutes: 1, runDay: args.day, createdAt: now, updatedAt: now,
    })
  },
})

const draftFields = {
  id: v.id('blogPosts'),
  title: v.string(),
  description: v.string(),
  keyword: v.string(),
  slug: v.string(),
  body: v.string(),
  faq: v.array(v.object({ q: v.string(), a: v.string() })),
}

export const saveDraft = internalMutation({
  args: {
    ...draftFields,
    kind: v.optional(v.string()),
    angle: v.optional(v.string()),
    whyNow: v.optional(v.string()),
    research: v.string(),
    sources: v.array(v.object({ title: v.string(), url: v.string() })),
    problems: v.array(v.string()),
  },
  handler: async (ctx, { id, slug, ...rest }) => {
    const words = wordCount(plainText(parseMarkdown(rest.body)))
    await ctx.db.patch(id, {
      ...rest,
      slug: await uniqueSlug(ctx, slug, id),
      status: 'checking',
      words,
      readingMinutes: readingMinutes(words),
      updatedAt: Date.now(),
    })
    await ctx.scheduler.runAfter(0, internal.blog.factCheck, { id })
  },
})

export const saveChecked = internalMutation({
  args: {
    ...draftFields,
    claims: v.array(v.object({ claim: v.string(), verdict: v.string(), sourceUrl: v.optional(v.string()), note: v.optional(v.string()) })),
    problems: v.array(v.string()),
    tokenHash: v.string(),
  },
  handler: async (ctx, { id, tokenHash, slug: _slug, ...rest }) => {
    const words = wordCount(plainText(parseMarkdown(rest.body)))
    await ctx.db.patch(id, { ...rest, status: 'pending', reviewTokenHash: tokenHash, words, readingMinutes: readingMinutes(words), updatedAt: Date.now() })
  },
})

export const setToken = internalMutation({
  args: { id: v.id('blogPosts'), tokenHash: v.string() },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.id, { reviewTokenHash: args.tokenHash, updatedAt: Date.now() })
  },
})

export const markSent = internalMutation({
  args: { id: v.id('blogPosts') },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.id, { emailSentAt: Date.now() })
  },
})

export const fail = internalMutation({
  args: { id: v.id('blogPosts'), error: v.string() },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.id, { status: 'failed', error: args.error.slice(0, 400), updatedAt: Date.now() })
  },
})

export const getInternal = internalQuery({
  args: { id: v.id('blogPosts') },
  handler: async (ctx, args) => ctx.db.get(args.id),
})

// ── Pipeline: topic candidates ────────────────────────────────────────────────

async function getJson<T>(url: string): Promise<T | null> {
  try {
    const response = await fetch(url, { headers: { 'user-agent': 'devrel-studio-blog/1.0' }, signal: AbortSignal.timeout(12_000) })
    return response.ok ? ((await response.json()) as T) : null
  } catch {
    return null
  }
}

async function gatherCandidates(written: { title: string; keyword: string }[]): Promise<string> {
  const since = Math.floor(Date.now() / 1000) - 4 * 86_400
  const queries = ['developer relations', 'devrel', 'developer advocate', 'developer experience', 'API documentation', 'developer community']
  const lines: string[] = []

  const hn = await Promise.all(
    queries.map((query) =>
      getJson<{ hits?: { title?: string; url?: string; points?: number }[] }>(
        `https://hn.algolia.com/api/v1/search?query=${encodeURIComponent(query)}&tags=story&numericFilters=created_at_i>${since}&hitsPerPage=6`,
      ),
    ),
  )
  const seen = new Set<string>()
  for (const result of hn) {
    for (const hit of result?.hits ?? []) {
      if (!hit.title || seen.has(hit.title) || (hit.points ?? 0) < 15) continue
      seen.add(hit.title)
      lines.push(`[Hacker News, ${hit.points} points] ${hit.title}${hit.url ? ` (${hit.url})` : ''}`)
    }
  }

  const devto = await getJson<{ title?: string; url?: string; public_reactions_count?: number }[]>('https://dev.to/api/articles?tag=devrel&top=7&per_page=10')
  for (const article of devto ?? []) {
    if (article.title && article.url) lines.push(`[dev.to, ${article.public_reactions_count ?? 0} reactions] ${article.title} (${article.url})`)
  }

  const unused = BACKLOG.filter((title) => !findDuplicate({ title, keyword: title }, written)).slice(0, 8)
  for (const title of unused) lines.push(`[Standing subject] ${title}`)
  return lines.slice(0, 50).join('\n')
}

interface Topic {
  title: string
  keyword: string
  angle: string
  hard_question?: string
  shape?: string
  reader: string
  why_now: string
  kind: string
  search_questions: string[]
  source_urls?: string[]
}

async function chooseTopic(candidates: string, dataBlock: string, written: { title: string; keyword: string }[]): Promise<Topic> {
  const avoid: string[] = []
  for (let attempt = 0; attempt < 3; attempt++) {
    const { system, user } = topicPrompt({
      candidates,
      dataBlock,
      today: new Date().toISOString().slice(0, 10),
      written: [...written.map((post) => `- ${post.title} [${post.keyword}]`), ...avoid.map((title) => `- ${title} [tried this run, too close to a written post]`)].join('\n'),
    })
    const topic = extractJson<Topic>(await callClaude({ system, user, temperature: 0.7, maxTokens: 1500 }))
    if (!topic?.title || !topic.keyword || !topic.angle) continue
    const clash = findDuplicate({ title: topic.title, keyword: topic.keyword }, written)
    if (!clash) return { ...topic, reader: topic.reader || 'developer advocates', search_questions: topic.search_questions ?? [] }
    avoid.push(topic.title)
  }
  throw new Error('No topic that is new enough. The backlog and the news overlap posts already written.')
}

// ── Pipeline: research and writing ────────────────────────────────────────────

interface Research {
  facts?: { claim?: string; source_url?: string; source_title?: string; date?: string }[]
  gaps?: string[]
}

async function writeDraft(topic: Topic, research: string, dataBlock: string): Promise<{ draft: Draft; problems: string[] }> {
  const system = writerSystem()
  const user = writerUser({
    title: topic.title,
    hardQuestion: topic.hard_question,
    shape: topic.shape,
    angle: topic.angle,
    keyword: topic.keyword,
    reader: topic.reader,
    searchQuestions: topic.search_questions,
    facts: research,
    dataBlock,
  })
  const ground = [research, dataBlock, PRODUCT_FACTS, topic.title, topic.keyword, topic.angle]

  let raw = await callClaude({ system, user, temperature: 0.5, maxTokens: 7000 })
  let draft = parseDraft(raw)
  if (!draft) {
    raw = await callClaude({ system, user: `${user}\n\nYour last reply did not follow the required layout. Follow it exactly.`, temperature: 0.4, maxTokens: 7000 })
    draft = parseDraft(raw)
  }
  if (!draft) throw new Error('The writer did not return a usable draft')

  // Second pass: an editor removes machine-writing patterns without adding anything.
  try {
    const polished = parseDraft(await callClaude({ system: AVOID_AI_SYSTEM, user: polishUser(draftToText(draft)), maxTokens: 7000 }))
    if (polished && polished.body.length > draft.body.length * 0.8) draft = polished
  } catch {
    // Keep the unpolished draft. The checks below still run.
  }

  let problems = checkDraft(draft, ground)
  for (let pass = 0; pass < 3 && problems.length > 0; pass++) {
    const repaired = parseDraft(await callClaude({ system, user: repairUser(draftToText(draft), problems), temperature: 0.3, maxTokens: 7000 }))
    if (!repaired) break
    draft = repaired
    problems = checkDraft(draft, ground)
  }
  return { draft, problems }
}

function sourcesFrom(research: Research): { title: string; url: string }[] {
  const out: { title: string; url: string }[] = []
  for (const fact of research.facts ?? []) {
    if (!fact.source_url || !/^https?:\/\//i.test(fact.source_url) || out.some((item) => item.url === fact.source_url)) continue
    out.push({ title: (fact.source_title ?? fact.source_url).slice(0, 140), url: fact.source_url.slice(0, 300) })
  }
  return out.slice(0, 15)
}

/** The cron. Stage one: topic, research and a checked draft. */
export const draftNext = internalAction({
  args: { force: v.optional(v.boolean()) },
  handler: async (ctx, args): Promise<void> => {
    const day = new Date().toISOString().slice(0, 10)
    if (!args.force && (await ctx.runQuery(internal.blog.runToday, { day }))) return

    const id: Id<'blogPosts'> = await ctx.runMutation(internal.blog.createRun, { day })
    try {
      const written: { title: string; keyword: string }[] = await ctx.runQuery(internal.blog.writtenList, {})
      const dataBlock: string = await ctx.runQuery(internal.blog.dataBlock, {})
      const candidates = await gatherCandidates(written)

      const topic = await chooseTopic(candidates, dataBlock, written)

      const { system, user } = researchPrompt({ title: topic.title, angle: topic.angle, keyword: topic.keyword, searchQuestions: topic.search_questions })
      const researchRaw = await callClaude({ system, user, searches: 8, temperature: 0.2, maxTokens: 5000 })
      const research = extractJson<Research>(researchRaw)
      if (!research?.facts?.length) throw new Error('The research step found no usable facts')
      const factsText = research.facts
        .map((fact) => `- ${fact.claim} (source: ${fact.source_title ?? ''} ${fact.source_url ?? ''}${fact.date ? `, ${fact.date}` : ''})`)
        .join('\n') + (research.gaps?.length ? `\nNot confirmed: ${research.gaps.join('; ')}` : '')

      const { draft, problems } = await writeDraft(topic, factsText, dataBlock)
      await ctx.runMutation(internal.blog.saveDraft, {
        id,
        ...draft,
        kind: topic.kind,
        angle: topic.angle,
        whyNow: topic.why_now,
        research: factsText.slice(0, 20_000),
        sources: sourcesFrom(research),
        problems,
      })
    } catch (error) {
      console.error('[blog] draft failed:', error)
      await ctx.runMutation(internal.blog.fail, { id, error: error instanceof Error ? error.message : String(error) })
    }
  },
})

/** Stage two: check every claim against the web, fix what fails, send for review. */
export const factCheck = internalAction({
  args: { id: v.id('blogPosts') },
  handler: async (ctx, args): Promise<void> => {
    try {
      const post: Doc<'blogPosts'> | null = await ctx.runQuery(internal.blog.getInternal, { id: args.id })
      if (!post) return
      const dataBlock: string = await ctx.runQuery(internal.blog.dataBlock, {})
      let draft: Draft = { title: post.title, description: post.description, keyword: post.keyword, slug: post.slug, body: post.body, faq: post.faq }
      const ground = [post.research ?? '', dataBlock, PRODUCT_FACTS]

      let claims: Claim[] = []
      let completed = false
      const started = Date.now()
      for (let round = 0; round < 3; round++) {
        // An action may run ten minutes. Leave room to save and send.
        if (round > 0 && Date.now() - started > 5 * 60_000) break
        const raw = await callClaude({ system: FACT_CHECK_SYSTEM, user: factCheckUser({ body: draftToText(draft), dataBlock }), searches: 12, temperature: 0.1, maxTokens: 6000 })
        const parsed = parseClaims(raw)
        if (!parsed) continue
        claims = parsed
        completed = true
        const flagged = claims.filter((claim) => claim.verdict !== 'verified')
        if (flagged.length === 0 || round === 2) break

        const repaired = parseDraft(
          await callClaude({
            system: writerSystem(),
            user: factRepairUser(draftToText(draft), flagged.map((item) => ({ claim: item.claim, verdict: item.verdict, note: item.note ?? '' }))),
            temperature: 0.2,
            maxTokens: 7000,
          }),
        )
        if (!repaired) break
        draft = { ...repaired, slug: draft.slug }
      }

      const problems = checkDraft(draft, ground)
      if (!completed) problems.unshift('The fact check did not finish. Check every claim by hand before you publish.')

      const token = newToken()
      await ctx.runMutation(internal.blog.saveChecked, {
        id: args.id,
        ...draft,
        claims: claims.map((claim) => ({ claim: claim.claim, verdict: claim.verdict, sourceUrl: claim.source_url, note: claim.note })),
        problems,
        tokenHash: await sha256(token),
      })
      await deliver(ctx, args.id, token)
    } catch (error) {
      console.error('[blog] fact check failed:', error)
      const message = error instanceof Error ? error.message : String(error)
      // Overload, rate limit and timeout errors usually pass on a second try.
      const transient = /\b(429|5\d\d)\b|timeout|timed out|aborted|overloaded/i.test(message)
      if (transient && (await ctx.runMutation(internal.blog.scheduleRetry, { id: args.id }))) return
      await ctx.runMutation(internal.blog.fail, { id: args.id, error: message })
    }
  },
})

/** Issues a new link and emails it. Used for the first send's retry and for "send again". */
export const sendReview = internalAction({
  args: { id: v.id('blogPosts') },
  handler: async (ctx, args): Promise<void> => {
    const token = newToken()
    await ctx.runMutation(internal.blog.setToken, { id: args.id, tokenHash: await sha256(token) })
    await deliver(ctx, args.id, token)
  },
})

async function deliver(ctx: ActionCtx, id: Id<'blogPosts'>, token: string): Promise<void> {
  const post: Doc<'blogPosts'> | null = await ctx.runQuery(internal.blog.getInternal, { id })
  if (!post) return
  const count = (verdict: string) => post.claims.filter((claim) => claim.verdict === verdict).length
  const blocks = parseMarkdown(post.body)
  const opening = plainText(blocks.filter((block) => block.t === 'p').slice(0, 2)).slice(0, 420)

  await ctx.runAction(internal.email.sendBlogReview, {
    to: REVIEW_TO(),
    title: post.title,
    description: post.description,
    keyword: post.keyword,
    whyNow: post.whyNow,
    words: post.words,
    verified: count('verified'),
    unsupported: count('unsupported'),
    wrong: count('wrong'),
    problems: post.problems.slice(0, 8),
    flagged: post.claims.filter((claim) => claim.verdict !== 'verified').slice(0, 10).map((claim) => ({ claim: claim.claim, verdict: claim.verdict, note: claim.note })),
    opening,
    reviewUrl: `${siteUrl()}/blog/review/${id}?t=${token}`,
  })
  await ctx.runMutation(internal.blog.markSent, { id })
}

