import { ConvexError, v } from 'convex/values'
import { internal } from './_generated/api'
import { internalMutation, internalQuery, mutation, query } from './_generated/server'
import { Doc } from './_generated/dataModel'
import {
  REQUEST_STATUSES,
  checkMonths,
  extendAccessWindow,
  requestStatusValidator,
} from './model/access'
import { requireAdmin, writeAudit } from './model/admin'
import { COMPED_USER_IDS, PLANS, accessOf, isPlanId } from './model/plans'

// ── Admin, phase one ──────────────────────────────────────────────────────────
//
// Bootstrap, the admin roster, and the reconciliation read that has to run
// before anything automates approvals.
//
// Nothing here renders a page. The console is built on top of this in later
// phases; what this file establishes is that the guard, the audit trail and the
// first administrator exist and are testable.

/**
 * Promote every address in ADMIN_EMAILS to owner.
 *
 * An `internalMutation`, which is the whole point: it is unreachable from the
 * browser and runnable only with Convex deploy credentials. That breaks the
 * chicken-and-egg — nobody holds `adminRole` yet, and every mutation that could
 * grant it requires an admin.
 *
 *   npx convex run admin:bootstrap --prod
 *
 * Idempotent. An address already holding owner is left alone and not re-logged,
 * so a second run is silent rather than filling the audit trail with noise.
 *
 * The allowlist is an environment variable rather than a constant so staging
 * and production can differ, and so losing access is recoverable without a
 * code deploy.
 */
export const bootstrap = internalMutation({
  args: {},
  handler: async (ctx) => {
    const raw = process.env.ADMIN_EMAILS
    if (!raw?.trim()) {
      throw new ConvexError(
        'ADMIN_EMAILS is not set. Set it on the Convex deployment to the ' +
          'comma-separated addresses that should administer the platform.',
      )
    }

    const wanted = raw
      .split(',')
      .map((entry) => entry.trim().toLowerCase())
      .filter(Boolean)

    const promoted: string[] = []
    const alreadyAdmin: string[] = []
    const missing: string[] = []

    for (const email of wanted) {
      const user = await ctx.db
        .query('users')
        .withIndex('by_email', (q) => q.eq('email', email))
        .first()

      if (!user) {
        // Sign in once with the address first — there is no row to promote
        // until Kinde's webhook has created the account.
        missing.push(email)
        continue
      }

      if (user.adminRole === 'owner') {
        alreadyAdmin.push(email)
        continue
      }

      await ctx.db.patch(user._id, { adminRole: 'owner' })

      // Attributed to the promoted account itself: there is no acting admin
      // during bootstrap, and inventing a system actor id would put a
      // dangling reference in the one table that must not have any.
      await writeAudit(
        ctx,
        { ...user, adminRole: 'owner' } as Doc<'users'>,
        'admin.bootstrap',
        { id: user._id, email: user.email },
        { before: user.adminRole ?? null, after: 'owner', reason: 'ADMIN_EMAILS bootstrap' },
      )

      promoted.push(email)
    }

    return { promoted, alreadyAdmin, missing }
  },
})

/**
 * Copy the hardcoded comp list onto the `comped` column.
 *
 * One-off, idempotent. `isComped` still falls back to the constant, so running
 * this changes no behaviour — it moves the fact into the database where it can
 * be read, reported on and changed without a deploy.
 */
export const migrateComped = internalMutation({
  args: { dryRun: v.optional(v.boolean()) },
  handler: async (ctx, args) => {
    const dryRun = args.dryRun ?? false
    const migrated: string[] = []

    for (const id of COMPED_USER_IDS) {
      const byId = await ctx.db
        .query('users')
        .filter((q) => q.eq(q.field('_id'), id))
        .first()

      const user =
        byId ??
        (await ctx.db
          .query('users')
          .withIndex('by_kinde_id', (q) => q.eq('kindeId', id))
          .unique())

      if (!user || user.comped) continue
      if (!dryRun) await ctx.db.patch(user._id, { comped: true })
      migrated.push(user.email)
    }

    return { dryRun, migrated }
  },
})

/**
 * Grant or remove administration from a terminal.
 *
 * The counterpart to `bootstrap`, which can only ever add. A typo in
 * ADMIN_EMAILS that happens to match a real account promotes a stranger, and
 * until this existed the only way to take it back was through the console —
 * which requires already being an owner, and refuses to demote the last one.
 * Recovery cannot depend on the thing being recovered.
 *
 *   npx convex run admin:setAdminRoleByEmail '{"email":"x@y.com","role":"support"}'
 *   npx convex run admin:setAdminRoleByEmail '{"email":"x@y.com"}'   # remove
 *
 * `internalMutation`, so it needs deploy credentials and is unreachable from
 * the browser — the same footing as bootstrap. Audited like every other change
 * to the roster, attributed to the account being changed since a terminal has
 * no signed-in actor.
 */
