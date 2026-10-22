import { ConvexError, v } from 'convex/values'
import { api, internal } from './_generated/api'
import { action, internalQuery, mutation } from './_generated/server'
import { requireInWorkspace } from './model/workspaces'
import { enforceRateLimit } from './model/rateLimit'
import { callClaude } from './model/claude'
import { previousMonth } from '../lib/metrics'
import type { ReportEntry } from '../lib/report'
import {
  agentFacts,
  buildAgentPrompt,
  checkAgentDraft,
  hasPublishedWork,
  parseAgentDraft,
  repairAgentPrompt,
  type AgentDraft,
  type AgentInput,
} from '../lib/report-agent'

// ── Report agent ──────────────────────────────────────────────────────────────
//
// Drafts the written half of a monthly report from the same entries the report
// shows. It never saves: the draft goes back to the composer, the DevRel reads
// and edits it, and only their Save writes anything. Sending a client words the
// person did not read is the one thing this must not do.

const MAX_REPAIRS = 2
const DRAFTS_PER_HOUR = 20

/** Permission and rate limit. An action cannot read the database, so a mutation does. */
export const authorize = mutation({
  args: { clientId: v.id('clients') },
  handler: async (ctx, args) => {
    const { user } = await requireInWorkspace(ctx, args.clientId, 'editor')
    await enforceRateLimit(
      ctx,
      'report-agent',
      String(user._id),
      DRAFTS_PER_HOUR,
      'You have used the report agent a lot this hour. Try again in a while.',
    )
    return { ok: true }
  },
})

/** Internal: the rows the agent reads for one client and one period. */
export const context = internalQuery({
  args: { clientId: v.id('clients'), period: v.string() },
  handler: async (ctx, args): Promise<AgentInput | null> => {
    const client = await ctx.db.get(args.clientId)
    if (!client?.slug) return null

    const rows = client.workspaceId
      ? await ctx.db
          .query('contentEntries')
          .withIndex('by_workspace_and_client', (q) =>
            q.eq('workspaceId', client.workspaceId).eq('client', client.slug!),
          )
          .collect()
      : await ctx.db
          .query('contentEntries')
          .withIndex('by_user_and_client', (q) =>
            q.eq('userId', client.userId).eq('client', client.slug!),
          )
          .collect()

    const entries: ReportEntry[] = rows.map((entry) => ({
      id: entry._id,
      category: entry.category,
      title: entry.title,
      platform: entry.platform,
      contentType: entry.contentType,
      link: entry.link,
      publicationDate: entry.publicationDate,
      status: entry.status,
      views: entry.views,
      downloads: entry.downloads,
      attendees: entry.attendees,
      stars: entry.stars,
      reshares: entry.reshares ?? [],
    }))

    const notes = await ctx.db
      .query('reportNotes')
      .withIndex('by_client_and_period', (q) =>
        q.eq('clientId', args.clientId).eq('period', args.period),
      )
      .first()

    const feedback = await ctx.db
      .query('reportFeedback')
      .withIndex('by_slug_and_period', (q) =>
        q.eq('slug', client.slug!).eq('period', previousMonth(args.period)),
      )
      .collect()

    return {
      clientName: client.company || client.name,
      period: args.period,
      entries,
      priorFeedback: feedback
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
        .map((item) => ({ comment: item.comment, rating: item.rating })),
      targets: {
        reach: notes?.reachTarget ?? client.reachTarget ?? null,
        published: notes?.publishedTarget ?? client.publishedTarget ?? null,
      },
    }
  },
})

export interface AgentResult {
  draft: AgentDraft
  /** Anything the checks still object to after the repair passes. */
  problems: string[]
}

export const draft = action({
  args: { clientId: v.id('clients'), period: v.string() },
  handler: async (ctx, args): Promise<AgentResult> => {
    if (!/^\d{4}-\d{2}$/.test(args.period)) throw new ConvexError('That is not a valid period')

    await ctx.runMutation(api.reportAgent.authorize, { clientId: args.clientId })

    const input: AgentInput | null = await ctx.runQuery(internal.reportAgent.context, args)
    if (!input) throw new ConvexError('Give this client a dashboard slug before drafting a report')
    if (!hasPublishedWork(input)) {
      throw new ConvexError('Nothing was published in this period, so there is nothing to draft from')
    }

    const facts = agentFacts(input)
    const { system, user } = buildAgentPrompt(input)

    let draft = parseAgentDraft(await callClaude({ system, user, maxTokens: 1500 }))
    if (!draft) throw new ConvexError('The agent did not return a usable draft. Try again.')

    let problems = checkAgentDraft(draft, facts)
    for (let pass = 0; pass < MAX_REPAIRS && problems.length > 0; pass++) {
      const repaired = parseAgentDraft(
        await callClaude({ system, user: repairAgentPrompt(draft, problems), maxTokens: 1500 }),
      )
      if (!repaired) break
      draft = repaired
      problems = checkAgentDraft(draft, facts)
    }

    return { draft, problems }
  },
})
