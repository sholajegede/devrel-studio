import { ConvexError, v } from 'convex/values'
import { Id } from './_generated/dataModel'
import { MutationCtx, mutation, query } from './_generated/server'
import { recordAudit } from './model/audit'
import { planOf } from './model/plans'
import { getCurrentWorkspace, planHolder, requireWorkspace } from './model/workspaces'
import {
  canUndo,
  canonicalUrl,
  describeEntryProposal,
  entryDraftProblems,
  type EntryDraft,
  proposalFingerprint,
} from '../lib/agents/proposals'

const draftValidator = v.object({
  client: v.string(),
  title: v.string(),
  link: v.string(),
  platform: v.string(),
  publicationDate: v.string(),
})

const evidenceValidator = v.array(v.object({ label: v.string(), url: v.optional(v.string()) }))

/** Newest first. Open items lead; history follows. */
export const list = query({
  args: {},
  handler: async (ctx) => {
    const current = await getCurrentWorkspace(ctx)
    if (!current) return []
    const rows = await ctx.db
      .query('proposals')
      .withIndex('by_workspace_and_status', (q) => q.eq('workspaceId', current.workspaceId))
      .collect()
    return rows.sort((a, b) => b.createdAt - a.createdAt).slice(0, 200)
  },
})

/** The number on the sidebar badge. */
export const openCount = query({
  args: {},
  handler: async (ctx) => {
    const current = await getCurrentWorkspace(ctx)
    if (!current) return 0
    const rows = await ctx.db
      .query('proposals')
      .withIndex('by_workspace_and_status', (q) =>
        q.eq('workspaceId', current.workspaceId).eq('status', 'pending'),
      )
      .collect()
    return rows.length
  },
})

/** Newest first. Read by any member, so a funder-facing view can use it later. */
export const activity = query({
  args: {},
  handler: async (ctx) => {
    const current = await getCurrentWorkspace(ctx)
    if (!current) return []
    return await ctx.db
      .query('auditEvents')
      .withIndex('by_workspace_and_at', (q) => q.eq('workspaceId', current.workspaceId))
      .order('desc')
      .take(200)
  },
})

/** A person writes a proposal by hand. Agents use the same shape later. */
export const createManual = mutation({
  args: { draft: draftValidator, evidence: v.optional(evidenceValidator) },
  handler: async (ctx, { draft, evidence }) => {
    const who = await requireWorkspace(ctx, 'editor')

    const problems = entryDraftProblems(draft)
    if (problems.length) throw new ConvexError(problems.join(' '))

    const fingerprint = proposalFingerprint('entry.create', canonicalUrl(draft.link))

    // One open item per page. A page a person already dismissed stays dismissed.
    const same = await ctx.db
      .query('proposals')
      .withIndex('by_workspace_and_fingerprint', (q) =>
        q.eq('workspaceId', who.workspaceId).eq('fingerprint', fingerprint),
      )
      .collect()
    if (same.some((p) => p.status === 'pending')) {
      throw new ConvexError('This link is already waiting in your Inbox.')
    }
    if (same.some((p) => p.status === 'executed')) {
      throw new ConvexError('This link is already in your Work.')
    }

    const id = await ctx.db.insert('proposals', {
      workspaceId: who.workspaceId,
      kind: 'entry.create',
      status: 'pending',
      source: 'person',
      summary: describeEntryProposal(draft),
      evidence: evidence ?? [{ label: 'Written by a person', url: draft.link }],
      payload: {
        client: draft.client.trim(),
        title: draft.title.trim(),
        link: draft.link.trim(),
        platform: draft.platform.trim(),
        publicationDate: draft.publicationDate,
      },
      fingerprint,
      createdBy: who.user._id,
      createdAt: Date.now(),
    })
    await recordAudit(ctx, who, {
      action: 'proposal.create',
      summary: `Proposed: ${describeEntryProposal(draft)}`,
      subjectKind: 'proposal',
      subjectId: id,
    })
    return id
  },
})

type Who = Awaited<ReturnType<typeof requireWorkspace>>

/**
 * Turn one pending proposal into an entry. Shared by single and bulk approval
 * so both apply the same state check, plan limit and audit.
 */
