import { Id } from './_generated/dataModel'
import { mutation, query } from './_generated/server'
import { v } from 'convex/values'

const categoryValidator = v.optional(v.union(
  v.literal("Written"),
  v.literal("Video"),
  v.literal("Event"),
  v.literal("Podcast"),
  v.literal("Package"),
))

const statusValidator = v.union(
  v.literal("Published"),
  v.literal("Draft"),
  v.literal("Waiting Approval"),
  v.literal("Scheduled"),
)

const reshareValidator = v.optional(v.array(v.object({
  platform: v.string(),
  link: v.string(),
  date: v.string(),
})))

// ── Shared entry fields (used by both create and update) ──────────────────────

const entryFields = {
  client: v.string(),
  category: categoryValidator,
  title: v.string(),
  link: v.string(),
  trackingLink: v.string(),
  platform: v.string(),
  publicationDate: v.string(),
  status: statusValidator,
  views: v.optional(v.number()),
  tags: v.array(v.string()),
  contentType: v.string(),
  notes: v.string(),
  reshares: reshareValidator,
  // Package
  packageName: v.optional(v.string()),
  downloads: v.optional(v.number()),
  weeklyDownloads: v.optional(v.number()),
  // Event
  eventName: v.optional(v.string()),
  eventLocation: v.optional(v.string()),
  attendees: v.optional(v.number()),
  // Podcast
  podcastName: v.optional(v.string()),
}

// ── Queries ───────────────────────────────────────────────────────────────────

export const getContentByClient = query({
  args: { client: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query('contentEntries')
      .withIndex('by_client', (q) => q.eq('client', args.client))
      .order('desc')
      .collect()
  },
})

export const getAllContent = query({
  args: { userId: v.id("users") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query('contentEntries')
      .filter((q) => q.eq(q.field('userId'), args.userId))
      .order('desc')
      .collect()
  },
})

export const getContentByStatus = query({
  args: { status: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query('contentEntries')
      .filter((q) => q.eq(q.field('status'), args.status))
      .order('desc')
      .collect()
  },
})

export const getContentById = query({
  args: { id: v.id('contentEntries') },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.id)
  },
})

export const getRetainerContent = query({
  args: { fromDate: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query('contentEntries')
      .filter((q) => q.gte(q.field('publicationDate'), args.fromDate))
      .filter((q) => q.eq(q.field('status'), 'Published'))
      .order('desc')
      .collect()
  },
})

// ── Mutations ─────────────────────────────────────────────────────────────────

export const createContent = mutation({
  args: {
    userId: v.id("users"),
    ...entryFields,
  },
  handler: async (ctx, args) => {
    const now = new Date().toISOString()
    const id = await ctx.db.insert('contentEntries', {
      ...args,
      updatedAt: now,
    })
    return id
  },
})

export const updateContent = mutation({
  args: {
    id: v.id('contentEntries'),
    userId: v.id("users"),
    ...entryFields,
  },
  handler: async (ctx, args) => {
    const { id, ...rest } = args
    const now = new Date().toISOString()
    await ctx.db.patch(id, { ...rest, updatedAt: now })
    return id
  },
})

export const deleteContent = mutation({
  args: { id: v.id('contentEntries') },
  handler: async (ctx, args) => {
    await ctx.db.delete(args.id)
    return args.id
  },
})

