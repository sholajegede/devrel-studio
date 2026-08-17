import { ConvexError, v } from 'convex/values'
import { MutationCtx, internalMutation, internalQuery } from './_generated/server'
import { Doc, Id } from './_generated/dataModel'
import { normalizeSlug } from './clients'
import { ensureMembership, ensurePersonalWorkspace } from './model/workspaces'
import { accessOf } from './model/plans'

// ── One-off data repairs ──────────────────────────────────────────────────────
//
// These are `internalMutation`s: they are not reachable from the browser and are
// meant to be run by hand with `npx convex run migrations:<name>`. Each one is
// written to be idempotent, so a second run is a no-op rather than a duplicate.

/** Loose match key — case and punctuation are not meaningful for matching. */
function matchKey(label: string): string {
  return normalizeSlug(label)
}

/**
 * `contentEntries.client` is a free-text label, but the client dashboard now
 * resolves a slug to exactly one `clients` row and reads entries through it. Any
 * entry whose label has no matching client row is invisible — the dashboard
 * renders empty with no indication why.
 *
 * This maps every distinct label to a real client row (creating one where none
 * exists) and rewrites the label to that row's slug, so the lookup is exact from
 * then on.
 *
 * Run with:  npx convex run migrations:backfillClientLinks '{"dryRun":true}'
 */
export const backfillClientLinks = internalMutation({
  args: { dryRun: v.optional(v.boolean()) },
  handler: async (ctx, args) => {
    const dryRun = args.dryRun === true

    const entries = await ctx.db.query('contentEntries').collect()
    const created: string[] = []
    const relabelled: string[] = []
    const skipped: string[] = []

    // Cache per owner so we resolve each client list once, not once per entry.
    const clientsByOwner = new Map<string, Doc<'clients'>[]>()
    // Rows a real run would have created by this point. Without this a dry run
    // reports one creation per entry instead of one per distinct label, which
    // makes the preview useless for deciding whether to go ahead.
    const plannedSlugs = new Map<string, string>()
    const loadClients = async (userId: Id<'users'>) => {
      const cached = clientsByOwner.get(userId)
      if (cached) return cached
      const rows = await ctx.db
        .query('clients')
        .withIndex('by_user', (q) => q.eq('userId', userId))
        .collect()
      clientsByOwner.set(userId, rows)
      return rows
    }

    for (const entry of entries) {
      const label = (entry.client ?? '').trim()
      if (!label) {
        skipped.push(`${entry._id}: no client label`)
        continue
      }

      const owned = await loadClients(entry.userId)
      const key = matchKey(label)

      // Match on any of the three fields a label could historically have held.
      let client = owned.find((c) =>
        [c.slug, c.name, c.company]
          .filter((value): value is string => !!value)
          .some((value) => matchKey(value) === key),
      )

      if (!client) {
        const plannedKey = `${entry.userId}:${key}`

        if (dryRun) {
          const already = plannedSlugs.get(plannedKey)
          const slug = already ?? (await freeSlug(ctx, key || 'client', plannedSlugs))

          if (!already) {
            plannedSlugs.set(plannedKey, slug)
            created.push(`${label} → would create client with slug "${slug}"`)
          }
          if (label !== slug) {
            relabelled.push(`${entry._id}: "${label}" → "${slug}"`)
          }
          continue
        }

        const slug = await freeSlug(ctx, key || 'client', plannedSlugs)
        const clientId = await ctx.db.insert('clients', {
          userId: entry.userId,
          name: label,
          company: label,
          status: 'Active' as const,
          slug,
        })
        client = (await ctx.db.get(clientId))!
        clientsByOwner.set(entry.userId, [...owned, client])
        created.push(`${label} → created client ${clientId} with slug "${slug}"`)
      }

      // A client with no slug has no dashboard to be read through. Give it one
      // derived from its own name rather than silently leaving entries orphaned.
      if (!client.slug) {
        const slug = await freeSlug(
          ctx,
          matchKey(client.company || client.name) || 'client',
          plannedSlugs,
        )
        if (!dryRun) await ctx.db.patch(client._id, { slug })
        client = { ...client, slug }
        created.push(`${client.company || client.name} → back-filled slug "${slug}"`)
      }

      if (entry.client !== client.slug) {
        if (!dryRun) await ctx.db.patch(entry._id, { client: client.slug })
        relabelled.push(`${entry._id}: "${label}" → "${client.slug}"`)
      }
    }

    return {
      dryRun,
      entriesScanned: entries.length,
      clientsCreated: created.length,
      entriesRelabelled: relabelled.length,
      created,
      relabelled,
      skipped,
    }
  },
})