async function executeEntryProposal(
  ctx: MutationCtx,
  who: Who,
  id: Id<'proposals'>,
  draft?: EntryDraft,
): Promise<Id<'contentEntries'>> {
  const proposal = await ctx.db.get(id)
  if (!proposal || proposal.workspaceId !== who.workspaceId) {
    throw new ConvexError('That proposal was not found.')
  }
  if (proposal.status !== 'pending') {
    throw new ConvexError('Someone already decided this one.')
  }

  const final = draft ?? proposal.payload
  const problems = entryDraftProblems(final)
  if (problems.length) throw new ConvexError(problems.join(' '))

  // Same plan limit as adding an entry by hand.
  const plan = planOf(await planHolder(ctx, who.workspace))
  if (plan.maxEntries !== null) {
    const count = (
      await ctx.db
        .query('contentEntries')
        .withIndex('by_workspace', (q) => q.eq('workspaceId', who.workspaceId))
        .collect()
    ).length
    if (count >= plan.maxEntries) {
      throw new ConvexError(
        `The ${plan.name} includes ${plan.maxEntries} content entries. Upgrade for unlimited entries.`,
      )
    }
  }

  const clean = {
    client: final.client.trim(),
    title: final.title.trim(),
    link: final.link.trim(),
    platform: final.platform.trim(),
    publicationDate: final.publicationDate,
  }
  const entryId = await ctx.db.insert('contentEntries', {
    userId: who.user._id,
    workspaceId: who.workspaceId,
    ...clean,
    trackingLink: '',
    status: 'Published',
    tags: [],
    contentType: '',
    notes: '',
    updatedAt: new Date().toISOString(),
  })
  await ctx.db.patch(id, {
    status: 'executed',
    payload: clean,
    decidedBy: who.user._id,
    decidedAt: Date.now(),
    resultEntryId: entryId,
  })
  await recordAudit(ctx, who, {
    action: draft ? 'proposal.approve_edited' : 'proposal.approve',
    summary: `Added “${clean.title}” to Work.`,
    subjectKind: 'proposal',
    subjectId: id,
  })
  return entryId
}

/**
 * Approve, optionally with edits. Checks the state again here, because the
 * screen may be minutes old: another member may have decided this already.
 */
export const approve = mutation({
  args: { id: v.id('proposals'), draft: v.optional(draftValidator) },
  handler: async (ctx, { id, draft }) => {
    const who = await requireWorkspace(ctx, 'editor')
    return await executeEntryProposal(ctx, who, id, draft)
  },
})

/** Approve many at once. Stops at the plan limit; reports what it did. */
export const approveMany = mutation({
  args: { ids: v.array(v.id('proposals')) },
  handler: async (ctx, { ids }) => {
    const who = await requireWorkspace(ctx, 'editor')
    let approved = 0
    let skipped = 0
    let stoppedBy: string | null = null
    for (const id of ids.slice(0, 50)) {
      try {
        await executeEntryProposal(ctx, who, id)
        approved += 1
      } catch (err) {
        const message = err instanceof ConvexError && typeof err.data === 'string' ? err.data : ''
        if (message.includes('includes')) {
          stoppedBy = message
          break
        }
        skipped += 1
      }
    }
    return { approved, skipped, stoppedBy, truncated: ids.length > 50 }
  },
})

export const dismiss = mutation({
  args: { id: v.id('proposals'), reason: v.string() },
  handler: async (ctx, { id, reason }) => {
    const who = await requireWorkspace(ctx, 'editor')
    const proposal = await ctx.db.get(id)
    if (!proposal || proposal.workspaceId !== who.workspaceId) {
      throw new ConvexError('That proposal was not found.')
    }
    if (proposal.status !== 'pending') {
      throw new ConvexError('Someone already decided this one.')
    }
    await ctx.db.patch(id, {
      status: 'dismissed',
      decidedBy: who.user._id,
      decidedAt: Date.now(),
      dismissReason: reason.trim().slice(0, 200) || 'Other',
    })
    await recordAudit(ctx, who, {
      action: 'proposal.dismiss',
      summary: `Dismissed: ${proposal.summary}`,
      subjectKind: 'proposal',
      subjectId: id,
    })
  },
})

/**
 * Undo an approved proposal: remove the entry it made. Only the exact entry
 * the approval created is touched, and only while it is still unchanged in
 * the ways that matter (it exists). Editing the entry later does not block undo.
 */
export const undo = mutation({
  args: { id: v.id('proposals') },
  handler: async (ctx, { id }) => {
    const who = await requireWorkspace(ctx, 'admin')
    const proposal = await ctx.db.get(id)
    if (!proposal || proposal.workspaceId !== who.workspaceId) {
      throw new ConvexError('That proposal was not found.')
    }
    if (!canUndo(proposal.status)) {
      throw new ConvexError('Only an approved item can be undone.')
    }
    if (proposal.resultEntryId) {
      const entry = await ctx.db.get(proposal.resultEntryId)
      if (entry && entry.workspaceId === who.workspaceId) {
        await ctx.db.delete(proposal.resultEntryId)
      }
    }
    await ctx.db.patch(id, { status: 'undone', resultEntryId: undefined })
    await recordAudit(ctx, who, {
      action: 'proposal.undo',
      summary: `Undid: ${proposal.summary}`,
      subjectKind: 'proposal',
      subjectId: id,
    })
  },
})
