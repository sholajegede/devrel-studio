# PROGRESS.md — where the work is

A cold-start checkpoint. Read this first in a new Claude Code session, then
verify against the code rather than trusting it: this file records intent and
sequence, and only the repo records truth.

**Branch:** `feat/admin-revenue-and-impersonation`, top of a four-deep stack off
`feat/report-writeup-and-redirect-fix`
**Last updated:** 2026-09-03

---

## 1. In flight right now

Three pieces were committed on `feat/report-writeup-and-redirect-fix`
(2026-09-01), one commit each, in this order:

- `6c4b2fd feat: show who opened the work, and how long they stayed`
- `b02deaa feat: bill a client at the rate they were actually charged`
- `f77fdb6 feat: an admin console that settles a purchase in one transaction`

Plus `c8ff78e chore: delete the stylesheet that never loaded`, unrelated to all
three.

Those three are pushed and open as **PR #1** into `main`
(https://github.com/sholajegede/devrel-studio/pull/1), still unmerged.

Phases 3, 4 and 5 of the admin console then landed on branches stacked off that
one — **the console is finished**:

- `6b2e369 feat: an account page for the work that never had a request behind it`
  — pushed, **PR #2** (https://github.com/sholajegede/devrel-studio/pull/2)
- `35ec664 feat: workspaces measured the way the product measures them`
  — pushed, **PR #3** (https://github.com/sholajegede/devrel-studio/pull/3)
- `40b1f7c feat: see what a customer sees, without being able to touch it`

What remains is a **production deploy** — everything above runs on dev only —
plus the two production commands in §2 that were left for a human.

### A. Analytics — who reads your work  ✅ built + committed, needs prod deploy

A new `/dashboard/analytics` section showing who opens client dashboards and
the public portfolio.

| Piece | Where |
| --- | --- |
| View counting | `proxy.ts` — one hook covers **both** surfaces |
| Edge-safe hashing, bot + referrer rules | `lib/view-tracking.ts` |
| Schema | `convex/schema.ts` → `pageViews` |
| Queries + prune cron | `convex/analytics.ts`, `convex/crons.ts` |
| Ingest endpoint | `convex/http.ts` → `/track` |
| Dwell time | `components/analytics/dwell-beacon.tsx` + `app/api/track/duration` |
| UI | `app/(main)/dashboard/analytics/`, `components/dashboard/analytics/` |

**Why the proxy and not the pages:** it is the only chokepoint in front of both
the client dashboard and the portfolio, it runs before the ISR cache (so cached
portfolio hits still count), and it meant the client dashboard's own code was
never touched.

**The bug that cost an hour** — see `devrel-studio-cloudflare-apex-only` in
memory. The apex is proxied through Cloudflare (Amsterdam) while
`*.devrel.studio` goes direct to Vercel, so `x-forwarded-for` and
`x-vercel-ip-country` are both wrong on portfolio views. `callerIp` /
`callerCountry` prefer `cf-connecting-ip` / `cf-ipcountry`. Anything else in
this codebase that reads a client IP has the same trap waiting.

**Outstanding:** needs a Vercel deploy for the Cloudflare fix to take effect.
~60 fake seeded rows are in the **dev** Convex deployment (`northwind`,
`sholajegede`) — clear with
`npx convex import --table pageViews --replace <empty.jsonl> -y`.
Production `pageViews` was deliberately cleared and is empty.

### B. Retainer rate history + pauses  ✅ built + committed, needs prod deploy

`clients.monthlyRetainer` was a single number, so raising a rate retroactively
rebilled the entire engagement at the new figure.

- `clients.rateHistory[]` — complete rate timeline, oldest first
- `clients.pausePeriods[]` — stretches on hold, `to` absent while running
- `lib/retainer.ts` — `billingSegments()` walks each billing anniversary and
  charges the rate in effect that day, skipping held months
- `convex/clients.ts` — `changeRetainerRate`, `setPauseState`
- UI — `components/dashboard/rate-change-dialog.tsx`, `pause-dialog.tsx`

**The seeding subtlety:** when `rateHistory` is empty, `changeRetainerRate`
writes the *outgoing* rate in first, effective from the start date. Appending
only the new amount would make it the earliest known rate and bill all history
at it — the exact bug the timeline exists to prevent.

**Tenure and billing are separate.** `monthsBilled()` counts anniversaries
elapsed (tenure); `monthsCharged()` counts invoices. A client paused two months
is still ten months into the relationship having paid for eight.

### C. Admin console — Phases 1 and 2  ✅ built; Phase 1 deployed to prod

See §2. Phase 2 is committed and has **not** been deployed to production.

---

## 2. Admin console

Full plan (audit, findings, five phases, nine security invariants):
**https://claude.ai/code/artifact/8057ed3a-75a1-4e1f-be19-881e73f3fe69**

### Phase 1 — Foundations ✅ done, deployed to production

- `convex/model/admin.ts` — `requireAdmin(ctx, minimum)`, `writeAudit`,
  `atLeastAdmin`. Two tiers: `support` reads and approves, `owner` also
  revokes, comps, impersonates and grants admin.
- Schema — `users.adminRole`, `users.comped`, `users.by_email` index,
  `adminAuditLog` table.
- `isComped()` reads the column; the hardcoded `COMPED_USER_IDS` array survives
  only as a fallback for unmigrated deployments.
- `convex/admin.ts` — `bootstrap` (internal-only), `migrateComped`,
  `listAdmins`, `setAdminRole`, `reconcileRequests`, `findDuplicateEmails`.
- `tests/admin.test.ts` — 22 tests.

**Every admin failure returns the same `'Not found'`.** Distinguishing "not an
admin" from "no such thing" confirms to a prober that `/admin` is real and that
the only missing piece is a flag on their account.

**The guard test is verified to fail.** `tests/admin.test.ts` reads the source
of every exported function in `convex/admin.ts` and asserts it calls
`requireAdmin`. Invariant 1 is the only one whose failure is an *absent* line,
which is what a reviewer skims past. It was proven by removing a guard and
watching it fail before being restored. **If you add a function to
`convex/admin.ts`, that test covers it automatically.**

### Phase 2 — Atomic approval + queue ✅ built + committed, needs prod deploy

The bug that paid for the project: approving a purchase was two commands typed
from memory — `accessRequests:settle` to close the request, `migrations:grantAccess`
to open the window — with no key, transaction or query joining them. Run one and
forget the other and a paying customer is locked out, undetectably.

- `convex/model/access.ts` — `extendAccessWindow`, `checkMonths`,
  `requestStatusValidator`, `REQUEST_STATUSES`. The window arithmetic now has
  **one** implementation; `migrations:grantAccess` calls it too.
- `convex/admin.ts` — `approveRequest`, `declineRequest`, `listRequests`,
  `openRequestCount`, `setAdminRoleByEmail`.
- Schema — `accessRequests.status` is a union, not `v.string()`.
- Email — `email.sendAccessGranted`, scheduled after the grant commits.
- UI — `app/(main)/admin/`, `components/admin/request-actions.tsx`, plus an
  Admin link in the dashboard sidebar that only renders for an admin.
- Tests — `tests/access.test.ts` (10), plus 14 more in `tests/admin.test.ts`.

**Approve resolves the account by `request.userId`, never by email.** Two
accounts can share an address; an email lookup picks between them arbitrarily,
which grants one person's purchase to another. A test asserts the function body
contains no `by_email` lookup.

**The atomicity test is verified to fail.** Removing the
`ctx.db.patch(request._id, ...)` line from `approveRequest` was proven to turn
the suite red before it was restored.

**`setAdminRoleByEmail` is new and was not in the plan.** `bootstrap` can only
add; a typo in `ADMIN_EMAILS` that matches a real account had no way back,
because the console refuses to demote the last owner and demoting through it
requires already being one. Internal-only, same footing as `bootstrap`:

```bash
npx convex run admin:setAdminRoleByEmail '{"email":"x@y.com","role":"support"}'
npx convex run admin:setAdminRoleByEmail '{"email":"x@y.com"}'   # remove
```

**Verified in the browser**, both themes, empty and populated: the queue, the
approve dialog's expiry preview, an end-to-end approval (request → `granted`,
user → `pro` until 26 Nov, two audit rows), and the 404 a non-admin gets.

