# PRODUCT.md — devrel.studio

> **The professional operating system for Developer Relations.**
> Where your work is logged, proven, owned, and portable for your entire career.

---

## Table of Contents

1. [What This Product Is](#1-what-this-product-is)
2. [The Problem It Solves](#2-the-problem-it-solves)
3. [Target Users](#3-target-users)
4. [Core Philosophy and Design Principles](#4-core-philosophy-and-design-principles)
5. [Current State (What Is Already Built)](#5-current-state-what-is-already-built)
6. [Full Feature Roadmap](#6-full-feature-roadmap)
   - [v1 — The Complete Platform](#v1--the-complete-platform)
   - [v2 — The Team Layer](#v2--the-team-layer)
7. [Technical Architecture](#7-technical-architecture)
8. [Database Schema](#8-database-schema)
9. [API Integrations and Metric Sync](#9-api-integrations-and-metric-sync)
10. [Authentication Architecture](#10-authentication-architecture)
11. [Monetization and Pricing](#11-monetization-and-pricing)
12. [Presale Strategy](#12-presale-strategy)
13. [Go-to-Market](#13-go-to-market)
14. [Build Order and Sequencing](#14-build-order-and-sequencing)
15. [Environment Variables Reference](#15-environment-variables-reference)

---

## 1. What This Product Is

devrel.studio is a content performance tracking, portfolio, and client reporting platform built specifically for Developer Relations professionals, technical writers, and developer advocates.

It has three distinct surfaces:

**The Admin Dashboard** — where the DevRel logs work, views metrics, manages client workspaces, and generates reports. This is the authenticated, private workspace the DevRel operates from day to day.

**The Client Dashboard** (`[clientslug].devrel.studio`) — a live, always-updated performance view shared with the client or manager. The client sees everything that has been delivered, can filter by time period, drop feedback on individual pieces or monthly summaries, and download polished PDF reports. Authentication is controlled by the DevRel via an access code.

**The Public Portfolio** (`devrel.studio/@handle`) — a public-facing profile page that aggregates cumulative impact across all clients and roles. This is the DevRel's proof of work — verified, permanent, and always current. It is the thing sent to a potential client or employer instead of a PDF resume.

Together these three surfaces make devrel.studio the first verifiable, living professional record for the Developer Relations industry.

---

## 2. The Problem It Solves

Developer Relations professionals produce measurable work — articles, conference talks, videos, open-source packages, podcasts — but have historically had no single, credible way to prove that impact.

The current state of DevRel reporting:
- Monthly reports are assembled manually from screenshots, spreadsheets, and exported PDFs
- Each report takes hours to build and is immediately stale
- Metrics are self-reported with no verification layer
- Clients receive a PDF that gives them no ongoing visibility
- When a DevRel moves to a new role, their track record lives in old email threads and personal Notion pages
- There is no industry-standard way for hiring managers or clients to evaluate DevRel candidates

devrel.studio solves all of this. Work is logged once. Metrics update automatically from source APIs. The client has a live dashboard, not a monthly PDF. Feedback from managers is captured inside the tool and becomes verified social proof on the public portfolio. When the DevRel changes roles, everything stays on their profile, scoped to that employment period and permanently accessible.

---

## 3. Target Users

### Primary: Freelance and Contract DevRels
The clearest pain. They have multiple clients, monthly reporting obligations, and a constant need to prove value to justify contract renewals. devrel.studio is the reporting infrastructure they currently build manually every month.

**Pain:** Hours of manual report assembly. No live view for clients. No proof of work when pitching new clients.

### Secondary: In-House DevRels (MongoDB, Stripe, Twilio, etc.)
Work in quarterly OKR cycles. Need to justify headcount and budget to leadership who don't understand DevRel. Need to track goals, conferences, community metrics, and content impact in one place.

**Pain:** Scattered data across platforms. Annual performance reviews with no verifiable impact record. Building internal reports for leadership who don't have visibility.

### Tertiary: Technical Writers
The content types map directly. Articles, docs, tutorials, changelogs — all trackable. The portfolio angle is even more powerful for TW because their work is the most invisible. Same product, TW-specific fields (pages updated vs. created, doc satisfaction score, support ticket deflection) added progressively.

### v2 Addition: DevRel Teams and Heads of DevRel
A team head at a company with 5-10 DevRels needs consolidated visibility, goal tracking across the team, and the ability to run annual impact reviews. The team workspace layer serves this without requiring the product to change for individuals.

### Approximate Market Size
There are approximately 50,000 Developer Relations professionals globally. This is the beachhead. Technical writers are an adjacent category of similar size. The total addressable market for the broader "developer-facing roles that produce content" category is significantly larger, but the go-to-market starts specifically with DevRel.

---

## 4. Core Philosophy and Design Principles

**The profile belongs to the individual, not the employer.**
This is the single most important architectural and philosophical decision in the product. A DevRel's track record is theirs. They bring it to every role and take it when they leave. Employers get visibility while the relationship is active. The individual keeps their proof of work forever.

**No free plan. This is intentional.**
devrel.studio is for professionals serious about their DevRel careers, not people who want a free account. A paid commitment signals intent. Free plans attract noise. Every user on the platform has skin in the game, which maintains the quality of the professional network and the credibility of the profiles.

**Verification over self-reporting.**
The value of the public portfolio depends on the data being trustworthy. Metrics pulled directly from source APIs (npm, Dev.to, YouTube, GitHub) cannot be inflated. Manager feedback submitted through the platform is attributed and timestamped. This is what makes `devrel.studio/@handle` worth more than a LinkedIn profile.

**Minimum friction, maximum signal.**
Every piece of friction in the logging workflow is work the DevRel is not doing. Auto-metric pulling, smart defaults, and one-click report generation are not convenience features — they are the product. The less time spent on administration, the more the tool feels like infrastructure rather than overhead.

**Design should match the quality of the work it tracks.**
The dashboard, client view, and public portfolio all need to feel as polished as the best developer tooling products. DevRels have high aesthetic standards. The design must communicate that devrel.studio is a serious professional tool, not a side project.

---

## 5. Current State (What Is Already Built)

The codebase is a **Next.js 15 App Router** application with **Convex** as the backend database and real-time layer, deployed on **Vercel** with subdomain routing.

### What exists and works today:

**Admin Dashboard** (`/dashboard`)
- Content logging with fields: title, platform, publication date, status, category (Written, Video, Event, Podcast, Package), views, downloads, attendees, reshares, event name/location, podcast name, package name
- Stat cards: Published, In Progress, Total Views, Downloads, Attendees
- Dual filter system: `contentForStats` (time-only filter feeds stat cards) and `contentForCounts` (all filters feed the table)
- Month dropdown filter
- Date range picker (mutually exclusive with month filter)
- Platform, status, category, and search filters for the content table
- Add content form (`/dashboard/add`)
- Edit content form (`/dashboard/edit/[id]`)
- Client management (`/dashboard/clients`)
- Members management (`/dashboard/members`)
- Billing placeholder (`/dashboard/billing`)
- Settings (`/dashboard/settings`)

**Client-Facing Subdomain** (`[subdomain].devrel.studio`)
- Live performance dashboard with same stat cards
- Same time-based filter (month + date range) on metrics
- Same independent table filters
- PDF export via `@react-pdf/renderer` — two-page professional report
  - Page 1: Summary with 6 stat cards, category breakdown with bar chart, monthly overview table
  - Page 2+: Content detail grouped by month with pinned-width tables

**Landing Page** (`devrel.studio`)
- Sections: Hero, About, Services, Social Proof, Stats, Testimonials, Waitlist
- Built in Vite + React (separate from the Next.js app — this is the marketing site)

**Infrastructure**
- Vercel deployment with subdomain routing via `vercel.json`
- Convex backend with real-time subscriptions
- `.npmrc` with `legacy-peer-deps` for build stability
- `@react-pdf/renderer` in `serverExternalPackages`

### What does NOT exist yet:
Everything described in Section 6.

---

## 6. Full Feature Roadmap

### v1 — The Complete Platform

#### 6.1 Authentication (Clerk)

**Current state:** Auth exists but the specifics of how Clerk is integrated into the subdomain flow and manager access are not fully specified.

**What needs to be implemented:**

**DevRel sign-up and login**
Standard Clerk authentication. `<SignIn />` and `<SignUp />` components rendered natively within the app (not Clerk's hosted pages). Clerk's component mode keeps all auth UI on `devrel.studio` with no redirects.

Critical architectural rule: **Never use Clerk's user ID as a primary key in Convex.** Always store Clerk's `userId` as an `externalId` field on a Convex `users` table. Every other table references Convex's internal `Id<"users">`. This contains the migration surface area when moving to WorkOS in the future.

```typescript
// convex/schema.ts
users: defineTable({
  externalId: v.string(),          // Clerk user ID — external reference only
  handle: v.string(),              // @handle for public profile
  name: v.string(),
  email: v.string(),
  avatarUrl: v.optional(v.string()),
  role: v.union(v.literal("devrel"), v.literal("tw"), v.literal("advocate")),
  plan: v.union(v.literal("solo"), v.literal("inhouse"), v.literal("team"), v.literal("enterprise")),
  stripeCustomerId: v.optional(v.string()),
  stripeSubscriptionId: v.optional(v.string()),
  subscriptionStatus: v.optional(v.string()),
  isFoundingMember: v.boolean(),
  createdAt: v.number(),
}).index("by_externalId", ["externalId"])
  .index("by_handle", ["handle"])
```

**Sync Clerk user to Convex via webhook**
Clerk fires `user.created` and `user.updated` webhooks. A Convex HTTP action at `/clerk-webhook` receives these, validates the Svix signature, and upserts the user record in Convex.

#### 6.2 Manager Access Code System

**What it is:** A manager at a client company should be able to access `kinde.devrel.studio` without being a devrel.studio user. They get a unique access code from the DevRel. They enter it once, and a scoped read-only session is created that persists in their browser.

**How it works:**

1. DevRel creates a client workspace and can generate a manager access code from Settings
2. The code is a cryptographically random string stored in Convex against the workspace
3. When a manager visits `kinde.devrel.studio`, if they have no valid session they see a simple code entry screen (not a full login — just a PIN-style input)
4. The code is validated server-side against the workspace record
5. A scoped JWT is issued and stored in an httpOnly cookie — it contains only the workspace ID and an `accessLevel: "manager"` claim, no PII
6. The session expires after 30 days; re-entry of the code refreshes it
7. The DevRel can rotate the code at any time, invalidating all existing manager sessions for that workspace

This is a custom auth flow, not Clerk. It runs entirely in Next.js middleware and Convex.

```typescript
// convex/schema.ts
workspaces: defineTable({
  ownerId: v.id("users"),           // DevRel who owns this workspace
  clientSlug: v.string(),           // e.g. "kinde"
  clientName: v.string(),
  managerAccessCode: v.string(),    // hashed, rotatable
  isPublic: v.boolean(),            // if true, no code required
  createdAt: v.number(),
}).index("by_ownerId", ["ownerId"])
  .index("by_clientSlug", ["clientSlug"])
```

**Public/Private toggle:** If `isPublic: true`, the subdomain is accessible without any code. If `isPublic: false`, the access code gate is shown. The DevRel controls this from their dashboard settings per workspace.

#### 6.3 Automatic Metric Pulling

This is the single most important feature for making devrel.studio feel like infrastructure rather than admin work. Manual metric entry is the primary friction point and the main reason tools like this eventually get abandoned.

**Architecture:** Convex cron jobs run on schedule to refresh metrics for all content items that have a source URL or identifier. Each platform integration is a separate Convex action.

**Platforms and their data sources:**

**Dev.to**
- API: `https://dev.to/api/articles/{id}` (authenticated with user's API key)
- Returns: `page_views_count`, `public_reactions_count`, `comments_count`
- Requires: User's Dev.to API key stored encrypted in Convex
- Schedule: Daily refresh

**npm**
- API: `https://api.npmjs.org/downloads/point/last-week/{package}` (public, no auth)
- Returns: `downloads` (weekly count)
- Requires: Package name only
- Schedule: Weekly refresh (Sundays)

**GitHub**
- API: `https://api.github.com/repos/{owner}/{repo}` (authenticated with PAT for higher rate limits)
- Returns: `stargazers_count`, `forks_count`, `watchers_count`
- Optional traffic API: `https://api.github.com/repos/{owner}/{repo}/traffic/views` (requires push access to the repo)
- Requires: GitHub PAT stored encrypted
- Schedule: Daily refresh

**YouTube**
- API: `https://www.googleapis.com/youtube/v3/videos?part=statistics&id={videoId}`
- Returns: `viewCount`, `likeCount`, `commentCount`
- Requires: YouTube Data API key
- Schedule: Daily refresh

**Hashnode**
- GraphQL API: `https://api.hashnode.com/` with query for post stats
- Requires: Hashnode API key
- Schedule: Daily refresh

**freeCodeCamp / Medium**
- No public stats API
- These remain manual — field shows "manual entry" indicator
- A browser extension (future v2 feature) could scrape these

**Implementation pattern for each sync:**

```typescript
// convex/actions/syncMetrics.ts
export const syncDevToArticle = internalAction({
  args: { contentId: v.id("content"), articleId: v.string(), apiKey: v.string() },
  handler: async (ctx, { contentId, articleId, apiKey }) => {
    const res = await fetch(`https://dev.to/api/articles/${articleId}`, {
      headers: { "api-key": apiKey }
    });
    const data = await res.json();
    await ctx.runMutation(internal.content.updateMetrics, {
      contentId,
      views: data.page_views_count,
      lastSyncedAt: Date.now(),
    });
  }
});
```

**Cron schedule:**

```typescript
// convex/crons.ts
crons.cron("daily metric sync", "0 6 * * *", internal.sync.runDailySync, {});
crons.cron("weekly npm sync", "0 8 * * 0", internal.sync.runNpmSync, {});
```

**Schema additions:**

```typescript
content: defineTable({
  // ... existing fields ...
  sourceUrl: v.optional(v.string()),        // The original article/video/package URL
  sourcePlatformId: v.optional(v.string()), // Platform-specific ID for API calls
  autoSyncEnabled: v.boolean(),
  lastSyncedAt: v.optional(v.number()),
  syncStatus: v.optional(v.union(
    v.literal("pending"),
    v.literal("success"),
    v.literal("error")
  )),
  syncError: v.optional(v.string()),
})
```

**API key storage:** User-provided API keys (Dev.to, GitHub PAT, YouTube) are stored encrypted in Convex using AES-256-GCM. The encryption key is an environment variable on the Convex deployment, never exposed to the client.

**UI additions:**
- "Auto-sync" toggle on each content item
- "Last synced X minutes ago" indicator next to metrics
- A sync status indicator (green/yellow/red) visible in the dashboard
- Manual "Sync now" button for immediate refresh
- Integration settings page where DevRel connects their platform API keys

#### 6.4 Manager Feedback System

**Two levels of feedback:**

**Per-piece feedback:** A manager can drop a comment on any specific content item directly from the client dashboard. Text input, optional star rating (1-5). The DevRel receives a notification. The manager marks each feedback item as "Internal only" or "Shareable." Only shareable feedback can surface on the public portfolio.

**Monthly summary feedback:** At the bottom of each month section on the client dashboard, a text area for the manager to leave a summary note for that period. Same shareable/internal toggle.

**Schema:**

```typescript
feedback: defineTable({
  workspaceId: v.id("workspaces"),
  contentId: v.optional(v.id("content")),   // null = monthly feedback
  month: v.optional(v.string()),             // "May 2026" — for monthly feedback
  authorType: v.literal("manager"),
  text: v.string(),
  rating: v.optional(v.number()),            // 1-5, optional
  isShareable: v.boolean(),
  createdAt: v.number(),
}).index("by_workspaceId", ["workspaceId"])
  .index("by_contentId", ["contentId"])
```

**On the portfolio:** The DevRel can select which shareable feedback items appear on their public portfolio. Selected feedback shows with the client name, the manager's first name and role (if provided), and the date. This is verified social proof — not a testimonial they wrote themselves.

#### 6.5 Content Request and Approval Flow

**Manager side:** A "Request content" button on the client dashboard opens a simple form: content type, topic brief, target platform, desired delivery date. The request is created and the DevRel is notified.

**DevRel side:** A "Requests" section in the dashboard shows all outstanding requests. They can accept, decline with a note, or mark as in-progress. When a content item is published, they can link it to a request, closing the loop.

**Why this matters:** All scope is documented inside the tool. No more Slack threads or email chains about "can you write something on X." The manager can see exactly what they requested, when it was accepted, and when it was delivered.

**Schema:**

```typescript
contentRequests: defineTable({
  workspaceId: v.id("workspaces"),
  requestedBy: v.string(),               // Manager identifier
  contentType: v.string(),
  brief: v.string(),
  targetPlatform: v.optional(v.string()),
  dueDate: v.optional(v.number()),
  status: v.union(
    v.literal("pending"),
    v.literal("accepted"),
    v.literal("declined"),
    v.literal("in_progress"),
    v.literal("delivered")
  ),
  linkedContentId: v.optional(v.id("content")),
  declineNote: v.optional(v.string()),
  createdAt: v.number(),
  updatedAt: v.number(),
}).index("by_workspaceId", ["workspaceId"])
```

#### 6.6 Goal Setting and Live Progress Tracking

**Who sets goals:** Both the DevRel and the manager can set goals for a period. The DevRel sets internal goals. The manager sets client-agreed deliverables. Both are visible on the client dashboard as a live scorecard.

**Goal types:**
- Content count (e.g., 3 articles this month)
- View target (e.g., 50,000 views this quarter)
- Event count (e.g., 2 conference talks this quarter)
- Download target (e.g., 10,000 npm downloads this month)
- Custom metric (free text + number)

**How progress is calculated:** Goals are evaluated against `contentForStats` — the same time-filtered, verified dataset that feeds the stat cards. When the target is hit, the goal card turns green and a checkmark appears. No manual tracking.

**On the client dashboard:** A "Goals & Targets" section appears above the content table when goals exist. Each goal shows a progress bar, current value vs. target, and status. The manager can see this in real-time without asking for an update.

**Schema:**

```typescript
goals: defineTable({
  workspaceId: v.id("workspaces"),
  setBy: v.union(v.literal("devrel"), v.literal("manager")),
  type: v.union(
    v.literal("content_count"),
    v.literal("view_target"),
    v.literal("event_count"),
    v.literal("download_target"),
    v.literal("custom")
  ),
  label: v.string(),
  target: v.number(),
  period: v.string(),          // "May 2026", "Q2 2026"
  periodStart: v.number(),
  periodEnd: v.number(),
  customMetricKey: v.optional(v.string()),
  createdAt: v.number(),
}).index("by_workspaceId", ["workspaceId"])
```

#### 6.7 Public Portfolio (`devrel.studio/@handle`)

**Route:** `app/(portfolio)/[handle]/page.tsx` — a separate route group that handles `devrel.studio/@sholajegede` style URLs.

**What the portfolio shows:**

- **Header:** Name, handle, current role/title, avatar, location (optional), social links
- **Headline stat row:** Total content delivered (all time), total cumulative reach, years active on the platform
- **"Currently working with" section:** Shows active client logos (only clients where the workspace is set to public or the DevRel has opted to show the client name)
- **Content breakdown:** Visual breakdown by category with totals — "47 articles · 12 talks · 8 npm packages · 3 podcasts"
- **Impact highlights:** The three highest-performing pieces across all time (by views, attendees, or downloads)
- **Verified feedback:** Manager feedback items marked shareable and selected by the DevRel to appear publicly
- **Career timeline:** Employment periods in reverse chronological order — "Kinde (Mar 2025 – present)" with aggregate stats per period
- **Recent activity:** The last 6 published pieces with metrics

**What the portfolio does NOT show:**
- Client-specific detailed dashboards (those are behind the access code)
- Any content the DevRel has set to private
- Specific view counts for clients who have requested confidentiality

**Privacy controls (DevRel sets these):**
- Entire portfolio: public / private / URL-only (not indexed)
- Individual content items: show/hide on portfolio
- Client names: show / anonymize (shows "Series B startup" instead of the name)
- Metrics: show exact numbers / show ranges / hide metrics entirely

**Handle claim:** On signup, the DevRel claims their handle. Handles are lowercase, alphanumeric with hyphens, 3-30 characters. Handles are permanent once claimed and cannot be transferred (to prevent squatting and ensure URL permanence).

#### 6.8 Notifications

**In-app notifications:** A notification bell in the admin dashboard header. Shows:
- New manager feedback received
- New content request from a manager
- Metric sync completed or failed
- Goal reached
- Subscription renewal reminder

**Email notifications:** Powered by Resend. Transactional emails for:
- Welcome email on signup
- Founding member confirmation (for presale buyers)
- New feedback notification
- New content request
- Monthly summary (optional digest of the past month's performance)
- Payment receipts and subscription renewal notices

**Schema:**

```typescript
notifications: defineTable({
  userId: v.id("users"),
  type: v.string(),
  title: v.string(),
  body: v.string(),
  isRead: v.boolean(),
  metadata: v.optional(v.any()),
  createdAt: v.number(),
}).index("by_userId_read", ["userId", "isRead"])
```

#### 6.9 Subscription and Billing (Stripe)

**Plan structure:**

| Plan | Price | Who It's For |
|------|-------|-------------|
| Solo | $25/month | Freelance / contract DevRels, 1-3 client workspaces |
| In-House | $15/month | Employee DevRels, single employer workspace, no client management |
| Team | $99/month | Up to 10 seats, team head view, goal tracking, consolidated reports |
| Enterprise | Custom | 10+ seats, SSO, API access, SLA |

**Presale:** $99 lifetime deal (founding members). Lifetime means all Solo plan features forever, no subscription. Capped at a defined number of seats (e.g., 200 founding members).

**Stripe integration with Convex:**

```
User clicks "Subscribe" → 
Stripe Checkout session created (server-side Next.js API route) → 
User completes payment on Stripe-hosted Checkout page → 
Stripe fires webhook → 
Convex HTTP action validates webhook signature → 
Convex updates user's `plan` and `subscriptionStatus` → 
App reflects new access immediately (real-time via Convex subscription)
```

**Webhooks to handle:**
- `checkout.session.completed` — activate subscription
- `customer.subscription.updated` — plan change or renewal
- `customer.subscription.deleted` — cancellation
- `invoice.payment_failed` — grace period, then downgrade

**Feature gating:** A Convex query helper `getUserPlan(ctx)` returns the user's current plan. All protected features check against this before executing. The middleware does not handle feature gating — only route protection (authenticated vs. unauthenticated). Feature gates live in the Convex functions.

#### 6.10 AI Impact Summary

**What it is:** A button on the admin dashboard (and optionally on the client dashboard) that generates a narrative summary of the selected time period's performance. One click, immediate output.

**What it produces:**
- An opening sentence establishing the period and total output
- Highlight of the best-performing piece with context ("your tutorial on X drove 2,400 views, 3x your average")
- Category breakdown in natural language
- A closing sentence with trajectory (up/down vs. previous period, if comparable data exists)

**Implementation:** A Convex action that calls the Anthropic API (`claude-sonnet-4-20250514`) with the period's stats as structured data and a system prompt instructing it to produce a concise, professional impact narrative. The result is displayed in a modal with copy-to-clipboard.

**System prompt pattern:**
```
You are a professional DevRel impact writer. Given the following performance data 
for a Developer Relations professional, write a concise 3-4 sentence impact 
summary suitable for sharing with a client or manager. Be specific, use the 
actual numbers, highlight the standout performance, and maintain a professional 
but confident tone. Do not use bullet points. Do not use hedging language.
```

**Optional export:** The generated summary can be included in the PDF export as a narrative section before the stats tables.

---

### v2 — The Team Layer

#### 6.11 Team Workspaces

**Team creation:** A DevRel head or Head of Developer Relations creates a team. They become the team owner. They can invite other DevRels by email.

**Individual experience within a team:**
- Each team member has their own personal admin dashboard (identical to the solo experience)
- Each member has their own public portfolio at `devrel.studio/@handle`
- Members manage their own client workspaces independently unless explicitly shared with the team
- The only difference from solo: their work is also aggregated upward to the team view

**Team head experience:**
- A consolidated team dashboard showing all members' output side by side
- Aggregate stat cards for the entire team
- Individual member cards with their stats, goal progress, and recent activity
- Ability to set team-wide goals (separate from individual workspace goals)
- Team-wide PDF export covering all members
- Member management (invite, remove, change role)

**Roles within a team:**
- `owner` — full access, billing, can add/remove members
- `admin` — can manage members, cannot change billing
- `member` — standard DevRel access, own workspaces visible to team head

**Profile portability (the critical rule):**
When a team member leaves, their personal profile and all their work history is preserved exactly as it was. The team's view of that period shows historical data frozen at the departure date. The former member's profile continues to show that work, scoped to the employment period label ("Kinde, Mar 2025 – Jun 2026"). They join a new team (or go solo) and their profile accumulates a new period.

This is the GitHub model applied to professional identity. The work is yours. The employer gets visibility while the relationship is active. The record is permanent.

**Schema additions for teams:**

```typescript
teams: defineTable({
  name: v.string(),
  slug: v.string(),
  ownerId: v.id("users"),
  plan: v.union(v.literal("team"), v.literal("enterprise")),
  stripeCustomerId: v.optional(v.string()),
  createdAt: v.number(),
}).index("by_ownerId", ["ownerId"])
  .index("by_slug", ["slug"])

teamMemberships: defineTable({
  teamId: v.id("teams"),
  userId: v.id("users"),
  role: v.union(v.literal("owner"), v.literal("admin"), v.literal("member")),
  joinedAt: v.number(),
  leftAt: v.optional(v.number()),   // null = still active
  employerLabel: v.optional(v.string()),  // "Kinde" — shown on portfolio timeline
}).index("by_teamId", ["teamId"])
  .index("by_userId", ["userId"])
```

#### 6.12 In-House DevRel Features

Specific features that make devrel.studio genuinely useful for employed DevRels rather than just freelancers:

**Conference and CFP Pipeline**
Track conference submissions from CFP through acceptance through delivered through post-event metrics. Fields: event name, CFP submission date, acceptance status, talk title, event date, attendee count, recording URL, slides URL.

**Community Metrics Tracking**
Fields for: Discord/Slack member growth, GitHub stars influenced, forum posts answered, open-source contributions made. These are distinct from content types but equally valid DevRel work.

**Internal Visibility Mode**
A workspace framing that's "my employer" rather than "my client." Same product, different labels. The "client dashboard" becomes an "internal dashboard" accessible to their manager. Goals become OKR-aligned targets. The feedback system becomes the performance review feedback layer.

**Annual Impact Report**
One-click generation of a beautifully formatted annual report — suitable for dropping in a performance review, sharing with their VP, or using as a portfolio piece. Different format from the monthly PDF: longer narrative, year-in-review format, cumulative growth charts.

---

## 7. Technical Architecture

### Stack

| Layer | Technology | Version | Notes |
|-------|-----------|---------|-------|
| Framework | Next.js | 15 (App Router) | Server Components, Server Actions |
| Backend / Database | Convex | Latest (≥1.25.0) | Real-time, serverless functions, cron jobs |
| Authentication | Clerk | Latest | Custom UI components, no redirects, webhook sync |
| Payments | Stripe | Latest | Subscriptions, webhooks, Checkout |
| Email | Resend | Latest | Transactional emails, React Email templates |
| Styling | Tailwind CSS | v4 | CSS-first configuration |
| UI Components | shadcn/ui | Latest | Radix primitives |
| PDF Generation | @react-pdf/renderer | Latest | In `serverExternalPackages` |
| AI Summaries | Anthropic SDK | Latest | `claude-sonnet-4-20250514` |
| Deployment | Vercel | — | Subdomain routing, Edge middleware |
| Package Manager | npm | — | `.npmrc` with `legacy-peer-deps=true` |

### Subdomain Routing

Client dashboards live at `[slug].devrel.studio`. This is handled by:

1. Vercel wildcard domain configuration: `*.devrel.studio` points to the same deployment
2. Next.js middleware reads `request.headers.get('host')`, extracts the subdomain, and routes to the `(subdomain)` route group
3. The `(subdomain)/[subdomain]/page.tsx` handles the client dashboard rendering
4. Portfolio routes (`devrel.studio/@handle`) are handled by a separate route group that checks for the `@` prefix

### Convex Architecture

- **Queries:** Real-time subscriptions. All dashboard data uses `useQuery` for live updates.
- **Mutations:** Write operations. Content CRUD, feedback submission, goal updates.
- **Actions:** Side-effectful operations. Stripe API calls, metric sync API calls, Anthropic API calls, email sending.
- **Cron jobs:** Defined in `convex/crons.ts`. Daily metric sync, weekly npm sync.
- **HTTP routes:** Defined in `convex/http.ts`. Clerk webhook receiver, Stripe webhook receiver.
- **Internal functions:** Metric sync actions, notification dispatch — called by crons and other functions, not directly by the client.

### File Structure

```
devrel_studio/
├── app/
│   ├── (main)/
│   │   ├── dashboard/
│   │   │   ├── page.tsx              # Main dashboard
│   │   │   ├── layout.tsx
│   │   │   ├── add/page.tsx          # Add content
│   │   │   ├── edit/[id]/page.tsx    # Edit content
│   │   │   ├── clients/page.tsx      # Client workspace management
│   │   │   ├── integrations/page.tsx # API key management (new)
│   │   │   ├── goals/page.tsx        # Goal management (new)
│   │   │   ├── requests/page.tsx     # Content requests inbox (new)
│   │   │   ├── members/page.tsx      # Team members
│   │   │   ├── billing/page.tsx      # Subscription management
│   │   │   └── settings/page.tsx
│   ├── (subdomain)/
│   │   └── [subdomain]/
│   │       ├── page.tsx              # Client dashboard
│   │       └── layout.tsx
│   ├── (portfolio)/
│   │   └── [handle]/                 # @handle routes (new)
│   │       └── page.tsx
│   ├── (marketing)/
│   │   ├── page.tsx                  # Landing page
│   │   └── pricing/page.tsx
│   ├── api/
│   │   ├── export-report/
│   │   │   ├── route.ts
│   │   │   └── pdf-template.tsx
│   │   ├── stripe/
│   │   │   └── webhook/route.ts      # Stripe webhook handler (new)
│   │   └── checkout/
│   │       └── route.ts              # Stripe checkout session creator (new)
│   ├── sign-in/page.tsx
│   ├── sign-up/page.tsx
│   └── layout.tsx
├── components/
│   ├── dashboard/
│   │   ├── content-form.tsx
│   │   ├── header.tsx
│   │   ├── sidebar.tsx
│   │   ├── goal-card.tsx             # (new)
│   │   ├── feedback-panel.tsx        # (new)
│   │   ├── sync-status.tsx           # (new)
│   │   └── ai-summary-modal.tsx      # (new)
│   ├── portfolio/                    # (new)
│   │   ├── portfolio-header.tsx
│   │   ├── impact-stats.tsx
│   │   ├── feedback-card.tsx
│   │   └── career-timeline.tsx
│   ├── marketing/
│   └── ui/                           # shadcn components
├── convex/
│   ├── schema.ts
│   ├── users.ts
│   ├── content.ts
│   ├── workspaces.ts
│   ├── feedback.ts                   # (new)
│   ├── goals.ts                      # (new)
│   ├── requests.ts                   # (new)
│   ├── notifications.ts              # (new)
│   ├── teams.ts                      # (new — v2)
│   ├── actions/
│   │   ├── syncMetrics.ts            # (new)
│   │   ├── stripe.ts                 # (new)
│   │   ├── email.ts                  # (new)
│   │   └── ai.ts                     # (new)
│   ├── http.ts                       # Webhooks
│   └── crons.ts                      # Scheduled jobs
├── lib/
│   ├── utils.ts
│   ├── stripe.ts                     # (new)
│   └── encryption.ts                 # (new) — for API key storage
├── middleware.ts                      # Subdomain + auth routing
├── .npmrc
├── next.config.mjs
└── PRODUCT.md
```

---

## 8. Database Schema

Full Convex schema for v1 and v2. All tables use Convex's built-in `_id` and `_creationTime`.

```typescript
import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({

  // ─── Users ───────────────────────────────────────────────────────────────
  users: defineTable({
    externalId: v.string(),              // Clerk user ID — external ref only
    handle: v.string(),                  // @handle — unique, permanent
    name: v.string(),
    email: v.string(),
    avatarUrl: v.optional(v.string()),
    bio: v.optional(v.string()),
    role: v.union(
      v.literal("devrel"),
      v.literal("tw"),
      v.literal("advocate"),
      v.literal("other")
    ),
    location: v.optional(v.string()),
    websiteUrl: v.optional(v.string()),
    twitterHandle: v.optional(v.string()),
    linkedinUrl: v.optional(v.string()),
    githubHandle: v.optional(v.string()),
    plan: v.union(
      v.literal("founding"),            // Presale lifetime members
      v.literal("solo"),
      v.literal("inhouse"),
      v.literal("team"),
      v.literal("enterprise"),
      v.literal("none")
    ),
    stripeCustomerId: v.optional(v.string()),
    stripeSubscriptionId: v.optional(v.string()),
    subscriptionStatus: v.optional(v.string()),
    currentPeriodEnd: v.optional(v.number()),
    isFoundingMember: v.boolean(),
    portfolioVisibility: v.union(
      v.literal("public"),
      v.literal("private"),
      v.literal("unlisted")
    ),
    createdAt: v.number(),
  })
    .index("by_externalId", ["externalId"])
    .index("by_handle", ["handle"])
    .index("by_email", ["email"]),

  // ─── Platform Integrations (API keys) ────────────────────────────────────
  platformIntegrations: defineTable({
    userId: v.id("users"),
    platform: v.union(
      v.literal("devto"),
      v.literal("github"),
      v.literal("youtube"),
      v.literal("hashnode"),
      v.literal("npm")
    ),
    encryptedApiKey: v.optional(v.string()),  // AES-256-GCM encrypted
    isConnected: v.boolean(),
    lastTestedAt: v.optional(v.number()),
    createdAt: v.number(),
  })
    .index("by_userId", ["userId"])
    .index("by_userId_platform", ["userId", "platform"]),

  // ─── Workspaces (Client Relationships) ───────────────────────────────────
  workspaces: defineTable({
    ownerId: v.id("users"),
    clientSlug: v.string(),              // URL slug, e.g. "kinde"
    clientName: v.string(),              // Display name, e.g. "Kinde"
    clientLogoUrl: v.optional(v.string()),
    managerName: v.optional(v.string()),
    managerRole: v.optional(v.string()),
    hashedAccessCode: v.string(),        // bcrypt hash of access code
    isPublic: v.boolean(),               // No code required if true
    showClientName: v.boolean(),         // Show client name on DevRel's portfolio
    isActive: v.boolean(),               // Soft-delete / archive
    createdAt: v.number(),
  })
    .index("by_ownerId", ["ownerId"])
    .index("by_clientSlug", ["clientSlug"])
    .index("by_ownerId_active", ["ownerId", "isActive"]),

  // ─── Content ─────────────────────────────────────────────────────────────
  content: defineTable({
    workspaceId: v.id("workspaces"),
    userId: v.id("users"),
    title: v.string(),
    platform: v.string(),
    publicationDate: v.string(),         // ISO date string
    status: v.union(
      v.literal("Published"),
      v.literal("Draft"),
      v.literal("Waiting Approval"),
      v.literal("Scheduled"),
      v.literal("In Progress"),
      v.literal("Cancelled")
    ),
    category: v.union(
      v.literal("Written"),
      v.literal("Video"),
      v.literal("Event"),
      v.literal("Podcast"),
      v.literal("Package"),
      v.literal("Other")
    ),
    // Metrics
    views: v.optional(v.number()),
    downloads: v.optional(v.number()),
    weeklyDownloads: v.optional(v.number()),
    attendees: v.optional(v.number()),
    reshares: v.optional(v.array(v.object({
      platform: v.string(),
      link: v.string(),
      date: v.string(),
    }))),
    // Category-specific fields
    eventName: v.optional(v.string()),
    eventLocation: v.optional(v.string()),
    podcastName: v.optional(v.string()),
    packageName: v.optional(v.string()),
    // Auto-sync
    sourceUrl: v.optional(v.string()),
    sourcePlatformId: v.optional(v.string()),
    autoSyncEnabled: v.boolean(),
    lastSyncedAt: v.optional(v.number()),
    syncStatus: v.optional(v.union(
      v.literal("pending"),
      v.literal("syncing"),
      v.literal("success"),
      v.literal("error"),
      v.literal("manual")
    )),
    syncError: v.optional(v.string()),
    // Portfolio visibility
    showOnPortfolio: v.boolean(),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_workspaceId", ["workspaceId"])
    .index("by_userId", ["userId"])
    .index("by_workspaceId_status", ["workspaceId", "status"])
    .index("by_workspaceId_date", ["workspaceId", "publicationDate"])
    .searchIndex("search_title", { searchField: "title", filterFields: ["workspaceId"] }),

  // ─── Feedback ────────────────────────────────────────────────────────────
  feedback: defineTable({
    workspaceId: v.id("workspaces"),
    contentId: v.optional(v.id("content")),   // null = monthly feedback
    month: v.optional(v.string()),             // "May 2026"
    authorType: v.literal("manager"),
    authorName: v.optional(v.string()),
    text: v.string(),
    rating: v.optional(v.number()),            // 1-5
    isShareable: v.boolean(),
    isSelectedForPortfolio: v.boolean(),       // DevRel chose to show this
    createdAt: v.number(),
  })
    .index("by_workspaceId", ["workspaceId"])
    .index("by_contentId", ["contentId"])
    .index("by_workspaceId_shareable", ["workspaceId", "isShareable"]),

  // ─── Goals ───────────────────────────────────────────────────────────────
  goals: defineTable({
    workspaceId: v.id("workspaces"),
    setBy: v.union(v.literal("devrel"), v.literal("manager")),
    type: v.union(
      v.literal("content_count"),
      v.literal("view_target"),
      v.literal("event_count"),
      v.literal("download_target"),
      v.literal("custom")
    ),
    label: v.string(),
    target: v.number(),
    period: v.string(),
    periodStart: v.number(),
    periodEnd: v.number(),
    customMetricKey: v.optional(v.string()),
    isActive: v.boolean(),
    createdAt: v.number(),
  })
    .index("by_workspaceId", ["workspaceId"])
    .index("by_workspaceId_active", ["workspaceId", "isActive"]),

  // ─── Content Requests ────────────────────────────────────────────────────
  contentRequests: defineTable({
    workspaceId: v.id("workspaces"),
    requestedBy: v.string(),
    contentType: v.string(),
    brief: v.string(),
    targetPlatform: v.optional(v.string()),
    dueDate: v.optional(v.number()),
    status: v.union(
      v.literal("pending"),
      v.literal("accepted"),
      v.literal("declined"),
      v.literal("in_progress"),
      v.literal("delivered")
    ),
    linkedContentId: v.optional(v.id("content")),
    declineNote: v.optional(v.string()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_workspaceId", ["workspaceId"])
    .index("by_workspaceId_status", ["workspaceId", "status"]),

  // ─── Notifications ───────────────────────────────────────────────────────
  notifications: defineTable({
    userId: v.id("users"),
    type: v.string(),
    title: v.string(),
    body: v.string(),
    isRead: v.boolean(),
    metadata: v.optional(v.any()),
    createdAt: v.number(),
  })
    .index("by_userId", ["userId"])
    .index("by_userId_read", ["userId", "isRead"]),

  // ─── Manager Sessions (for access code auth) ─────────────────────────────
  managerSessions: defineTable({
    workspaceId: v.id("workspaces"),
    sessionToken: v.string(),            // hashed session token
    expiresAt: v.number(),
    createdAt: v.number(),
  })
    .index("by_workspaceId", ["workspaceId"])
    .index("by_sessionToken", ["sessionToken"]),

  // ─── Teams (v2) ──────────────────────────────────────────────────────────
  teams: defineTable({
    name: v.string(),
    slug: v.string(),
    ownerId: v.id("users"),
    plan: v.union(v.literal("team"), v.literal("enterprise")),
    stripeCustomerId: v.optional(v.string()),
    stripeSubscriptionId: v.optional(v.string()),
    logoUrl: v.optional(v.string()),
    createdAt: v.number(),
  })
    .index("by_ownerId", ["ownerId"])
    .index("by_slug", ["slug"]),

  teamMemberships: defineTable({
    teamId: v.id("teams"),
    userId: v.id("users"),
    role: v.union(v.literal("owner"), v.literal("admin"), v.literal("member")),
    employerLabel: v.optional(v.string()),
    joinedAt: v.number(),
    leftAt: v.optional(v.number()),
  })
    .index("by_teamId", ["teamId"])
    .index("by_userId", ["userId"])
    .index("by_teamId_userId", ["teamId", "userId"]),

});
```

---

## 9. API Integrations and Metric Sync

### Dev.to API
- **Base URL:** `https://dev.to/api`
- **Auth:** API key in `api-key` header (user-provided, stored encrypted)
- **Endpoints used:**
  - `GET /articles/{id}` — returns `page_views_count`, `public_reactions_count`, `comments_count`, `reading_time_minutes`
  - `GET /articles/me` — for initial article discovery/import
- **Rate limit:** 3 req/sec, 1000 req/day on authenticated endpoints
- **URL parsing:** Extract article ID from Dev.to URL pattern `dev.to/{username}/{slug}`
- **Sync frequency:** Daily at 06:00 UTC

### npm Downloads API
- **Base URL:** `https://api.npmjs.org`
- **Auth:** None required (public API)
- **Endpoints used:**
  - `GET /downloads/point/last-week/{package}` — weekly downloads
  - `GET /downloads/point/last-month/{package}` — monthly downloads
  - `GET /downloads/range/{start}:{end}/{package}` — custom range
- **Rate limit:** None documented, reasonable use
- **Sync frequency:** Weekly on Sundays at 08:00 UTC

### GitHub API
- **Base URL:** `https://api.github.com`
- **Auth:** Personal Access Token in `Authorization: Bearer {token}` header
- **Endpoints used:**
  - `GET /repos/{owner}/{repo}` — stars, forks, watchers, open issues
  - `GET /repos/{owner}/{repo}/traffic/views` — requires push access — optional
- **Rate limit:** 5000 req/hour authenticated, 60/hour unauthenticated
- **Sync frequency:** Daily at 06:00 UTC

### YouTube Data API v3
- **Base URL:** `https://www.googleapis.com/youtube/v3`
- **Auth:** API key (user-provided, stored encrypted)
- **Endpoints used:**
  - `GET /videos?part=statistics&id={videoId}` — viewCount, likeCount, commentCount, favoriteCount
- **URL parsing:** Extract video ID from `youtube.com/watch?v={id}` or `youtu.be/{id}`
- **Rate limit:** 10,000 units/day on free tier (each video stats call = 1 unit)
- **Sync frequency:** Daily at 06:00 UTC

### Hashnode API
- **Base URL:** `https://api.hashnode.com`
- **Auth:** API key in `Authorization` header
- **Type:** GraphQL
- **Query:** Post stats by slug including totalReactions, views
- **Sync frequency:** Daily at 06:00 UTC

---

## 10. Authentication Architecture

### DevRel User Auth (Clerk)

**Integration pattern:**
```
ClerkProvider (app/layout.tsx)
  └── ConvexProviderWithClerk (components/providers/ConvexKindeProvider.tsx → rename to ConvexClerkProvider.tsx)
```

**Middleware** (`middleware.ts`):
- Reads `host` header to detect subdomain
- If subdomain exists and is not `www`, route to `(subdomain)` group
- If path starts with `/dashboard`, require Clerk authentication
- If path starts with `/@`, route to portfolio (no auth required)

**Webhook sync** (`convex/http.ts`):
```typescript
http.route({
  path: "/clerk-webhook",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    // Validate Svix signature
    // Upsert user in Convex users table
  })
});
```

**Critical rule:** The Convex `users` table `externalId` field stores the Clerk user ID. All other Convex tables reference `v.id("users")` — never the Clerk ID directly.

### Manager Access Code Auth (Custom)

**Flow:**
1. DevRel generates code in workspace settings → random 8-character alphanumeric string
2. Code is bcrypt-hashed and stored in `workspaces.hashedAccessCode`
3. Plain code is shown once to the DevRel (copy and send to manager)
4. Manager visits `[slug].devrel.studio` → if no valid session cookie, sees code entry screen
5. Manager submits code → Next.js Server Action validates against bcrypt hash in Convex
6. If valid: create record in `managerSessions` table, issue httpOnly cookie with signed JWT (workspace ID + expiry)
7. Cookie expires after 30 days; manager is prompted to re-enter code
8. DevRel can rotate code → invalidates all sessions for that workspace (queries `managerSessions` by `workspaceId` and deletes)

**Session validation** (in subdomain page):
```typescript
// Server Component
const sessionToken = cookies().get('manager_session')?.value;
if (!sessionToken) redirect to code entry;
const session = await convex.query(api.workspaces.validateManagerSession, { token: sessionToken });
if (!session || session.expiresAt < Date.now()) redirect to code entry;
```

### Auth Migration Path to WorkOS

When the first enterprise customer requires SAML SSO (the real migration trigger, not a MAU threshold):

1. Add WorkOS as identity provider alongside Clerk
2. New enterprise users authenticate via WorkOS
3. Existing users remain on Clerk
4. A migration script maps Clerk `externalId` values to new WorkOS user IDs
5. Update `externalId` column in `users` table in a single Convex migration function
6. Remove Clerk dependency once all users are migrated

Because Clerk IDs are isolated to the `externalId` field, this migration touches exactly one table and one field. No cascading changes.

---

## 11. Monetization and Pricing

### Plan Tiers

| Plan | Monthly | Annual (2 months free) | Who |
|------|---------|----------------------|-----|
| Solo | $25/mo | $250/yr | Freelance DevRels, 1-3 active workspaces |
| In-House | $15/mo | $150/yr | Employed DevRels, single employer workspace |
| Team | $99/mo | $990/yr | Up to 10 seats, team head dashboard |
| Enterprise | Custom | Custom | 10+ seats, SSO, API access, SLA |
| **Founding Member** | **$99 lifetime** | — | Presale buyers — all Solo features forever |

### What Each Plan Includes

**Founding Member ($99 lifetime)**
- All Solo plan features, forever
- No subscription, no renewal
- Founding member badge on public portfolio
- Direct Slack/Discord access to builder for roadmap input
- Early access to every new feature
- Name in the founding members acknowledgment on the site

**Solo ($25/month)**
- Up to 3 active client workspaces
- Unlimited content entries
- Auto metric sync (all supported platforms)
- Public portfolio at `devrel.studio/@handle`
- Manager access code system
- Feedback and request flows
- Goal tracking
- PDF report export
- AI impact summaries (limited — 10/month)
- Email notifications via Resend

**In-House ($15/month)**
- 1 employer workspace
- All Solo features
- Conference/CFP pipeline tracker
- Community metrics fields
- OKR-aligned goal templates
- Annual impact report generation

**Team ($99/month for up to 10 seats)**
- Everything in Solo for each member
- Team head consolidated dashboard
- Team-wide goal setting
- Cross-member content calendar view
- Team PDF export
- Member management
- Admin and member role levels

**Enterprise (Custom)**
- Everything in Team, unlimited seats
- SAML SSO via WorkOS (when implemented)
- SCIM directory sync
- API access for custom integrations
- Dedicated support SLA
- Custom onboarding

### Stripe Implementation

**Products and prices to create in Stripe:**
- Product: "devrel.studio Solo" — recurring monthly $25, recurring annual $250
- Product: "devrel.studio In-House" — recurring monthly $15, recurring annual $150
- Product: "devrel.studio Team" — recurring monthly $99, recurring annual $990
- Product: "devrel.studio Founding Member" — one-time $99

**Checkout flow:**
```
POST /api/checkout
body: { priceId, userId }
→ stripe.checkout.sessions.create({
    customer_email: user.email,
    line_items: [{ price: priceId, quantity: 1 }],
    mode: priceId === FOUNDING_PRICE_ID ? "payment" : "subscription",
    success_url: `${origin}/dashboard?checkout=success`,
    cancel_url: `${origin}/pricing`,
    metadata: { userId }
  })
→ return { url: session.url }
```

**Webhook handler** (`convex/http.ts`):
```typescript
http.route({
  path: "/stripe-webhook",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    // Validate Stripe signature
    // Handle: checkout.session.completed, customer.subscription.updated,
    //         customer.subscription.deleted, invoice.payment_failed
  })
});
```

---

## 12. Presale Strategy

### The Offer
**$99 lifetime deal** — founding member access to all Solo plan features forever, with no subscription.

**Hard cap:** 200 founding members. When the cap is reached, the presale closes. This creates genuine scarcity without being artificial.

### Landing Page Hero (finalized copy)

**Headline:** Your DevRel work, finally visible.
**Subline:** Where your work is logged, proven, owned, and portable for your entire career.

### Discord Post for DevRel University (finalized draft)

> Hey DevRel Uni 👋
>
> I'm a DevRel at Kinde and about 6 months ago I got tired of spending hours every month stitching together reports — screenshots, spreadsheets, PDFs — just to prove my impact to my manager.
>
> So I built something to fix it. My manager recently called it the most genuinely useful tool he's seen working with DevRels. That gave me the confidence to turn it into a proper platform.
>
> It's called devrel.studio — where your work is logged, proven, owned, and portable for your entire career.
>
> Right now it gives every client a live performance dashboard that updates as you publish. No more monthly PDFs. Before I build it into something bigger, I want to get it into the hands of people who actually feel this pain.
>
> I'm opening a small presale — lifetime access for $99 (it'll be $25/month at launch). You get founding member status, direct input on what gets built, and early access to everything.
>
> If reporting has ever felt like the worst part of your DevRel work — I'd love for you to try it: devrel.studio
>
> Happy to answer anything here 🙏

### What to Build Before Announcing
At minimum before the presale is announced:
1. A Stripe payment link for the $99 founding member one-time purchase
2. A "founding member" confirmation page and email via Resend
3. An updated landing page with the new hero copy, the presale pricing, and a buy button
4. A list of founding member benefits clearly stated
5. The founding member counter showing X/200 remaining

The full product does not need to be ready. The presale validates demand and funds the build.

---

## 13. Go-to-Market

### Phase 1: Presale (Before Full Launch)
- DevRel University Discord announcement
- Personal Twitter/X — share the journey authentically, not as a launch announcement
- Direct outreach to 10-15 DevRel professionals known personally
- The Kinde manager quote as social proof
- Goal: 50-100 founding members before full v1 ships

### Phase 2: v1 Launch
- Product Hunt launch (coordinate with DevRel community for upvotes)
- Dev.to article: "I Built the Tool I Wished Existed When I Started in DevRel"
- Twitter/X thread of the build journey
- Guest post or mention in developer-focused newsletters
- Outreach to DevRel communities: DevRel Uni, DevRel Collective, community Discord servers

### Phase 3: Organic Growth
- Every DevRel sharing their `devrel.studio/@handle` profile is marketing
- Every client dashboard URL shared is marketing
- The public portfolio is a permanent distribution channel — as long as profiles are active, the domain gets traffic

### The Unique Positioning Statement
"GitHub is to engineers what devrel.studio is to DevRels."

This framing is not a stretch. GitHub didn't set out to be a professional identity platform — it started as a place to store code. The identity followed because the work lived there. devrel.studio does the same thing for Developer Relations.

---

## 14. Build Order and Sequencing

### Immediate Priorities (Before Presale Announcement)
1. Update landing page hero copy
2. Stripe presale payment (one-time $99 founding member)
3. Founding member email confirmation via Resend
4. Founding member counter on landing page

### v1 Build Sequence (Post-Presale)
1. **Manager access code system** — everything else in the manager flow depends on this
2. **Platform API integrations and auto-sync** — highest friction removal, biggest product upgrade
3. **Integration settings page** — DevRel connects their Dev.to, GitHub, YouTube, npm API keys
4. **Public portfolio (`/@handle`)** — the network effect and distribution engine
5. **Manager feedback system** — depends on manager access code being done
6. **Goal setting and live progress** — needed for in-house DevRel positioning
7. **Content requests flow** — completes the two-directional dashboard
8. **Stripe full subscription management** — billing page, plan selection, upgrade/downgrade
9. **Notifications** — in-app bell + email via Resend
10. **AI impact summaries** — builds on Anthropic SDK, adds significant perceived value

### v2 Build Sequence
1. Team schema additions and membership model
2. Team invitation flow
3. Team head consolidated dashboard
4. Team-wide goals
5. Employment period scoping on profiles
6. Team PDF export

---

## 15. Environment Variables Reference

```bash
# Next.js
NEXT_PUBLIC_APP_URL=https://devrel.studio
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=
CLERK_SECRET_KEY=
CLERK_WEBHOOK_SECRET=                    # Svix secret for webhook validation

# Convex
NEXT_PUBLIC_CONVEX_URL=
CONVEX_DEPLOY_KEY=                       # For CI/CD

# Stripe
STRIPE_SECRET_KEY=
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=
STRIPE_WEBHOOK_SECRET=
STRIPE_SOLO_MONTHLY_PRICE_ID=
STRIPE_SOLO_ANNUAL_PRICE_ID=
STRIPE_INHOUSE_MONTHLY_PRICE_ID=
STRIPE_INHOUSE_ANNUAL_PRICE_ID=
STRIPE_TEAM_MONTHLY_PRICE_ID=
STRIPE_TEAM_ANNUAL_PRICE_ID=
STRIPE_FOUNDING_MEMBER_PRICE_ID=

# Email (Resend)
RESEND_API_KEY=
EMAIL_FROM=hello@devrel.studio

# AI (Anthropic)
ANTHROPIC_API_KEY=

# Encryption (for API key storage)
ENCRYPTION_KEY=                          # 32-byte hex string, AES-256-GCM

# Convex environment variables (set via npx convex env set)
# ENCRYPTION_KEY
# STRIPE_SECRET_KEY
# STRIPE_WEBHOOK_SECRET
# RESEND_API_KEY
# ANTHROPIC_API_KEY
# CLERK_WEBHOOK_SECRET
```

---

## References

- **Convex Docs:** https://docs.convex.dev
- **Convex + Clerk Integration:** https://docs.convex.dev/auth/clerk
- **Convex Cron Jobs:** https://docs.convex.dev/scheduling/cron-jobs
- **Convex Scheduled Functions:** https://docs.convex.dev/scheduling/scheduled-functions
- **Clerk Next.js Docs:** https://clerk.com/docs/nextjs
- **Clerk + Convex Integration Guide:** https://clerk.com/docs/guides/development/integrations/databases/convex
- **Clerk Pricing (current):** https://clerk.com/pricing — Pro at $20/month, 50,000 MAU free as of early 2026
- **Stripe Subscriptions:** https://stripe.com/docs/billing/subscriptions
- **Stripe Webhooks:** https://stripe.com/docs/webhooks
- **@react-pdf/renderer:** https://react-pdf.org
- **Dev.to API:** https://developers.forem.com/api
- **npm Downloads API:** https://api.npmjs.org/downloads/point/last-week/{package}
- **YouTube Data API v3:** https://developers.google.com/youtube/v3/docs/videos/list
- **GitHub REST API:** https://docs.github.com/en/rest
- **Resend:** https://resend.com/docs
- **Anthropic SDK:** https://docs.anthropic.com/en/api
- **WorkOS (future migration path):** https://workos.com

---

*Last updated: May 2026*
*Author: Shola Jegede*
*Status: Active development*