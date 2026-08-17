import { v } from 'convex/values'
import { internalMutation } from './_generated/server'
import { ensureMembership } from './model/workspaces'

// ── The public demo ───────────────────────────────────────────────────────────
//
// "Explore the demo" used to point at /dashboard, which requires an account —
// so the one link on the landing page aimed at people who have not signed up
// sent them to a sign-in wall.
//
// This seeds a real client workspace, marked public, containing entries in all
// six categories. It is not a mock: it is the same schema, the same queries and
// the same dashboard a paying customer's client sees, which is the only version
// worth showing.
//
// Idempotent — re-running replaces the demo entries rather than duplicating
// them, so the demo can be refreshed after a schema change.

const DEMO_SLUG = 'demo'
const DEMO_EMAIL = 'demo@devrel.studio'

/** Dates are generated relative to now so the demo never looks abandoned. */
function monthsAgo(months: number, day: number): string {
  const now = new Date()
  const date = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - months, day))
  return date.toISOString().slice(0, 10)
}

interface DemoEntry {
  category: 'Written' | 'Video' | 'Event' | 'Podcast' | 'Package' | 'Demo'
  title: string
  platform: string
  contentType: string
  status: 'Published' | 'Draft' | 'Waiting Approval' | 'Scheduled'
  publicationDate: string
  link?: string
  tags: string[]
  views?: number
  downloads?: number
  weeklyDownloads?: number
  attendees?: number
  stars?: number
  packageName?: string
  eventName?: string
  eventLocation?: string
  podcastName?: string
  repoUrl?: string
  stack?: string
  reshares?: { platform: string; link: string; date: string }[]
}

/**
 * Deliberately uneven. Every category is represented, but so are the states a
 * real workspace is always in: work in review, something scheduled, a draft,
 * and a couple of pieces that did far better than the rest.
 */
