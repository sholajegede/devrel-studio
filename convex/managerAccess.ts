import { ConvexError, v } from 'convex/values'
import { MutationCtx, QueryCtx, mutation, query } from './_generated/server'
import { Id } from './_generated/dataModel'
import { requireInWorkspace } from './model/workspaces'

// ── Manager access to [slug].devrel.studio ────────────────────────────────────
//
// Managers are not devrel.studio users. They prove access with a code the
// DevRel gives them, and get a 30-day browser session in exchange.
//
// All hashing happens in the Next.js server layer (lib/manager-auth.ts) using a
// server-only secret. Convex only ever sees and compares hashes, so a dump of
// this table does not reveal any usable code or session token.

const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000 // 30 days

// ── Guessing throttle ─────────────────────────────────────────────────────────
//
// A code is 8 characters from a 32-character alphabet, so guessing it outright
// is impractical. The throttle is there for the cases that are not brute force:
// a leaked partial code, a manager who was given the wrong one and retries
// forever, and scripted probing that would otherwise run unmetered and unseen.
//
// Two counters run per slug. The per-IP one absorbs an ordinary wrong-code
// fumble; the slug-wide one is deliberately looser but is the only thing that
// notices an attacker rotating addresses.

const ATTEMPT_WINDOW_MS = 15 * 60 * 1000
const MAX_FAILURES_PER_IP = 8
const MAX_FAILURES_PER_SLUG = 40
const LOCKOUT_MS = 15 * 60 * 1000
const SLUG_BUCKET = '*'

// ── Public: what the gate screen needs to render ──────────────────────────────

/** Non-sensitive info about a client dashboard. Safe to call unauthenticated. */
export const getGateInfo = query({
  args: { slug: v.string() },
  handler: async (ctx, args) => {
    const client = await ctx.db
      .query('clients')
      .withIndex('by_slug', (q) => q.eq('slug', args.slug))
      .first()

    if (!client) return { exists: false, clientName: null, isPublic: false, hasCode: false }

    return {
      exists: true,
      clientName: client.company || client.name,
      isPublic: client.isPublic === true,
      hasCode: !!client.accessCodeHash,
    }
  },
})

/** True when this token is a live session for this slug. */
export const validateManagerSession = query({
  args: { slug: v.string(), tokenHash: v.string() },
  handler: async (ctx, args) => {
    const session = await ctx.db
      .query('managerSessions')
      .withIndex('by_token_hash', (q) => q.eq('tokenHash', args.tokenHash))
      .first()

    if (!session) return false
    if (session.slug !== args.slug) return false
    if (session.expiresAt < Date.now()) return false

    return true
  },
})

/**
 * Exchange a code hash for a session. Called only from the server-side route
 * handler, never from the browser.
 */
export const redeemAccessCode = mutation({
  args: {
    slug: v.string(),
    codeHash: v.string(),
    tokenHash: v.string(),
    // Hashed in the Next.js layer — Convex never sees a raw address.
    ipHash: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const now = Date.now()
    const buckets = [args.ipHash ?? 'unknown', SLUG_BUCKET]

    // Check before doing any work, so a locked-out caller cannot use this
    // mutation to probe whether a slug exists.
    const lockedUntil = await lockoutFor(ctx, args.slug, buckets, now)
    if (lockedUntil) {
      return { ok: false as const, retryAfterMs: lockedUntil - now }
    }

    const client = await ctx.db
      .query('clients')
      .withIndex('by_slug', (q) => q.eq('slug', args.slug))
      .first()

    const isValid =
      !!client &&
      !!client.accessCodeHash &&
      client.accessCodeHash === args.codeHash

    if (!isValid || !client) {
      await recordFailure(ctx, args.slug, buckets, now)
      return { ok: false as const }
    }

    // A correct code clears the counters — an honest manager who mistyped twice
    // should not carry those failures around for the rest of the window.
    await clearAttempts(ctx, args.slug, buckets)

    await ctx.db.insert('managerSessions', {
      clientId: client._id,
      slug: args.slug,
      tokenHash: args.tokenHash,
      expiresAt: now + SESSION_TTL_MS,
      createdAt: now,
    })

    return { ok: true as const, expiresAt: now + SESSION_TTL_MS }
  },
})

/** Drop a single session — used when a manager signs out. */
export const endManagerSession = mutation({
  args: { tokenHash: v.string() },
  handler: async (ctx, args) => {
    const session = await ctx.db
      .query('managerSessions')
      .withIndex('by_token_hash', (q) => q.eq('tokenHash', args.tokenHash))
      .first()

    if (session) await ctx.db.delete(session._id)
  },
})

// ── Owner-only: managing the code ─────────────────────────────────────────────

