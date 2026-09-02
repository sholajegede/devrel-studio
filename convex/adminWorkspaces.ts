import { ConvexError, v } from 'convex/values'
import { QueryCtx, mutation, query } from './_generated/server'
import { Id } from './_generated/dataModel'
import { requireAdmin, writeAudit } from './model/admin'
import { PLANS, accessOf, planOf } from './model/plans'

// ── Admin, phase four: workspaces, abuse and the audit reader ─────────────────
//
// Three questions this console could not answer:
//
//   Is anybody over the plan they are paying for?
//   Who is locked out of a client dashboard, and why?
//   What has been done here, by anyone, ever?
//
// The first two were terminal commands or Convex dashboard sessions; the third
// was a table nothing read. The audit log has been written since phase one and
// until now the only way to look at it was the raw table view.

/** How many rows any listing here returns at once. */
const MAX_ROWS = 100

// ── Usage against the plan ────────────────────────────────────────────────────

/**
 * What a workspace is using, counted the way the limits are enforced.
 *
 * This is the subtlety that makes the whole section worth building. Every limit
 * check in the product — `clients:createClient`, `content:createContent` —
 * counts rows **by workspace** and compares them against the plan of the
 * workspace's **owner**, because an invited member works without a plan of their
 * own. Counting by `userId` instead answers a different question ("rows this
 * person created") and quietly disagrees with the gate the customer actually
 * hits, in either direction: it misses a member's work, and it counts work this
 * person did inside somebody else's workspace.
 *
 * A console that reports a number the product does not enforce is worse than one
 * that reports nothing, because somebody will act on it.
 */
async function usageOf(ctx: QueryCtx, workspaceId: Id<'workspaces'>) {
  const [clients, entries, members] = await Promise.all([
    ctx.db
      .query('clients')
      .withIndex('by_workspace', (q) => q.eq('workspaceId', workspaceId))
      .collect(),
    ctx.db
      .query('contentEntries')
      .withIndex('by_workspace', (q) => q.eq('workspaceId', workspaceId))
      .collect(),
    ctx.db
      .query('memberships')
      .withIndex('by_workspace', (q) => q.eq('workspaceId', workspaceId))
      .collect(),
  ])

  return {
    clients: clients.length,
    entries: entries.length,
    members: members.length,
    clientRows: clients,
    memberRows: members,
  }
}

/**
 * Whether a count is over a limit, where `null` means unlimited.
 *
 * Over-limit is reachable without anybody cheating: a workspace on Pro with five
 * clients that lapses to the trial's single client is instantly four over. The
 * product does not delete anything when that happens — it stops writes — so the
 * console has to be able to say "over" without implying wrongdoing.
 */
function over(count: number, limit: number | null): boolean {
  return limit !== null && count > limit
}

// ── Workspaces ────────────────────────────────────────────────────────────────

/**
 * Every workspace, with what it is using and what its owner's plan allows.
 *
 * Support-level. Scans `workspaces` and counts each one's rows, which is honest
 * at tens of workspaces and would not be at tens of thousands — at that point
 * this becomes a paginated read with the counts denormalised onto the workspace
 * row by the mutations that change them.
 *
 * Sorted with the over-limit ones first: the list exists to answer "is anybody
 * over what they are paying for", and an answer you have to scroll for is one
 * nobody checks twice.
 */
