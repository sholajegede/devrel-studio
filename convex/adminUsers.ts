import { ConvexError, v } from 'convex/values'
import { internal } from './_generated/api'
import { mutation, query } from './_generated/server'
import { Doc, Id } from './_generated/dataModel'
import { checkMonths, extendAccessWindow, revokedPatch } from './model/access'
import { requireAdmin, writeAudit } from './model/admin'
import { PLANS, accessOf, isPlanId } from './model/plans'

// ── Admin, phase three: accounts ──────────────────────────────────────────────
//
// Finding one account and seeing everything true about it, then the three
// things an operator can do to it by hand: grant, revoke, comp.
//
// Phase two could only answer a purchase somebody had asked for. Most of the
// work that actually arrives has no request behind it — a refund, a grant made
// against the wrong account, an advisor who should not be paying, a customer
// asking "what am I on and until when" — and every one of those was a Convex
// dashboard session against the raw table with no audit row behind it.
//
// A separate file from `admin.ts` because that one is about the queue and this
// one is about accounts, and because the guard test discovers `convex/admin*.ts`
// rather than a hand-maintained list — a new file here is covered the moment it
// is created, which is the only way invariant 1 survives being split up.

/** Plans that can be granted by hand. 'free' is the absence of a grant. */
const grantablePlan = v.union(v.literal('starter'), v.literal('pro'), v.literal('agency'))

/** How many rows a search or a listing will return at once. */
const MAX_ROWS = 50

// ── Reading ───────────────────────────────────────────────────────────────────

/**
 * One row of the account list — enough to decide which account to open.
 *
 * Access state is computed here rather than in the browser so the console and
 * every gate in the product agree about what "active" means. `accessOf` is the
 * same function the dashboard uses on itself.
 */
function summarise(user: Doc<'users'>, now: number) {
  const access = accessOf(user, now)
  return {
    id: user._id,
    email: user.email,
    name: `${user.firstName ?? ''} ${user.lastName ?? ''}`.trim() || null,
    handle: user.handle ?? null,
    state: access.state,
    planName: access.plan.name,
    until: access.until,
    comped: user.comped === true,
    adminRole: user.adminRole ?? null,
    paused: Boolean(user.pausedAt),
    createdAt: user._creationTime,
  }
}

/**
 * Find an account.
 *
 * Support-level: looking someone up is the first half of answering a support
 * email, and it is the tier that exists to absorb that.
 *
 * Matches on an email prefix through the `by_email` index, plus an exact handle
 * through `by_handle`. Both are range reads on an index rather than a scan with
 * a filter — the difference does not matter at fourteen accounts and matters
 * entirely at fourteen thousand, and the scan is the thing nobody comes back to
 * fix once the console works.
 *
 * There is deliberately no search by name. It would have to scan, it would have
 * to guess at "Sam" versus "Samuel", and the address is what a support email
 * arrives from — searching by the field somebody actually has beats searching
 * by the field that reads better in a mockup.
 *
 * An empty term lists the newest accounts, which is the useful default for a
 * page whose other state is a blank box.
 */
export const searchUsers = query({
  args: { term: v.optional(v.string()), limit: v.optional(v.number()) },
  handler: async (ctx, args) => {
    await requireAdmin(ctx)

    const limit = Math.min(Math.max(args.limit ?? MAX_ROWS, 1), MAX_ROWS)
    const term = (args.term ?? '').trim().toLowerCase()
    const now = Date.now()

    if (!term) {
      const recent = await ctx.db.query('users').order('desc').take(limit)
      return { term, rows: recent.map((user) => summarise(user, now)) }
    }

    // Emails are stored lowercased at sign-up, which is what makes a prefix
    // range read work at all — an index is ordered by the stored bytes, so a
    // mixed-case row would sort outside the range and be invisible here.
    // Everything from the term up to the term plus the highest code point:
    // the half-open range that is exactly "starts with this".
    const byEmail = await ctx.db
      .query('users')
      .withIndex('by_email', (q) =>
        q.gte('email', term).lt('email', term + '￿'),
      )
      .take(limit)

    // A handle is exact: it is the thing someone pastes out of a portfolio URL
    // when they cannot remember which address they signed up with.
    const handle = term.replace(/^@/, '')
    const byHandle = handle
      ? await ctx.db
          .query('users')
          .withIndex('by_handle', (q) => q.eq('handle', handle))
          .take(2)
      : []

    const seen = new Set(byEmail.map((user) => user._id))
    const rows = [...byEmail, ...byHandle.filter((user) => !seen.has(user._id))]

    return { term, rows: rows.slice(0, limit).map((user) => summarise(user, now)) }
  },
})

