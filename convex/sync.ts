import { v } from 'convex/values'
import { internal } from './_generated/api'
import { Doc, Id } from './_generated/dataModel'
import { MAX_DOWNLOAD_CHUNKS, downloadRanges, parseRepo } from '../lib/sources'
import {
  ActionCtx,
  action,
  internalAction,
  internalMutation,
  internalQuery,
} from './_generated/server'

// ── Automatic stat refresh ────────────────────────────────────────────────────
//
// Package downloads and Demo stars are the two metrics nobody should have to
// type in by hand: npm and GitHub both publish them on unauthenticated APIs.
// A daily cron (see `crons.ts`) refreshes every entry; the dashboard also
// exposes a "Refresh now" button that syncs just the caller's entries.
//
// A GITHUB_TOKEN environment variable is optional. Without it GitHub allows 60
// requests an hour per IP, which is plenty for a daily job but can be hit by
// repeated manual refreshes on a large account.

const NPM_API = 'https://api.npmjs.org'
const NPM_REGISTRY = 'https://registry.npmjs.org'
const GITHUB_API = 'https://api.github.com'

/** Guard against a runaway loop if a package reports a nonsense creation date. */

// ── Internal reads / writes ───────────────────────────────────────────────────

export const listSyncableEntries = internalQuery({
  args: { userId: v.optional(v.id('users')) },
  handler: async (ctx, args) => {
    const packages = await ctx.db
      .query('contentEntries')
      .withIndex('by_category', (q) => q.eq('category', 'Package'))
      .collect()

    const demos = await ctx.db
      .query('contentEntries')
      .withIndex('by_category', (q) => q.eq('category', 'Demo'))
      .collect()

    const inScope = (entry: Doc<'contentEntries'>) =>
      !args.userId || entry.userId === args.userId

    return {
      packages: packages
        .filter(inScope)
        .filter((e) => !!e.packageName?.trim())
        .map((e) => ({ id: e._id, packageName: e.packageName!.trim() })),
      demos: demos
        .filter(inScope)
        .filter((e) => !!e.repoUrl?.trim())
        .map((e) => ({ id: e._id, repoUrl: e.repoUrl!.trim() })),
    }
  },
})

export const userIdForKindeId = internalQuery({
  args: { kindeId: v.string() },
  handler: async (ctx, args) => {
    const user = await ctx.db
      .query('users')
      .withIndex('by_kinde_id', (q) => q.eq('kindeId', args.kindeId))
      .unique()
    return user?._id ?? null
  },
})

export const applyStats = internalMutation({
  args: {
    id: v.id('contentEntries'),
    downloads: v.optional(v.number()),
    weeklyDownloads: v.optional(v.number()),
    stars: v.optional(v.number()),
    error: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { id, error, ...stats } = args

    // The entry may have been deleted between the read and the write.
    const entry = await ctx.db.get(id)
    if (!entry) return

    const patch: Record<string, unknown> = {
      statsSyncedAt: new Date().toISOString(),
      statsSyncError: error,
    }

    // Only write numbers we actually resolved — a failed fetch must not zero
    // out a value the DevRel entered by hand.
    for (const [key, value] of Object.entries(stats)) {
      if (typeof value === 'number' && Number.isFinite(value)) patch[key] = value
    }

    await ctx.db.patch(id, patch)
  },
})

// ── npm ───────────────────────────────────────────────────────────────────────

interface NpmStats {
  weeklyDownloads: number
  downloads: number
}

async function fetchJson(url: string, headers?: Record<string, string>) {
  const response = await fetch(url, { headers })
  if (!response.ok) {
    throw new Error(`${response.status} ${response.statusText} for ${url}`)
  }
  return await response.json()
}

/**
 * All-time downloads.
 *
 * npm's point endpoint caps a single range at 18 months, so a package older than
 * that has to be summed in chunks walking back from today to its publication
 * date. The range arithmetic lives in lib/sources.ts so it can be tested without
 * a network.
 */
async function fetchTotalDownloads(pkg: string): Promise<number> {
  const encoded = encodeURIComponent(pkg)

  let createdAt: Date
  try {
    const meta = await fetchJson(`${NPM_REGISTRY}/${encoded}`)
    createdAt = new Date(meta?.time?.created ?? 0)
    if (Number.isNaN(createdAt.getTime())) createdAt = new Date(0)
  } catch {
    // Registry metadata is a nicety — without it, fall back to one year.
    createdAt = new Date(Date.now() - 365 * 24 * 60 * 60 * 1000)
  }

  let total = 0

  for (const range of downloadRanges(createdAt, new Date(), MAX_DOWNLOAD_CHUNKS)) {
    const data = await fetchJson(
      `${NPM_API}/downloads/point/${range.from}:${range.to}/${encoded}`,
    )
    total += typeof data?.downloads === 'number' ? data.downloads : 0
  }

  return total
}