export const seedSampleData = mutation({
  args: {},
  handler: async (ctx) => {
    const userId = "jd74y8z0rpgr93h8ky8fd10a0d801pfz" as Id<"users">;

    const sampleData = [
      // July 2025 - Week 1
      {
        userId,
        client: "kinde",
        category: "Written" as const,
        title: 'Add Billing to Your SaaS in Under 10 Minutes (With Kinde)',
        link: 'https://dev.to/sholajegede/add-billing-to-your-saas-in-under-10-minutes-with-kinde-20md',
        trackingLink: 'https://dev.to/sholajegede/add-billing-to-your-saas-in-under-10-minutes-with-kinde-20md?utm_source=kinde&utm_medium=content&utm_campaign=learnflowai&creative=post1',
        platform: 'Dev.to',
        publicationDate: '2025-07-17',
        status: 'Published' as const,
        views: 0,
        tags: ['Kinde', 'Billing', 'SaaS', 'Tutorial'],
        contentType: 'Tutorial',
        notes: 'Week 1 - Post 1',
      },
      {
        userId,
        client: "kinde",
        category: "Written" as const,
        title: 'How Kinde Billing Actually Works',
        link: 'https://dev.to/sholajegede/how-kinde-billing-actually-works-8fc',
        trackingLink: 'https://dev.to/sholajegede/how-kinde-billing-actually-works-8fc?utm_source=kinde&utm_medium=content&utm_campaign=learnflowai&creative=post2',
        platform: 'Dev.to',
        publicationDate: '2025-07-18',
        status: 'Published' as const,
        views: 0,
        tags: ['Kinde', 'Billing'],
        contentType: 'Guide',
        notes: 'Week 1 - Post 2',
      },
      // November 2025 - Retainer Month 1
      {
        userId,
        client: "kinde",
        category: "Written" as const,
        title: 'The Complete Guide to Usage-Based Billing in AI Apps',
        link: '',
        trackingLink: 'https://kinde.com?utm_source=fcc&utm_medium=content&utm_campaign=shola&campaignid=chatgptapp',
        platform: 'freeCodeCamp',
        publicationDate: '2025-11-15',
        status: 'Waiting Approval' as const,
        views: 0,
        tags: ['Billing', 'AI', 'SaaS', 'Kinde'],
        contentType: 'Guide',
        notes: 'November 2025 - freeCodeCamp article',
      },
      {
        userId,
        client: "kinde",
        category: "Written" as const,
        title: "Why Your SaaS Can't Charge Per-Seat Anymore (And What Replaces It)",
        link: 'https://dev.to/sholajegede/why-your-saas-cant-charge-per-seat-anymore-and-what-replaces-it-d70',
        trackingLink: 'https://kinde.com?utm_source=devto&utm_medium=content&utm_campaign=shola',
        platform: 'Dev.to',
        publicationDate: '2025-11-20',
        status: 'Scheduled' as const,
        views: 0,
        tags: ['Pricing', 'SaaS', 'Kinde'],
        contentType: 'Opinion',
        notes: 'November 2025 - Dev.to article 1',
      },
      // January 2026 - Retainer Month 3
      {
        userId,
        client: "kinde",
        category: "Written" as const,
        title: 'How to Build and Deploy Tetris Inside ChatGPT',
        link: '',
        trackingLink: 'https://kinde.com?utm_source=fcc&utm_medium=content&utm_campaign=shola',
        platform: 'freeCodeCamp',
        publicationDate: '2026-01-15',
        status: 'Waiting Approval' as const,
        views: 0,
        tags: ['ChatGPT', 'Vercel', 'OAuth', 'Kinde'],
        contentType: 'Tutorial',
        notes: 'January 2026 - freeCodeCamp article',
      },
      {
        userId,
        client: "kinde",
        category: "Written" as const,
        title: 'How to Build Self-Service Billing: Let Users Upgrade Their Own Plans',
        link: 'https://dev.to/sholajegede/how-to-build-self-service-billing-let-users-upgrade-their-own-plans-1606',
        trackingLink: 'https://kinde.com?utm_source=devto&utm_medium=content&utm_campaign=shola',
        platform: 'Dev.to',
        publicationDate: '2026-01-20',
        status: 'Draft' as const,
        views: 0,
        tags: ['Billing', 'SaaS', 'Kinde'],
        contentType: 'Tutorial',
        notes: 'January 2026 - Dev.to article 1',
      },
    ]

    let inserted = 0
    for (const data of sampleData) {
      try {
        const now = new Date().toISOString()
        await ctx.db.insert('contentEntries', { ...data, updatedAt: now })
        inserted++
      } catch (e) {
        console.error('Error inserting sample data:', e)
      }
    }

    return { inserted, total: sampleData.length }
  },
})

// ── February 2026 demo data — every category, platform, status & metric ──────