/**
 * Give every existing user a personal workspace and move their rows into it.
 *
 * Before this runs, `contentEntries` and `clients` have no `workspaceId`, and
 * the authorisation helpers fall back to comparing `userId` — so the app keeps
 * working either way. After it runs, everything resolves through the workspace
 * and shared access becomes possible.
 *
 * Idempotent: users who already have a personal workspace keep it, and rows that
 * already carry a `workspaceId` are left alone.
 *
 * Run with:  npx convex run migrations:backfillWorkspaces '{"dryRun":true}'
 */
export const backfillWorkspaces = internalMutation({
  args: { dryRun: v.optional(v.boolean()) },
  handler: async (ctx, args) => {
    const dryRun = args.dryRun === true

    const users = await ctx.db.query('users').collect()
    const created: string[] = []
    const workspaceByUser = new Map<string, Id<'workspaces'>>()
    // A dry run creates nothing, so it has no id to record — but it still has to
    // know the user *would* have a workspace, or the move counts below all
    // report zero and the preview looks like a no-op.
    const willHaveWorkspace = new Set<string>()

    for (const user of users) {
      const owned = await ctx.db
        .query('workspaces')
        .withIndex('by_owner', (q) => q.eq('ownerId', user._id))
        .collect()

      const existing = owned.find((workspace) => workspace.isPersonal)
      if (existing) {
        workspaceByUser.set(user._id, existing._id)
        willHaveWorkspace.add(user._id)
        if (!dryRun) await ensureMembership(ctx, existing._id, user._id, 'owner')
        continue
      }

      willHaveWorkspace.add(user._id)

      if (dryRun) {
        created.push(`${user.email} → would get a personal workspace`)
        continue
      }

      const workspaceId = await ensurePersonalWorkspace(ctx, user)
      workspaceByUser.set(user._id, workspaceId)
      created.push(`${user.email} → workspace ${workspaceId}`)
    }

    // Rows are keyed by their creator, which before workspaces was also their
    // only possible owner — so the creator's personal workspace is the correct
    // destination for every one of them.
    let entriesMoved = 0
    const entries = await ctx.db.query('contentEntries').collect()
    for (const entry of entries) {
      if (entry.workspaceId) continue
      if (!willHaveWorkspace.has(entry.userId)) continue
      const workspaceId = workspaceByUser.get(entry.userId)
      if (!dryRun && workspaceId) await ctx.db.patch(entry._id, { workspaceId })
      entriesMoved++
    }

    let clientsMoved = 0
    const clients = await ctx.db.query('clients').collect()
    for (const client of clients) {
      if (client.workspaceId) continue
      if (!willHaveWorkspace.has(client.userId)) continue
      const workspaceId = workspaceByUser.get(client.userId)
      if (!dryRun && workspaceId) await ctx.db.patch(client._id, { workspaceId })
      clientsMoved++
    }

    // Older invites predate workspaces; point them at the inviter's own.
    let invitesMoved = 0
    const invites = await ctx.db.query('workspaceInvites').collect()
    for (const invite of invites) {
      if (invite.workspaceId) continue
      if (!willHaveWorkspace.has(invite.ownerId)) continue
      const workspaceId = workspaceByUser.get(invite.ownerId)
      if (!dryRun && workspaceId) await ctx.db.patch(invite._id, { workspaceId })
      invitesMoved++
    }

    return {
      dryRun,
      usersScanned: users.length,
      workspacesCreated: created.length,
      entriesMoved,
      clientsMoved,
      invitesMoved,
      created,
    }
  },
})

/**
 * Repair a workspace created by hand in the Convex dashboard.
 *
 * A row inserted directly has no membership, so nobody can see it: access is
 * decided by `memberships`, not by `workspaces.ownerId`. It also tends to have
 * `isPersonal: false`, which stops `ensurePersonalWorkspace` from adopting it,
 * so the backfill would build a second workspace alongside it and leave this one
 * empty and confusing.
 *
 * This makes it the owner's real personal workspace: fills in the missing
 * fields, adds the owner membership, and points the owner at it.
 *
 * Run with:
 *   npx convex run migrations:adoptManualWorkspace '{"workspaceId":"k57..."}'
 */
