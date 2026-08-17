import { ConvexError } from 'convex/values'
import { MutationCtx } from '../_generated/server'

// ── Rate limiting for unauthenticated writes ──────────────────────────────────
//
// `reports:submitFeedback` can be called by anyone
// on the internet with no credential at all. Neither is a tempting target, but
// neither had a ceiling either, and a table filled overnight by a script is a
// cleanup job nobody wants.
//
// A fixed window rather than a sliding one: the point is a ceiling, not
// smoothness, and a fixed window is one row and one comparison.

const WINDOW_MS = 60 * 60 * 1000

/**
 * Allow `limit` calls per hour per caller.
 *
 * `bucket` is a hashed IP where the caller supplied one, and a shared constant
 * where it did not — which deliberately makes unidentifiable callers share a
 * single allowance rather than escaping the limit entirely.
 */
export async function enforceRateLimit(
  ctx: MutationCtx,
  scope: string,
  bucket: string,
  limit: number,
  message: string,
): Promise<void> {
  const now = Date.now()

  const row = await ctx.db
    .query('publicWriteAttempts')
    .withIndex('by_scope_and_bucket', (q) => q.eq('scope', scope).eq('bucket', bucket))
    .first()

  if (!row || now - row.windowStartedAt > WINDOW_MS) {
    const fields = { scope, bucket, count: 1, windowStartedAt: now }
    if (row) await ctx.db.patch(row._id, fields)
    else await ctx.db.insert('publicWriteAttempts', fields)
    return
  }

  if (row.count >= limit) {
    throw new ConvexError(message)
  }

  await ctx.db.patch(row._id, { count: row.count + 1 })
}
