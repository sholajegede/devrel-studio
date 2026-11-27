import { ConvexError, v } from 'convex/values'
import { internal } from './_generated/api'
import { Doc, Id } from './_generated/dataModel'
import { MutationCtx, internalAction, internalQuery, mutation, query } from './_generated/server'
import { recordAudit } from './model/audit'
import { getCurrentWorkspace, requireWorkspace } from './model/workspaces'
import {
  EVIDENCE_MAX_BYTES,
  isEvidenceType,
  isMonthKey,
  isStatsPlatform,
  missingEvidence,
  monthKey,
  monthLabel,
  platformsInUse,
  previousMonth,
} from '../lib/platform-stats'

// ── Platform stats ────────────────────────────────────────────────────────────
//
// The Dev.to, Medium and Hashnode numbers a client cannot see for themselves,
// one row per client, platform and month, each with the screenshot or export it
// was read from. See lib/platform-stats for the rules.

async function clientInWorkspace(ctx: MutationCtx, workspaceId: Id<'workspaces'>, slug: string) {
  const rows = await ctx.db
    .query('clients')
    .withIndex('by_workspace', (q) => q.eq('workspaceId', workspaceId))
    .collect()
  const client = rows.find((row) => row.slug === slug)
  if (!client) throw new ConvexError('Choose one of your clients.')
  return client
}

/** One month's rows for the workspace, with a link to each evidence file. */
export const list = query({
  args: { month: v.string() },
  handler: async (ctx, args) => {
    const current = await getCurrentWorkspace(ctx)
    if (!current || !isMonthKey(args.month)) return []
    const rows = await ctx.db
      .query('platformStats')
      .withIndex('by_workspace_and_month', (q) =>
        q.eq('workspaceId', current.workspaceId).eq('month', args.month),
      )
      .collect()
    return await Promise.all(
      rows.map(async (row) => ({
        ...row,
        evidenceUrl: row.evidenceStorageId ? await ctx.storage.getUrl(row.evidenceStorageId) : null,
      })),
    )
  },
})

/**
 * Which platforms each client publishes on, so the page asks only for those.
 * Keyed by client slug.
 */
export const platformsByClient = query({
  args: {},
  handler: async (ctx) => {
    const current = await getCurrentWorkspace(ctx)
    if (!current) return {} as Record<string, string[]>
    const entries = await ctx.db
      .query('contentEntries')
      .withIndex('by_workspace', (q) => q.eq('workspaceId', current.workspaceId))
      .collect()
    const byClient = new Map<string, Array<{ platform: string }>>()
    for (const entry of entries) {
      if (!entry.client) continue
      const list = byClient.get(entry.client) ?? []
      list.push({ platform: entry.platform })
      byClient.set(entry.client, list)
    }
    const result: Record<string, string[]> = {}
    for (const [client, list] of byClient) {
      const platforms = platformsInUse(list)
      if (platforms.length) result[client] = platforms
    }
    return result
  },
})

export const generateUploadUrl = mutation({
  args: {},
  handler: async (ctx) => {
    await requireWorkspace(ctx, 'editor')
    return await ctx.storage.generateUploadUrl()
  },
})

/**
 * Save a platform's numbers for a month, and optionally a new evidence file.
 *
 * A new file replaces the current one, which moves to `history` rather than
 * being deleted: a client may already have seen it in a sent report.
 */
