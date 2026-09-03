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
  logoUrl: v.optional(v.string()),
  brandColor: v.optional(v.string()),
  customDomain: v.optional(v.string()),
}

/**
 * A hex colour, or nothing.
 *
 * Validated on the way in rather than trusted from the form, because this value
 * is interpolated into a style attribute on a page served to a client's staff —
 * anything that is not six hex digits has no business reaching it.
 */
function cleanBrandColor(value: string | undefined): string | undefined {
  if (!value) return undefined
  const hex = value.trim().toLowerCase()
  return /^#[0-9a-f]{6}$/.test(hex) ? hex : undefined
}

/**
 * An https image address, or nothing.
 *
 * https only: the client dashboard is served over TLS, and a http logo either
 * fails to load or costs the page its lock icon — on the one screen whose whole
 * job is to look credible.
 */
/**
 * A bare hostname, lowercased, or nothing.
 *
 * Stored in the shape a Host header arrives in — no scheme, no port, no path —
 * because the alternative is normalising on every request rather than once here.
 * A pasted URL is accepted and reduced, since that is what somebody copying from
 * their browser will hand over.
 */
function cleanCustomDomain(value: string | undefined): string | undefined {
  if (!value?.trim()) return undefined

  const raw = value.trim().toLowerCase()
  const host = raw.includes('://') ? raw.split('://')[1] : raw
  const bare = host.split('/')[0].split(':')[0]

  // A domain under this product's own name is not a custom domain — it is a
  // slug, and accepting it here would shadow the routing that already exists.
  if (!/^[a-z0-9.-]+\.[a-z]{2,}$/.test(bare)) return undefined
  if (bare.endsWith('devrel.studio')) return undefined

  return bare
}