export const adoptManualWorkspace = internalMutation({
  args: { workspaceId: v.id('workspaces'), makePersonal: v.optional(v.boolean()) },
  handler: async (ctx, args) => {
    const workspace = await ctx.db.get(args.workspaceId)
    if (!workspace) throw new ConvexError('No such workspace')

    const owner = await ctx.db.get(workspace.ownerId)
    if (!owner) throw new ConvexError('That workspace has no owner row')

    const personal = args.makePersonal !== false

    await ctx.db.patch(workspace._id, {
      isPersonal: personal,
      createdAt: workspace.createdAt || new Date().toISOString(),
      name: workspace.name || 'My workspace',
    })

    await ensureMembership(ctx, workspace._id, owner._id, 'owner')
    await ctx.db.patch(owner._id, { activeWorkspaceId: workspace._id })

    return {
      workspaceId: workspace._id,
      name: workspace.name,
      owner: owner.email,
      isPersonal: personal,
    }
  },
})

/**
 * Give one account access to another account's workspace, by email.
 *
 * For the case where a person has two sign-ins and the content sits under the
 * one they are not currently using. This is the same thing accepting an
 * invitation does — it inserts a `memberships` row — but without needing an
 * invite link, and it is reversible by deleting that row.
 *
 * Run with:
 *   npx convex run migrations:grantWorkspaceAccess \
 *     '{"email":"you@example.com","ownerEmail":"other@example.com","role":"owner"}'
 */
export const grantWorkspaceAccess = internalMutation({
  args: {
    /** The account that should gain access. */
    email: v.string(),
    /** The account whose personal workspace holds the content. */
    ownerEmail: v.string(),
    role: v.optional(
      v.union(
        v.literal('owner'),
        v.literal('admin'),
        v.literal('editor'),
        v.literal('viewer'),
      ),
    ),
    /** Also make it the account's active workspace, so it shows up immediately. */
    setActive: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const find = async (email: string) =>
      await ctx.db
        .query('users')
        .filter((q) => q.eq(q.field('email'), email.trim().toLowerCase()))
        .first()

    const grantee = await find(args.email)
    if (!grantee) throw new ConvexError(`No user with the email ${args.email}`)

    const owner = await find(args.ownerEmail)
    if (!owner) throw new ConvexError(`No user with the email ${args.ownerEmail}`)

    const owned = await ctx.db
      .query('workspaces')
      .withIndex('by_owner', (q) => q.eq('ownerId', owner._id))
      .collect()

    const workspace = owned.find((w) => w.isPersonal) ?? owned[0]
    if (!workspace) {
      throw new ConvexError(`${args.ownerEmail} has no workspace`)
    }

    // 'owner' here is the role on the membership, not a transfer of ownership:
    // `workspaces.ownerId` still decides whose plan applies.
    await ensureMembership(ctx, workspace._id, grantee._id, args.role ?? 'admin')

    if (args.setActive !== false) {
      await ctx.db.patch(grantee._id, { activeWorkspaceId: workspace._id })
    }

    const entries = await ctx.db
      .query('contentEntries')
      .withIndex('by_workspace', (q) => q.eq('workspaceId', workspace._id))
      .collect()

    return {
      grantedTo: grantee.email,
      workspaceId: workspace._id,
      workspaceName: workspace.name,
      role: args.role ?? 'admin',
      entriesNowVisible: entries.length,
    }
  },
})

/**
 * Lift an access-code lockout. A manager who mistypes their way into a 15-minute
 * wait has no way to clear it themselves, and neither does the DevRel from the
 * dashboard — this is the manual override.
 *
 * Run with:  npx convex run migrations:clearAccessAttempts '{"slug":"acme"}'
 */
export const clearAccessAttempts = internalMutation({
  args: { slug: v.string() },
  handler: async (ctx, args) => {
    const rows = await ctx.db
      .query('managerAccessAttempts')
      .withIndex('by_slug_and_bucket', (q) => q.eq('slug', args.slug))
      .collect()

    for (const row of rows) await ctx.db.delete(row._id)
    return { cleared: rows.length }
  },
})

/**
 * First slug of the form `base`, `base-2`, `base-3`… not already taken. Slugs a
 * dry run has only planned count as taken too, so two different labels that
 * normalise to the same root are not both previewed onto the same slug.
 */
async function freeSlug(
  ctx: MutationCtx,
  base: string,
  planned: Map<string, string>,
): Promise<string> {
  const root = normalizeSlug(base) || 'client'
  const reserved = new Set(planned.values())

  for (let suffix = 0; suffix < 100; suffix++) {
    const candidate = suffix === 0 ? root : `${root}-${suffix + 1}`
    if (reserved.has(candidate)) continue

    const taken = await ctx.db
      .query('clients')
      .withIndex('by_slug', (q) => q.eq('slug', candidate))
      .first()
    if (!taken) return candidate
  }

  throw new Error(`Could not find a free slug for "${base}"`)
}

