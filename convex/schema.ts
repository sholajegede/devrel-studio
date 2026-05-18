import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  users: defineTable({
    kindeId: v.string(),
    email: v.string(),
    firstName: v.optional(v.string()),
    lastName: v.optional(v.string()),
    imageUrl: v.optional(v.string()),
    imageStorageId: v.optional(v.id("_storage")),
  }),

  contentEntries: defineTable({
    userId: v.id("users"),
    client: v.string(),

    // Top-level category — optional so existing records without it remain valid
    category: v.optional(v.union(
      v.literal("Written"),
      v.literal("Video"),
      v.literal("Event"),
      v.literal("Podcast"),
      v.literal("Package"),
    )),

    title: v.string(),
    link: v.string(),
    trackingLink: v.string(),

    // Widened from union-of-literals to string so event free-text and future
    // platforms don't require schema changes
    platform: v.string(),

    publicationDate: v.string(),

    status: v.union(
      v.literal("Published"),
      v.literal("Draft"),
      v.literal("Waiting Approval"),
      v.literal("Scheduled"),
    ),

    // Optional — only used for Written / Video (existing docs already have it)
    views: v.optional(v.number()),

    tags: v.array(v.string()),

    // Sub-type — widened from union-of-literals to string for per-category flexibility
    contentType: v.string(),

    notes: v.string(),

    reshares: v.optional(v.array(v.object({
      platform: v.string(),
      link: v.string(),
      date: v.string(),
    }))),

    // ── Package-specific ──────────────────────────────────────────────────────
    packageName: v.optional(v.string()),    // e.g. "@convex-dev/rate-limiter"
    downloads: v.optional(v.number()),      // total downloads (Package) or listeners (Podcast)
    weeklyDownloads: v.optional(v.number()),// weekly npm downloads

    // ── Event-specific ────────────────────────────────────────────────────────
    eventName: v.optional(v.string()),      // conference / meetup name
    eventLocation: v.optional(v.string()), // city / venue
    attendees: v.optional(v.number()),

    // ── Podcast-specific ──────────────────────────────────────────────────────
    podcastName: v.optional(v.string()),    // show name, separate from episode title

    updatedAt: v.string(),
  })
    .index("by_publication_date", ["publicationDate"])
    .index("by_client", ["client"])
    .index("by_status", ["status"])
    .index("by_category", ["category"]),

  waitlist: defineTable({
    email: v.string(),
    name: v.optional(v.string()),
    company: v.optional(v.string()),
    role: v.optional(v.string()),
    useCase: v.optional(v.string()),
  }).index("by_email", ["email"]),

  clients: defineTable({
    userId: v.id("users"),
    name: v.string(),
    company: v.string(),
    email: v.optional(v.string()),
    website: v.optional(v.string()),
    monthlyRetainer: v.optional(v.number()),
    currency: v.optional(v.string()),
    startDate: v.optional(v.string()),
    endDate: v.optional(v.string()),
    status: v.union(v.literal("Active"), v.literal("Paused"), v.literal("Ended")),
    contractType: v.optional(v.union(
      v.literal("Retainer"),
      v.literal("Project"),
      v.literal("Hourly"),
    )),
    notes: v.optional(v.string()),
    slug: v.optional(v.string()),
  })
    .index("by_user", ["userId"])
    .index("by_status", ["status"]),
});
