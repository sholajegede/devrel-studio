# DevRel Studio

**Developer-relations work, logged once and shown to the people paying for it.**

A developer advocate logs each piece of work they ship — a post, a talk, a package, a demo. DevRel Studio turns that log into three things at once: a private workspace for the advocate, a live branded dashboard for every client, and a public portfolio of everything they have ever published. No exports, no slide decks, no month-end scramble.

Live at **[devrel.studio](https://devrel.studio)**. See a real client dashboard at **[devrel.studio/demo](https://devrel.studio/demo)**.

---

## Contents

- [The four surfaces](#the-four-surfaces)
- [Features](#features)
- [How the hosts work](#how-the-hosts-work)
- [Tech stack](#tech-stack)
- [Project structure](#project-structure)
- [Routes](#routes)
- [Data model](#data-model)
- [Content categories](#content-categories)
- [Access and authentication](#access-and-authentication)
- [Background jobs](#background-jobs)
- [Machine-readable surfaces](#machine-readable-surfaces)
- [Plans and access](#plans-and-access)
- [Getting started](#getting-started)
- [Environment variables](#environment-variables)
- [Testing](#testing)
- [Deployment](#deployment)
- [Scripts](#scripts)

---

## The four surfaces

The single most useful thing to understand about this codebase is that it serves **four different audiences on three different hosts**, from one Next.js app. `proxy.ts` is what decides which.

| Surface | Address | Who opens it | Auth |
|---|---|---|---|
| **Advocate workspace** | `devrel.studio/dashboard` | The DevRel who owns the account | Kinde session |
| **Client dashboard** | `<slug>.devrel.studio`, or the client's own domain | The client being reported to — no account | Access code, or public |
| **Public portfolio** | `devrel.studio/@handle` | Anyone; search engines; agents | None |
| **Admin console** | `admin.devrel.studio` | Whoever operates the platform | Kinde session **+** admin role |

These are genuinely separate. An admin has no implicit access to anyone's client data. A client manager has no account at all. A portfolio is world-readable and deliberately excludes anything a client commissioned.

---

## Features

### Advocate workspace — `devrel.studio/dashboard`

| Page | What it does |
|---|---|
| **Overview** | Live counters (published, in progress, views, downloads, attendees), a six-month published-vs-in-progress chart, month-by-month content with category and status filters, and a getting-started checklist |
| **All Content** | Every entry across every client: keyword search, category / status / platform / client filters, saved views, bulk actions, CSV import and export, keyboard shortcuts |
| **Pipeline** | The forward-looking view — what is in flight, due, or slipped, as lanes over the existing `status` values |
| **Analytics** | Who actually opened the work: views and dwell time across client dashboards and the public portfolio, referrers, countries, and per-page depth |
| **Clients** | Full CRUD for engagements — retainer rate with full rate history, contract type, pause/resume, access codes, logo upload (light *and* dark), brand colour, and a custom domain |
| **Reports** | Monthly client reports: written notes and targets, PDF export, per-client recipients, and a schedule (day, hour, timezone) that sends them automatically |
| **Members** | Invite teammates into a workspace by email with a role (Admin, Editor, Viewer); seat limits enforced by plan |
| **Billing** | Plan, access window, term pricing, and upgrade paths |
| **Settings** | Profile, portfolio handle and bio, social links, account pause |

### Client dashboard — `<slug>.devrel.studio`

- Opened by a manager who has **no account**, behind an access code the advocate sets
- Live stats and a content table with category badges, platforms, metrics and direct links
- Expandable reshare history per entry
- Month and category filters
- Monthly reports with the advocate's written summary, plus a feedback box that emails back
- PDF download carrying the client's own logo and brand colour
- White-labelled: the client's logo (per theme), their colour, optionally their own domain

### Public portfolio — `devrel.studio/@handle`

- Server-rendered and indexable, with a generated link-preview card
- Only `Published` work. Drafts, scheduled work, notes, tracking links and **which client commissioned what** never appear
- Grouped by category with the metric each category is measured by
- Setting a handle is what publishes it — there is no separate on/off switch

### Admin console — `admin.devrel.studio`

Its own origin, so cookies, storage and any future edge rule stop at the boundary. Overview, accounts, workspaces, revenue and access windows, traffic, content, access requests, abuse signals, an audit log, and read-only impersonation for support.

The host is **not** the security boundary — every query behind these pages resolves the caller through `requireAdmin` server-side.

---

## How the hosts work

All routing decisions live in `proxy.ts`:

```
admin.devrel.studio/*     → rewrite to /admin/*        (Kinde session required)
<slug>.devrel.studio/*    → rewrite to /<slug>/*       (no Kinde; access-code gate in the layout)
reports.acme.com/*        → same, resolved via a cached Convex lookup
devrel.studio/@handle     → rewrite to /portfolio/handle
devrel.studio/demo        → the public demo client dashboard, served on the apex
devrel.studio/*           → marketing and the advocate workspace
```

Worth knowing:

- **Reserved subdomains** (`www`, `api`, `admin`, `docs`, `demo`, …) live in `lib/naming.ts`, shared with the Convex mutation that decides whether a slug can be claimed — so the two namespaces cannot drift apart. A reserved name 404s rather than quietly serving the marketing site.
- **Custom domains** cost one Convex HTTP lookup on first request, cached in module scope with a shorter TTL for misses so a domain being set up starts working within the minute.
- **View tracking** happens in the proxy because it is the only chokepoint in front of both the client dashboard and the portfolio, and it runs *before* the ISR cache — so a portfolio served from cache is still counted. Bots and prefetches are excluded.

---

## Tech stack

| Layer | Technology |
|---|---|
| Framework | [Next.js 16](https://nextjs.org) — App Router, Turbopack |
| UI runtime | React 19 |
| Language | TypeScript 5 |
| Styling | [Tailwind CSS v4](https://tailwindcss.com) with light/dark themes via `next-themes` |
| Components | [shadcn/ui](https://ui.shadcn.com) on Radix primitives |
| Charts | [Recharts](https://recharts.org) 2 |
| Backend / DB | [Convex](https://convex.dev) 1.44 — reactive queries, mutations, actions, crons, file storage |
| Auth | [Kinde](https://kinde.com) (`@kinde-oss/kinde-auth-nextjs` 2) |
| Payments | [Stripe](https://stripe.com) — optional; the app runs fully without keys |
| Email | [Resend](https://resend.com), via Convex actions |
| PDF | [`@react-pdf/renderer`](https://react-pdf.org) + `pdf-lib` |
| Errors | [Sentry](https://sentry.io) |
| Tests | [Vitest](https://vitest.dev) + Testing Library + jsdom |
| Hosting | Vercel (frontend) + Convex Cloud (backend) |

---

## Project structure

```
devrel_studio/
├── app/
│   ├── (main)/
│   │   ├── dashboard/           # Advocate workspace (Kinde-protected)
│   │   │   ├── page.tsx           overview · add/ · edit/[id]/ · content/
│   │   │   ├── pipeline/          analytics/ · clients/ · reports/
│   │   │   └── members/           billing/ · settings/
│   │   ├── admin/               # Platform console, served on admin.devrel.studio
│   │   └── login/               # The console's own front door
│   ├── (subdomain)/
│   │   └── [subdomain]/         # Client dashboard — layout.tsx holds the access gate
│   │       ├── page.tsx           report/ · reports/ · llms.txt/
│   │       └── opengraph-image.tsx
│   ├── portfolio/[handle]/      # Public portfolio (rewrite target for /@handle)
│   ├── api/                     # auth · billing/checkout · export-report
│   │                            # manager-access · members · portfolio/revalidate · track
│   ├── llms.txt/                # Site-level agent index
│   ├── sitemap.ts robots.ts     # Crawler-facing, generated
│   └── page.tsx                 # Landing page
│
├── components/
│   ├── brand/                   # Logo mark + the loader built from it
│   ├── dashboard/ admin/        # Workspace and console UI
│   ├── subdomain/               # Access gate, report view
│   ├── analytics/               # Dwell-time beacon
│   ├── marketing/ invite/       # Nav, footer, invitation flow
│   └── ui/                      # shadcn/ui library
│
├── convex/
│   ├── schema.ts                # 16 tables
│   ├── model/                   # Shared server logic: auth, workspaces, plans,
│   │                            # access windows, rate limiting, admin guards
│   ├── content.ts clients.ts    # Core domain
│   ├── reports.ts analytics.ts  # Reporting and view data
│   ├── members.ts users.ts      # Workspaces, invites, profiles
│   ├── admin*.ts                # Console queries, split by section
│   ├── managerAccess.ts         # Client access codes and sessions
│   ├── portfolio.ts             # Public reads + the llms.txt index
│   ├── billing.ts trials.ts     # Plans, access windows, trial notices
│   ├── sync.ts email.ts         # npm/GitHub stat refresh; Resend actions
│   ├── crons.ts http.ts         # Scheduled jobs; webhooks and ingest
│   └── migrations.ts
│
├── lib/                         # Framework-free helpers, shared by app and convex
│   ├── metrics.ts               # Which number belongs to which category
│   ├── naming.ts                # Slug/handle rules and the reserved lists
│   ├── llms-txt.ts report.ts    # Generated text surfaces
│   ├── view-tracking.ts         # Edge-safe hashing, bot and prefetch rules
│   └── manager-auth.ts stripe.ts retainer.ts schedule.ts …
│
├── tests/                       # Vitest suites (21 files)
└── proxy.ts                     # Host routing, auth gate, view tracking
```

---

## Routes

### Apex — `devrel.studio`

| Route | Access | Description |
|---|---|---|
| `/` | Public | Landing page |
| `/pricing` `/contact` `/privacy` `/terms` | Public | Marketing and legal |
| `/sign-in` `/sign-up` | Public | Branded entry to Kinde's hosted flow |
| `/demo` | Public | A real, seeded client dashboard |
| `/@handle` | Public | Portfolio (rewrites to `/portfolio/handle`) |
| `/invite/[token]` | Public | Workspace invitation |
| `/dashboard/**` | Kinde | The advocate workspace |

### Client host — `<slug>.devrel.studio` or a custom domain

| Route | Access | Description |
|---|---|---|
| `/` | Gate | Live performance dashboard |
| `/reports` `/report` | Gate | Monthly reports, feedback, PDF download |

### Console — `admin.devrel.studio`

| Route | Access | Description |
|---|---|---|
| `/login` | Public | The only unauthenticated page on this host |
| `/` `/users` `/workspaces` `/revenue` `/traffic` `/content` `/requests` `/abuse` `/audit` | Admin | Console sections |

### API

| Route | Description |
|---|---|
| `/api/auth/[kindeAuth]` | Kinde login, logout, register, callback |
| `/api/manager-access`, `/api/manager-access/code` | Redeem and request a client access code |
| `/api/members/invite`, `/api/members/accept` | Workspace invitations |
| `/api/billing/checkout` | Stripe checkout session (when configured) |
| `/api/export-report` | Server-rendered PDF |
| `/api/track/duration` | Dwell-time beacon |
| `/api/portfolio/revalidate` | Refresh the caller's own portfolio (Kinde-gated `revalidatePath`) |

### Convex HTTP — `<deployment>.convex.site`

`/kinde` (user sync webhook) · `/stripe` (payment webhook) · `/resolve-domain` (custom-domain lookup) · `/track` (view ingest)

---

## Data model

Sixteen tables in `convex/schema.ts`.

| Table | Purpose |
|---|---|
| `users` | Profile, portfolio fields, plan and access window, admin role |
| `contentEntries` | The core record — one row per piece of work |
| `clients` | Engagements: retainer and rate history, branding, slug, custom domain |
| `workspaces` · `memberships` · `workspaceInvites` | Team accounts and roles |
| `managerSessions` · `managerAccessAttempts` | Client dashboard sessions and rate limiting |
| `reportSchedules` · `reportNotes` · `reportFeedback` | Report delivery, written summaries, client replies |
| `pageViews` | Analytics, pruned after a year |
| `accessRequests` | Requests to view a gated dashboard |
| `adminAuditLog` · `impersonationSessions` | Console accountability |
| `publicWriteAttempts` | Abuse signal on unauthenticated surfaces |

### `contentEntries`

| Field | Type | Notes |
|---|---|---|
| `userId` / `workspaceId` | ids | Creator; the workspace that authorises reads |
| `client` | `string` | Slug, name or company — resolved within one client's owner |
| `category` | `Written \| Video \| Event \| Podcast \| Package \| Demo` | Absent reads as `Written` |
| `title` · `link` · `platform` · `publicationDate` | | |
| `trackingLink` · `notes` | `string` | **Internal.** Never leaves through a public read |
| `status` | `Published \| Draft \| Waiting Approval \| Scheduled` | |
| `views` · `downloads` · `weeklyDownloads` · `attendees` · `stars` | `number?` | Only the metric its category owns is ever counted |
| `packageName` · `eventName` · `eventLocation` · `podcastName` · `repoUrl` · `stack` | `string?` | Category-specific |
| `reshares` | `{platform, link, date}[]?` | Cross-promotion log |
| `tags` · `contentType` · `updatedAt` | | |

`lib/metrics.ts` is the single source of truth for which number belongs to which category — an Event's stray `views` is never added to a views total.

---

## Content categories

Six, each with its own platforms, sub-types and headline metric:

| Category | Metric | Platforms | Sub-types |
|---|---|---|---|
| **Written** | Views | Dev.to, freeCodeCamp, Medium, Hashnode, LinkedIn, Newsletter, Blog, GitHub, Docs, X | Tutorial, Guide, Reference Doc, Blog Post, Case Study, Opinion |
| **Video** | Views | YouTube, Loom, Vimeo, TikTok | Tutorial, Demo, Conference Talk, Interview |
| **Event** | Attendees | Free text — conference names vary too much for a dropdown | Conference Talk, Workshop, Meetup, Panel, Keynote |
| **Podcast** | Listeners | Spotify, Apple Podcasts, YouTube Podcasts | Guest Appearance, Host, Solo Episode |
| **Package** | Downloads + weekly | npm, GitHub | Convex Component, Library, CLI Tool |
| **Demo** | Stars | Vercel, Netlify, Cloudflare Pages, GitHub | Full App, Starter Kit, Sample |

**Package** and **Demo** metrics refresh themselves — a daily cron reads npm's download API and GitHub's star count, with a "Refresh now" button for the impatient. `GITHUB_TOKEN` is optional and only raises the rate limit.

---

## Access and authentication

Three independent models. Confusing them is the easiest way to introduce a hole.

**1. Advocate — Kinde.** Sign-in and sign-up redirect to Kinde's hosted flow; `/api/auth/kinde_callback` completes it. A Kinde webhook to `<deployment>.convex.site/kinde` creates or updates the `users` row. `contexts/user-context.tsx` bridges the Kinde session and the Convex profile for every dashboard page. Authorisation resolves through the **workspace**, not the user.

**2. Client manager — access code.** Managers have no account. `app/(subdomain)/[subdomain]/layout.tsx` checks, server-side on every request, whether the visitor holds a valid session cookie or the dashboard is marked public. The dashboard is never sent to the browser otherwise. Codes are hashed with `MANAGER_CODE_SECRET`; attempts are rate-limited.

> **Adding a route under `(subdomain)/[subdomain]/`?** A layout wraps *pages*, not route handlers. Anything you add as a `route.ts` there inherits the address of a private dashboard and **none of its protection** — it must run the gate itself. See `llms.txt/route.ts` for the pattern.

**3. Platform admin — role, not host.** Authority lives in an `adminRole` column on `users`, never in an environment variable at request time. `admin.devrel.studio` is its own origin for isolation, but every console query calls `requireAdmin` server-side. An account without the role gets the same "not found" as any unknown URL. Impersonation is read-only and logged.

The first administrator is a chicken-and-egg problem — every mutation that grants the role requires the role. It is broken by an `internalMutation`, unreachable from the browser and runnable only with deploy credentials:

```bash
npx convex env set ADMIN_EMAILS "you@example.com"   # on the Convex deployment
npx convex run admin:bootstrap --prod
```

Idempotent: a second run is silent rather than filling the audit trail.

---

## Background jobs

Six crons in `convex/crons.ts`:

| Job | Cadence | Purpose |
|---|---|---|
| Refresh package and demo stats | Daily 04:00 UTC | npm downloads, GitHub stars |
| Send scheduled client reports | **Hourly** :05 | Each schedule carries its own day, hour and timezone — hourly is the only way to honour that |
| Send trial notices | Daily 08:00 UTC | Idempotent; a retry mails nobody twice |
| Prune old page views | Daily 03:30 UTC | Views are kept one year |
| Send weekly digests | Mondays 08:00 UTC | Skipped entirely for a quiet week |
| Prune orphaned uploads | Daily 04:15 UTC | Logos uploaded but never saved |

---

## Machine-readable surfaces

Alongside `sitemap.xml`, `robots.txt` and generated OpenGraph cards, the app publishes `llms.txt` files for agents:

| URL | Contents |
|---|---|
| `/llms.txt` | Directory of every published portfolio |
| `/@handle/llms.txt` | One advocate's published work, grouped by category |
| `<slug>.devrel.studio/llms.txt` | A client dashboard — only when the advocate marked it public; otherwise a stub |

The rule they obey: **an llms.txt says exactly what the HTML page at the same URL already says, and nothing more.** Entries are projected field by field, never spread, so `notes` and `trackingLink` cannot surface. Customer-authored text is flattened to a single line and leading markdown markers are escaped — a bio may describe itself, not the file it sits in.

> If you front the site with a CDN, check its managed `robots.txt`. A default AI-crawler block will stop the exact audience these files exist for.

---

## Plans and access

Priced per month, **sold in blocks** rather than renewed monthly.

| Plan | Monthly | Clients | Entries | Seats |
|---|---|---|---|---|
| **Free Trial** | — | 1 | 10 | 1 |
| **Starter** | $29 | 1 | Unlimited | 1 |
| **Pro** | $59 | 5 | Unlimited | 1 |
| **Agency** | $119 | Unlimited | Unlimited | 5 |

Terms: 1 month (0%), 3 months (10%), 6 months (15%), 12 months (20% off). Trial is 14 days.

Access is a **timestamp**, not a subscription — which makes selling a month, a year or a perpetual licence the same field with a different number in it. `convex/model/plans.ts` is the one definition of what each plan allows, imported by both the enforcing mutations and the pricing UI, so the two cannot drift.

Stripe is wired but optional. Without keys, `billingIsConfigured()` is false and the billing page says so rather than the app failing to boot.

---

## Getting started

### Prerequisites

- Node.js 20+
- A [Convex](https://convex.dev) project
- A [Kinde](https://kinde.com) application

### 1. Install

```bash
git clone <your-repo-url> devrel_studio
cd devrel_studio
npm install
```

### 2. Link Convex

```bash
npx convex dev
```

Writes `CONVEX_DEPLOYMENT` and `NEXT_PUBLIC_CONVEX_URL` into `.env.local` and watches `convex/` for changes.

### 3. Configure Kinde

1. Create an application in the [Kinde dashboard](https://app.kinde.com)
2. Allowed callback URL: `http://localhost:3000/api/auth/kinde_callback`
3. Allowed logout redirect URL: `http://localhost:3000`
4. Add a webhook to `https://<deployment>.convex.site/kinde`, subscribed to `user.created` and `user.updated`

### 4. Fill in `.env.local`

See [Environment variables](#environment-variables). At minimum you need the Convex and Kinde values plus `NEXT_PUBLIC_ROOT_DOMAIN` and `MANAGER_CODE_SECRET`.

### 5. Run

```bash
npx convex dev     # terminal 1 — backend
npm run dev        # terminal 2 — frontend
```

Open [http://localhost:3000](http://localhost:3000).

**Testing the other hosts locally.** Subdomains of `localhost` work without any hosts-file editing:

```bash
curl -H "Host: acme.localhost:3000" http://localhost:3000/
open http://admin.localhost:3000/login
```

---

## Environment variables

### Required

| Variable | Where | Description |
|---|---|---|
| `CONVEX_DEPLOYMENT` | Local | Set by `npx convex dev` |
| `NEXT_PUBLIC_CONVEX_URL` | Both | Convex deployment URL |
| `NEXT_PUBLIC_ROOT_DOMAIN` | Both | Bare host — `devrel.studio`, `localhost:3000`. Composed with a slug for subdomain URLs |
| `KINDE_CLIENT_ID` / `KINDE_CLIENT_SECRET` | Next | From the Kinde application |
| `KINDE_ISSUER_URL` | Both | `https://yourapp.kinde.com` |
| `KINDE_SITE_URL` | Next | Your origin |
| `KINDE_POST_LOGIN_REDIRECT_URL` | Next | e.g. `/dashboard` |
| `KINDE_POST_LOGOUT_REDIRECT_URL` | Next | e.g. `/` |
| `MANAGER_CODE_SECRET` | Both | Hashes client access codes. **Rotating it invalidates every manager session** |

### Optional

| Variable | Enables |
|---|---|
| `KINDE_COOKIE_DOMAIN` | Read by the Kinde SDK; set to `.devrel.studio` to share a session across subdomains |
| `RESEND_API_KEY`, `EMAIL_FROM` | All outbound email — invites, reports, digests, trial notices |
| `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_PRICE_{STARTER,PRO,AGENCY}` | Card checkout |
| `GITHUB_TOKEN` | Raises the GitHub rate limit for star sync |
| `ADMIN_EMAILS` | **Convex-side only.** Read by `admin:bootstrap` to promote the first administrators — see below |
| `OWNER_EMAIL` | Where operator notifications are sent (defaults to `support@devrel.studio`) |
| `SENTRY_DSN`, `NEXT_PUBLIC_SENTRY_DSN` | Error reporting |
| `NEXT_PUBLIC_APP_URL`, `SITE_URL` | Absolute URLs where the origin cannot be inferred |
| `REPORT_REDIRECT_TO` | Diverts every report email to one address — useful in staging |

Convex functions read their own environment (`npx convex env set …`), which is separate from Vercel's. `MANAGER_CODE_SECRET`, `RESEND_API_KEY` and `GITHUB_TOKEN` need to be set in **both** places; `ADMIN_EMAILS` belongs on Convex only.

---

## Testing

```bash
npm test           # vitest run
npm run test:watch
npm run typecheck  # tsc --noEmit
npm run lint
```

Twenty-one suites, 505 tests, all passing. Concentrated where a mistake is expensive rather than spread evenly: access control and admin authorisation, impersonation, view-tracking correctness and write contention, metric roll-ups, retainer rate history, report scheduling across timezones, PDF rendering, CSV import, and naming rules.

---

## Deployment

**Two deployments, and they are separate.** The frontend goes to Vercel on push to `main`. Convex does **not** — it is a manual step.

```bash
# 1. Backend — schema, functions, crons
npx convex deploy

# 2. Frontend — automatic on push to main, or:
vercel --prod
```

Order matters. Deploying the frontend first means new code calling functions that do not exist yet; a route that fetches a missing query will fall back or fail until Convex catches up.

### Production checklist

1. Point `NEXT_PUBLIC_ROOT_DOMAIN` at the live domain and update every `localhost:3000` value
2. Update Kinde's callback and logout URLs, and repoint the webhook at the production Convex deployment
3. Set `MANAGER_CODE_SECRET` in **both** Vercel and Convex — the same value
4. Add a **wildcard DNS record** (`*.devrel.studio`) and a wildcard certificate, or no client subdomain resolves
5. If the apex is proxied by a CDN, make sure subdomains are not — and check the CDN's managed `robots.txt`
6. Run `npx convex deploy`

---

## Scripts

| Command | Description |
|---|---|
| `npm run dev` | Next.js dev server on :3000 |
| `npm run build` / `npm run start` | Production build and server |
| `npm test` / `npm run test:watch` | Vitest |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run lint` | ESLint |
| `npx convex dev` | Watch and push `convex/` to the dev deployment |
| `npx convex deploy` | Push schema and functions to production |
| `npx convex env set KEY value` | Set a Convex-side environment variable |

---

## License

Private. All rights reserved.

Built by [Shola Jegede](https://github.com/sholajegede).
