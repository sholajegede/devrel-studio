import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";
import { requestStatusValidator } from "./model/access";

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

    /**
     * Trial emails already sent to this account: 'ending', 'ended'.
     *
     * Recorded so a daily cron that runs twice, or retries after a failure,
     * cannot mail the same person the same notice again. Absent on accounts
     * created before these emails existed, which reads as "none sent".
     */
    trialNoticesSent: v.optional(v.array(v.string())),

    // Kept so an existing row still validates; unused while payments are manual.
    stripeCustomerId: v.optional(v.string()),
    lastCheckoutSessionId: v.optional(v.string()),

    // Which workspace this user is currently looking at. Optional because a
    // user created before workspaces existed has none until the migration runs;
    // `model/workspaces.ts` falls back to their own personal workspace.
    activeWorkspaceId: v.optional(v.id("workspaces")),

    // ── Platform administration ───────────────────────────────────────────────
    //
    // Authority to run devrel.studio itself, which is orthogonal to workspace
    // membership: an admin has no implicit access to anyone's client data, and
    // a workspace owner is not an admin.
    //
    // Kept here rather than as a Kinde role so the check happens in the same
    // place as the data it protects, works without a Kinde tenant in local
    // development, and cannot be changed by editing IdP configuration. Kinde
    // establishes identity; this establishes authority.
    //
    // 'support' can read everything and approve a purchase. 'owner' can also
    // revoke access, comp an account, impersonate, and grant admin — the
    // destructive and the routine deliberately separated.
    adminRole: v.optional(v.union(v.literal("owner"), v.literal("support"))),

    /**
     * When this account was paused, if it is.
     *
     * Deliberately not a delete. Removing an account takes a customer's work
     * with it and cannot be undone by anybody, whereas almost every reason to
     * reach for one — abuse, a billing dispute, a compromised login, somebody
     * asking for a break — is temporary and wants exactly this: they cannot get
     * in, and everything is still there when the reason passes.
     *
     * Enforced in `getCurrentUser`, the function every query and mutation in the
     * product already resolves through, so a paused account reads nothing and
     * writes nothing without forty call sites having to remember.
     */
    /**
     * When this account last opened the dashboard.
     *
     * Only ever moved forward, and only by the dashboard itself, so "since you
     * were last here" means the last visit rather than the last request — a page
     * that stamped it on every query would make the phrase mean "since a moment
     * ago", which is nothing.
     */
    lastSeenAt: v.optional(v.number()),

    pausedAt: v.optional(v.number()),
    /** Why. Shown to nobody but an admin; recorded in the audit log as well. */
    pausedReason: v.optional(v.string()),

    /**
     * Top plan without a purchase — internal and advisor accounts.
     *
     * Was a hardcoded array of document ids in model/plans.ts, which meant
     * comping somebody required a source edit and a deploy, and the resulting
     * grant was invisible to every query reporting on access.
     */
    comped: v.optional(v.boolean()),
  })
    .index("by_kinde_id", ["kindeId"])
    .index("by_handle", ["handle"])
    .index("by_stripe_customer", ["stripeCustomerId"])
    // Six call sites looked accounts up by email with `.filter(...).first()`,
    // which scans the table and — with no uniqueness constraint anywhere —
    // picks arbitrarily between duplicates. A grant landing on whichever row
    // the scan happened to reach first is not a performance problem.
    .index("by_email", ["email"]),

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

  clients: defineTable({
    userId: v.id("users"),
    workspaceId: v.optional(v.id("workspaces")),
    name: v.string(),
    company: v.string(),
    email: v.optional(v.string()),
    website: v.optional(v.string()),

    // ── How the client's own dashboard looks ──────────────────────────────────
    //
    // The page at [slug].devrel.studio is opened by somebody who was sent a link
    // by a consultant they are paying. Until these two fields it carried this
    // product's identity and none of theirs, which makes a commissioned report
    // look like a tool the contractor happens to use.
    //
    // Both optional, and both fall back to the product's own look. A client with
    // no logo should not get a hole where one would go.

    /**
     * The client's logo, held in Convex storage.
     *
     * Uploaded rather than linked. A hotlinked logo is a dependency on somebody
     * else's server staying up and their path staying put, and the first time it
     * fails is on the dashboard a customer is showing their manager. Holding the
     * file means the page cannot be broken from outside.
     */
    logoStorageId: v.optional(v.id("_storage")),

    /**
     * A logo address, from before uploads existed.
     *
     * Read as a fallback when there is no stored file, so a client configured
     * with a link keeps their logo rather than losing it to an upgrade. Nothing
     * writes this any more.
     */
    logoUrl: v.optional(v.string()),

    /**
     * A hex colour, `#rrggbb`, validated on write.
     *
     * Applied to accents on the client's dashboard and to the exported PDF, and
     * nowhere else — a brand colour is for the page that belongs to them, not
     * for the DevRel's own workspace.
     */
    brandColor: v.optional(v.string()),

    /**
     * A domain the client owns, pointed at this dashboard.
     *
     * `reports.acme.com` rather than a subdomain of somebody else's product. The
     * strongest signal available that the report was commissioned rather than
     * generated, and the last piece of white-labelling the surface has.
     *
     * Stored lowercase and without a scheme, because that is the form a Host
     * header arrives in — comparing anything else means normalising on every
     * request instead of once on write.
     */
    customDomain: v.optional(v.string()),

    /**
     * The rate in effect right now.
     *
     * Kept as a plain number so the clients list, sorting and the "total monthly
     * retainer" sum stay one field read. `rateHistory` below is what makes it
     * correct over time; this is always the newest entry's amount.
     */
    monthlyRetainer: v.optional(v.number()),

    /**
     * What the client has been charged, and from when.
     *
     * Without this a raise rewrites the past: `totalBilled` multiplies one rate
     * by the whole engagement, so going from 1,500 to 3,000 retroactively claims
     * every previous month was billed at 3,000. The earnings figure is the kind
     * of number that ends up in an invoice or a year-end summary, so it has to
     * reflect what was actually charged at the time.
     *
     * The array is the complete timeline, oldest first — including the opening
     * rate, not just changes to it. A client with no history falls back to
     * `monthlyRetainer` for the whole engagement, which is exactly the previous
     * behaviour, so nothing recorded before this existed needs migrating.
     *
     * An array rather than its own table: rate changes number in the handful
     * over years, and they are never read without the client.
     */
    rateHistory: v.optional(v.array(v.object({
      amount: v.number(),
      /** `YYYY-MM-DD`. The first billing date charged at this amount. */
      effectiveFrom: v.string(),
      /** Why it changed — "scope increase", "annual review". */
      note: v.optional(v.string()),
      /** When the change was entered, which is not when it took effect. */
      recordedAt: v.optional(v.string()),
    }))),
    currency: v.optional(v.string()),
    startDate: v.optional(v.string()),
    endDate: v.optional(v.string()),
    status: v.union(v.literal("Active"), v.literal("Paused"), v.literal("Ended")),
    contractType: v.optional(v.union(
      v.literal("Retainer"),
      v.literal("Project"),
      v.literal("Hourly"),
    )),
    /**
     * Stretches where the engagement was on hold and nothing was billed.
     *
     * `status: 'Paused'` records *that* a client is paused but not since when,
     * so the earnings figure had to assume continuous billing and label itself
     * an estimate. With dates the arithmetic can simply skip the months nobody
     * paid for, and the number stops being a guess.
     *
     * An array because engagements stop and restart — a client paused over a
     * quiet December and again in the summer has two gaps, and one pair of
     * fields cannot hold both. An entry with no `to` is a pause still running,
     * which is what makes `status` derivable rather than separately maintained.
     */
    pausePeriods: v.optional(v.array(v.object({
      /** `YYYY-MM-DD`. First day on hold. */
      from: v.string(),
      /** `YYYY-MM-DD`. Absent while the pause is still open. */
      to: v.optional(v.string()),
      note: v.optional(v.string()),
      recordedAt: v.optional(v.string()),
    }))),

    notes: v.optional(v.string()),
    slug: v.optional(v.string()),

    // ── Standing goals ────────────────────────────────────────────────────────
    // The engagement's targets, used when a period has not set its own. Without
    // a target a report states activity and calls it performance: "48K reach"
    // is a number, "48K against 40K" is a result. A period may override these
    // in `reportNotes` — a launch month is not held to a quiet month's goal.
    reachTarget: v.optional(v.number()),
    publishedTarget: v.optional(v.number()),

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
    .index("by_slug", ["slug"])
    // Every request arriving on a domain the product does not recognise costs
    // one lookup, so it has to be an indexed one.
    .index("by_custom_domain", ["customDomain"]),

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

  // Counters for the unauthenticated mutations — report
  // feedback. Anyone on the internet can call those, and without a ceiling a
  // single script can fill a table overnight.
  //
  // `bucket` is a hashed caller IP or a shared fallback; `scope` names which
  // mutation, so one noisy client dashboard cannot lock out another.
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

  /**
   * A request to buy or extend access.
   *
   * Payments are arranged by hand, so the request has to survive leaving the
   * page: the buyer needs to see that it was received, and the owner needs a
   * list to work from. Neither is served by a mailto link, which asks the
   * browser to open software the buyer may not have.
   */
  accessRequests: defineTable({
    userId: v.id("users"),
    email: v.string(),
    name: v.optional(v.string()),
    plan: v.string(),
    months: v.number(),
    /** Currency and amount quoted at the time, so a later price change cannot
     *  rewrite what someone was asked to pay. */
    currency: v.string(),
    amount: v.number(),
    note: v.optional(v.string()),
    /**
     * 'open' until the owner grants access or turns it down.
     *
     * A union rather than a string: a status nothing produces is a request no
     * query matches, which reads as a customer who never asked. `v.string()`
     * let one through silently, and finding it again needed a reconciliation
     * pass over the whole table.
     */
    status: requestStatusValidator,
    createdAt: v.number(),
  })
    .index("by_user", ["userId"])
    .index("by_status", ["status"]),

  // ── The written half of a report ────────────────────────────────────────────
  //
  // Everything in a report used to be generated from the data. That makes a
  // competent activity log and a poor report: a reader sees "+40%" and cannot
  // tell whether it was a launch, a conference or an algorithm change, and the
  // person who actually knows had nowhere to say so.
  //
  // One row per client per period, holding the parts only a human can write.
  // Separate from `clients` because it is per-period, and separate from
  // `contentEntries` because it is about the period rather than any one piece.
  //
  // Every field is optional. A report with no write-up renders exactly as it
  // did before, so this is additive for every period already sent.
  reportNotes: defineTable({
    clientId: v.id("clients"),
    workspaceId: v.optional(v.id("workspaces")),
    /** Denormalised so the public report can be read by slug in one query. */
    slug: v.string(),
    /** `YYYY-MM`. */
    period: v.string(),

    /** The opening paragraph, in the DevRel's voice. */
    summary: v.optional(v.string()),
    /** One line on why the numbers moved, shown beneath the figures. */
    performanceNote: v.optional(v.string()),
    /** Answers the feedback left on the previous period. */
    responseToFeedback: v.optional(v.string()),

    /**
     * Quotes, reactions and mentions worth showing.
     *
     * DevRel value is disproportionately qualitative, and a numbers-only report
     * systematically undersells it — a maintainer's reply can matter more than
     * the view count on the post that prompted it.
     */
    quotes: v.optional(v.array(v.object({
      text: v.string(),
      attribution: v.optional(v.string()),
      link: v.optional(v.string()),
    }))),

    /** Overrides the client's standing goal for this period only. */
    reachTarget: v.optional(v.number()),
    publishedTarget: v.optional(v.number()),

    updatedAt: v.string(),
    /** Who last wrote it, for a workspace with several people in it. */
    updatedBy: v.optional(v.id("users")),
  })
    .index("by_client_and_period", ["clientId", "period"])
    .index("by_slug_and_period", ["slug", "period"])
    .index("by_workspace", ["workspaceId"]),

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

  // ── Who looked at the work ──────────────────────────────────────────────────
  //
  // One row per view of a public surface: a client dashboard at
  // [slug].devrel.studio, or a portfolio at /@handle. This is what the DevRel's
  // own /dashboard/analytics section reads.
  //
  // The point of the table is not traffic measurement — the volumes here are
  // tens to hundreds a month, not millions. It is evidence of attention: that
  // the manager paying for the work actually opened the report, and how long
  // they stayed. That fact is the hardest thing in DevRel to prove and the most
  // valuable thing to be able to show.
  //
  // Rows are raw rather than pre-aggregated. At this volume a workspace's whole
  // history is a few thousand documents, which is cheaper to query directly
  // than to maintain rollups for — and it keeps the per-view detail the
  // activity feed depends on.
  pageViews: defineTable({
    /**
     * Which surface was viewed.
     *
     * 'site' is every other page on devrel.studio — the marketing pages, the
     * pricing page, the signed-in app. It was added after the first two because
     * "which of my own pages do people actually open" turned out to be a
     * question nobody could answer either, and the counting hook was already
     * sitting in the one place that sees every request.
     */
    surface: v.union(
      v.literal("dashboard"),
      v.literal("portfolio"),
      v.literal("site"),
    ),

    // Whose analytics this belongs in. Resolved at write time by looking the
    // slug or handle up, so the read path never has to join back through
    // clients/users to scope a query to the signed-in workspace.
    workspaceId: v.optional(v.id("workspaces")),
    userId: v.optional(v.id("users")),
    /** Set for dashboard views; absent for portfolio, which belongs to no client. */
    clientId: v.optional(v.id("clients")),

    /** The slug or handle, denormalised for display without a second read. */
    target: v.string(),
    /** Path within the surface — '/', '/report', '/reports'. */
    path: v.string(),

    // ── Who, to the extent it is knowable ─────────────────────────────────────
    //
    // 'manager' means the visitor held a valid access-code session for this
    // client, so the view can honestly be attributed to the person the DevRel
    // gave the code to. 'anonymous' is everyone else, including every portfolio
    // visitor — a public page cannot identify its readers and should not claim
    // to.
    identity: v.union(v.literal("manager"), v.literal("anonymous")),

    /**
     * Daily-rotating hash of IP + user agent. Counts unique visitors within a
     * day without being a durable identifier: the salt includes the date, so
     * the same person tomorrow hashes differently and cannot be followed across
     * days. Raw IPs never reach Convex — the hash is computed in the Next.js
     * layer, the same rule `managerAccessAttempts` follows.
     */
    visitorHash: v.string(),

    /** ISO-3166 alpha-2 from the CDN edge. Country granularity only. */
    country: v.optional(v.string()),
    /** Bare hostname of the referrer — 'linkedin.com', never the full URL. */
    referrer: v.optional(v.string()),

    /** Milliseconds on the page, when the surface reported it on unload. */
    durationMs: v.optional(v.number()),

    at: v.number(),
  })
    .index("by_workspace_and_time", ["workspaceId", "at"])
    .index("by_client_and_time", ["clientId", "at"])
    .index("by_target_and_visitor", ["target", "visitorHash"])
    .index("by_time", ["at"]),

  // ── Admin audit ─────────────────────────────────────────────────────────────
  //
  // Every privileged action, appended and never changed.
  //
  // Nothing recorded that a grant happened, who made it, or what it replaced.
  // `users.accessNote` held a single overwritable string, so the second grant
  // erased the first one's reason. With one operator that is uncomfortable; the
  // moment a customer disputes a charge, or a second person can approve one,
  // this table is the only thing that can answer the question.
  //
  // Append-only by construction: no mutation is written anywhere that patches
  // or deletes a row here. An audit trail that can be edited is not one.
  adminAuditLog: defineTable({
    actorId: v.id("users"),
    /**
     * Denormalised on purpose. Ids dangle when an account is deleted, and the
     * history of what somebody did must outlive their account.
     */
    actorEmail: v.string(),

    /** Dotted verb: 'access.grant', 'access.revoke', 'admin.promote'. */
    action: v.string(),

    /** Who or what it was done to. A string rather than an id union so one
     *  table can log actions against users, workspaces and requests alike. */
    subjectId: v.optional(v.string()),
    subjectEmail: v.optional(v.string()),

    /** Serialised before/after for anything that changed a value. */
    before: v.optional(v.string()),
    after: v.optional(v.string()),

    /** Why — typed by the admin at the time, not inferred later. */
    reason: v.optional(v.string()),

    at: v.number(),
  })
    .index("by_time", ["at"])
    .index("by_subject", ["subjectId", "at"])
    .index("by_actor", ["actorId", "at"]),

  // Failed access-code attempts, used to throttle guessing. `bucket` is either a
  // hashed caller IP or the literal "*" — the "*" row is the whole-slug counter,
  // which is what catches an attacker spread across many addresses. Raw IPs are
  // never stored; the hash is peppered in the Next.js layer.
  // ── Read-only impersonation ─────────────────────────────────────────────────
  //
  // An admin looking at the product as one customer sees it, to answer "my
  // dashboard is empty" without asking them for screenshots.
  //
  // The session lives here rather than in an argument on the way in. Nothing the
  // browser sends decides whose data is returned: `model/auth.ts` resolves the
  // signed-in admin from the Kinde token as it always has, then looks for a row
  // in this table belonging to *them*. A client that forges an id gets nothing,
  // because there is no id to forge.
  //
  // Read-only is structural, not a rule each function has to remember. The swap
  // happens in `getCurrentUser`, and that function refuses outright when it is
  // called from a mutation while a session is open — so every write in the
  // product fails closed, including ones written after this table existed.
  //
  // Rows are kept after they end. Who looked at whose account, and when, is
  // exactly the sort of thing that has to be answerable later; the audit log
  // carries the same fact and this table carries the window.
  impersonationSessions: defineTable({
    /** The real signed-in admin. Never the subject. */
    adminId: v.id("users"),
    /** Whose data is being read. */
    subjectId: v.id("users"),
    reason: v.optional(v.string()),
    startedAt: v.number(),
    /**
     * Short by design. An impersonation left open is an admin who forgets they
     * are not themselves, and every reading they take afterwards is wrong.
     */
    expiresAt: v.number(),
    /** Set when it is ended deliberately; absent means it ran out or is live. */
    endedAt: v.optional(v.number()),
  })
    .index("by_admin", ["adminId"])
    .index("by_subject", ["subjectId"]),

  managerAccessAttempts: defineTable({
    slug: v.string(),
    bucket: v.string(),
    failures: v.number(),
    firstFailureAt: v.number(),
    lastFailureAt: v.number(),
    lockedUntil: v.optional(v.number()),
  }).index("by_slug_and_bucket", ["slug", "bucket"]),
});