export const setAdminRoleByEmail = internalMutation({
  args: {
    email: v.string(),
    role: v.optional(v.union(v.literal('owner'), v.literal('support'))),
    reason: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const email = args.email.trim().toLowerCase()
    const user = await ctx.db
      .query('users')
      .withIndex('by_email', (q) => q.eq('email', email))
      .first()

    if (!user) throw new ConvexError(`No account with the email ${email}`)
    if (user.adminRole === args.role) {
      return { email: user.email, role: args.role ?? null, changed: false }
    }

    await ctx.db.patch(user._id, { adminRole: args.role })
    await writeAudit(
      ctx,
      { ...user, adminRole: args.role } as Doc<'users'>,
      args.role ? 'admin.promote' : 'admin.demote',
      { id: user._id, email: user.email },
      {
        before: user.adminRole ?? null,
        after: args.role ?? null,
        reason: args.reason ?? 'set from the terminal',
      },
    )

    return { email: user.email, role: args.role ?? null, changed: true }
  },
})

/** Who can administer the platform. Owner-only: the roster is itself sensitive. */
export const listAdmins = query({
  args: {},
  handler: async (ctx) => {
    await requireAdmin(ctx, 'owner')

    const admins = await ctx.db
      .query('users')
      .filter((q) => q.neq(q.field('adminRole'), undefined))
      .collect()

    return admins.map((user) => ({
      id: user._id,
      email: user.email,
      name: `${user.firstName ?? ''} ${user.lastName ?? ''}`.trim() || null,
      role: user.adminRole!,
    }))
  },
})

/**
 * Whether the caller may open the console.
 *
 * Returns a role or null rather than throwing, because the client uses it to
 * decide whether to render anything at all — and a thrown error in a query the
 * layout runs on every navigation is noise, not a signal.
 */
export const myAdminRole = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity()
    if (!identity) return null

    const user = await ctx.db
      .query('users')
      .withIndex('by_kinde_id', (q) => q.eq('kindeId', identity.subject))
      .unique()

    return user?.adminRole ?? null
  },
})

/**
 * Grant or remove platform administration.
 *
 * Owner-only, and refuses to remove the last owner: an empty roster can only be
 * repaired by running `bootstrap` from a terminal, which is a bad place to
 * discover you need deploy credentials.
 */
export const setAdminRole = mutation({
  args: {
    userId: v.id('users'),
    role: v.optional(v.union(v.literal('owner'), v.literal('support'))),
    reason: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const admin = await requireAdmin(ctx, 'owner')

    const target = await ctx.db.get(args.userId)
    if (!target) throw new ConvexError('No such account')

    if (target.adminRole === 'owner' && args.role !== 'owner') {
      const owners = await ctx.db
        .query('users')
        .filter((q) => q.eq(q.field('adminRole'), 'owner'))
        .collect()
      if (owners.length <= 1) {
        throw new ConvexError('That is the last owner — promote someone else first')
      }
    }

    await ctx.db.patch(args.userId, { adminRole: args.role })
    await writeAudit(
      ctx,
      admin,
      args.role ? 'admin.promote' : 'admin.demote',
      { id: target._id, email: target.email },
      { before: target.adminRole ?? null, after: args.role ?? null, reason: args.reason },
    )

    return { email: target.email, role: args.role ?? null }
  },
})

// ── The purchase queue ────────────────────────────────────────────────────────
//
// Approving a purchase used to be two commands typed from memory:
// `accessRequests:settle` to close the request and `migrations:grantAccess` to
// open the window. Nothing joined them — no key, no transaction, no query — so
// running one and forgetting the other left either a paying customer locked out
// or a free grant behind a closed request, and neither is visible from any
// screen.
//
// `approveRequest` does both, or neither. A Convex mutation is a transaction,
// so the settle and the grant commit together or roll back together, and the
// class of bug the reconciliation pass exists to find can no longer be created.

/** A request as the console shows it, with the account's access alongside. */
const requestPlan = v.union(v.literal('starter'), v.literal('pro'), v.literal('agency'))

/**
 * The purchase queue, newest first.
 *
 * Support-level: reading and approving purchases is the routine work the
 * second tier exists to absorb.
 *
 * Each row carries the requester's current access state, because the same two
 * numbers decide whether to approve: what they asked for, and what they already
 * have. Reading them from separate screens is how someone gets granted twice.
 */