/**
 * Everything true about one account.
 *
 * The point of the page is that the whole picture is on it. Access state, what
 * they have built, every request they have made and every privileged thing
 * anybody has done to them — read from four places that previously had to be
 * opened in four Convex dashboard tabs and mentally joined.
 *
 * The history comes from the audit log rather than from the account's own
 * fields because the fields only hold the current value: `accessNote` is a
 * single overwritable string, so the second grant erased the first one's
 * reason. The log is the only thing that can answer "what happened here".
 */
export const userDetail = query({
  args: { userId: v.id('users') },
  handler: async (ctx, args) => {
    await requireAdmin(ctx)

    const user = await ctx.db.get(args.userId)
    if (!user) return null

    const now = Date.now()
    const access = accessOf(user, now)

    // Counted rather than listed. An admin deciding whether to grant needs to
    // know an account is real and in use; the contents are the customer's, and
    // reading them is not what this console is for.
    const [workspaces, memberships, requests, audit] = await Promise.all([
      ctx.db
        .query('workspaces')
        .withIndex('by_owner', (q) => q.eq('ownerId', user._id))
        .collect(),
      ctx.db
        .query('memberships')
        .withIndex('by_user', (q) => q.eq('userId', user._id))
        .collect(),
      ctx.db
        .query('accessRequests')
        .withIndex('by_user', (q) => q.eq('userId', user._id))
        .collect(),
      ctx.db
        .query('adminAuditLog')
        .withIndex('by_subject', (q) => q.eq('subjectId', user._id))
        .order('desc')
        .take(50),
    ])

    // Counted by workspace, across the workspaces this account owns — which is
    // how every limit in the product is actually enforced, and against this
    // account's plan because the owner is the billing subject.
    //
    // It was `by_user` before, meaning "rows this person created". That answers
    // a different question and disagrees with the gate the customer hits in both
    // directions: it misses work a member did inside their workspace, and counts
    // work they did inside somebody else's. A console reporting a number the
    // product does not enforce is worse than one reporting nothing.
    let clients = 0
    let entries = 0
    let overLimit = false

    for (const workspace of workspaces) {
      const [ownedClients, ownedEntries] = await Promise.all([
        ctx.db
          .query('clients')
          .withIndex('by_workspace', (q) => q.eq('workspaceId', workspace._id))
          .collect(),
        ctx.db
          .query('contentEntries')
          .withIndex('by_workspace', (q) => q.eq('workspaceId', workspace._id))
          .collect(),
      ])

      clients += ownedClients.length
      entries += ownedEntries.length

      // Per workspace, because the limit is. Two workspaces of three clients
      // each are not one workspace of six, and summing before comparing would
      // report an account over a limit it is nowhere near.
      const maxClients = access.plan.maxClients
      const maxEntries = access.plan.maxEntries
      if (
        (maxClients !== null && ownedClients.length > maxClients) ||
        (maxEntries !== null && ownedEntries.length > maxEntries)
      ) {
        overLimit = true
      }
    }

    return {
      account: {
        ...summarise(user, now),
        kindeId: user.kindeId,
        plan: user.plan ?? null,
        planStatus: user.planStatus ?? null,
        /**
         * The raw column, alongside the effective `until` from `summarise`.
         *
         * They differ on a comped account: `accessOf` reports no expiry however
         * much paid time is left underneath the comp. The console's grant
         * preview and its "removing this comp locks them out" warning are both
         * about the window underneath, so both need the column itself.
         */
        accessUntil: user.accessUntil ?? null,
        planPurchasedAt: user.planPurchasedAt ?? null,
        trialEndsAt: user.trialEndsAt ?? null,
        accessNote: user.accessNote ?? null,
        pausedAt: user.pausedAt ?? null,
        pausedReason: user.pausedReason ?? null,
        canWrite: access.canWrite,
        daysLeft: access.daysLeft,
      },
      usage: {
        workspaces: workspaces.length,
        memberships: memberships.length,
        clients,
        entries,
        planLimit: access.plan.maxClients,
        /** True when any single owned workspace is over what this plan allows. */
        overLimit,
      },
      requests: requests
        .sort((a, b) => b.createdAt - a.createdAt)
        .map((request) => ({
          id: request._id,
          plan: request.plan,
          planName: isPlanId(request.plan) ? PLANS[request.plan].name : request.plan,
          months: request.months,
          currency: request.currency,
          amount: request.amount,
          status: request.status,
          createdAt: request.createdAt,
        })),
      history: audit.map((row) => ({
        id: row._id,
        action: row.action,
        actorEmail: row.actorEmail,
        reason: row.reason ?? null,
        before: row.before ?? null,
        after: row.after ?? null,
        at: row.at,
      })),
    }
  },
})