// ── Manual access grants ──────────────────────────────────────────────────────
//
// Card payments are not available here: Stripe requires a US entity. A buyer
// emails, pays by transfer, and access is extended by hand from the CLI.
//
// Internal only. Nothing the browser can reach writes an access window, which
// is the whole security model for a paywall with no payment processor behind it.

/**
 * Give an account access for a number of months.
 *
 * Extends from whichever is later — now, or an existing expiry — so renewing
 * early adds to the window rather than truncating it.
 *
 *   npx convex run migrations:grantAccess --prod \
 *     '{"email":"someone@example.com","months":3,"plan":"pro","note":"₦120k transfer, 17 Aug"}'
 */
export const grantAccess = internalMutation({
  args: {
    email: v.string(),
    months: v.number(),
    plan: v.union(
      v.literal('starter'),
      v.literal('pro'),
      v.literal('agency'),
    ),
    note: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const email = args.email.trim().toLowerCase()

    const user = await ctx.db
      .query('users')
      .filter((q) => q.eq(q.field('email'), email))
      .first()

    if (!user) throw new ConvexError(`No account with the email ${email}`)
    if (args.months <= 0 || args.months > 60) {
      throw new ConvexError('Months must be between 1 and 60')
    }

    const now = Date.now()
    const from = user.accessUntil && user.accessUntil > now ? user.accessUntil : now

    // Calendar months, not 30-day blocks — someone who pays for three months
    // starting on the 31st should not silently lose days.
    const until = new Date(from)
    until.setMonth(until.getMonth() + args.months)

    await ctx.db.patch(user._id, {
      plan: args.plan,
      planStatus: 'active',
      planPurchasedAt: new Date().toISOString(),
      accessUntil: until.getTime(),
      accessNote: args.note,
    })

    return {
      email: user.email,
      plan: args.plan,
      until: until.toISOString().slice(0, 10),
      extendedFrom: from === now ? 'today' : new Date(from).toISOString().slice(0, 10),
    }
  },
})

/** Take access away — a refund, a chargeback, or a grant made in error. */
export const revokeAccess = internalMutation({
  args: { email: v.string() },
  handler: async (ctx, args) => {
    const user = await ctx.db
      .query('users')
      .filter((q) => q.eq(q.field('email'), args.email.trim().toLowerCase()))
      .first()

    if (!user) throw new ConvexError(`No account with the email ${args.email}`)

    await ctx.db.patch(user._id, {
      accessUntil: undefined,
      planStatus: 'revoked',
      accessNote: 'Access revoked',
    })

    return { email: user.email, revoked: true }
  },
})

/** Who has access, and until when — the operator's view of the book. */
export const listAccess = internalQuery({
  args: {},
  handler: async (ctx) => {
    const users = await ctx.db.query('users').collect()
    const now = Date.now()

    return users
      .map((user) => ({
        email: user.email,
        plan: user.plan ?? 'free',
        state: accessOf(user, now).state,
        until: user.accessUntil
          ? new Date(user.accessUntil).toISOString().slice(0, 10)
          : null,
        trialEnds: user.trialEndsAt
          ? new Date(user.trialEndsAt).toISOString().slice(0, 10)
          : null,
        note: user.accessNote,
      }))
      .sort((a, b) => (b.until ?? '').localeCompare(a.until ?? ''))
  },
})

/**
 * Give existing accounts a trial window.
 *
 * `trialEndsAt` is set when an account is created, but every account that
 * existed before access windows did has no value — and `accessOf` reads a
 * missing window as expired. Without this, introducing the paywall locks out
 * every current user at once.
 *
 * Idempotent: an account that already has a trial or paid access is untouched.
 *
 *   npx convex run migrations:backfillTrials --prod '{"days":14}'
 */
export const backfillTrials = internalMutation({
  args: { days: v.optional(v.number()), dryRun: v.optional(v.boolean()) },
  handler: async (ctx, args) => {
    const days = args.days ?? 14
    const dryRun = args.dryRun === true
    const until = Date.now() + days * 24 * 60 * 60 * 1000

    const users = await ctx.db.query('users').collect()
    const granted: string[] = []

    for (const user of users) {
      if (user.trialEndsAt || user.accessUntil) continue
      granted.push(user.email)
      if (!dryRun) await ctx.db.patch(user._id, { trialEndsAt: until })
    }

    return {
      dryRun,
      days,
      scanned: users.length,
      granted: granted.length,
      emails: granted,
    }
  },
})
