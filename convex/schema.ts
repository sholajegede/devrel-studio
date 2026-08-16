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

    // ── Public portfolio (devrel.studio/@handle) ───────────────────────────────
    // Setting a handle is what publishes the portfolio — there is no separate
    // on/off switch, so a user who has never chosen one has nothing public.
    handle: v.optional(v.string()),
    bio: v.optional(v.string()),
    websiteUrl: v.optional(v.string()),
    githubUsername: v.optional(v.string()),
    twitterUsername: v.optional(v.string()),

    // ── Billing ───────────────────────────────────────────────────────────────
    // Plans are a one-time purchase. `plan` is only ever written by the Stripe
    // webhook, never by the client — see convex/billing.ts.
    plan: v.optional(v.string()),
    planStatus: v.optional(v.string()),
    planPurchasedAt: v.optional(v.string()),
    stripeCustomerId: v.optional(v.string()),
    lastCheckoutSessionId: v.optional(v.string()),

    // Which workspace this user is currently looking at. Optional because a
    // user created before workspaces existed has none until the migration runs;
    // `model/workspaces.ts` falls back to their own personal workspace.
    activeWorkspaceId: v.optional(v.id("workspaces")),
  })
    .index("by_kinde_id", ["kindeId"])
    .index("by_handle", ["handle"])
    .index("by_stripe_customer", ["stripeCustomerId"]),

  contentEntries: defineTable({
    // `userId` is retained as "who created this row"; `workspaceId` is what
    // authorisation and every list query resolve through. Optional only so rows
    // written before the workspace migration remain valid documents.
    userId: v.id("users"),
    workspaceId: v.optional(v.id("workspaces")),
    client: v.string(),

    // Top-level category — optional so existing records without it remain valid
    category: v.optional(v.union(
      v.literal("Written"),
      v.literal("Video"),
      v.literal("Event"),
      v.literal("Podcast"),
      v.literal("Package"),
      v.literal("Demo"),
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

    // ── Demo-specific ─────────────────────────────────────────────────────────
    repoUrl: v.optional(v.string()),        // GitHub repo for the demo / starter kit
    stack: v.optional(v.string()),          // free-text tech stack
    stars: v.optional(v.number()),          // GitHub stars

    // ── Auto-sync bookkeeping ─────────────────────────────────────────────────
    // Set by the npm / GitHub sync job. `statsSyncError` holds the last failure
    // so the UI can show "couldn't reach npm" instead of a silently stale number.
    statsSyncedAt: v.optional(v.string()),
    statsSyncError: v.optional(v.string()),

    updatedAt: v.string(),
  })
    .index("by_publication_date", ["publicationDate"])
    .index("by_user", ["userId"])
    .index("by_client", ["client"])
    // Client dashboards read through this one. Keying on the owner as well as
    // the client name is what stops two DevRels who both have a client called
    // "kinde" from seeing each other's entries.
    .index("by_user_and_client", ["userId", "client"])
    .index("by_workspace", ["workspaceId"])
    .index("by_workspace_and_client", ["workspaceId", "client"])
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
    workspaceId: v.optional(v.id("workspaces")),
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

    // ── Client dashboard access ───────────────────────────────────────────────
    // Managers reach [slug].devrel.studio without a devrel.studio account. They
    // enter an access code, which is stored here only as a salted hash.
    accessCodeHash: v.optional(v.string()),
    accessCodeUpdatedAt: v.optional(v.string()),
    // When true the dashboard is readable with no code at all.
    isPublic: v.optional(v.boolean()),
  })
    .index("by_user", ["userId"])
    .index("by_workspace", ["workspaceId"])
    .index("by_status", ["status"])
    .index("by_slug", ["slug"]),

  // ── Workspaces ──────────────────────────────────────────────────────────────
  //
  // A workspace owns content and clients; users reach it through a membership.
  // Every user gets a personal workspace on first sign-in, so the single-user
  // case is just a workspace with one member and costs nothing extra.
  workspaces: defineTable({
    name: v.string(),
    // The billing subject. Plan limits are read from this user, which is why an
    // invited member does not need a plan of their own.
    ownerId: v.id("users"),
    // Marks the workspace created automatically for a user. It cannot be left
    // or deleted, so there is always somewhere to fall back to.
    isPersonal: v.boolean(),
    createdAt: v.string(),
  }).index("by_owner", ["ownerId"]),

  memberships: defineTable({
    workspaceId: v.id("workspaces"),
    userId: v.id("users"),
    role: v.union(
      v.literal("owner"),
      v.literal("admin"),
      v.literal("editor"),
      v.literal("viewer"),
    ),
    createdAt: v.string(),
  })
    .index("by_workspace", ["workspaceId"])
    .index("by_user", ["userId"])
    .index("by_workspace_and_user", ["workspaceId", "userId"]),

  // Invitations to join a workspace. Seats count against the owner's plan.
  workspaceInvites: defineTable({
    ownerId: v.id("users"),
    // Optional for invites written before workspaces existed; acceptance
    // requires it, so those older rows can only be revoked.
    workspaceId: v.optional(v.id("workspaces")),
    email: v.string(),
    role: v.union(v.literal("admin"), v.literal("editor"), v.literal("viewer")),
    status: v.union(
      v.literal("pending"),
      v.literal("accepted"),
      v.literal("revoked"),
    ),
    // Only the hash is stored, for the same reason as access codes: a dump of
    // this table must not yield a working invitation link.
    tokenHash: v.optional(v.string()),
    invitedAt: v.string(),
    expiresAt: v.number(),
    acceptedAt: v.optional(v.string()),
    acceptedBy: v.optional(v.id("users")),
  })
    .index("by_owner", ["ownerId"])
    .index("by_workspace", ["workspaceId"])
    .index("by_email", ["email"])
    .index("by_token_hash", ["tokenHash"]),

  // Browser sessions issued to managers after a valid access code. The cookie
  // holds the raw token; only its hash is stored here.
  managerSessions: defineTable({
    clientId: v.id("clients"),
    slug: v.string(),
    tokenHash: v.string(),
    expiresAt: v.number(),
    createdAt: v.number(),
  })
    .index("by_token_hash", ["tokenHash"])
    .index("by_client", ["clientId"]),

  // Failed access-code attempts, used to throttle guessing. `bucket` is either a
  // hashed caller IP or the literal "*" — the "*" row is the whole-slug counter,
  // which is what catches an attacker spread across many addresses. Raw IPs are
  // never stored; the hash is peppered in the Next.js layer.
  managerAccessAttempts: defineTable({
    slug: v.string(),
    bucket: v.string(),
    failures: v.number(),
    firstFailureAt: v.number(),
    lastFailureAt: v.number(),
    lockedUntil: v.optional(v.number()),
  }).index("by_slug_and_bucket", ["slug", "bucket"]),
});