/**
 * The shape of the book: how many accounts, in what state, and what has been
 * done lately.
 *
 * A composition of the reads above rather than a table of its own. Counters
 * maintained on write drift the moment anything changes a row without going
 * through the console — a migration, a webhook, the Convex dashboard — and a
 * number that is quietly wrong is worse than one that costs a scan.
 *
 * It does scan `users`, which is honest at this size (tens) and would not be at
 * a hundred thousand. The fix then is a rollup written by the same mutations
 * that write the audit log, not a bigger `.take()`.
 */
export const overview = query({
  args: {},
  handler: async (ctx) => {
    await requireAdmin(ctx)

    const now = Date.now()
    const users = await ctx.db.query('users').collect()

    const states = { comped: 0, active: 0, trial: 0, expired: 0 }
    let admins = 0
    let expiringSoon = 0

    for (const user of users) {
      const access = accessOf(user, now)
      states[access.state] += 1
      if (user.adminRole) admins += 1
      // Two weeks is roughly the notice a manual renewal needs: an invoice to
      // send, a transfer to clear, and somebody to approve it by hand.
      if (
        access.state === 'active' &&
        access.until &&
        access.until - now < 14 * 86_400_000
      ) {
        expiringSoon += 1
      }
    }

    const openRequests = await ctx.db
      .query('accessRequests')
      .withIndex('by_status', (q) => q.eq('status', 'open'))
      .collect()

    const since = now - 30 * 86_400_000
    const recentAudit = await ctx.db
      .query('adminAuditLog')
      .withIndex('by_time', (q) => q.gte('at', since))
      .order('desc')
      .collect()

    return {
      accounts: users.length,
      states,
      admins,
      expiringSoon,
      openRequests: openRequests.length,
      grantsThisMonth: recentAudit.filter((row) => row.action === 'access.grant').length,
      revokesThisMonth: recentAudit.filter((row) => row.action === 'access.revoke').length,
      recent: recentAudit.slice(0, 12).map((row) => ({
        id: row._id,
        action: row.action,
        actorEmail: row.actorEmail,
        subjectId: row.subjectId ?? null,
        subjectEmail: row.subjectEmail ?? null,
        reason: row.reason ?? null,
        at: row.at,
      })),
    }
  },
})

// ── Writing ───────────────────────────────────────────────────────────────────

