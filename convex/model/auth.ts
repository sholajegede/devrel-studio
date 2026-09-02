import { ConvexError } from 'convex/values'
import { Doc, Id } from '../_generated/dataModel'
import { MutationCtx, QueryCtx } from '../_generated/server'

// ── Auth helpers ──────────────────────────────────────────────────────────────
//
// Every public Convex function that touches user-owned data resolves the caller
// through these helpers. `userId` is never accepted as an argument from the
// client — it is derived from the verified Kinde ID token on `ctx.auth`.
//
// Convention:
//   • queries   return null when the caller is unauthenticated or not the owner
//               (the UI already renders "not found" / loading states for null)
//   • mutations throw, because a write by a non-owner is always a bug or an attack

export type AnyCtx = QueryCtx | MutationCtx

/** Tables whose rows are owned by a single user via a `userId` field. */
type OwnedTable = 'contentEntries' | 'clients'

/**
 * The account behind the Kinde token, ignoring impersonation.
 *
 * Everything that decides *authority* resolves through this rather than through
 * `getCurrentUser` below: whether somebody may administer the platform is a fact
 * about who is signed in, never about whose data they are currently reading.
 * Resolving an admin check through the impersonated account would mean viewing
 * an owner's dashboard made you an owner.
 */
export async function getRealUser(ctx: AnyCtx): Promise<Doc<'users'> | null> {
  const identity = await ctx.auth.getUserIdentity()
  if (!identity) return null

  // Kinde puts the user id in the `sub` claim, which Convex exposes as `subject`.
  return await ctx.db
    .query('users')
    .withIndex('by_kinde_id', (q) => q.eq('kindeId', identity.subject))
    .unique()
}

/**
 * Whether this context can write.
 *
 * A `MutationCtx` carries a DatabaseWriter, which is a DatabaseReader plus
 * `insert`, `patch`, `replace` and `delete`; a query's `ctx.db` has none of
 * them. Feature-detecting the writer is how one function can behave differently
 * in the two without every caller having to say which it is — and the
 * alternative, a flag passed by each call site, is a flag somebody forgets to
 * pass on the one mutation that matters.
 */
function canWrite(ctx: AnyCtx): boolean {
  return typeof (ctx.db as { insert?: unknown }).insert === 'function'
}

/**
 * The signed-in user, or null if unauthenticated or no profile row exists yet.
 *
 * While an admin has an impersonation session open, this returns the account
 * they are *reading* — which is the whole mechanism. Every query in the product
 * already resolves the caller through here, so a single swap in one function
 * shows the admin the customer's dashboard without a line changing anywhere
 * else.
 *
 * In a mutation it refuses instead of swapping. Impersonation is read-only, and
 * making that structural rather than a rule is the only version worth having:
 * a rule is a line each of forty mutations has to remember, and the one that
 * forgets is discovered by an audit row naming the wrong person. Failing closed
 * costs an admin an error message they can act on.
 *
 * Writing as *themselves* while the UI says "viewing as someone else" would be
 * worse than either, so that is refused too.
 */
export async function getCurrentUser(ctx: AnyCtx): Promise<Doc<'users'> | null> {
  const real = await getRealUser(ctx)
  if (!real) return null

  // Only an admin can have a session, so for everybody else this function does
  // exactly what it did before impersonation existed — same reads, same result.
  // That is worth a line: this is the function every query in the product
  // resolves through, and the change is provably inert for the accounts that
  // are not doing the thing it exists for.
  if (!real.adminRole) return real

  const session = await activeImpersonation(ctx, real._id)
  if (!session) return real

  if (canWrite(ctx)) {
    throw new ConvexError(
      `You are viewing ${session.subjectEmail ?? 'another account'} read-only. ` +
        'End that session before making changes.',
    )
  }

  return (await ctx.db.get(session.subjectId)) ?? real
}

/**
 * The impersonation session this admin has open, if any.
 *
 * Expiry is checked on read rather than by a cron: a session that has run out
 * must stop working the moment it does, and a sweep that runs every hour would
 * leave a window in which the row says one thing and the clock says another.
 */
async function activeImpersonation(ctx: AnyCtx, adminId: Id<'users'>) {
  const now = Date.now()

  const sessions = await ctx.db
    .query('impersonationSessions')
    .withIndex('by_admin', (q) => q.eq('adminId', adminId))
    .collect()

  const live = sessions.find(
    (session) => session.endedAt === undefined && session.expiresAt > now,
  )
  if (!live) return null

  const subject = await ctx.db.get(live.subjectId)
  return {
    subjectId: live.subjectId,
    subjectEmail: subject?.email ?? null,
    startedAt: live.startedAt,
    expiresAt: live.expiresAt,
  }
}

/** The open impersonation session, for the banner and for ending it. */
export async function currentImpersonation(ctx: AnyCtx) {
  const real = await getRealUser(ctx)
  if (!real) return null
  return await activeImpersonation(ctx, real._id)
}

/** The signed-in user. Throws when unauthenticated — use in mutations. */
export async function requireCurrentUser(ctx: AnyCtx): Promise<Doc<'users'>> {
  const user = await getCurrentUser(ctx)
  if (!user) throw new ConvexError('Not authenticated')
  return user
}

/** Read a document only if the caller owns it. Returns null otherwise. */
export async function readOwnedDoc<T extends OwnedTable>(
  ctx: AnyCtx,
  id: Id<T>,
): Promise<Doc<T> | null> {
  const user = await getCurrentUser(ctx)
  if (!user) return null

  const doc = (await ctx.db.get(id)) as unknown as Doc<OwnedTable> | null
  if (!doc) return null
  if (doc.userId !== user._id) return null

  return doc as unknown as Doc<T>
}

/** Load a document and assert ownership. Throws — use in mutations. */
export async function requireOwnedDoc<T extends OwnedTable>(
  ctx: AnyCtx,
  id: Id<T>,
): Promise<{ user: Doc<'users'>; doc: Doc<T> }> {
  const user = await requireCurrentUser(ctx)

  const doc = (await ctx.db.get(id)) as unknown as Doc<OwnedTable> | null
  if (!doc) throw new ConvexError('Not found')
  if (doc.userId !== user._id) {
    throw new ConvexError('Not authorized')
  }

  return { user, doc: doc as unknown as Doc<T> }
}