/** Set or rotate the access code. Rotating invalidates every live session. */
export const setAccessCode = mutation({
  args: {
    clientId: v.id('clients'),
    codeHash: v.string(),
  },
  handler: async (ctx, args) => {
    const { doc: client } = await requireInWorkspace(ctx, args.clientId, 'admin')

    if (!client.slug) {
      throw new ConvexError('Add a slug to this client before creating an access code')
    }

    await ctx.db.patch(args.clientId, {
      accessCodeHash: args.codeHash,
      accessCodeUpdatedAt: new Date().toISOString(),
    })

    await revokeSessionsFor(ctx, args.clientId)
    return { ok: true }
  },
})

/** Remove the code entirely. The dashboard becomes unreachable unless public. */
export const clearAccessCode = mutation({
  args: { clientId: v.id('clients') },
  handler: async (ctx, args) => {
    await requireInWorkspace(ctx, args.clientId, 'admin')

    await ctx.db.patch(args.clientId, {
      accessCodeHash: undefined,
      accessCodeUpdatedAt: undefined,
    })

    await revokeSessionsFor(ctx, args.clientId)
    return { ok: true }
  },
})

/** Sign every manager out of this dashboard without changing the code. */
export const revokeManagerSessions = mutation({
  args: { clientId: v.id('clients') },
  handler: async (ctx, args) => {
    await requireInWorkspace(ctx, args.clientId, 'admin')
    const removed = await revokeSessionsFor(ctx, args.clientId)
    return { removed }
  },
})

/** Toggle "anyone with the link can view". */
export const setClientPublic = mutation({
  args: { clientId: v.id('clients'), isPublic: v.boolean() },
  handler: async (ctx, args) => {
    await requireInWorkspace(ctx, args.clientId, 'admin')
    await ctx.db.patch(args.clientId, { isPublic: args.isPublic })
    return { ok: true }
  },
})

// ── Throttle helpers ──────────────────────────────────────────────────────────

function attemptRow(ctx: MutationCtx | QueryCtx, slug: string, bucket: string) {
  return ctx.db
    .query('managerAccessAttempts')
    .withIndex('by_slug_and_bucket', (q) => q.eq('slug', slug).eq('bucket', bucket))
    .first()
}

/** Timestamp the caller is locked until, or null if they may try now. */
async function lockoutFor(
  ctx: MutationCtx,
  slug: string,
  buckets: string[],
  now: number,
): Promise<number | null> {
  let latest: number | null = null

  for (const bucket of buckets) {
    const row = await attemptRow(ctx, slug, bucket)
    if (row?.lockedUntil && row.lockedUntil > now) {
      latest = Math.max(latest ?? 0, row.lockedUntil)
    }
  }

  return latest
}

async function recordFailure(
  ctx: MutationCtx,
  slug: string,
  buckets: string[],
  now: number,
) {
  for (const bucket of buckets) {
    const limit = bucket === SLUG_BUCKET ? MAX_FAILURES_PER_SLUG : MAX_FAILURES_PER_IP
    const row = await attemptRow(ctx, slug, bucket)

    // A window that has gone quiet starts over, so occasional wrong codes months
    // apart never accumulate into a lockout.
    if (!row || now - row.firstFailureAt > ATTEMPT_WINDOW_MS) {
      const fields = {
        slug,
        bucket,
        failures: 1,
        firstFailureAt: now,
        lastFailureAt: now,
        lockedUntil: undefined,
      }
      if (row) await ctx.db.patch(row._id, fields)
      else await ctx.db.insert('managerAccessAttempts', fields)
      continue
    }

    const failures = row.failures + 1
    await ctx.db.patch(row._id, {
      failures,
      lastFailureAt: now,
      // Each failure past the limit doubles the wait, capped at an hour, so a
      // persistent script backs off fast while a human who finds the right code
      // on attempt nine waits a quarter of an hour once.
      lockedUntil:
        failures >= limit
          ? now + Math.min(LOCKOUT_MS * 2 ** (failures - limit), 60 * 60 * 1000)
          : undefined,
    })
  }
}

async function clearAttempts(ctx: MutationCtx, slug: string, buckets: string[]) {
  for (const bucket of buckets) {
    // The slug-wide counter is left alone: one manager signing in correctly
    // says nothing about whoever else is guessing against the same dashboard.
    if (bucket === SLUG_BUCKET) continue
    const row = await attemptRow(ctx, slug, bucket)
    if (row) await ctx.db.delete(row._id)
  }
}

// ── Helpers ───────────────────────────────────────────────────────────────────

async function revokeSessionsFor(ctx: MutationCtx, clientId: Id<'clients'>) {
  const sessions = await ctx.db
    .query('managerSessions')
    .withIndex('by_client', (q) => q.eq('clientId', clientId))
    .collect()

  for (const session of sessions) {
    await ctx.db.delete(session._id)
  }

  return sessions.length
}