export const listWorkspaces = query({
  args: { limit: v.optional(v.number()) },
  handler: async (ctx, args) => {
    await requireAdmin(ctx)

    const limit = Math.min(Math.max(args.limit ?? MAX_ROWS, 1), MAX_ROWS)
    const workspaces = await ctx.db.query('workspaces').collect()
    const now = Date.now()

    const rows = await Promise.all(
      workspaces.map(async (workspace) => {
        const owner = await ctx.db.get(workspace.ownerId)
        const usage = await usageOf(ctx, workspace._id)

        // The owner's plan, not the viewer's and not the workspace's — a
        // workspace has no plan of its own, which is exactly why this file
        // resolves the owner rather than reading a field.
        const plan = owner ? planOf(owner) : PLANS.free
        const access = owner ? accessOf(owner, now) : null

        return {
          id: workspace._id,
          name: workspace.name,
          isPersonal: workspace.isPersonal,
          createdAt: workspace.createdAt,
          owner: owner
            ? {
                id: owner._id,
                email: owner.email,
                name: `${owner.firstName ?? ''} ${owner.lastName ?? ''}`.trim() || null,
                state: access!.state,
                planName: plan.name,
              }
            : null,
          usage: {
            clients: usage.clients,
            entries: usage.entries,
            members: usage.members,
          },
          limits: {
            maxClients: plan.maxClients,
            maxEntries: plan.maxEntries,
            seats: plan.seats,
          },
          over: {
            clients: over(usage.clients, plan.maxClients),
            entries: over(usage.entries, plan.maxEntries),
            seats: over(usage.members, plan.seats),
          },
        }
      }),
    )

    const overFirst = rows.sort((a, b) => {
      const aOver = a.over.clients || a.over.entries || a.over.seats ? 1 : 0
      const bOver = b.over.clients || b.over.entries || b.over.seats ? 1 : 0
      if (aOver !== bOver) return bOver - aOver
      return b.usage.entries - a.usage.entries
    })

    return {
      total: workspaces.length,
      overLimit: rows.filter((r) => r.over.clients || r.over.entries || r.over.seats)
        .length,
      rows: overFirst.slice(0, limit),
    }
  },
})

/**
 * One workspace: who is in it, what is in it, and the dashboards it publishes.
 *
 * Clients are listed by name and slug because a locked-out manager quotes the
 * address, not the company — resolving `acme.devrel.studio` to a workspace is
 * half of answering that support email. What is *inside* those dashboards is
 * still counted rather than read: it belongs to the customer.
 */
export const workspaceDetail = query({
  args: { workspaceId: v.id('workspaces') },
  handler: async (ctx, args) => {
    await requireAdmin(ctx)

    const workspace = await ctx.db.get(args.workspaceId)
    if (!workspace) return null

    const owner = await ctx.db.get(workspace.ownerId)
    const usage = await usageOf(ctx, workspace._id)
    const plan = owner ? planOf(owner) : PLANS.free
    const access = owner ? accessOf(owner) : null

    const members = await Promise.all(
      usage.memberRows.map(async (membership) => {
        const user = await ctx.db.get(membership.userId)
        return {
          id: membership._id,
          userId: membership.userId,
          email: user?.email ?? 'deleted account',
          name: user ? `${user.firstName ?? ''} ${user.lastName ?? ''}`.trim() || null : null,
          role: membership.role,
          isOwner: membership.userId === workspace.ownerId,
          createdAt: membership.createdAt,
        }
      }),
    )

    return {
      workspace: {
        id: workspace._id,
        name: workspace.name,
        isPersonal: workspace.isPersonal,
        createdAt: workspace.createdAt,
      },
      owner: owner
        ? {
            id: owner._id,
            email: owner.email,
            name: `${owner.firstName ?? ''} ${owner.lastName ?? ''}`.trim() || null,
            state: access!.state,
            planName: plan.name,
            until: access!.until,
          }
        : null,
      usage: {
        clients: usage.clients,
        entries: usage.entries,
        members: usage.members,
      },
      limits: {
        maxClients: plan.maxClients,
        maxEntries: plan.maxEntries,
        seats: plan.seats,
      },
      over: {
        clients: over(usage.clients, plan.maxClients),
        entries: over(usage.entries, plan.maxEntries),
        seats: over(usage.members, plan.seats),
      },
      members: members.sort((a, b) => Number(b.isOwner) - Number(a.isOwner)),
      clients: usage.clientRows
        .map((client) => ({
          id: client._id,
          company: client.company,
          slug: client.slug ?? null,
          status: client.status ?? null,
          /** How the dashboard is protected, which is what a lockout is about. */
          gate: client.isPublic ? 'public' : client.accessCodeHash ? 'code' : 'open',
        }))
        .sort((a, b) => a.company.localeCompare(b.company)),
    }
  },
})

