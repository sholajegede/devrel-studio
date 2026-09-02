import { ConvexError, v } from 'convex/values'
import { internalQuery, mutation, query } from './_generated/server'
import { currentImpersonation, getRealUser } from './model/auth'
import { requireAdmin, writeAudit } from './model/admin'

// ── Read-only impersonation ───────────────────────────────────────────────────
//
// Looking at the product the way one customer sees it. "My dashboard is empty"
// and "the report shows the wrong month" are questions that take a screenshot
// exchange to answer and ten seconds to see.
//
// Three properties make it worth having rather than dangerous:
//
//   1. Nothing the browser sends decides whose data comes back. The session is a
//      row keyed to the signed-in admin; there is no id to forge.
//   2. It cannot write. `getCurrentUser` swaps identity in queries and refuses
//      outright in mutations, so every write in the product fails closed —
//      including the ones written before this existed and the ones written after
//      by somebody who never read this file.
//   3. Authority is never borrowed. Admin checks resolve `getRealUser`, so
//      viewing an owner's account does not make you one, and ending a session
//      never depends on the account you are currently wearing.
//
// Owner-only to start. It is the most invasive thing the console can do, and the
// tier split exists precisely for actions like this one.

/**
 * How long a session lasts.
 *
 * Half an hour, and deliberately not adjustable from the browser. The failure
 * mode of impersonation is not somebody malicious, it is somebody who forgets:
 * an admin who wandered off two hours ago and comes back to a dashboard they
 * believe is their own. Short enough that the answer to "is this still me" is
 * almost always yes.
 */
const SESSION_MS = 30 * 60 * 1000

/**
 * Start looking at somebody's account.
 *
 * A reason is required. Impersonation is the one action here with no effect on
 * the data at all, which is exactly why it needs the strongest record: nothing
 * else in the system will show that it happened, and "why was this account
 * opened on a Sunday" is the question this row exists to answer.
 */
export const start = mutation({
  args: { userId: v.id('users'), reason: v.string() },
  handler: async (ctx, args) => {
    const admin = await requireAdmin(ctx, 'owner')

    const reason = args.reason.trim()
    if (!reason) throw new ConvexError('Say why you are opening this account')

    const subject = await ctx.db.get(args.userId)
    if (!subject) throw new ConvexError('No such account')

    // Viewing yourself is not impersonation; it is the dashboard. Refusing is
    // clearer than opening a session that changes nothing and then has to be
    // remembered and ended.
    if (subject._id === admin._id) {
      throw new ConvexError('That is your own account')
    }

    const now = Date.now()

    // One at a time. Two open sessions would make "whose data am I looking at"
    // depend on which row a query happened to find first.
    const existing = await ctx.db
      .query('impersonationSessions')
      .withIndex('by_admin', (q) => q.eq('adminId', admin._id))
      .collect()

    for (const session of existing) {
      if (session.endedAt === undefined && session.expiresAt > now) {
        await ctx.db.patch(session._id, { endedAt: now })
      }
    }

    await ctx.db.insert('impersonationSessions', {
      adminId: admin._id,
      subjectId: subject._id,
      reason,
      startedAt: now,
      expiresAt: now + SESSION_MS,
    })

    await writeAudit(ctx, admin, 'impersonate.start', {
      id: subject._id,
      email: subject.email,
    }, {
      after: { until: now + SESSION_MS },
      reason,
    })

    return { email: subject.email, expiresAt: now + SESSION_MS }
  },
})

/**
 * Stop.
 *
 * Support-level rather than owner-only, and deliberately: whatever authority it
 * took to start, getting *out* must never be the thing somebody cannot do. It
 * resolves the real signed-in admin, so it works from inside the impersonated
 * view where `getCurrentUser` would report somebody else entirely.
 */
export const end = mutation({
  args: {},
  handler: async (ctx) => {
    const admin = await requireAdmin(ctx)
    const now = Date.now()

    const sessions = await ctx.db
      .query('impersonationSessions')
      .withIndex('by_admin', (q) => q.eq('adminId', admin._id))
      .collect()

    const live = sessions.filter(
      (session) => session.endedAt === undefined && session.expiresAt > now,
    )

    for (const session of live) {
      await ctx.db.patch(session._id, { endedAt: now })

      const subject = await ctx.db.get(session.subjectId)
      await writeAudit(ctx, admin, 'impersonate.end', {
        id: session.subjectId,
        email: subject?.email,
      }, {
        before: { startedAt: session.startedAt },
        after: { endedAt: now, minutes: Math.round((now - session.startedAt) / 60_000) },
      })
    }

    return { ended: live.length }
  },
})

/**
 * The open session, for the banner.
 *
 * Not guarded by `requireAdmin`: it answers "are you currently wearing somebody
 * else's account", which is a question about the caller and returns null for
 * everybody else. Guarding it would mean the banner could not render on the one
 * page it matters on if the role check ever moved.
 */
export const mySession = query({
  args: {},
  handler: async (ctx) => {
    const session = await currentImpersonation(ctx)
    if (!session) return null

    return {
      subjectId: session.subjectId,
      subjectEmail: session.subjectEmail,
      startedAt: session.startedAt,
      expiresAt: session.expiresAt,
    }
  },
})

/**
 * Whether this Kinde subject has a session open.
 *
 * For actions, which have no database of their own and cannot call the helpers
 * above. `sync:syncMyStats` resolves its own identity from the token and would
 * otherwise happily refresh the *admin's* statistics while the screen in front
 * of them showed somebody else's dashboard — a write that the read-only rule
 * misses because it never passes through `getCurrentUser`.
 */
export const activeForKindeId = internalQuery({
  args: { kindeId: v.string() },
  handler: async (ctx, args) => {
    const user = await ctx.db
      .query('users')
      .withIndex('by_kinde_id', (q) => q.eq('kindeId', args.kindeId))
      .unique()

    if (!user) return false

    const now = Date.now()
    const sessions = await ctx.db
      .query('impersonationSessions')
      .withIndex('by_admin', (q) => q.eq('adminId', user._id))
      .collect()

    return sessions.some(
      (session) => session.endedAt === undefined && session.expiresAt > now,
    )
  },
})

/**
 * Who has been looked at, and by whom.
 *
 * The audit log carries the same facts, but a list keyed to the subject answers
 * the question somebody actually asks — "has anybody opened my account" — without
 * reading the whole log. Owner-only: the roster of who impersonates whom is not
 * routine support reading.
 */
export const history = query({
  args: { limit: v.optional(v.number()) },
  handler: async (ctx, args) => {
    await requireAdmin(ctx, 'owner')

    const limit = Math.min(Math.max(args.limit ?? 25, 1), 100)
    const now = Date.now()

    const sessions = await ctx.db.query('impersonationSessions').order('desc').take(limit)

    return await Promise.all(
      sessions.map(async (session) => {
        const [admin, subject] = await Promise.all([
          ctx.db.get(session.adminId),
          ctx.db.get(session.subjectId),
        ])

        return {
          id: session._id,
          adminEmail: admin?.email ?? 'deleted account',
          subjectId: session.subjectId,
          subjectEmail: subject?.email ?? 'deleted account',
          reason: session.reason ?? null,
          startedAt: session.startedAt,
          endedAt: session.endedAt ?? null,
          live: session.endedAt === undefined && session.expiresAt > now,
        }
      }),
    )
  },
})

/** The caller's own identity, unaffected by any session. For the banner. */
export const realMe = query({
  args: {},
  handler: async (ctx) => {
    const user = await getRealUser(ctx)
    return user ? { id: user._id, email: user.email } : null
  },
})