export const save = mutation({
  args: {
    client: v.string(),
    platform: v.string(),
    month: v.string(),
    views: v.optional(v.number()),
    reads: v.optional(v.number()),
    note: v.optional(v.string()),
    evidenceStorageId: v.optional(v.id('_storage')),
    evidenceName: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const who = await requireWorkspace(ctx, 'editor')
    if (!isStatsPlatform(args.platform)) throw new ConvexError('Stats are kept for Dev.to, Medium and Hashnode.')
    if (!isMonthKey(args.month)) throw new ConvexError('That is not a month.')
    for (const value of [args.views, args.reads]) {
      if (value !== undefined && (!Number.isFinite(value) || value < 0)) {
        throw new ConvexError('Numbers must be zero or more.')
      }
    }
    await clientInWorkspace(ctx, who.workspaceId, args.client)

    let evidenceType: string | undefined
    if (args.evidenceStorageId) {
      const meta = await ctx.db.system.get(args.evidenceStorageId)
      if (!meta) throw new ConvexError('That upload did not arrive. Try again.')
      if (meta.size > EVIDENCE_MAX_BYTES || !isEvidenceType(meta.contentType)) {
        await ctx.storage.delete(args.evidenceStorageId)
        throw new ConvexError('Upload a PNG, JPG, CSV or PDF file of 8 MB or less.')
      }
      evidenceType = meta.contentType
    }

    const existing = (
      await ctx.db
        .query('platformStats')
        .withIndex('by_workspace_client_month', (q) =>
          q.eq('workspaceId', who.workspaceId).eq('client', args.client).eq('month', args.month),
        )
        .collect()
    ).find((row) => row.platform === args.platform)

    const now = Date.now()
    const fields = {
      views: args.views,
      reads: args.reads,
      note: args.note?.trim() || undefined,
      updatedBy: who.user._id,
      updatedAt: now,
    }

    if (!existing) {
      await ctx.db.insert('platformStats', {
        workspaceId: who.workspaceId,
        client: args.client,
        platform: args.platform,
        month: args.month,
        ...fields,
        ...(args.evidenceStorageId
          ? { evidenceStorageId: args.evidenceStorageId, evidenceName: args.evidenceName ?? 'evidence', evidenceType }
          : {}),
      })
    } else {
      const patch: Partial<Doc<'platformStats'>> = { ...fields }
      if (args.evidenceStorageId && args.evidenceStorageId !== existing.evidenceStorageId) {
        patch.evidenceStorageId = args.evidenceStorageId
        patch.evidenceName = args.evidenceName ?? 'evidence'
        patch.evidenceType = evidenceType
        if (existing.evidenceStorageId) {
          patch.history = [
            ...(existing.history ?? []),
            { storageId: existing.evidenceStorageId, name: existing.evidenceName ?? 'evidence', replacedAt: now },
          ]
        }
      }
      await ctx.db.patch(existing._id, patch)
    }

    await recordAudit(ctx, who, {
      action: 'platform_stats.save',
      summary: `Saved ${args.platform} stats for ${monthLabel(args.month)}${args.evidenceStorageId ? ' with evidence' : ''}.`,
      subjectKind: 'platformStats',
    })
  },
})

// ── Monthly reminder ──────────────────────────────────────────────────────────

/** Owners with at least one client missing last month's evidence. */
export const reminderRecipients = internalQuery({
  args: { month: v.string() },
  handler: async (ctx, args) => {
    const workspaces = await ctx.db.query('workspaces').collect()
    const out: Array<{ email: string; firstName?: string; clients: Array<{ name: string; platforms: string[] }> }> = []

    for (const workspace of workspaces) {
      const clients = (
        await ctx.db
          .query('clients')
          .withIndex('by_workspace', (q) => q.eq('workspaceId', workspace._id))
          .collect()
      ).filter((client) => client.slug && client.status === 'Active')
      if (!clients.length) continue

      const entries = await ctx.db
        .query('contentEntries')
        .withIndex('by_workspace', (q) => q.eq('workspaceId', workspace._id))
        .collect()
      const rows = await ctx.db
        .query('platformStats')
        .withIndex('by_workspace_and_month', (q) => q.eq('workspaceId', workspace._id).eq('month', args.month))
        .collect()

      const missing: Array<{ name: string; platforms: string[] }> = []
      for (const client of clients) {
        const platforms = platformsInUse(entries.filter((entry) => entry.client === client.slug))
        const lacking = missingEvidence(platforms, rows.filter((row) => row.client === client.slug))
        if (lacking.length) missing.push({ name: client.company || client.name, platforms: lacking })
      }
      if (!missing.length) continue

      const owner = await ctx.db.get(workspace.ownerId)
      if (!owner?.email) continue
      out.push({ email: owner.email, firstName: owner.firstName ?? undefined, clients: missing })
    }
    return out
  },
})

/** Runs on the 1st: asks for last month's screenshots where they are missing. */
export const sendReminders = internalAction({
  args: {},
  handler: async (ctx): Promise<{ sent: number; failed: number }> => {
    const month = previousMonth(monthKey(new Date()))
    const recipients: Array<{ email: string; firstName?: string; clients: Array<{ name: string; platforms: string[] }> }> =
      await ctx.runQuery(internal.platformStats.reminderRecipients, { month })
    const statsUrl = `${process.env.SITE_URL ?? 'https://devrel.studio'}/dashboard/reports/stats?month=${month}`

    let sent = 0
    let failed = 0
    for (const recipient of recipients) {
      try {
        await ctx.runAction(internal.email.sendStatsReminder, {
          ...recipient,
          monthLabel: monthLabel(month),
          statsUrl,
        })
        sent += 1
      } catch {
        failed += 1
      }
    }
    return { sent, failed }
  },
})
