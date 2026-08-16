import { ConvexError, v } from 'convex/values'
import { MutationCtx, mutation, query } from './_generated/server'
import { Doc, Id } from './_generated/dataModel'
import {
  getCurrentWorkspace,
  planHolder,
  readInWorkspace,
  requireInWorkspace,
  requireWorkspace,
} from './model/workspaces'
import { planOf } from './model/plans'
import { isReservedSubdomain, normalizeSlug } from '../lib/naming'

const statusValidator = v.union(
  v.literal('Active'),
  v.literal('Paused'),
  v.literal('Ended'),
)

const contractTypeValidator = v.optional(v.union(
  v.literal('Retainer'),
  v.literal('Project'),
  v.literal('Hourly'),
))

const clientFields = {
  name: v.string(),
  company: v.string(),
  email: v.optional(v.string()),
  website: v.optional(v.string()),
  monthlyRetainer: v.optional(v.number()),
  currency: v.optional(v.string()),
  startDate: v.optional(v.string()),
  endDate: v.optional(v.string()),
  status: statusValidator,
  contractType: contractTypeValidator,
  notes: v.optional(v.string()),
  slug: v.optional(v.string()),
}

// ── Slugs ─────────────────────────────────────────────────────────────────────
//
// A slug is a subdomain, so it lives in one namespace shared by every account —
// two users cannot both own `kinde.devrel.studio`. Uniqueness is enforced here
// rather than in the UI because the client dashboard resolves a slug to exactly
// one owner, and a duplicate would silently hand one user's content to another.
//
// The name rules themselves live in lib/naming.ts, shared with the proxy that
// does the routing — see that file for why keeping two copies was a bug.

export { normalizeSlug }

async function assertSlugAvailable(
  ctx: MutationCtx,
  slug: string,
  exceptClientId?: Id<'clients'>,
) {
  if (isReservedSubdomain(slug)) {
    throw new ConvexError(`"${slug}" is reserved — pick another dashboard slug`)
  }

  const existing = await ctx.db
    .query('clients')
    .withIndex('by_slug', (q) => q.eq('slug', slug))
    .first()

  if (existing && existing._id !== exceptClientId) {
    throw new ConvexError(
      `The dashboard slug "${slug}" is already taken — pick another`,
    )
  }
}

export const getClients = query({
  args: {},
  handler: async (ctx) => {
    const context = await getCurrentWorkspace(ctx)
    if (!context) return []

    return await ctx.db
      .query('clients')
      .withIndex('by_workspace', (q) => q.eq('workspaceId', context.workspaceId))
      .order('desc')
      .collect()
  },
})

export const getClientById = query({
  args: { clientId: v.id('clients') },
  handler: async (ctx, args) => {
    return await readInWorkspace(ctx, args.clientId)
  },
})

export const createClient = mutation({
  args: clientFields,
  handler: async (ctx, args) => {
    const { user, workspace, workspaceId } = await requireWorkspace(ctx, 'editor')

    // The workspace owner's plan sets the limit — see createContent.
    const plan = planOf(await planHolder(ctx, workspace))
    if (plan.maxClients !== null) {
      const existing = await ctx.db
        .query('clients')
        .withIndex('by_workspace', (q) => q.eq('workspaceId', workspaceId))
        .collect()

      if (existing.length >= plan.maxClients) {
        throw new ConvexError(
          `The ${plan.name} plan includes ${plan.maxClients} client ` +
            `workspace${plan.maxClients === 1 ? '' : 's'}. Upgrade to add more.`,
        )
      }
    }

    const slug = normalizeSlug(args.slug || args.company)
    if (slug) await assertSlugAvailable(ctx, slug)

    return await ctx.db.insert('clients', {
      ...args,
      userId: user._id,
      workspaceId,
      slug: slug || undefined,
    })
  },
})

export const updateClient = mutation({
  args: {
    clientId: v.id('clients'),
    ...clientFields,
  },
  handler: async (ctx, args) => {
    const { clientId, ...fields } = args
    const { doc: before } = await requireInWorkspace(ctx, clientId, 'editor')

    const slug = normalizeSlug(fields.slug || fields.company)
    if (slug) await assertSlugAvailable(ctx, slug, clientId)

    await ctx.db.patch(clientId, { ...fields, slug: slug || undefined })

    // Entries are tagged with the slug as a string, and the client dashboard
    // matches on it exactly. Renaming the slug without moving the entries would
    // leave them pointing at a slug nobody owns — the dashboard silently empties
    // and there is nothing on screen to explain why.
    if (slug && before.slug && before.slug !== slug) {
      await relabelEntries(ctx, before, before.slug, slug)
    }

    return clientId
  },
})

/**
 * Move every entry tagged `from` onto `to`.
 *
 * Scoped by workspace where the client has one, because entries in a shared
 * workspace can have been created by different members — keying the sweep on a
 * single userId would silently leave a colleague's entries behind on the old
 * slug. Pre-migration clients still fall back to their creator.
 */
async function relabelEntries(
  ctx: MutationCtx,
  client: Doc<'clients'>,
  from: string,
  to: string,
) {
  const entries = client.workspaceId
    ? await ctx.db
        .query('contentEntries')
        .withIndex('by_workspace_and_client', (q) =>
          q.eq('workspaceId', client.workspaceId).eq('client', from),
        )
        .collect()
    : await ctx.db
        .query('contentEntries')
        .withIndex('by_user_and_client', (q) =>
          q.eq('userId', client.userId).eq('client', from),
        )
        .collect()

  for (const entry of entries) {
    await ctx.db.patch(entry._id, { client: to })
  }

  return entries.length
}

export const deleteClient = mutation({
  args: { clientId: v.id('clients') },
  handler: async (ctx, args) => {
    // Deleting a client takes its dashboard offline for the manager using it,
    // so it sits above the editor role.
    await requireInWorkspace(ctx, args.clientId, 'admin')

    // Drop manager sessions too. They are only checked by slug and expiry, so
    // leaving them behind would let an old manager into whichever client next
    // claims this slug.
    const sessions = await ctx.db
      .query('managerSessions')
      .withIndex('by_client', (q) => q.eq('clientId', args.clientId))
      .collect()
    for (const session of sessions) await ctx.db.delete(session._id)

    await ctx.db.delete(args.clientId)
  },
})

export const getActiveClients = query({
  args: {},
  handler: async (ctx) => {
    const context = await getCurrentWorkspace(ctx)
    if (!context) return []

    return await ctx.db
      .query('clients')
      .withIndex('by_workspace', (q) => q.eq('workspaceId', context.workspaceId))
      .filter((q) => q.eq(q.field('status'), 'Active'))
      .collect()
  },
})
