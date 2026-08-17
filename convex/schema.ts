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

    // ── Access ────────────────────────────────────────────────────────────────
    // Access is time-limited and granted by hand. Card payments are not
    // available here — Stripe requires a US entity — so a buyer emails, pays out
    // of band, and an internal mutation extends their window. Nothing the
    // browser can call writes any of these fields.
    plan: v.optional(v.string()),
    planStatus: v.optional(v.string()),
    planPurchasedAt: v.optional(v.string()),

    /** Free trial expiry, set when the account is created. */
    trialEndsAt: v.optional(v.number()),
    /** Paid access expiry. Absent means never granted. */
    accessUntil: v.optional(v.number()),
    /** Why access was granted — what they paid, in what currency, when. */
    accessNote: v.optional(v.string()),

    // Kept so an existing row still validates; unused while payments are manual.
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

  // Counters for the unauthenticated mutations — waitlist signups and report
  // feedback. Anyone on the internet can call those, and without a ceiling a
  // single script can fill a table overnight.
  //
  // `bucket` is a hashed caller IP or a shared fallback; `scope` names which
  // mutation, so one noisy client dashboard cannot lock out the waitlist.
  publicWriteAttempts: defineTable({
    scope: v.string(),
    bucket: v.string(),
    count: v.number(),
    windowStartedAt: v.number(),
  }).index("by_scope_and_bucket", ["scope", "bucket"]),

  // When and to whom a client's monthly report goes.
  //
  // One row per client, because the recipient and the timing are properties of
  // the engagement, not of the account: one client's manager wants it on the 1st
  // at 9am Lagos time, another's wants the 5th at 8am New York.
  //
  // `recipients` is separate from `clients.email` on purpose. The billing
  // contact and the person who reads the report are frequently different people,
  // and the reader changes when someone leaves the company.
  reportSchedules: defineTable({
    clientId: v.id("clients"),
    workspaceId: v.optional(v.id("workspaces")),
    enabled: v.boolean(),
    recipients: v.array(v.string()),
    /** 1–28. Capped so a schedule cannot silently skip February. */
    dayOfMonth: v.number(),
    /** 0–23, in the timezone below. */
    hourLocal: v.number(),
    /** IANA name, e.g. Africa/Lagos. */
    timezone: v.string(),
    /** `YYYY-MM` of the last period sent — what makes the cron idempotent. */
    lastSentPeriod: v.optional(v.string()),
    lastSentAt: v.optional(v.string()),
  })
    .index("by_client", ["clientId"])
    .index("by_workspace", ["workspaceId"])
    .index("by_enabled", ["enabled"]),

  // Feedback a client leaves on a monthly report.
  //
  // Left by the manager reading the report, who has no account — so there is no
  // userId here. Attribution is the client row plus whatever name they type.
  // One row per submission rather than one per period: a client who sends a
  // second thought a week later should not overwrite the first.
  reportFeedback: defineTable({
    clientId: v.id("clients"),
    slug: v.string(),
    /** `YYYY-MM` the feedback is about. */
    period: v.string(),
    /** 1–5, or undefined when they left only a comment. */
    rating: v.optional(v.number()),
    comment: v.string(),
    /** Free text, since the reader is not an authenticated user. */
    authorName: v.optional(v.string()),
    createdAt: v.string(),
  })
    .index("by_client", ["clientId"])
    .index("by_slug_and_period", ["slug", "period"]),

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