**Dev has five seeded `accessRequests`** left in place for building Phases 3–5.
One is deliberately `granted` with no access behind it, so `reconcileRequests`
on **dev** now reports one `grantedWithoutAccess` — that is the fixture, not a
regression. Production is untouched and still has zero requests. Clear the
fixture with:

```bash
npx convex import --table accessRequests --replace <empty.jsonl> -y
```

Approving one of them also gave `jegedeshola+requester@gmail.com` Pro access on
dev until 26 Nov 2026.

### Reconciliation result (production, 2026-08-26)

```
totalRequests: 0   grantedWithoutAccess: []   openWithAccess: []   unknownStatus: []
users checked: 14  duplicate emails: []
```

Clean. Zero access requests have ever been created, so the two critical
findings are real bugs that have not yet had a chance to bite. **Phase 2 needs
no data cleanup.**

### ⚠ Two commands not yet run on production

Deliberately left for a human — the first confers platform ownership, the
second touches a live account.

```bash
npx convex env set ADMIN_EMAILS "jegedeshola@gmail.com" --prod
npx convex run admin:bootstrap --prod
npx convex run admin:migrateComped --prod   # dry run found: oluwanisholajegede@gmail.com
```

Both are already done on **dev** and verified (promote → audit row → idempotent
second run).

### Phase 3 — Users, access, overview ✅ built + committed, needs prod deploy

`convex/adminUsers.ts`, `app/(main)/admin/users/`, `components/admin/user-actions.tsx`,
`lib/admin-audit.ts`, and the overview now at `/admin` (it used to redirect to
`/admin/requests`; the sidebar link points at `/admin`).

- **Search** is a range read on `by_email` plus an exact `by_handle` lookup. No
  search by name — it cannot use an index and the address is what a support
  email arrives from.