/**
 * Open an access window by hand.
 *
 * Support-level, on the same footing as approving a request: it is the same
 * act, for a purchase that never produced a request row — someone who paid
 * before the pricing page existed, or emailed instead of using it. Making it
 * owner-only would mean the routine half of the job could not be delegated
 * whenever the customer skipped a form.
 *
 * The window arithmetic is `extendAccessWindow`, the same function the queue
 * and the terminal command use, so a hand grant and an approved request cannot
 * land on different dates for the same term.
 *
 * The notification is opt-out rather than automatic. A hand grant is as often a
 * correction to a window the customer already has — a wrong plan, a term short
 * by a month — and mailing "you're in" to somebody who never noticed they were
 * out invents a problem for them to worry about.
 */
export const grantAccess = mutation({
  args: {
    userId: v.id('users'),
    plan: grantablePlan,
    months: v.number(),
    reason: v.optional(v.string()),
    notify: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const admin = await requireAdmin(ctx)

    const problem = checkMonths(args.months)
    if (problem) throw new ConvexError(problem)

    const user = await ctx.db.get(args.userId)
    if (!user) throw new ConvexError('No such account')

    const now = Date.now()
    const window = extendAccessWindow(user.accessUntil, args.months, now)
    const term = args.months === 1 ? '1 month' : `${args.months} months`
    const note = args.reason?.trim()
      ? `${PLANS[args.plan].name}, ${term} · ${args.reason.trim()} · ${admin.email}`
      : `${PLANS[args.plan].name}, ${term} · granted by ${admin.email}`

    await ctx.db.patch(user._id, {
      plan: args.plan,
      planStatus: 'active',
      planPurchasedAt: new Date(now).toISOString(),
      accessUntil: window.until,
      accessNote: note,
    })

    await writeAudit(ctx, admin, 'access.grant', { id: user._id, email: user.email }, {
      before: { plan: user.plan ?? null, accessUntil: user.accessUntil ?? null },
      after: { plan: args.plan, accessUntil: window.until },
      reason: note,
    })

    if (args.notify !== false) {
      // Scheduled rather than awaited, for the reason approveRequest gives: the
      // grant is already committed, and a mail provider having a bad minute
      // must not roll it back.
      await ctx.scheduler.runAfter(0, internal.email.sendAccessGranted, {
        email: user.email,
        firstName: user.firstName,
        planName: PLANS[args.plan].name,
        months: args.months,
        until: window.until,
        extended: window.extended,
      })
    }

    return {
      email: user.email,
      plan: args.plan,
      until: window.until,
      extended: window.extended,
      /** A comped account is entitled regardless; the window is bookkeeping. */
      comped: user.comped === true,
    }
  },
})

/**
 * Close somebody's access window.
 *
 * Owner-only. A refund, a chargeback, or a grant that landed on the wrong
 * account — every one of those takes something away from a person who may
 * disagree, which is exactly the line the two tiers exist to draw.
 *
 * A reason is required rather than optional. This is the row somebody reads
 * back months later during a dispute, and "revoked by admin, no reason given"
 * is the answer that starts the argument it was written to end.
 *
 * Nothing is deleted. Their work, their clients and their clients' dashboards
 * stay exactly where they are — `accessOf` already keeps an expired account
 * readable and stops it writing, and punishing a client for their DevRel's
 * refund would be the wrong party.
 */
export const revokeAccess = mutation({
  args: { userId: v.id('users'), reason: v.string() },
  handler: async (ctx, args) => {
    const admin = await requireAdmin(ctx, 'owner')

    const reason = args.reason.trim()
    if (!reason) throw new ConvexError('Say why — this is the row read back in a dispute')

    const user = await ctx.db.get(args.userId)
    if (!user) throw new ConvexError('No such account')

    await ctx.db.patch(user._id, revokedPatch(reason))
    await writeAudit(ctx, admin, 'access.revoke', { id: user._id, email: user.email }, {
      before: { plan: user.plan ?? null, accessUntil: user.accessUntil ?? null },
      after: { accessUntil: null, planStatus: 'revoked' },
      reason,
    })

    return {
      email: user.email,
      /**
       * Comping outranks the window, so revoking one on a comped account
       * changes the record and nothing a customer would notice. The caller is
       * told rather than left to discover it from a page that still says
       * "comped" after a successful revoke.
       */
      stillComped: user.comped === true,
    }
  },
})

