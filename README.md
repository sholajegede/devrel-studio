# DevRel Studio

**The command centre for developer advocates who manage content for clients.**

DevRel Studio is a full-stack SaaS platform that lets developer advocates log every piece of content they produce, track live performance metrics across all channels, and share a beautiful, read-only performance dashboard with each client — no exports, no slide decks, no chasing data.

---

## Table of Contents

- [Overview](#overview)
- [Features](#features)
- [Tech Stack](#tech-stack)
- [Project Structure](#project-structure)
- [Routes](#routes)
- [Data Model](#data-model)
- [Getting Started](#getting-started)
- [Environment Variables](#environment-variables)
- [Convex Backend](#convex-backend)
- [Authentication](#authentication)
- [Content Categories](#content-categories)
- [Pricing Model](#pricing-model)
- [Deployment](#deployment)

---

## Overview

Developer advocates who work as freelancers or consultants face a recurring problem: their clients rarely have visibility into the work being done on their behalf. Monthly PDFs and shared spreadsheets are slow, hard to maintain, and easy to ignore.

DevRel Studio solves this with a two-sided dashboard:

- **Admin dashboard** — the advocate logs content, updates metrics, and manages clients from a private workspace.
- **Client dashboard** — a live, read-only performance page at a unique URL (e.g. `devrel.studio/kinde`) that the client can check any time without logging in.

Everything updates in real time via Convex's reactive backend. No polling, no manual refreshes.

---

## Features

### Admin Dashboard
- **Overview** — live stat counters (Published, In Progress, Views, Downloads, Attendees), a monthly bar chart (published vs in-progress over the last 6 months), and a month-by-month content list with category and status filters
- **All Content** — searchable, filterable table of every content entry across all clients and time periods; supports keyword search, category, status, platform, and client filters; CSV export
- **Add / Edit Entries** — full-featured form that adapts to the selected category; supports reshares (cross-platform promotion log), tags, UTM tracking links, and category-specific metrics
- **Client Management** — full CRUD for client engagements: contact details, retainer amount and currency, contract type, start/end dates, status (Active/Paused/Ended), notes, and an auto-generated dashboard slug
- **Members** — invite team members by email and assign roles (Admin, Editor, Viewer)
- **Billing** — plan overview, one-time fee upgrade paths (Starter/Pro/Agency), license and receipt storage, FAQ accordion
- **Settings** — profile management wired to Convex; account deletion; preferences

### Client Dashboard
- Publicly accessible at `/{slug}` — no login required
- Live stat cards: Published, In Progress, Views, Downloads, Attendees
- Content table with category badges, platform, status, metrics, and direct links
- Expandable reshare history per entry
- Month and category filters
- UTM tracking link display per entry

### Marketing Site
- Landing page with hero, Before/After, features, content categories, how-it-works, testimonials, FAQ accordion, CTA
- Continuous-scroll social proof marquee (11 brand logos)
- Dedicated pricing page with plan comparison table and FAQ
- Sign-in and sign-up pages with Kinde auth integration
- Waitlist page backed by Convex

### Onboarding
- Context-aware guided tour on every dashboard page (Overview, All Content, Clients, Members, Billing, Settings, Add Entry)
- Each tour is stored in `localStorage` and auto-starts once per page; restartable via the Tour button
- Keyboard navigation (← → arrow keys, Esc to close)
- Spotlight highlight on targeted elements

---

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | [Next.js 16](https://nextjs.org) — App Router |
| Language | TypeScript 5 |
| Styling | [Tailwind CSS v4](https://tailwindcss.com) |
| UI Components | [shadcn/ui](https://ui.shadcn.com) (Radix UI primitives) |
| Charts | [Recharts](https://recharts.org) v2 via shadcn `ChartContainer` |
| Backend / Database | [Convex](https://convex.dev) v1.31 — real-time reactive queries and mutations |
| Authentication | [Kinde](https://kinde.com) (`@kinde-oss/kinde-auth-nextjs` v2) |
| Notifications | [Sonner](https://sonner.emilkowal.ski) |
| Icons | [Lucide React](https://lucide.dev) |
| Analytics | [Vercel Analytics](https://vercel.com/analytics) |
| Runtime | Node.js / Vercel Edge |

---

## Project Structure

```
devrelstudio/
├── app/
│   ├── (main)/
│   │   └── dashboard/          # Protected admin workspace
│   │       ├── layout.tsx       # Wraps all dashboard pages in UserProvider + sidebar
│   │       ├── page.tsx         # Overview (stats, chart, monthly content)
│   │       ├── add/             # Add content entry
│   │       ├── edit/[id]/       # Edit content entry
│   │       ├── content/         # All Content table
│   │       ├── clients/         # Client management CRUD
│   │       ├── members/         # Team members & invites
│   │       ├── billing/         # Plan, receipts, FAQ
│   │       └── settings/        # Profile, preferences, danger zone
│   ├── (subdomain)/
│   │   └── [subdomain]/         # Public client performance dashboard
│   ├── api/
│   │   └── auth/[kindeAuth]/    # Kinde auth handler (GET = handleAuth)
│   ├── sign-in/                 # Custom branded sign-in page
│   ├── sign-up/                 # Custom branded sign-up page
│   ├── pricing/                 # Dedicated pricing page
│   ├── waitlist/                # Waitlist signup (Convex-backed)
│   ├── page.tsx                 # Landing page
│   ├── layout.tsx               # Root layout (ConvexProvider, fonts)
│   └── globals.css              # Tailwind v4 imports + custom animations
│
├── components/
│   ├── dashboard/
│   │   ├── sidebar.tsx          # Fixed desktop sidebar + mobile drawer
│   │   ├── content-form.tsx     # Add/edit form (category-adaptive)
│   │   └── header.tsx           # Legacy dashboard header
│   ├── marketing/
│   │   ├── nav.tsx              # Shared sticky nav (all marketing pages)
│   │   └── footer.tsx           # Shared dark footer
│   ├── admin-onboarding-tour/
│   │   └── index.tsx            # Guided tour engine (all 7 variants)
│   ├── onboarding-tour/         # Client dashboard tour
│   └── ui/                      # shadcn/ui component library
│
├── convex/
│   ├── schema.ts                # Database schema (users, contentEntries, clients, waitlist)
│   ├── users.ts                 # User CRUD (Kinde webhook handlers + public queries)
│   ├── content.ts               # Content entry queries, mutations, seeder
│   ├── clients.ts               # Client management queries and mutations
│   ├── waitlist.ts              # Waitlist mutations
│   ├── http.ts                  # HTTP action endpoints (Kinde webhooks)
│   └── auth.config.ts           # Convex ↔ Kinde JWKS configuration
│
├── contexts/
│   └── user-context.tsx         # UserProvider — Kinde + Convex profile bridge
│
├── lib/
│   ├── types.ts                 # Categories, platforms, subtypes, shared types
│   └── utils.ts                 # cn() and other helpers
│
└── public/
    ├── images/                  # Dashboard screenshot, logo
    └── assets/logos/            # Social proof brand logos (SVG + PNG)
```

---

## Routes

### Public
| Route | Description |
|---|---|
| `/` | Landing page |
| `/pricing` | Dedicated pricing page with plan comparison table |
| `/sign-in` | Branded sign-in page → Kinde auth |
| `/sign-up` | Branded sign-up page → Kinde registration |
| `/waitlist` | Waitlist form (stored in Convex) |
| `/{slug}` | Client-facing performance dashboard (no login required) |

### Protected (requires Kinde session)
| Route | Description |
|---|---|
| `/dashboard` | Overview — stats, bar chart, monthly content view |
| `/dashboard/content` | All Content — search, filter, CSV export |
| `/dashboard/add` | Add a new content entry |
| `/dashboard/edit/[id]` | Edit an existing entry |
| `/dashboard/clients` | Client management — CRUD with retainer tracking |
| `/dashboard/members` | Team members and invitations |
| `/dashboard/billing` | Plan, upgrade, receipts |
| `/dashboard/settings` | Profile (Convex-wired), preferences, account deletion |

### API
| Route | Description |
|---|---|
| `/api/auth/[kindeAuth]` | Kinde auth handler — login, logout, register, callback |

---

## Data Model

### `users`
Synced from Kinde via webhook on every login/register event.

| Field | Type | Notes |
|---|---|---|
| `kindeId` | `string` | Kinde user identifier |
| `email` | `string` | |
| `firstName` | `string?` | |
| `lastName` | `string?` | |
| `imageUrl` | `string?` | Profile photo URL |
| `imageStorageId` | `Id<"_storage">?` | Convex file storage reference |

### `contentEntries`
The core of the platform. One row per piece of content.

| Field | Type | Notes |
|---|---|---|
| `userId` | `Id<"users">` | Owner |
| `client` | `string` | Matches a client slug |
| `category` | `Written \| Video \| Event \| Podcast \| Package` | |
| `title` | `string` | |
| `link` | `string` | Live URL of the content |
| `trackingLink` | `string` | UTM or bit.ly link |
| `platform` | `string` | e.g. Dev.to, YouTube, npm |
| `publicationDate` | `string` | ISO date |
| `status` | `Published \| Draft \| Waiting Approval \| Scheduled` | |
| `views` | `number?` | Written / Video |
| `downloads` | `number?` | Package / Podcast |
| `weeklyDownloads` | `number?` | npm weekly |
| `attendees` | `number?` | Event |
| `packageName` | `string?` | e.g. `@convex-dev/rate-limiter` |
| `eventName` | `string?` | Conference / meetup name |
| `eventLocation` | `string?` | City or venue |
| `podcastName` | `string?` | Show name |
| `reshares` | `Array<{platform, link, date}>?` | Cross-platform promotion log |
| `tags` | `string[]` | |
| `contentType` | `string` | Sub-type (Tutorial, Demo, etc.) |
| `notes` | `string` | Internal notes |
| `updatedAt` | `string` | ISO timestamp |

Indexes: `by_publication_date`, `by_client`, `by_status`, `by_category`

### `clients`
Client engagements owned by a user.

| Field | Type | Notes |
|---|---|---|
| `userId` | `Id<"users">` | Owner |
| `name` | `string` | Contact person name |
| `company` | `string` | Company name |
| `email` | `string?` | |
| `website` | `string?` | |
| `monthlyRetainer` | `number?` | |
| `currency` | `string?` | USD, EUR, GBP, NGN, CAD, AUD |
| `startDate` | `string?` | ISO date |
| `endDate` | `string?` | ISO date |
| `status` | `Active \| Paused \| Ended` | |
| `contractType` | `Retainer \| Project \| Hourly?` | |
| `notes` | `string?` | |
| `slug` | `string?` | Auto-generated from company name; used in dashboard URL and content entries |

Indexes: `by_user`, `by_status`

### `waitlist`
| Field | Type |
|---|---|
| `email` | `string` |
| `name` | `string?` |
| `company` | `string?` |
| `role` | `string?` |
| `useCase` | `string?` |

---

## Getting Started

### Prerequisites

- Node.js 20+
- A [Convex](https://convex.dev) account and project
- A [Kinde](https://kinde.com) account and application

### 1. Clone and install

```bash
git clone <your-repo-url> devrelstudio
cd devrelstudio
npm install
```

### 2. Set up Convex

```bash
npx convex dev
```

This will prompt you to log in to Convex and link a project. It writes `CONVEX_DEPLOYMENT` and `NEXT_PUBLIC_CONVEX_URL` to `.env.local` automatically and starts watching your `convex/` directory for schema changes.

### 3. Configure Kinde

1. Create an application in the [Kinde dashboard](https://app.kinde.com)
2. Set the **Allowed callback URLs** to `http://localhost:3000/api/auth/kinde_callback`
3. Set the **Allowed logout redirect URLs** to `http://localhost:3000`
4. Copy your credentials into `.env.local` (see [Environment Variables](#environment-variables))

### 4. Configure Kinde webhooks for Convex user sync

In your Kinde dashboard, add a webhook pointing to your Convex HTTP endpoint:

```
https://<your-convex-deployment>.convex.site/api/webhooks/kinde
```

Subscribe to: `user.created`, `user.updated`

This keeps the Convex `users` table in sync with Kinde whenever someone signs up or updates their profile.

### 5. Create `.env.local`

```bash
cp .env.example .env.local
# then fill in your values (see Environment Variables below)
```

### 6. Start the development server

```bash
# Terminal 1 — Convex backend
npx convex dev

# Terminal 2 — Next.js frontend
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

---

## Environment Variables

| Variable | Required | Description |
|---|---|---|
| `CONVEX_DEPLOYMENT` | ✅ | Set automatically by `npx convex dev` |
| `NEXT_PUBLIC_CONVEX_URL` | ✅ | Convex deployment URL |
| `NEXT_PUBLIC_CONVEX_HTTP_URL` | ✅ | Convex HTTP actions URL |
| `KINDE_CLIENT_ID` | ✅ | From your Kinde application |
| `KINDE_CLIENT_SECRET` | ✅ | From your Kinde application |
| `KINDE_ISSUER_URL` | ✅ | e.g. `https://yourapp.kinde.com` |
| `KINDE_SITE_URL` | ✅ | e.g. `http://localhost:3000` |
| `KINDE_POST_LOGIN_REDIRECT_URL` | ✅ | e.g. `http://localhost:3000/dashboard` |
| `KINDE_POST_LOGOUT_REDIRECT_URL` | ✅ | e.g. `http://localhost:3000` |

For production, replace all `localhost:3000` values with your live domain.

---

## Convex Backend

All server-side logic lives in `convex/`. Convex handles queries, mutations, and real-time subscriptions without a separate API layer.

```
convex/
├── schema.ts        # Table definitions and indexes
├── users.ts         # createUserKinde, updateUserKinde, getUserByKindeId, deleteUser, …
├── content.ts       # getAllContent, getContentByClient, createEntry, updateEntry, deleteEntry, seedDemoData
├── clients.ts       # getClients, getActiveClients, createClient, updateClient, deleteClient
├── waitlist.ts      # joinWaitlist
├── http.ts          # HTTP actions — Kinde webhook handler (/api/webhooks/kinde)
└── auth.config.ts   # JWKS domain config for Convex ↔ Kinde token verification
```

**Key patterns:**
- `internalMutation` / `internalQuery` functions are used for webhook handlers (not callable from the browser)
- Public `query` functions are used for real-time reactive data in the client
- All queries are optimistic — the UI updates immediately before the server confirms

---

## Authentication

Authentication is handled entirely by [Kinde](https://kinde.com). The integration works as follows:

1. **Sign-in / Sign-up pages** (`/sign-in`, `/sign-up`) use `LoginLink` and `RegisterLink` from `@kinde-oss/kinde-auth-nextjs` to redirect users to Kinde's hosted auth flow.
2. Kinde calls back to `/api/auth/kinde_callback`, which is handled by `handleAuth()` from the Kinde Next.js SDK.
3. On successful auth, Kinde fires a webhook to the Convex HTTP endpoint, which creates or updates the user record in the `users` table.
4. The `UserProvider` context (`contexts/user-context.tsx`) reads the Kinde session client-side via `useKindeBrowserClient` and cross-references it with the Convex `users` table to expose a `profile` object to all dashboard pages.
5. If a user is authenticated in Kinde but not yet in Convex (race condition on first login), the context redirects to `/` until the webhook completes.

**Logout** uses `LogoutLink` from `@kinde-oss/kinde-auth-nextjs` which clears the Kinde session and redirects to `KINDE_POST_LOGOUT_REDIRECT_URL`.

---

## Content Categories

DevRel Studio tracks five content categories, each with its own set of platforms, sub-types, and metric fields:

| Category | Platforms | Key Metric | Sub-types |
|---|---|---|---|
| **Written** | Dev.to, freeCodeCamp, Medium, Hashnode, LinkedIn, Newsletter, Blog, Docs, Twitter/X | Views | Tutorial, Guide, Reference Doc, Blog Post, Case Study, Opinion |
| **Video** | YouTube, Loom, Vimeo, TikTok | Views | Tutorial, Demo, Conference Talk, Interview |
| **Event** | Free-text (conference names vary) | Attendees | Conference Talk, Workshop, Meetup, Panel, Keynote |
| **Podcast** | Spotify, Apple Podcasts, YouTube Podcasts | Downloads / Listeners | Guest Appearance, Host, Solo Episode |
| **Package** | npm, GitHub | Downloads + Weekly Downloads | Convex Component, Library, CLI Tool |

Every entry also supports:
- **Reshares** — log every platform where the piece was cross-promoted (LinkedIn, Twitter/X, Reddit, Hacker News, Dev.to, etc.)
- **UTM tracking link** — separate from the canonical URL
- **Tags** — free-form, with suggested tags per category
- **Status** — Published, Draft, Waiting Approval, Scheduled

---

## Pricing Model

DevRel Studio uses a **one-time fee** model — no subscriptions, no recurring charges.

| Plan | Price | Client Workspaces | Team Seats |
|---|---|---|---|
| **Starter** | $49 | 1 | 1 |
| **Pro** | $149 | Up to 5 | 1 |
| **Agency** | $349 | Unlimited | Up to 5 |

**Upgrade pricing:** You pay only the price difference (Starter → Pro = $100, Pro → Agency = $200).

**Free Trial:** 1 workspace, up to 10 content entries, unlimited time. No credit card required.

**Refund policy:** Full refund within 14 days of purchase.

---

## Deployment

### Vercel (recommended)

```bash
# Push to GitHub, then connect the repo in the Vercel dashboard
# Add all environment variables in the Vercel project settings
# Convex auto-deploys when you run:
npx convex deploy
```

### Required production steps

1. Update all `localhost:3000` env vars to your production domain
2. Update the Kinde application's allowed callback and logout URLs to your production domain
3. Update the Kinde webhook URL to your production Convex HTTP URL
4. Run `npx convex deploy` to push your schema and functions to the production Convex deployment

### Build

```bash
npm run build
npm run start
```

---

## Scripts

| Command | Description |
|---|---|
| `npm run dev` | Start Next.js development server on port 3000 |
| `npm run build` | Production build |
| `npm run start` | Start production server |
| `npm run lint` | ESLint |
| `npx convex dev` | Start Convex dev server (watches `convex/` for changes) |
| `npx convex deploy` | Deploy Convex schema and functions to production |

---

## License

Private. All rights reserved.

Built by [Shola Jegede](https://github.com/sholajegede).