- **Grant** is support-level (the same act as approving a request, for a
  purchase that skipped the form). **Revoke and comp are owner-only**, and
  revoke demands a reason: that row is what gets read back in a dispute.
- **`revokedPatch`** in `model/access.ts` is the one definition of revoked, used
  by the console and by `migrations:revokeAccess`.
- **The raw `accessUntil` column** is what the grant preview and the "removing
  this comp locks them out" warning read. `accessOf` reports no expiry for every
  comped account, so the effective date would fire that warning on all of them.
- **Invariant 1 now discovers `convex/admin*.ts`** rather than reading a list, so
  a new admin module is covered the moment it exists. Three failures were proven
  by breaking the code, not assumed.

Verified in the browser on dev, both themes: search, the account page, a grant
and its revoke, each landing in the history panel and the overview feed.

### Phase 4 — Workspaces, abuse, audit ✅ built + committed, needs prod deploy

`convex/adminWorkspaces.ts`, `app/(main)/admin/{workspaces,abuse,audit}/`.

- **Usage is counted by workspace against the owner's plan**, which is how every
  limit in the product is enforced (`clients:createClient`,
  `content:createContent`). Counting `by_user` answers a different question and
  disagrees with the customer's own gate. Phase 3's account page was doing that
  and now matches — and compares **per workspace** rather than summing first.
- **Over-limit is not abuse.** A Pro workspace whose access lapses to the trial
  is instantly over; the product blocks writes and deletes nothing. Dev has two
  real ones.
- **`migrations:clearAccessAttempts` is retired** for
  `adminWorkspaces:clearLockout`. The per-caller rows and the `*` whole-dashboard
  ceiling are now separate decisions — the second needs an explicit checkbox, and
  a lift that would only touch it refuses instead of reporting a no-op.
- **The audit reader** is support-level, filters from what the table holds rather
  than the `AuditAction` union, and pages by timestamp.

Verified on dev with a genuine lockout driven through `redeemAccessCode`.

### Phase 5 — Revenue and impersonation ✅ built + committed, needs prod deploy

`convex/adminRevenue.ts`, `convex/adminImpersonate.ts`,
`app/(main)/admin/revenue/`, `components/admin/impersonation-banner.tsx`.

**The impersonation design is the thing to understand before touching
`model/auth.ts` again.** The identity swap lives in `getCurrentUser` — the
function every user-facing query already resolves through:

- The session is a **row keyed to the signed-in admin**, never an argument.
  Nothing the browser sends decides whose data comes back.
- `getCurrentUser` **refuses in a mutation context**, detected by whether
  `ctx.db` carries a writer. Read-only is structural, so a mutation written next
  year is covered without anybody remembering. Proven in the browser:
  `users:updateUser` refused a save it knows nothing about.
- **Admin checks use `getRealUser`**, so authority is never borrowed and ending a
  session never needs the account you are wearing. `end` is support-level while
  `start` is owner-only, deliberately.
- Sessions last **30 minutes**, expire on read, one at a time.
- **Non-admins short-circuit** before the new table is touched — the change is
  inert for every account that cannot impersonate.
- `sync:syncMyStats` is an **action** and resolves its own identity, so it checks
  `adminImpersonate.activeForKindeId` separately. Any future action needs the
  same check; the choke point cannot see it.

**Revenue is deliberately modest.** `accessRequests.amount` is the only number
anybody typed as money, so hand grants carry none and the page names that gap.
Currencies are never converted.

### The console is done

Phases 1–5 are all built. What is left is not more phases:

1. **Deploy the stack to production** — `npx convex deploy --prod`, then Vercel.
2. **The two owner commands** in §2, still waiting on a human.
3. **Merge the stack**: PRs #1 → #2 → #3 → #4.

If a sixth phase is ever wanted, the obvious candidates are an admin-only view of
a client dashboard (the analytics section already knows who read what), and
moving the console to `admin.devrel.studio` — the subdomain is reserved in
`lib/naming.ts`, but doing it properly means deciding whether admin gets its own
Kinde login, because sharing the session cookie across hosts gives up the
isolation that is the only reason to move.

---

## 3. Things that will bite a fresh session

- **Two Convex deployments.** `.env.local` points at **dev**
  (`sensible-parakeet-879`). Real data is **prod** (`shiny-guineapig-726`).
  Every CLI command needs `--prod` to touch production.
- **One stylesheet.** `app/globals.css`. Tailwind v4 with no `@config`, so
  `tailwind.config.ts` is **inert**. A duplicate `styles/globals.css` used to
  exist and was deleted — CSS written there did nothing.
- **`demo` is a reserved subdomain** (`lib/naming.ts`), so `demo.devrel.studio`
  404s at the proxy before any client lookup.
- **Look at UI before calling it done.** Render it, check both themes and both
  the empty and populated states, and copy the page shell from a sibling:
  `<main className="px-6 lg:px-10 py-8 max-w-400">`, an `h1` with a one-line
  subtitle, actions right, `<RoleNotice />` at the top.

## 4. Verify the tree is healthy

```bash
npx tsc --noEmit          # expect silence
npx vitest run            # expect 317 passing
npm run build             # expect Compiled successfully
```
