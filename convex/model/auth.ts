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

/** The signed-in user, or null if unauthenticated or no profile row exists yet. */
export async function getCurrentUser(ctx: AnyCtx): Promise<Doc<'users'> | null> {
  const identity = await ctx.auth.getUserIdentity()
  if (!identity) return null

  // Kinde puts the user id in the `sub` claim, which Convex exposes as `subject`.
  return await ctx.db
    .query('users')
    .withIndex('by_kinde_id', (q) => q.eq('kindeId', identity.subject))
    .unique()
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