// ── Abuse: access-code lockouts ───────────────────────────────────────────────
//
// A manager who mistypes their way into a fifteen-minute wait cannot clear it
// themselves, and neither can the DevRel from their own dashboard. Until now the
// override was `migrations:clearAccessAttempts`, typed from a terminal by
// somebody who first had to be told which slug to type — the support email says
// "the link doesn't work", not "please clear the attempts row for acme".

/** The whole-slug counter, as opposed to a single caller's. */
const SLUG_BUCKET = '*'

/**
 * Who is currently shut out, and who has been failing lately.
 *
 * Two kinds of row, kept visibly distinct because they mean opposite things.
 * A bucket row is one caller — a hashed IP — getting the code wrong, which is
 * almost always the manager. The `*` row is the ceiling across *every* caller on
 * that dashboard, which is what catches somebody spread across many addresses.
 * Lifting the first is customer service. Lifting the second re-opens the door
 * that was holding an attack back, so the console says which is which and never
 * silently does the second while doing the first.
 *
 * Raw IPs are never stored — the bucket is a hash computed in the Next.js layer
 * — so there is nothing to show here but a short prefix, and that is deliberate.
 */
export const listLockouts = query({
  args: { includeExpired: v.optional(v.boolean()) },
  handler: async (ctx, args) => {
    await requireAdmin(ctx)

    const now = Date.now()
    const attempts = await ctx.db.query('managerAccessAttempts').collect()

    const relevant = attempts.filter((row) =>
      args.includeExpired ? true : (row.lockedUntil ?? 0) > now,
    )

    // One entry per slug, since that is the unit somebody asks about and the
    // unit the unlock acts on.
    const bySlug = new Map<string, typeof relevant>()
    for (const row of relevant) {
      bySlug.set(row.slug, [...(bySlug.get(row.slug) ?? []), row])
    }

    const rows = await Promise.all(
      [...bySlug.entries()].map(async ([slug, group]) => {
        const client = await ctx.db
          .query('clients')
          .withIndex('by_slug', (q) => q.eq('slug', slug))
          .first()

        const callers = group.filter((row) => row.bucket !== SLUG_BUCKET)
        const slugWide = group.find((row) => row.bucket === SLUG_BUCKET) ?? null

        return {
          slug,
          client: client
            ? { id: client._id, company: client.company, workspaceId: client.workspaceId ?? null }
            : null,
          lockedCallers: callers.filter((row) => (row.lockedUntil ?? 0) > now).length,
          callers: callers
            .map((row) => ({
              id: row._id,
              /** A prefix of the hash. Enough to tell two callers apart. */
              bucket: row.bucket.slice(0, 8),
              failures: row.failures,
              firstFailureAt: row.firstFailureAt,
              lastFailureAt: row.lastFailureAt,
              lockedUntil: row.lockedUntil ?? null,
              locked: (row.lockedUntil ?? 0) > now,
            }))
            .sort((a, b) => b.lastFailureAt - a.lastFailureAt),
          slugWide: slugWide
            ? {
                failures: slugWide.failures,
                lockedUntil: slugWide.lockedUntil ?? null,
                locked: (slugWide.lockedUntil ?? 0) > now,
              }
            : null,
          lastFailureAt: Math.max(...group.map((row) => row.lastFailureAt)),
        }
      }),
    )

    return rows.sort((a, b) => b.lastFailureAt - a.lastFailureAt)
  },
})

/**
 * Lift a lockout on one client dashboard.
 *
 * Support-level: this is the routine half of the job — somebody wrote in saying
 * the link does not work — and it grants nothing. The code still has to be
 * right on the next attempt; all this clears is the wait.
 *
 * `includeSlugWide` is off by default and asked for explicitly. Clearing the
 * per-caller rows helps the manager in front of you; clearing the `*` row lifts
 * the ceiling that is holding back whoever is guessing from forty addresses at
 * once, and the two should never be the same click.
 */