export const listRequests = query({
  args: {
    status: v.optional(requestStatusValidator),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    await requireAdmin(ctx)

    const limit = Math.min(Math.max(args.limit ?? 100, 1), 500)
    const requests = args.status
      ? await ctx.db
          .query('accessRequests')
          .withIndex('by_status', (q) => q.eq('status', args.status!))
          .collect()
      : await ctx.db.query('accessRequests').collect()

    const now = Date.now()
    const rows = requests.sort((a, b) => b.createdAt - a.createdAt).slice(0, limit)

    return await Promise.all(
      rows.map(async (request) => {
        // By id, never by email. Two accounts can share an address, and an
        // email lookup would pick between them arbitrarily — granting access
        // to one person for a purchase made by another.
        const user = await ctx.db.get(request.userId)
        const access = accessOf(user, now)

        return {
          id: request._id,
          email: request.email,
          name: request.name ?? null,
          plan: request.plan,
          planName: isPlanId(request.plan) ? PLANS[request.plan].name : request.plan,
          months: request.months,
          currency: request.currency,
          amount: request.amount,
          note: request.note ?? null,
          status: request.status,
          createdAt: request.createdAt,
          /** Null when the account has since been deleted — approving will fail. */
          account: user
            ? {
                id: user._id,
                state: access.state,
                planName: access.plan.name,
                until: access.until,
              }
            : null,
        }
      }),
    )
  },
})

/** How many are still waiting, for the sidebar and the page title. */
export const openRequestCount = query({
  args: {},
  handler: async (ctx) => {
    await requireAdmin(ctx)
    const open = await ctx.db
      .query('accessRequests')
      .withIndex('by_status', (q) => q.eq('status', 'open'))
      .collect()
    return open.length
  },
})

/**
 * Approve a purchase: settle the request and open the window, together.
 *
 * `months` and `plan` default to what was asked for and can be overridden,
 * because what someone requested and what they paid for are not always the
 * same — a transfer arrives short, or they call and change their mind. The
 * override is recorded in the audit trail next to the original.
 *
 * Refuses anything not still open. Approving twice would extend the window a
 * second time from a request that was already paid once, and the second grant
 * looks identical to the first from every screen.
 */
export const approveRequest = mutation({
  args: {
    requestId: v.id('accessRequests'),
    months: v.optional(v.number()),
    plan: v.optional(requestPlan),
    note: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const admin = await requireAdmin(ctx)

    const request = await ctx.db.get(args.requestId)
    if (!request) throw new ConvexError('No such request')
    if (request.status !== 'open') {
      throw new ConvexError(`That request was already ${request.status}`)
    }

    const months = args.months ?? request.months
    const problem = checkMonths(months)
    if (problem) throw new ConvexError(problem)

    const plan = args.plan ?? request.plan
    if (!isPlanId(plan) || plan === 'free') {
      throw new ConvexError(`${request.plan} is not a plan that can be granted`)
    }

    const user = await ctx.db.get(request.userId)
    if (!user) {
      throw new ConvexError(
        'The account that made this request no longer exists. Decline it instead.',
      )
    }

    const now = Date.now()
    const window = extendAccessWindow(user.accessUntil, months, now)

    const term = months === 1 ? '1 month' : `${months} months`
    const note =
      args.note ??
      `${request.currency} ${request.amount.toLocaleString('en-US')} · ${PLANS[plan].name}, ${term} · approved by ${admin.email}`

    // Both writes, one transaction. This pairing is the phase.
    await ctx.db.patch(user._id, {
      plan,
      planStatus: 'active',
      planPurchasedAt: new Date(now).toISOString(),
      accessUntil: window.until,
      accessNote: note,
    })
    await ctx.db.patch(request._id, { status: 'granted' })

    // Two rows for one action, deliberately. `request.approve` is the decision
    // and `access.grant` is its effect: the queue is read by request and the
    // revenue ledger by grant, and a grant made without a request (a comp, a
    // fix) must appear in the second without inventing a row in the first.
    await writeAudit(
      ctx,
      admin,
      'request.approve',
      { id: request._id, email: request.email },
      {
        before: { status: 'open', plan: request.plan, months: request.months },
        after: { status: 'granted', plan, months },
        reason: args.note,
      },
    )
    await writeAudit(
      ctx,
      admin,
      'access.grant',
      { id: user._id, email: user.email },
      {
        before: { plan: user.plan ?? null, accessUntil: user.accessUntil ?? null },
        after: { plan, accessUntil: window.until },
        reason: note,
      },
    )

    // Scheduled, not awaited: the customer is already paid up in the database
    // by this point, and a mail provider having a bad minute must not roll that
    // back. A send that fails is recoverable by hand; a lost grant is not.
    await ctx.scheduler.runAfter(0, internal.email.sendAccessGranted, {
      email: user.email,
      firstName: user.firstName,
      planName: PLANS[plan].name,
      months,
      until: window.until,
      extended: window.extended,
    })

    return {
      email: user.email,
      plan,
      months,
      until: window.until,
      extended: window.extended,
    }
  },
})

