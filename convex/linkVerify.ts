import { ConvexError, v } from 'convex/values'
import { internal } from './_generated/api'
import { Id } from './_generated/dataModel'
import { internalAction, internalMutation, internalQuery, mutation } from './_generated/server'
import { requireInWorkspace, requireWorkspace } from './model/workspaces'
import {
  findLinks,
  judgeLinks,
  readableContent,
  trackingHost,
  verifyTargets,
  type VerifyResult,
  type VerifyTarget,
} from '../lib/link-verify'

// ── Live-link check ───────────────────────────────────────────────────────────
//
// Reads each published page an entry's tracking link should be on, and records
// whether the link is there. The browser asks; the work runs in an action so a
// slow site never holds up the page. See lib/link-verify for the rules.

const MAX_PER_RUN = 50
const FETCH_TIMEOUT_MS = 10_000
const MAX_BODY_BYTES = 3 * 1024 * 1024

const resultValidator = v.union(
  v.literal('found'),
  v.literal('old_link'),
  v.literal('not_found'),
  v.literal('could_not_check'),
)

/** Start a check for up to 50 entries. Results arrive on each entry. */
export const start = mutation({
  args: { ids: v.array(v.id('contentEntries')) },
  handler: async (ctx, args) => {
    if (args.ids.length > MAX_PER_RUN) throw new ConvexError(`Check up to ${MAX_PER_RUN} entries at a time.`)
    await requireWorkspace(ctx, 'editor')
    const now = Date.now()
    for (const id of args.ids) {
      const { doc } = await requireInWorkspace(ctx, id, 'editor')
      await ctx.db.patch(id, {
        linkVerification: { status: 'checking', checkedAt: now, results: doc.linkVerification?.results ?? [] },
      })
    }
    await ctx.scheduler.runAfter(0, internal.linkVerify.run, { ids: args.ids })
  },
})

/** What to fetch for each entry, worked out with the entry's client settings. */
export const targets = internalQuery({
  args: { ids: v.array(v.id('contentEntries')) },
  handler: async (ctx, args) => {
    const out: Array<{ id: Id<'contentEntries'>; host: string | null; campaign: string; targets: VerifyTarget[] }> = []
    for (const id of args.ids) {
      const entry = await ctx.db.get(id)
      if (!entry?.workspaceId) continue
      const clients = await ctx.db
        .query('clients')
        .withIndex('by_workspace', (q) => q.eq('workspaceId', entry.workspaceId!))
        .collect()
      const client = clients.find((c) => c.slug === entry.client) ?? null
      out.push({
        id,
        host: trackingHost(client),
        campaign: client?.utmCampaign ?? '',
        targets: verifyTargets(entry, client),
      })
    }
    return out
  },
})

export const save = internalMutation({
  args: {
    id: v.id('contentEntries'),
    results: v.array(v.object({ place: v.string(), label: v.string(), url: v.string(), result: resultValidator })),
  },
  handler: async (ctx, args) => {
    const entry = await ctx.db.get(args.id)
    if (!entry) return
    await ctx.db.patch(args.id, {
      linkVerification: { status: 'done', checkedAt: Date.now(), results: args.results },
    })
  },
})

async function readPage(target: VerifyTarget): Promise<string | null> {
  // A plain controller and timer: the Convex runtime is not guaranteed to have
  // AbortSignal.timeout.
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS)
  try {
    const response = await fetch(target.fetchUrl, {
      redirect: 'follow',
      signal: controller.signal,
      headers: {
        'User-Agent': 'devrel.studio link check (+https://devrel.studio)',
        Accept: target.format === 'npm-json' ? 'application/json' : 'text/html,text/plain;q=0.9,*/*;q=0.5',
      },
    })
    if (!response.ok) return null
    const length = Number(response.headers.get('content-length') ?? 0)
    if (length > MAX_BODY_BYTES) return null
    const body = await response.text()
    return body.length > MAX_BODY_BYTES ? body.slice(0, MAX_BODY_BYTES) : body
  } catch {
    return null
  } finally {
    clearTimeout(timer)
  }
}

export const run = internalAction({
  args: { ids: v.array(v.id('contentEntries')) },
  handler: async (ctx, args) => {
    const work: Array<{ id: Id<'contentEntries'>; host: string | null; campaign: string; targets: VerifyTarget[] }> =
      await ctx.runQuery(internal.linkVerify.targets, { ids: args.ids })

    for (const item of work) {
      const results: Array<{ place: string; label: string; url: string; result: VerifyResult }> = []
      for (const target of item.targets) {
        const body = item.host ? await readPage(target) : null
        const result: VerifyResult =
          body === null
            ? 'could_not_check'
            : judgeLinks(findLinks(readableContent(body, target.format), item.host!), {
                source: target.source,
                campaign: item.campaign,
              })
        results.push({ place: target.place, label: target.label, url: target.pageUrl, result })
      }
      await ctx.runMutation(internal.linkVerify.save, { id: item.id, results })
    }
  },
})