export const clearLockout = mutation({
  args: {
    slug: v.string(),
    includeSlugWide: v.optional(v.boolean()),
    reason: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const admin = await requireAdmin(ctx)

    const slug = args.slug.trim().toLowerCase()
    if (!slug) throw new ConvexError('Which dashboard?')

    const rows = await ctx.db
      .query('managerAccessAttempts')
      .withIndex('by_slug_and_bucket', (q) => q.eq('slug', slug))
      .collect()

    if (rows.length === 0) {
      throw new ConvexError(`Nothing is throttled on ${slug}`)
    }

    const targets = args.includeSlugWide
      ? rows
      : rows.filter((row) => row.bucket !== SLUG_BUCKET)

    if (targets.length === 0) {
      throw new ConvexError(
        `Only the whole-dashboard counter is set on ${slug}. Clearing it lifts the ` +
          'limit for every caller — say so explicitly if that is what you mean.',
      )
    }

    for (const row of targets) await ctx.db.delete(row._id)

    await writeAudit(ctx, admin, 'abuse.unlock', { id: slug }, {
      before: {
        callers: rows.filter((row) => row.bucket !== SLUG_BUCKET).length,
        slugWide: rows.some((row) => row.bucket === SLUG_BUCKET),
      },
      after: { cleared: targets.length, includedSlugWide: args.includeSlugWide === true },
      reason: args.reason,
    })

    return { slug, cleared: targets.length, includedSlugWide: args.includeSlugWide === true }
  },
})

// ── The audit reader ──────────────────────────────────────────────────────────

/**
 * The log, newest first.
 *
 * Support-level to read: the whole argument for an audit trail is that somebody
 * can check it, and a log only one person may open is a log that gets checked
 * once a year.
 *
 * Paged by timestamp rather than by Convex's cursor, because the only navigation
 * this needs is "older than what I am looking at". An opaque cursor belongs to
 * the query that produced it, so switching the action filter would carry a
 * position that means nothing in the new query; `at` still does.
 *
 * Nothing here writes, patches or deletes. That is not an oversight to be fixed
 * later: an audit trail that can be edited is not an audit trail, and the test
 * suite asserts no mutation anywhere in `convex/` touches this table.
 */
export const listAudit = query({
  args: {
    action: v.optional(v.string()),
    /** Only rows strictly older than this. Pass the last row's `at` to page. */
    before: v.optional(v.number()),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    await requireAdmin(ctx)

    const limit = Math.min(Math.max(args.limit ?? 50, 1), MAX_ROWS)

    const before = args.before
    const log = ctx.db.query('adminAuditLog')
    const page = await (before === undefined
      ? log.withIndex('by_time')
      : log.withIndex('by_time', (q) => q.lt('at', before))
    )
      .order('desc')
      // Over-read when filtering, so a page of 'access.revoke' does not come
      // back short simply because the newest fifty rows were something else.
      .take(args.action ? limit * 10 : limit + 1)

    const filtered = args.action
      ? page.filter((row) => row.action === args.action)
      : page

    const rows = filtered.slice(0, limit)

    return {
      rows: rows.map((row) => ({
        id: row._id,
        action: row.action,
        actorEmail: row.actorEmail,
        actorId: row.actorId,
        subjectId: row.subjectId ?? null,
        subjectEmail: row.subjectEmail ?? null,
        reason: row.reason ?? null,
        before: row.before ?? null,
        after: row.after ?? null,
        at: row.at,
      })),
      /** The cursor for the next page, or null at the end of the log. */
      nextBefore: page.length > rows.length && rows.length > 0
        ? rows[rows.length - 1].at
        : null,
    }
  },
})

/** Every action the log actually contains, for the reader's filter. */
export const auditActions = query({
  args: {},
  handler: async (ctx) => {
    await requireAdmin(ctx)

    // Read from the data rather than from the `AuditAction` union: the filter
    // should offer what is in the log, not what the code could one day write.
    const recent = await ctx.db.query('adminAuditLog').withIndex('by_time').order('desc').take(500)

    const counts = new Map<string, number>()
    for (const row of recent) counts.set(row.action, (counts.get(row.action) ?? 0) + 1)

    return [...counts.entries()]
      .map(([action, count]) => ({ action, count }))
      .sort((a, b) => b.count - a.count)
  },
})