function demoEntries(): DemoEntry[] {
  return [
    // ── Written ──
    {
      category: 'Written', title: 'Shipping type-safe webhooks without a queue',
      platform: 'Dev.to', contentType: 'Tutorial', status: 'Published',
      publicationDate: monthsAgo(0, 4), link: 'https://dev.to/', views: 12480,
      tags: ['TypeScript', 'Webhooks', 'Backend'],
      reshares: [
        { platform: 'LinkedIn', link: 'https://linkedin.com/', date: monthsAgo(0, 4) },
        { platform: 'Hacker News', link: 'https://news.ycombinator.com/', date: monthsAgo(0, 5) },
      ],
    },
    {
      category: 'Written', title: 'A practical guide to auth in multi-tenant apps',
      platform: 'Company Blog', contentType: 'Guide', status: 'Published',
      publicationDate: monthsAgo(1, 12), link: 'https://example.com/', views: 8210,
      tags: ['Auth', 'Multi-tenant', 'SaaS'],
      reshares: [{ platform: 'Twitter/X', link: 'https://x.com/', date: monthsAgo(1, 12) }],
    },
    {
      category: 'Written', title: 'Why your SDK needs a migration guide before v2',
      platform: 'Hashnode', contentType: 'Opinion', status: 'Published',
      publicationDate: monthsAgo(2, 8), link: 'https://hashnode.com/', views: 4360,
      tags: ['SDK', 'DX', 'Versioning'],
    },
    {
      category: 'Written', title: 'Rate limiting patterns for public APIs',
      platform: 'Dev.to', contentType: 'Tutorial', status: 'Waiting Approval',
      publicationDate: monthsAgo(0, 26), views: 0,
      tags: ['APIs', 'Rate Limiting'],
    },

    // ── Video ──
    {
      category: 'Video', title: 'Build a realtime dashboard in 20 minutes',
      platform: 'YouTube', contentType: 'Walkthrough', status: 'Published',
      publicationDate: monthsAgo(0, 9), link: 'https://youtube.com/', views: 31200,
      tags: ['Realtime', 'React', 'Live coding'],
      reshares: [{ platform: 'LinkedIn', link: 'https://linkedin.com/', date: monthsAgo(0, 10) }],
    },
    {
      category: 'Video', title: 'Debugging production with structured logs',
      platform: 'YouTube', contentType: 'Deep dive', status: 'Published',
      publicationDate: monthsAgo(2, 21), link: 'https://youtube.com/', views: 9840,
      tags: ['Observability', 'Debugging'],
    },
    {
      category: 'Video', title: 'Migrating to the new SDK — what changes',
      platform: 'Loom', contentType: 'Announcement', status: 'Scheduled',
      publicationDate: monthsAgo(-1, 3), views: 0,
      tags: ['SDK', 'Migration'],
    },

    // ── Event ──
    {
      category: 'Event', title: 'The hidden cost of your onboarding flow',
      platform: 'Conference', contentType: 'Conference Talk', status: 'Published',
      publicationDate: monthsAgo(1, 19), attendees: 640,
      eventName: 'DevRelCon', eventLocation: 'London, UK',
      tags: ['DX', 'Onboarding', 'Talk'],
      reshares: [{ platform: 'Twitter/X', link: 'https://x.com/', date: monthsAgo(1, 20) }],
    },
    {
      category: 'Event', title: 'Workshop: instrumenting your first service',
      platform: 'Meetup', contentType: 'Workshop', status: 'Published',
      publicationDate: monthsAgo(3, 6), attendees: 85,
      eventName: 'Cloud Native Meetup', eventLocation: 'Berlin, DE',
      tags: ['Workshop', 'Observability'],
    },
    {
      category: 'Event', title: 'Live Q&A: migrating from REST to typed RPC',
      platform: 'Webinar', contentType: 'Webinar', status: 'Scheduled',
      publicationDate: monthsAgo(-1, 14), attendees: 0,
      eventName: 'Community Office Hours', eventLocation: 'Online',
      tags: ['RPC', 'Community'],
    },

    // ── Podcast ──
    {
      category: 'Podcast', title: 'What developer experience actually measures',
      platform: 'Spotify', contentType: 'Guest Appearance', status: 'Published',
      publicationDate: monthsAgo(1, 2), link: 'https://open.spotify.com/', downloads: 14300,
      podcastName: 'The Changelog',
      tags: ['DX', 'Metrics', 'Interview'],
    },
    {
      category: 'Podcast', title: 'Running a DevRel programme as a team of one',
      platform: 'Apple Podcasts', contentType: 'Guest Appearance', status: 'Published',
      publicationDate: monthsAgo(3, 15), link: 'https://podcasts.apple.com/', downloads: 6120,
      podcastName: 'Developer Relations Weekly',
      tags: ['DevRel', 'Career'],
    },

    // ── Package ──
    {
      category: 'Package', title: 'Typed webhook verifier',
      platform: 'npm', contentType: 'Library', status: 'Published',
      publicationDate: monthsAgo(4, 11), link: 'https://npmjs.com/',
      packageName: '@acme/webhook-verify', downloads: 184300, weeklyDownloads: 9420,
      tags: ['npm', 'TypeScript', 'Open Source'],
      reshares: [{ platform: 'Reddit', link: 'https://reddit.com/', date: monthsAgo(4, 12) }],
    },
    {
      category: 'Package', title: 'Rate limiter component',
      platform: 'npm', contentType: 'Component', status: 'Published',
      publicationDate: monthsAgo(2, 3), link: 'https://npmjs.com/',
      packageName: '@acme/rate-limiter', downloads: 42800, weeklyDownloads: 3110,
      tags: ['npm', 'Rate Limiting', 'Open Source'],
    },
    {
      category: 'Package', title: 'CLI for local webhook replay',
      platform: 'npm', contentType: 'CLI Tool', status: 'Draft',
      publicationDate: monthsAgo(0, 22), packageName: '@acme/replay-cli',
      downloads: 0, weeklyDownloads: 0,
      tags: ['CLI', 'DX'],
    },

    // ── Demo ──
    {
      category: 'Demo', title: 'Multi-tenant SaaS starter kit',
      platform: 'GitHub', contentType: 'Starter Kit', status: 'Published',
      publicationDate: monthsAgo(2, 27), link: 'https://github.com/',
      repoUrl: 'https://github.com/acme/saas-starter', stars: 2840,
      stack: 'Next.js · TypeScript · Postgres',
      tags: ['Starter Kit', 'SaaS', 'Open Source'],
      reshares: [
        { platform: 'Hacker News', link: 'https://news.ycombinator.com/', date: monthsAgo(2, 28) },
        { platform: 'LinkedIn', link: 'https://linkedin.com/', date: monthsAgo(2, 28) },
      ],
    },
    {
      category: 'Demo', title: 'Realtime collaboration reference app',
      platform: 'GitHub', contentType: 'Reference App', status: 'Published',
      publicationDate: monthsAgo(5, 14), link: 'https://github.com/',
      repoUrl: 'https://github.com/acme/realtime-demo', stars: 910,
      stack: 'React · WebSockets · Redis',
      tags: ['Realtime', 'Reference'],
    },
  ]
}

