import { ConvexError, v } from 'convex/values'
import { internal } from './_generated/api'
import { mutation, query } from './_generated/server'
import { recordAudit } from './model/audit'
import { getCurrentWorkspace, requireWorkspace } from './model/workspaces'
import { PROVIDER_LABEL, normalizeHandle } from '../lib/agents/sources'

const providerValidator = v.union(v.literal('devto'), v.literal('hashnode'))
const MAX_CONNECTIONS = 10

export const list = query({
  args: {},
  handler: async (ctx) => {
    const current = await getCurrentWorkspace(ctx)
    if (!current) return []
    return await ctx.db
      .query('connections')
      .withIndex('by_workspace', (q) => q.eq('workspaceId', current.workspaceId))
      .collect()
  },
})

export const add = mutation({
  args: { provider: providerValidator, handle: v.string(), clientSlug: v.string() },
  handler: async (ctx, args) => {
    const who = await requireWorkspace(ctx, 'editor')

    const handle = normalizeHandle(args.provider, args.handle)
    if (!handle.ok) throw new ConvexError(handle.error)

    const program = await ctx.db
      .query('clients')
      .withIndex('by_slug', (q) => q.eq('slug', args.clientSlug))
      .collect()
    if (!program.some((c) => c.workspaceId === who.workspaceId)) {
      throw new ConvexError('Choose one of your programs.')
    }

    const existing = await ctx.db
      .query('connections')
      .withIndex('by_workspace', (q) => q.eq('workspaceId', who.workspaceId))
      .collect()
    if (existing.length >= MAX_CONNECTIONS) {
      throw new ConvexError(`You can connect up to ${MAX_CONNECTIONS} sources.`)
    }
    if (existing.some((c) => c.provider === args.provider && c.handle === handle.handle)) {
      throw new ConvexError('That source is already connected.')
    }

    const id = await ctx.db.insert('connections', {
      workspaceId: who.workspaceId,
      clientSlug: args.clientSlug,
      provider: args.provider,
      handle: handle.handle,
      status: 'new',
      createdBy: who.user._id,
      createdAt: Date.now(),
    })
    await recordAudit(ctx, who, {
      action: 'connection.add',
      summary: `Connected ${PROVIDER_LABEL[args.provider]} (${handle.handle}).`,
      subjectKind: 'connection',
      subjectId: id,
    })
    await ctx.scheduler.runAfter(0, internal.scout.syncConnection, { id })
    return id
  },
})

export const syncNow = mutation({
  args: { id: v.id('connections') },
  handler: async (ctx, { id }) => {
    const who = await requireWorkspace(ctx, 'editor')
    const connection = await ctx.db.get(id)
    if (!connection || connection.workspaceId !== who.workspaceId) {
      throw new ConvexError('That source was not found.')
    }
    // Two clicks in a row should not start two reads.
    if (connection.status === 'syncing' && Date.now() - (connection.lastSyncAt ?? connection.createdAt) < 120_000) {
      return
    }
    await ctx.scheduler.runAfter(0, internal.scout.syncConnection, { id })
  },
})

export const remove = mutation({
  args: { id: v.id('connections') },
  handler: async (ctx, { id }) => {
    const who = await requireWorkspace(ctx, 'admin')
    const connection = await ctx.db.get(id)
    if (!connection || connection.workspaceId !== who.workspaceId) {
      throw new ConvexError('That source was not found.')
    }
    await ctx.db.delete(id)
    await recordAudit(ctx, who, {
      action: 'connection.remove',
      summary: `Disconnected ${PROVIDER_LABEL[connection.provider]} (${connection.handle}). Entries already added stay.`,
      subjectKind: 'connection',
      subjectId: id,
    })
  },
})