/**
 * Give an account the top plan without a purchase, or take it back.
 *
 * Owner-only: it is an unbounded grant with no end date, which makes it the
 * most valuable thing in the console to acquire and the one worth keeping in
 * the smallest possible number of hands.
 *
 * Was a hardcoded array of document ids in `model/plans.ts`. Comping an advisor
 * meant editing a constant, opening a pull request and waiting for a deploy,
 * and the resulting grant was invisible to every query that reports on access.
 * The column has been read first since phase one; this is what writes it.
 */
export const setComped = mutation({
  args: { userId: v.id('users'), comped: v.boolean(), reason: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const admin = await requireAdmin(ctx, 'owner')

    const user = await ctx.db.get(args.userId)
    if (!user) throw new ConvexError('No such account')

    if ((user.comped === true) === args.comped) {
      return { email: user.email, comped: args.comped, changed: false }
    }

    await ctx.db.patch(user._id, { comped: args.comped })
    await writeAudit(
      ctx,
      admin,
      args.comped ? 'access.comp' : 'access.uncomp',
      { id: user._id, email: user.email },
      {
        before: { comped: user.comped === true },
        after: { comped: args.comped },
        reason: args.reason,
      },
    )

    return {
      email: user.email,
      comped: args.comped,
      changed: true,
      /**
       * Un-comping falls back to whatever window the account has, which for an
       * account that has only ever been comped is none at all. Said plainly
       * here so the console can warn before it happens rather than after.
       */
      leavesWithoutAccess:
        !args.comped && accessOf({ ...user, comped: false }, Date.now()).state === 'expired',
    }
  },
})

/**
 * Stop an account signing in, or let it back.
 *
 * Owner-only, and the console's answer to everything a delete button would have
 * been reached for. Abuse, a chargeback, a login somebody else is using, a
 * customer asking for a break — all of them are temporary, and all of them are
 * served by an account that cannot get in and still has everything in it when
 * the reason passes.
 *
 * Nothing is removed. Their content, clients and client dashboards stay exactly
 * where they are, and the dashboards keep answering: a manager reading last
 * month's report has done nothing wrong and should not lose the page because
 * the DevRel is in a dispute.
 *
 * A reason is required, for the same reason revoke demands one — this is the row
 * that gets read back when somebody asks why they were locked out.
 */
export const setPaused = mutation({
  args: { userId: v.id('users'), paused: v.boolean(), reason: v.string() },
  handler: async (ctx, args) => {
    const admin = await requireAdmin(ctx, 'owner')

    const reason = args.reason.trim()
    if (!reason) throw new ConvexError('Say why — this is the row read back later')

    const user = await ctx.db.get(args.userId)
    if (!user) throw new ConvexError('No such account')

    // Pausing yourself locks you out of the console that would unpause you, and
    // the only way back is a terminal. Refusing is kinder than the alternative.
    if (user._id === admin._id) {
      throw new ConvexError('You cannot pause your own account')
    }

    if (Boolean(user.pausedAt) === args.paused) {
      return { email: user.email, paused: args.paused, changed: false }
    }

    const now = Date.now()
    await ctx.db.patch(user._id, {
      pausedAt: args.paused ? now : undefined,
      pausedReason: args.paused ? reason : undefined,
    })

    await writeAudit(
      ctx,
      admin,
      args.paused ? 'access.pause' : 'access.unpause',
      { id: user._id, email: user.email },
      {
        before: { paused: Boolean(user.pausedAt) },
        after: { paused: args.paused },
        reason,
      },
    )

    return { email: user.email, paused: args.paused, changed: true }
  },
})