/**
 * Turn a request down.
 *
 * No email. A decline usually means the transfer never arrived or the plan was
 * wrong, and an automated "no" to someone who may have already sent money is
 * worse than a reply written by a person. The reason recorded here is for the
 * audit trail and for whoever writes that reply.
 */
export const declineRequest = mutation({
  args: {
    requestId: v.id('accessRequests'),
    reason: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const admin = await requireAdmin(ctx)

    const request = await ctx.db.get(args.requestId)
    if (!request) throw new ConvexError('No such request')
    if (request.status !== 'open') {
      throw new ConvexError(`That request was already ${request.status}`)
    }

    await ctx.db.patch(request._id, { status: 'declined' })
    await writeAudit(
      ctx,
      admin,
      'request.decline',
      { id: request._id, email: request.email },
      {
        before: { status: 'open' },
        after: { status: 'declined' },
        reason: args.reason,
      },
    )

    return { email: request.email }
  },
})

// ── Reconciliation ────────────────────────────────────────────────────────────

/**
 * Purchases whose two halves disagree.
 *
 * Approving a purchase has always been two commands typed from memory —
 * `accessRequests:settle` to close the request and `migrations:grantAccess` to
 * open the window — with no key, transaction or query joining them. Run one and
 * forget the other and the result is undetectable: a customer who paid and is
 * locked out, or a closed request with a free grant behind it.
 *
 * This finds both, and must be run before any UI starts presenting these
 * records as fact. Read-only, so it is safe against production.
 *
 *   npx convex run admin:reconcileRequests --prod
 */
export const reconcileRequests = internalQuery({
  args: {},
  handler: async (ctx) => {
    const requests = await ctx.db.query('accessRequests').collect()
    const now = Date.now()

    /** Settled as granted, but the account has no access window open. */
    const grantedWithoutAccess: object[] = []
    /** Still open although the account already has access — probably settled by hand. */
    const openWithAccess: object[] = []
    /** A status nothing in the codebase produces — a typo through `v.string()`. */
    const unknownStatus: object[] = []

    // Every status the validator allows. 'cancelled' was missing here, so a
    // buyer who withdrew their own request was reported as corrupt data.
    const KNOWN = new Set<string>(REQUEST_STATUSES)

    for (const request of requests) {
      if (!KNOWN.has(request.status)) {
        unknownStatus.push({
          id: request._id,
          email: request.email,
          status: request.status,
          createdAt: new Date(request.createdAt).toISOString().slice(0, 10),
        })
      }

      const user = await ctx.db
        .query('users')
        .withIndex('by_email', (q) => q.eq('email', request.email.toLowerCase()))
        .first()

      const access = accessOf(user ?? null, now)

      if (request.status === 'granted' && access.state === 'expired') {
        grantedWithoutAccess.push({
          id: request._id,
          email: request.email,
          plan: request.plan,
          months: request.months,
          amount: `${request.currency} ${request.amount}`,
          settledButLockedOut: true,
        })
      }

      if (request.status === 'open' && access.state === 'active') {
        openWithAccess.push({
          id: request._id,
          email: request.email,
          plan: request.plan,
          accessUntil: access.until
            ? new Date(access.until).toISOString().slice(0, 10)
            : null,
        })
      }
    }

    return {
      totalRequests: requests.length,
      grantedWithoutAccess,
      openWithAccess,
      unknownStatus,
      clean:
        grantedWithoutAccess.length === 0 &&
        openWithAccess.length === 0 &&
        unknownStatus.length === 0,
    }
  },
})

/** Accounts sharing an email — the hazard the `by_email` index exposes. */
export const findDuplicateEmails = internalQuery({
  args: {},
  handler: async (ctx) => {
    const users = await ctx.db.query('users').collect()
    const seen = new Map<string, string[]>()

    for (const user of users) {
      const email = user.email.toLowerCase()
      seen.set(email, [...(seen.get(email) ?? []), user._id])
    }

    const duplicates = [...seen.entries()]
      .filter(([, ids]) => ids.length > 1)
      .map(([email, ids]) => ({ email, ids }))

    return { checked: users.length, duplicates }
  },
})