function cleanLogoUrl(value: string | undefined): string | undefined {
  if (!value?.trim()) return undefined
  try {
    const url = new URL(value.trim())
    return url.protocol === 'https:' ? url.toString() : undefined
  } catch {
    return undefined
  }
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

/**
 * The dashboard slug a custom domain stands for, or null.
 *
 * Public, and answering only for a host somebody has already pointed at this
 * product — the mapping is a fact that host announces by resolving here. It
 * returns the slug and nothing else, which is what the URL would have carried in
 * the first place.
 */
export const slugForDomain = query({
  args: { host: v.string() },
  handler: async (ctx, args) => {
    const host = args.host.toLowerCase().trim()
    if (!host) return null

    const client = await ctx.db
      .query('clients')
      .withIndex('by_custom_domain', (q) => q.eq('customDomain', host))
      .first()

    return client?.slug ?? null
  },
})

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
      brandColor: cleanBrandColor(args.brandColor),
      logoUrl: cleanLogoUrl(args.logoUrl),
      customDomain: cleanCustomDomain(args.customDomain),
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
    const { clientId, ...rest } = args
    const fields = {
      ...rest,
      brandColor: cleanBrandColor(rest.brandColor),
      logoUrl: cleanLogoUrl(rest.logoUrl),
      customDomain: cleanCustomDomain(rest.customDomain),
    }
    const { doc: before } = await requireInWorkspace(ctx, clientId, 'editor')

    const slug = normalizeSlug(fields.slug || fields.company)
    if (slug) await assertSlugAvailable(ctx, slug, clientId)

    // Editing the retainer field means "the current rate is wrong", not "the
    // rate changed today" — a change with a date goes through changeRetainerRate
    // instead. Correcting the newest history entry keeps the two in step;
    // leaving it would make the timeline disagree with the field it summarises.
    const patch: Partial<Doc<'clients'>> = { ...fields, slug: slug || undefined }
    if (
      fields.monthlyRetainer !== before.monthlyRetainer &&
      before.rateHistory?.length
    ) {
      const history = [...before.rateHistory]
      const newest = history.reduce((latest, entry, index) =>
        entry.effectiveFrom > history[latest].effectiveFrom ? index : latest, 0)
      history[newest] = { ...history[newest], amount: fields.monthlyRetainer ?? 0 }
      patch.rateHistory = history
    }

    await ctx.db.patch(clientId, patch)

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
 * Record a new retainer rate taking effect on a given date.
 *
 * This is the path for a raise or a cut, as distinct from `updateClient`, which
 * treats a changed retainer as a correction to the current figure.
 *
 * The important part is the seeding below. `rateHistory` is empty on every
 * client created before it existed, and the calculation falls back to the
 * earliest *recorded* rate for any month preceding it. So appending only the new
 * amount would bill the entire back-history at the raised rate — the precise
 * error the timeline exists to prevent. The rate being replaced is therefore
 * written in first, effective from the engagement's start date.
 */
export const changeRetainerRate = mutation({
  args: {
    clientId: v.id('clients'),
    amount: v.number(),
    /** `YYYY-MM-DD`. The first billing date charged at the new amount. */
    effectiveFrom: v.string(),
    note: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { doc: client } = await requireInWorkspace(ctx, args.clientId, 'editor')

    if (args.amount < 0) {
      throw new ConvexError('A retainer cannot be negative')
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(args.effectiveFrom)) {
      throw new ConvexError('Effective date must be a calendar date (YYYY-MM-DD)')
    }

    const history = [...(client.rateHistory ?? [])]

    if (history.length === 0) {
      // Nothing recorded yet: preserve what the client has been paying so far.
      // Without a start date there is no defensible date to attach it to, so the
      // new rate simply becomes the opening one.
      if (client.monthlyRetainer && client.startDate) {
        history.push({
          amount: client.monthlyRetainer,
          effectiveFrom: client.startDate,
          note: 'Opening rate',
          recordedAt: new Date().toISOString(),
        })
      }
    }

    // Re-dating an existing entry rather than stacking two rates on one day,
    // which would leave the timeline with an unreachable period.
    const existing = history.findIndex(
      (entry) => entry.effectiveFrom === args.effectiveFrom,
    )
    const entry = {
      amount: args.amount,
      effectiveFrom: args.effectiveFrom,
      note: args.note,
      recordedAt: new Date().toISOString(),
    }
    if (existing >= 0) history[existing] = entry
    else history.push(entry)

    history.sort((a, b) => a.effectiveFrom.localeCompare(b.effectiveFrom))

    // `monthlyRetainer` mirrors whichever rate is in effect today, so a change
    // dated in the future does not move it until that date arrives.
    const today = new Date().toISOString().slice(0, 10)
    const inEffect = history.filter((rate) => rate.effectiveFrom <= today)
    const currentAmount = inEffect.length
      ? inEffect[inEffect.length - 1].amount
      : client.monthlyRetainer

    await ctx.db.patch(args.clientId, {
      rateHistory: history,
      monthlyRetainer: currentAmount,
    })

    return { rateHistory: history, monthlyRetainer: currentAmount }
  },
})

/**
 * Put an engagement on hold, or bring it back.
 *
 * `status` is written here rather than left to the edit form, so the flag and
 * the dated history cannot disagree — a client showing "Paused" with no open
 * pause period would bill straight through the hold, which is the bug this
 * whole timeline exists to remove.
 *
 * Resuming closes the open period rather than deleting it: the gap is what
 * makes the earnings figure correct, and discarding it would silently restore
 * the months to the total.
 */
export const setPauseState = mutation({
  args: {
    clientId: v.id('clients'),
    /** True to pause, false to resume. */
    paused: v.boolean(),
    /** `YYYY-MM-DD` — when the hold starts, or when work resumed. */
    date: v.string(),
    note: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { doc: client } = await requireInWorkspace(ctx, args.clientId, 'editor')

    if (!/^\d{4}-\d{2}-\d{2}$/.test(args.date)) {
      throw new ConvexError('Date must be a calendar date (YYYY-MM-DD)')
    }

    const periods = [...(client.pausePeriods ?? [])]
    const openIndex = periods.findIndex((period) => !period.to)

    if (args.paused) {
      if (openIndex >= 0) {
        throw new ConvexError('This client is already paused')
      }
      periods.push({
        from: args.date,
        note: args.note,
        recordedAt: new Date().toISOString(),
      })
    } else {
      if (openIndex < 0) {
        throw new ConvexError('This client is not currently paused')
      }
      if (args.date < periods[openIndex].from) {
        throw new ConvexError('Work cannot resume before the pause began')
      }
      periods[openIndex] = { ...periods[openIndex], to: args.date }
    }

    periods.sort((a, b) => a.from.localeCompare(b.from))

    await ctx.db.patch(args.clientId, {
      pausePeriods: periods,
      // An ended engagement stays ended — resuming a closed contract is a
      // decision for the edit form, not a side effect of clearing a hold.
      status: args.paused
        ? 'Paused'
        : client.status === 'Ended'
          ? 'Ended'
          : 'Active',
    })

    return { pausePeriods: periods }
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
