import { ConvexError, v } from 'convex/values'
import { MutationCtx, mutation, query } from './_generated/server'
import { Id } from './_generated/dataModel'
import { getCurrentUser, requireCurrentUser } from './model/auth'
import { HANDLE_PATTERN, isReservedHandle, normalizeHandle } from '../lib/naming'

// ── Public portfolio ──────────────────────────────────────────────────────────
//
// devrel.studio/@handle — an unauthenticated, read-only view of everything a
// DevRel has shipped. This is the second unauthenticated read in the app (the
// other is the client dashboard), so the shape returned here is built by hand
// rather than by spreading a document: notes, tracking links and client names
// are internal and must never leave through this query.

// Handle rules live in lib/naming.ts alongside the slug rules, so the two
// namespaces cannot drift apart.
export { normalizeHandle }

async function assertHandleAvailable(
  ctx: MutationCtx,
  handle: string,
  exceptUserId: Id<'users'>,
) {
  if (!HANDLE_PATTERN.test(handle)) {
    throw new ConvexError(
      'Handles are 3–30 characters, using lowercase letters, numbers, hyphens and underscores',
    )
  }

  if (isReservedHandle(handle)) {
    throw new ConvexError(`"@${handle}" is reserved — pick another handle`)
  }

  const existing = await ctx.db
    .query('users')
    .withIndex('by_handle', (q) => q.eq('handle', handle))
    .first()

  if (existing && existing._id !== exceptUserId) {
    throw new ConvexError(`"@${handle}" is already taken`)
  }
}

// ── Public read ───────────────────────────────────────────────────────────────

/**
 * ⚠ PUBLIC — unauthenticated. Everything returned here is world-readable.
 *
 * Only Published entries are included. Drafts, scheduled work and anything
 * waiting on client approval stay private, as do notes, UTM links and which
 * client commissioned the work.
 */
export const getPortfolio = query({
  args: { handle: v.string() },
  handler: async (ctx, args) => {
    const handle = normalizeHandle(args.handle)
    if (!handle) return null

    const user = await ctx.db
      .query('users')
      .withIndex('by_handle', (q) => q.eq('handle', handle))
      .first()

    if (!user) return null

    const entries = await ctx.db
      .query('contentEntries')
      .withIndex('by_user', (q) => q.eq('userId', user._id))
      .collect()

    const published = entries
      .filter((entry) => entry.status === 'Published')
      .sort((a, b) => b.publicationDate.localeCompare(a.publicationDate))
      .map((entry) => ({
        id: entry._id,
        category: entry.category,
        // Constant by construction — carried so the shared metric helpers in
        // lib/metrics can roll these up without a special case.
        status: 'Published' as const,
        title: entry.title,
        link: entry.link,
        platform: entry.platform,
        publicationDate: entry.publicationDate,
        contentType: entry.contentType,
        tags: entry.tags,
        // Metrics, per category
        views: entry.views,
        downloads: entry.downloads,
        weeklyDownloads: entry.weeklyDownloads,
        attendees: entry.attendees,
        stars: entry.stars,
        // Category-specific display fields
        packageName: entry.packageName,
        eventName: entry.eventName,
        eventLocation: entry.eventLocation,
        podcastName: entry.podcastName,
        repoUrl: entry.repoUrl,
        stack: entry.stack,
        reshareCount: entry.reshares?.length ?? 0,
      }))

    return {
      profile: {
        handle: user.handle!,
        firstName: user.firstName ?? '',
        lastName: user.lastName ?? '',
        imageUrl: user.imageUrl,
        bio: user.bio,
        websiteUrl: user.websiteUrl,
        githubUsername: user.githubUsername,
        twitterUsername: user.twitterUsername,
      },
      entries: published,
    }
  },
})

/**
 * ⚠ PUBLIC — unauthenticated. Every claimed handle is already world-readable at
 * /@handle, so listing them reveals nothing new; this exists so the sitemap can
 * enumerate them for search engines.
 *
 * Portfolios with nothing published are omitted: a sitemap entry pointing at an
 * empty page is a crawl budget cost with no upside.
 */
export const listPublishedHandles = query({
  args: {},
  handler: async (ctx) => {
    const users = await ctx.db
      .query('users')
      .withIndex('by_handle')
      .collect()

    const listed: { handle: string; lastModified: string }[] = []

    for (const user of users) {
      if (!user.handle) continue

      const entries = await ctx.db
        .query('contentEntries')
        .withIndex('by_user', (q) => q.eq('userId', user._id))
        .collect()

      const published = entries.filter((entry) => entry.status === 'Published')
      if (published.length === 0) continue

      // Newest `updatedAt` is what a crawler should treat as the page's age.
      const lastModified = published.reduce(
        (latest, entry) => (entry.updatedAt > latest ? entry.updatedAt : latest),
        published[0].updatedAt,
      )

      listed.push({ handle: user.handle, lastModified })
    }

    return listed
  },
})

// ── Owner writes ──────────────────────────────────────────────────────────────

/** Whether a handle can be claimed by the signed-in user. Drives the settings UI. */
export const isHandleAvailable = query({
  args: { handle: v.string() },
  handler: async (ctx, args) => {
    const handle = normalizeHandle(args.handle)

    if (!HANDLE_PATTERN.test(handle)) {
      return {
        available: false,
        reason:
          'Use 3–30 characters: lowercase letters, numbers, hyphens or underscores',
      }
    }

    if (isReservedHandle(handle)) {
      return { available: false, reason: 'That handle is reserved' }
    }

    const existing = await ctx.db
      .query('users')
      .withIndex('by_handle', (q) => q.eq('handle', handle))
      .first()

    const user = await getCurrentUser(ctx)

    if (existing && existing._id !== user?._id) {
      return { available: false, reason: 'That handle is already taken' }
    }

    return { available: true, reason: null }
  },
})

export const updatePortfolio = mutation({
  args: {
    handle: v.optional(v.string()),
    bio: v.optional(v.string()),
    websiteUrl: v.optional(v.string()),
    githubUsername: v.optional(v.string()),
    twitterUsername: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const user = await requireCurrentUser(ctx)
    const patch: Record<string, unknown> = {}

    if (args.handle !== undefined) {
      const handle = normalizeHandle(args.handle)
      if (!handle) {
        // Clearing the handle unpublishes the portfolio.
        patch.handle = undefined
      } else {
        await assertHandleAvailable(ctx, handle, user._id)
        patch.handle = handle
      }
    }

    if (args.bio !== undefined) patch.bio = args.bio.trim().slice(0, 500) || undefined
    if (args.websiteUrl !== undefined) {
      patch.websiteUrl = args.websiteUrl.trim().slice(0, 200) || undefined
    }
    if (args.githubUsername !== undefined) {
      patch.githubUsername =
        args.githubUsername.trim().replace(/^@/, '').slice(0, 60) || undefined
    }
    if (args.twitterUsername !== undefined) {
      patch.twitterUsername =
        args.twitterUsername.trim().replace(/^@/, '').slice(0, 60) || undefined
    }

    await ctx.db.patch(user._id, patch)
    return { ok: true, handle: patch.handle ?? user.handle ?? null }
  },
})