export const seedFebruaryDemo = mutation({
  args: {},
  handler: async (ctx) => {
    // Resolve userId dynamically — look up from existing content, then users table
    const existingEntry = await ctx.db.query("contentEntries").first()
    const firstUser = !existingEntry ? await ctx.db.query("users").first() : null
    const userId = existingEntry?.userId ?? firstUser?._id
    if (!userId) return { inserted: 0, total: 0, error: "No user found in database" }
    const now = new Date().toISOString()

    const entries = [

      // ── WRITTEN ──────────────────────────────────────────────────────────────

      {
        userId, client: "kinde", category: "Written" as const,
        title: "How to Build a Multi-Tenant SaaS with Kinde Organizations and Next.js",
        link: "https://dev.to/sholajegede/how-to-build-multi-tenant-saas-kinde-nextjs",
        trackingLink: "https://kinde.com?utm_source=devto&utm_medium=content&utm_campaign=shola&creative=feb1",
        platform: "Dev.to",
        publicationDate: "2026-02-03",
        status: "Published" as const,
        views: 4_210,
        tags: ["Kinde", "SaaS", "NextJS", "Organizations"],
        contentType: "Tutorial",
        notes: "Feb 2026 - Dev.to article 1",
        reshares: [
          { platform: "LinkedIn", link: "https://linkedin.com/posts/sholajegede-feb1", date: "2026-02-04" },
          { platform: "Twitter/X", link: "https://x.com/sholajegede/status/feb1", date: "2026-02-04" },
          { platform: "Hacker News", link: "https://news.ycombinator.com/item?id=feb1", date: "2026-02-05" },
        ],
      },

      {
        userId, client: "kinde", category: "Written" as const,
        title: "The Complete Guide to Passkey Authentication: Why Passwords Are Dead",
        link: "https://freecodecamp.org/news/passkey-authentication-guide",
        trackingLink: "https://kinde.com?utm_source=fcc&utm_medium=content&utm_campaign=shola&creative=feb2",
        platform: "freeCodeCamp",
        publicationDate: "2026-02-10",
        status: "Published" as const,
        views: 11_830,
        tags: ["Kinde", "Passkeys", "Auth", "Security"],
        contentType: "Guide",
        notes: "Feb 2026 - freeCodeCamp article",
        reshares: [
          { platform: "LinkedIn", link: "https://linkedin.com/posts/sholajegede-feb2", date: "2026-02-11" },
          { platform: "Reddit", link: "https://reddit.com/r/webdev/feb2", date: "2026-02-12" },
        ],
      },

      {
        userId, client: "kinde", category: "Written" as const,
        title: "Why Every B2B SaaS Needs Enterprise SSO (And How to Add It in a Day)",
        link: "https://medium.com/@sholajegede/enterprise-sso-saas",
        trackingLink: "https://kinde.com?utm_source=medium&utm_medium=content&utm_campaign=shola&creative=feb3",
        platform: "Medium",
        publicationDate: "2026-02-14",
        status: "Published" as const,
        views: 2_670,
        tags: ["Kinde", "SSO", "Enterprise", "B2B", "SAML"],
        contentType: "Opinion",
        notes: "Feb 2026 - Medium article",
        reshares: [],
      },

      {
        userId, client: "kinde", category: "Written" as const,
        title: "Rate Limiting Your API Without a Backend: A Serverless Approach",
        link: "https://dev.to/sholajegede/rate-limiting-serverless",
        trackingLink: "https://kinde.com?utm_source=devto&utm_medium=content&utm_campaign=shola&creative=feb4",
        platform: "Dev.to",
        publicationDate: "2026-02-18",
        status: "Waiting Approval" as const,
        views: 0,
        tags: ["Kinde", "Rate Limiting", "API", "Serverless"],
        contentType: "Tutorial",
        notes: "Feb 2026 - Dev.to article 2 - pending editorial review",
      },

      {
        userId, client: "kinde", category: "Written" as const,
        title: "OAuth 2.0 vs OIDC: What's the Difference and When to Use Each",
        link: "",
        trackingLink: "",
        platform: "Hashnode",
        publicationDate: "2026-02-24",
        status: "Draft" as const,
        views: 0,
        tags: ["Kinde", "OAuth", "OIDC", "Auth"],
        contentType: "Reference Doc",
        notes: "Feb 2026 - Hashnode draft, needs technical review",
      },

      {
        userId, client: "kinde", category: "Written" as const,
        title: "How to Add Role-Based Access Control to a React App in 15 Minutes",
        link: "",
        trackingLink: "https://kinde.com?utm_source=linkedin&utm_medium=content&utm_campaign=shola&creative=feb5",
        platform: "LinkedIn",
        publicationDate: "2026-02-27",
        status: "Scheduled" as const,
        views: 0,
        tags: ["Kinde", "Roles", "Permissions", "React", "Auth"],
        contentType: "Tutorial",
        notes: "Feb 2026 - LinkedIn newsletter scheduled for end of month",
      },

      // ── VIDEO ─────────────────────────────────────────────────────────────────

      {
        userId, client: "kinde", category: "Video" as const,
        title: "Build a Full-Stack Auth System with Kinde + Next.js in 20 Minutes",
        link: "https://youtube.com/watch?v=kinde-nextjs-auth-feb",
        trackingLink: "https://kinde.com?utm_source=youtube&utm_medium=content&utm_campaign=shola&creative=feb-video1",
        platform: "YouTube",
        publicationDate: "2026-02-07",
        status: "Published" as const,
        views: 7_540,
        tags: ["Kinde", "Auth", "NextJS", "YouTube", "Tutorial"],
        contentType: "Tutorial",
        notes: "Feb 2026 - YouTube tutorial",
        reshares: [
          { platform: "LinkedIn", link: "https://linkedin.com/posts/sholajegede-video1", date: "2026-02-07" },
          { platform: "Twitter/X", link: "https://x.com/sholajegede/status/video1", date: "2026-02-08" },
        ],
      },

      {
        userId, client: "kinde", category: "Video" as const,
        title: "Kinde Workflows Explained: Automate Auth Logic Without Code",
        link: "",
        trackingLink: "",
        platform: "YouTube",
        publicationDate: "2026-02-21",
        status: "Scheduled" as const,
        views: 0,
        tags: ["Kinde", "Workflows", "YouTube", "Demo"],
        contentType: "Demo",
        notes: "Feb 2026 - YouTube video 2, recording done, scheduling pending",
      },

      // ── EVENT ─────────────────────────────────────────────────────────────────

      {
        userId, client: "kinde", category: "Event" as const,
        title: "Auth for AI Apps: What Changes When Your Users Are Agents",
        link: "https://reactsummit.com/talks/auth-for-ai-apps",
        trackingLink: "",
        platform: "React Summit Amsterdam",
        publicationDate: "2026-02-13",
        status: "Published" as const,
        views: 0,
        tags: ["Kinde", "Auth", "AI", "Conference", "Keynote"],
        contentType: "Conference Talk",
        notes: "Feb 2026 - React Summit main stage talk",
        eventName: "React Summit Amsterdam",
        eventLocation: "Amsterdam, Netherlands",
        attendees: 1_850,
        reshares: [
          { platform: "LinkedIn", link: "https://linkedin.com/posts/sholajegede-reactsummit", date: "2026-02-13" },
          { platform: "Twitter/X", link: "https://x.com/sholajegede/status/reactsummit", date: "2026-02-13" },
        ],
      },

      {
        userId, client: "kinde", category: "Event" as const,
        title: "Building Secure Multi-Tenant Apps: A Practical Workshop",
        link: "",
        trackingLink: "",
        platform: "Node.js London Meetup",
        publicationDate: "2026-02-20",
        status: "Published" as const,
        views: 0,
        tags: ["Kinde", "Workshop", "Meetup", "Multi-tenant"],
        contentType: "Workshop",
        notes: "Feb 2026 - London meetup workshop, 2 hours",
        eventName: "Node.js London Meetup",
        eventLocation: "London, UK",
        attendees: 140,
      },

      {
        userId, client: "kinde", category: "Event" as const,
        title: "Zero-Trust Auth Patterns for Modern SaaS",
        link: "",
        trackingLink: "",
        platform: "DevRelCon NYC",
        publicationDate: "2026-02-28",
        status: "Scheduled" as const,
        views: 0,
        tags: ["Kinde", "Security", "DevRel", "Conference"],
        contentType: "Conference Talk",
        notes: "Feb 2026 - DevRelCon NYC, talk confirmed, slides in progress",
        eventName: "DevRelCon NYC",
        eventLocation: "New York, USA",
        attendees: 0,
      },

      // ── PODCAST ───────────────────────────────────────────────────────────────

      {
        userId, client: "kinde", category: "Podcast" as const,
        title: "Why Auth Is the Hardest Part of Building a SaaS (And How to Get It Right)",
        link: "https://open.spotify.com/episode/kinde-changelog-feb",
        trackingLink: "",
        platform: "Spotify",
        publicationDate: "2026-02-05",
        status: "Published" as const,
        views: 0,
        tags: ["Kinde", "Auth", "SaaS", "Podcast", "Guest Appearance"],
        contentType: "Guest Appearance",
        notes: "Feb 2026 - The Changelog episode",
        podcastName: "The Changelog",
        downloads: 3_920,
        reshares: [
          { platform: "LinkedIn", link: "https://linkedin.com/posts/sholajegede-changelog", date: "2026-02-06" },
          { platform: "Twitter/X", link: "https://x.com/sholajegede/status/changelog", date: "2026-02-06" },
        ],
      },

      {
        userId, client: "kinde", category: "Podcast" as const,
        title: "DevRel in 2026: What Actually Moves the Needle",
        link: "https://podcasts.apple.com/devrel-weekly-feb",
        trackingLink: "",
        platform: "Apple Podcasts",
        publicationDate: "2026-02-19",
        status: "Published" as const,
        views: 0,
        tags: ["Kinde", "DevRel", "Podcast", "Opinion"],
        contentType: "Guest Appearance",
        notes: "Feb 2026 - DevRel Weekly episode",
        podcastName: "DevRel Weekly",
        downloads: 1_240,
      },

      {
        userId, client: "kinde", category: "Podcast" as const,
        title: "Solo: How I Track Every Piece of Content I Ship for Clients",
        link: "",
        trackingLink: "",
        platform: "Spotify",
        publicationDate: "2026-02-26",
        status: "Draft" as const,
        views: 0,
        tags: ["DevRel", "Podcast", "Build in Public"],
        contentType: "Solo Episode",
        notes: "Feb 2026 - Personal podcast, recording scheduled",
        podcastName: "The DevRel Files",
        downloads: 0,
      },

      // ── PACKAGE ───────────────────────────────────────────────────────────────

      {
        userId, client: "kinde", category: "Package" as const,
        title: "Kinde Rate Limiter for Convex",
        link: "https://npmjs.com/package/@convex-dev/kinde-rate-limiter",
        trackingLink: "",
        platform: "npm",
        publicationDate: "2026-02-01",
        status: "Published" as const,
        views: 0,
        tags: ["Kinde", "Convex", "Rate Limiting", "npm", "Open Source", "Convex Component"],
        contentType: "Convex Component",
        notes: "Feb 2026 - First Convex Component published under Kinde campaign",
        packageName: "@convex-dev/kinde-rate-limiter",
        downloads: 2_840,
        weeklyDownloads: 390,
        reshares: [
          { platform: "LinkedIn", link: "https://linkedin.com/posts/sholajegede-ratelimiter", date: "2026-02-02" },
          { platform: "Twitter/X", link: "https://x.com/sholajegede/status/ratelimiter", date: "2026-02-02" },
          { platform: "Hacker News", link: "https://news.ycombinator.com/item?id=ratelimiter", date: "2026-02-03" },
        ],
      },

      {
        userId, client: "kinde", category: "Package" as const,
        title: "Kinde Session Sync for Convex",
        link: "https://npmjs.com/package/@convex-dev/kinde-session-sync",
        trackingLink: "",
        platform: "npm",
        publicationDate: "2026-02-15",
        status: "Published" as const,
        views: 0,
        tags: ["Kinde", "Convex", "Session Management", "npm", "Open Source", "Convex Component"],
        contentType: "Convex Component",
        notes: "Feb 2026 - Second Convex Component, syncs Kinde session state with Convex",
        packageName: "@convex-dev/kinde-session-sync",
        downloads: 1_105,
        weeklyDownloads: 210,
      },

      {
        userId, client: "kinde", category: "Package" as const,
        title: "Kinde M2M Token Cache",
        link: "",
        trackingLink: "",
        platform: "npm",
        publicationDate: "2026-02-28",
        status: "Waiting Approval" as const,
        views: 0,
        tags: ["Kinde", "M2M", "API", "npm", "Open Source"],
        contentType: "Library",
        notes: "Feb 2026 - Awaiting Kinde OSS approval before publishing",
        packageName: "@convex-dev/kinde-m2m-cache",
        downloads: 0,
        weeklyDownloads: 0,
      },
    ]

    let inserted = 0
    for (const data of entries) {
      try {
        await ctx.db.insert("contentEntries", { ...data, updatedAt: now })
        inserted++
      } catch (e) {
        console.error("Error inserting demo entry:", e)
      }
    }

    return { inserted, total: entries.length }
  },
})