/**
 * Create or refresh the public demo workspace.
 *
 * Run with:  npx convex run demo:seedDemo
 */
export const seedDemo = internalMutation({
  args: { reset: v.optional(v.boolean()) },
  handler: async (ctx, args) => {
    // A dedicated account so the demo can never be confused with, or write into,
    // a real customer's workspace.
    let user = await ctx.db
      .query('users')
      .filter((q) => q.eq(q.field('email'), DEMO_EMAIL))
      .first()

    if (!user) {
      const userId = await ctx.db.insert('users', {
        kindeId: 'demo-account-not-a-real-login',
        email: DEMO_EMAIL,
        firstName: 'DevRel',
        lastName: 'Studio',
      })
      user = (await ctx.db.get(userId))!
    }

    let workspace = (
      await ctx.db
        .query('workspaces')
        .withIndex('by_owner', (q) => q.eq('ownerId', user!._id))
        .collect()
    )[0]

    if (!workspace) {
      const workspaceId = await ctx.db.insert('workspaces', {
        name: 'Demo workspace',
        ownerId: user._id,
        isPersonal: true,
        createdAt: new Date().toISOString(),
      })
      workspace = (await ctx.db.get(workspaceId))!
    }

    await ensureMembership(ctx, workspace._id, user._id, 'owner')

    let client = await ctx.db
      .query('clients')
      .withIndex('by_slug', (q) => q.eq('slug', DEMO_SLUG))
      .first()

    if (!client) {
      const clientId = await ctx.db.insert('clients', {
        userId: user._id,
        workspaceId: workspace._id,
        name: 'Jordan Reyes',
        company: 'Northwind',
        email: DEMO_EMAIL,
        website: 'https://example.com',
        monthlyRetainer: 4500,
        currency: 'USD',
        startDate: monthsAgo(9, 1),
        status: 'Active' as const,
        contractType: 'Retainer' as const,
        slug: DEMO_SLUG,
        // Public: the whole point is that nobody needs a code to look.
        isPublic: true,
      })
      client = (await ctx.db.get(clientId))!
    } else {
      await ctx.db.patch(client._id, { isPublic: true, workspaceId: workspace._id })
    }

    const existing = await ctx.db
      .query('contentEntries')
      .withIndex('by_workspace', (q) => q.eq('workspaceId', workspace!._id))
      .collect()

    // Replace rather than append, so re-running refreshes the dates instead of
    // stacking a second copy of every entry.
    if (existing.length > 0 && args.reset !== false) {
      for (const entry of existing) await ctx.db.delete(entry._id)
    } else if (existing.length > 0) {
      return { skipped: true, entries: existing.length, slug: DEMO_SLUG }
    }

    const now = new Date().toISOString()
    let inserted = 0

    for (const entry of demoEntries()) {
      await ctx.db.insert('contentEntries', {
        ...entry,
        userId: user._id,
        workspaceId: workspace._id,
        client: DEMO_SLUG,
        link: entry.link ?? '',
        trackingLink: '',
        notes: '',
        updatedAt: now,
      })
      inserted++
    }

    return {
      slug: DEMO_SLUG,
      workspaceId: workspace._id,
      clientId: client._id,
      inserted,
    }
  },
})