async function fetchNpmStats(pkg: string): Promise<NpmStats> {
  const encoded = encodeURIComponent(pkg)

  const weekly = await fetchJson(`${NPM_API}/downloads/point/last-week/${encoded}`)
  const weeklyDownloads = typeof weekly?.downloads === 'number' ? weekly.downloads : 0

  return { weeklyDownloads, downloads: await fetchTotalDownloads(pkg) }
}

// ── GitHub ────────────────────────────────────────────────────────────────────

export { parseRepo }

async function fetchStars(repoUrl: string): Promise<number> {
  const parsed = parseRepo(repoUrl)
  if (!parsed) throw new Error(`Not a GitHub repo URL: ${repoUrl}`)

  const headers: Record<string, string> = {
    Accept: 'application/vnd.github+json',
    'User-Agent': 'devrel-studio',
  }
  const token = process.env.GITHUB_TOKEN
  if (token) headers.Authorization = `Bearer ${token}`

  const data = await fetchJson(
    `${GITHUB_API}/repos/${parsed.owner}/${parsed.repo}`,
    headers,
  )

  return typeof data?.stargazers_count === 'number' ? data.stargazers_count : 0
}

// ── Orchestration ─────────────────────────────────────────────────────────────

/** Truncated so one long upstream message cannot dominate the document. */
function errorText(error: unknown): string {
  return (error instanceof Error ? error.message : String(error)).slice(0, 200)
}

export interface SyncResult {
  synced: number
  failed: number
  total: number
}

interface SyncableEntries {
  packages: { id: Id<'contentEntries'>; packageName: string }[]
  demos: { id: Id<'contentEntries'>; repoUrl: string }[]
}

async function runSync(
  ctx: ActionCtx,
  userId?: Id<'users'>,
): Promise<SyncResult> {
  const { packages, demos }: SyncableEntries = await ctx.runQuery(
    internal.sync.listSyncableEntries,
    { userId },
  )

  let synced = 0
  let failed = 0

  for (const pkg of packages) {
    try {
      const stats = await fetchNpmStats(pkg.packageName)
      await ctx.runMutation(internal.sync.applyStats, {
        id: pkg.id,
        // A zero all-time total almost always means the registry metadata was
        // unreadable rather than that nobody has installed it, so leave any
        // existing figure alone instead of wiping it.
        downloads: stats.downloads > 0 ? stats.downloads : undefined,
        weeklyDownloads: stats.weeklyDownloads,
        error: undefined,
      })
      synced++
    } catch (error) {
      console.error('[sync] npm failed for', pkg.packageName, error)
      await ctx.runMutation(internal.sync.applyStats, {
        id: pkg.id,
        error: errorText(error),
      })
      failed++
    }
  }

  for (const demo of demos) {
    try {
      const stars = await fetchStars(demo.repoUrl)
      await ctx.runMutation(internal.sync.applyStats, {
        id: demo.id,
        stars,
        error: undefined,
      })
      synced++
    } catch (error) {
      console.error('[sync] GitHub failed for', demo.repoUrl, error)
      await ctx.runMutation(internal.sync.applyStats, {
        id: demo.id,
        error: errorText(error),
      })
      failed++
    }
  }

  return { synced, failed, total: packages.length + demos.length }
}

/** Daily job — refreshes every Package and Demo entry in the database. */
export const syncAllStats = internalAction({
  args: {},
  handler: async (ctx): Promise<SyncResult> => {
    const result = await runSync(ctx)
    console.log('[sync] daily run complete', result)
    return result
  },
})

/** "Refresh now" — scoped to the caller's own entries. */
export const syncMyStats = action({
  args: {},
  handler: async (ctx): Promise<SyncResult> => {
    const identity = await ctx.auth.getUserIdentity()
    if (!identity) throw new Error('Not authenticated')

    const userId: Id<'users'> | null = await ctx.runQuery(
      internal.sync.userIdForKindeId,
      { kindeId: identity.subject },
    )
    if (!userId) throw new Error('No profile for this account yet')

    return await runSync(ctx, userId)
  },
})
