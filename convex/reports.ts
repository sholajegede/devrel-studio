import { ConvexError, v } from 'convex/values'
import { internal } from './_generated/api'
import { internalAction, internalQuery, mutation, query } from './_generated/server'
import { getCurrentWorkspace } from './model/workspaces'
import { enforceRateLimit } from './model/rateLimit'

// ── Monthly report notifications ──────────────────────────────────────────────
//
// Deliberately not a Node action: Convex only allows actions in a 'use node'
// module, and this file needs a query alongside its action. The email senders
// it calls are the Node ones, which is where fetch actually happens.
//
// The report itself has always been live at the client's dashboard URL. What
// was missing was the nudge: without it a client only looks when they remember
// to, which is the habit this product exists to replace.
//
// Sent on the 1st for the month that just closed. A client with nothing
// published that month is skipped — "0 pieces published" is a worse message
// than no message.

/** Clients that should receive a report for `month` (YYYY-MM), with their counts. */
export const clientsDueAReport = internalQuery({
  args: { month: v.string() },
  handler: async (ctx, args) => {
    const clients = await ctx.db.query('clients').collect()

    const due: {
      clientId: string
      email: string
      clientName: string
      slug: string
      publishedCount: number
    }[] = []

    for (const client of clients) {
      // No email means nobody to notify; no slug means no dashboard to link to.
      if (!client.email || !client.slug) continue
      if (client.status !== 'Active') continue
      // The seeded demo is a marketing surface, not an engagement. It has an
      // address and published entries, so without this it would be mailed a
      // monthly report like a paying client.
      if (client.slug === 'demo') continue

      const entries = client.workspaceId
        ? await ctx.db
            .query('contentEntries')
            .withIndex('by_workspace_and_client', (q) =>
              q.eq('workspaceId', client.workspaceId).eq('client', client.slug!),
            )
            .collect()
        : await ctx.db
            .query('contentEntries')
            .withIndex('by_user_and_client', (q) =>
              q.eq('userId', client.userId).eq('client', client.slug!),
            )
            .collect()

      const publishedCount = entries.filter(
        (entry) =>
          entry.status === 'Published' &&
          entry.publicationDate?.startsWith(args.month),
      ).length

      if (publishedCount === 0) continue

      due.push({
        clientId: client._id,
        email: client.email,
        clientName: client.company || client.name,
        slug: client.slug,
        publishedCount,
      })
    }

    return due
  },
})

/** The month that just ended, as YYYY-MM. */
function lastMonth(now: Date): string {
  const year = now.getUTCFullYear()
  const month = now.getUTCMonth() // 0-indexed, so this is already last month
  return month === 0
    ? `${year - 1}-12`
    : `${year}-${String(month).padStart(2, '0')}`
}

/** Shared with the report email — "2026-07" reads badly in a subject line. */
function periodName(period: string): string {
  return monthLabel(period)
}

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
]

/**
 * Long form for the email subject — "July 2026".
 *
 * Spelled out rather than going through `toLocaleDateString`, which drags in a
 * timezone and a locale to render a string that is already unambiguous.
 */
function monthLabel(key: string): string {
  const [year, month] = key.split('-').map(Number)
  return `${MONTH_NAMES[month - 1]} ${year}`
}

/**
 * Where reports actually go.
 *
 * While the wording and cadence are still being judged, every report is sent to
 * this address instead of the client's. Deliberately an override rather than a
 * disabled cron: the job still runs on its real schedule against real data, so
 * what arrives is exactly what a client would have received — which is the only
 * way to review it honestly.
 *
 * Clear it to start sending to clients:
 *   npx convex env remove REPORT_REDIRECT_TO --prod
 */
function redirectTarget(): string | null {
  const target = process.env.REPORT_REDIRECT_TO?.trim()
  return target && target.includes('@') ? target : null
}

/**
 * Render the report to a PDF by asking the Next.js route that already does it.
 *
 * @react-pdf/renderer cannot run inside Convex, and maintaining a second
 * renderer here would mean the attached PDF could drift from the one the
 * download button produces. One renderer, two callers.
 *
 * Returns null on any failure. A report email without an attachment is worse
 * than one with; an email that never arrives because a PDF would not render is
 * far worse than both.
 */
async function buildReportPdf(slug: string, month: string): Promise<string | null> {
  const origin = process.env.SITE_URL
  if (!origin) return null

  try {
    const response = await fetch(`${origin}/api/export-report`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ slug, month, source: 'cron' }),
    })

    if (!response.ok) {
      console.error(`[reports] pdf render failed for ${slug} ${month}:`, response.status)
      return null
    }

    const bytes = new Uint8Array(await response.arrayBuffer())

    // btoa needs a binary string, and spreading a multi-megabyte array into
    // String.fromCharCode blows the call stack — hence the chunking.
    let binary = ''
    const CHUNK = 8192
    for (let i = 0; i < bytes.length; i += CHUNK) {
      binary += String.fromCharCode(...bytes.subarray(i, i + CHUNK))
    }

    return btoa(binary)
  } catch (error) {
    console.error(`[reports] pdf render errored for ${slug} ${month}:`, error)
    return null
  }
}

export const sendMonthlyReports = internalAction({
  args: { month: v.optional(v.string()) },
  handler: async (ctx, args): Promise<{
    month: string
    sent: number
    failed: number
    redirectedTo: string | null
  }> => {
    const month = args.month ?? lastMonth(new Date())

    const due = await ctx.runQuery(internal.reports.clientsDueAReport, { month })

    const root = process.env.SITE_URL?.replace(/^https?:\/\//, '') ?? 'devrel.studio'
    const redirect = redirectTarget()

    let sent = 0
    let failed = 0

    for (const client of due) {
      const pdf = await buildReportPdf(client.slug, month)

      const result = await ctx.runAction(internal.email.sendMonthlyReportReady, {
        email: redirect ?? client.email,
        ...(pdf ? { pdfBase64: pdf, pdfFilename: `${client.slug}-report-${month}.pdf` } : {}),
        clientName: client.clientName,
        period: monthLabel(month),
        publishedCount: client.publishedCount,
        // Deep-linked to the period the email is about, so the reader lands on
        // that report rather than on a dashboard they have to filter.
        dashboardUrl: `https://${client.slug}.${root}/report?month=${month}`,
      })

      // One provider failure must not stop the rest of the run.
      if (result.ok) sent++
      else failed++
    }

    console.log(
      `[reports] ${month}: ${sent} sent, ${failed} failed, ${due.length} due` +
        (redirect ? ` — all redirected to ${redirect}` : ''),
    )

    return { month, sent, failed, redirectedTo: redirect }
  },
})

// ── The report page ───────────────────────────────────────────────────────────
//
// ⚠ PUBLIC — unauthenticated, like the client dashboard it sits alongside. The
// access-code gate in app/(subdomain)/[subdomain]/layout.tsx is what decides
// whether a visitor reaches this at all.

/**
 * Everything the monthly report renders, for one client and one period.
 *
 * Assembled here rather than filtered in the browser so the page has a single
 * await and the PDF can be built from exactly the same payload — a report whose
 * printed version disagrees with the page is worse than no report.
 */
export const getReport = query({
  args: { slug: v.string(), period: v.string() },
  handler: async (ctx, args) => {
    const slug = args.slug.trim().toLowerCase()

    const client = await ctx.db
      .query('clients')
      .withIndex('by_slug', (q) => q.eq('slug', slug))
      .first()

    if (!client) return null

    const entries = client.workspaceId
      ? await ctx.db
          .query('contentEntries')
          .withIndex('by_workspace_and_client', (q) =>
            q.eq('workspaceId', client.workspaceId).eq('client', slug),
          )
          .collect()
      : await ctx.db
          .query('contentEntries')
          .withIndex('by_user_and_client', (q) =>
            q.eq('userId', client.userId).eq('client', slug),
          )
          .collect()

    // Notes and tracking links are internal. This goes to the client, so the
    // payload is built by hand rather than by spreading the document.
    const visible = entries.map((entry) => ({
      id: entry._id,
      category: entry.category,
      title: entry.title,
      link: entry.link,
      platform: entry.platform,
      contentType: entry.contentType,
      publicationDate: entry.publicationDate,
      status: entry.status,
      views: entry.views,
      downloads: entry.downloads,
      weeklyDownloads: entry.weeklyDownloads,
      attendees: entry.attendees,
      stars: entry.stars,
      packageName: entry.packageName,
      eventName: entry.eventName,
      eventLocation: entry.eventLocation,
      podcastName: entry.podcastName,
      repoUrl: entry.repoUrl,
      stack: entry.stack,
      tags: entry.tags,
      reshares: entry.reshares ?? [],
    }))

    const feedback = await ctx.db
      .query('reportFeedback')
      .withIndex('by_slug_and_period', (q) =>
        q.eq('slug', slug).eq('period', args.period),
      )
      .collect()

    return {
      client: {
        id: client._id,
        name: client.company || client.name,
        contact: client.name,
        website: client.website,
        slug,
      },
      period: args.period,
      entries: visible,
      feedback: feedback
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
        .map((item) => ({
          id: item._id,
          rating: item.rating,
          comment: item.comment,
          authorName: item.authorName,
          createdAt: item.createdAt,
        })),
    }
  },
})

/**
 * ⚠ PUBLIC — the person leaving feedback is a client manager with no account.
 *
 * Rate limiting is deliberately absent: reaching this at all requires getting
 * past the access-code gate, and the worst case is a client leaving several
 * comments, which is not an attack. Length is capped so a single submission
 * cannot be used to store arbitrary data.
 */
export const submitFeedback = mutation({
  args: {
    slug: v.string(),
    period: v.string(),
    comment: v.string(),
    rating: v.optional(v.number()),
    authorName: v.optional(v.string()),
    /** Hashed in the Next.js layer; Convex never sees a raw address. */
    ipHash: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const slug = args.slug.trim().toLowerCase()
    const comment = args.comment.trim().slice(0, 2000)

    // Generous — a client leaving several considered comments is normal, and
    // this exists to stop a script, not a person.
    await enforceRateLimit(
      ctx,
      'feedback',
      args.ipHash ?? 'unknown',
      20,
      'That is a lot of feedback in one hour. Try again shortly.',
    )

    if (!comment) throw new ConvexError('Write something before sending')

    const client = await ctx.db
      .query('clients')
      .withIndex('by_slug', (q) => q.eq('slug', slug))
      .first()

    if (!client) throw new ConvexError('That dashboard does not exist')

    const rating =
      typeof args.rating === 'number' && args.rating >= 1 && args.rating <= 5
        ? Math.round(args.rating)
        : undefined

    await ctx.db.insert('reportFeedback', {
      clientId: client._id,
      slug,
      period: args.period,
      rating,
      comment,
      authorName: args.authorName?.trim().slice(0, 80) || undefined,
      createdAt: new Date().toISOString(),
    })

    // Tell the person it was written for. Scheduled, not awaited: a client
    // should never see their feedback fail to save because a mail provider
    // was briefly unreachable.
    const owner = await ctx.db.get(client.userId)
    if (owner?.email) {
      const root = process.env.SITE_URL?.replace(/^https?:\/\//, '') ?? 'devrel.studio'
      await ctx.scheduler.runAfter(0, internal.email.sendFeedbackNotification, {
        email: owner.email,
        clientName: client.company || client.name,
        period: periodName(args.period),
        comment,
        authorName: args.authorName?.trim().slice(0, 80) || undefined,
        rating,
        reportUrl: `https://${slug}.${root}/report?month=${args.period}`,
      })
    }

    return { ok: true }
  },
})

// ── Feedback, from the DevRel's side ──────────────────────────────────────────

/**
 * Every piece of client feedback across the caller's workspace, newest first.
 *
 * The form on the report was shipped without this, so feedback went into a void:
 * a client could reply and the person it was meant for would never learn of it.
 */
export const listFeedback = query({
  args: { limit: v.optional(v.number()) },
  handler: async (ctx, args) => {
    const context = await getCurrentWorkspace(ctx)
    if (!context) return []

    const clients = await ctx.db
      .query('clients')
      .withIndex('by_workspace', (q) => q.eq('workspaceId', context.workspaceId))
      .collect()

    const byId = new Map(clients.map((client) => [client._id, client]))

    const feedback = (
      await Promise.all(
        clients.map((client) =>
          ctx.db
            .query('reportFeedback')
            .withIndex('by_client', (q) => q.eq('clientId', client._id))
            .collect(),
        ),
      )
    ).flat()

    return feedback
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .slice(0, args.limit ?? 50)
      .map((item) => {
        const client = byId.get(item.clientId)
        return {
          id: item._id,
          clientName: client ? client.company || client.name : 'Unknown client',
          slug: item.slug,
          period: item.period,
          rating: item.rating,
          comment: item.comment,
          authorName: item.authorName,
          createdAt: item.createdAt,
        }
      })
  },
})

/** How many pieces of feedback have arrived — drives the sidebar indicator. */
export const feedbackCount = query({
  args: {},
  handler: async (ctx) => {
    const context = await getCurrentWorkspace(ctx)
    if (!context) return 0

    const clients = await ctx.db
      .query('clients')
      .withIndex('by_workspace', (q) => q.eq('workspaceId', context.workspaceId))
      .collect()

    const counts = await Promise.all(
      clients.map(async (client) =>
        (
          await ctx.db
            .query('reportFeedback')
            .withIndex('by_client', (q) => q.eq('clientId', client._id))
            .collect()
        ).length,
      ),
    )

    return counts.reduce((sum, n) => sum + n, 0)
  },
})

/**
 * Every period this client has published work in, newest first.
 *
 * ⚠ PUBLIC — same gate as the report itself. Powers the archive: a client who
 * loses the email should still be able to find last quarter's report.
 */
export const listReportPeriods = query({
  args: { slug: v.string() },
  handler: async (ctx, args) => {
    const slug = args.slug.trim().toLowerCase()

    const client = await ctx.db
      .query('clients')
      .withIndex('by_slug', (q) => q.eq('slug', slug))
      .first()

    if (!client) return null

    const entries = client.workspaceId
      ? await ctx.db
          .query('contentEntries')
          .withIndex('by_workspace_and_client', (q) =>
            q.eq('workspaceId', client.workspaceId).eq('client', slug),
          )
          .collect()
      : await ctx.db
          .query('contentEntries')
          .withIndex('by_user_and_client', (q) =>
            q.eq('userId', client.userId).eq('client', slug),
          )
          .collect()

    const byPeriod = new Map<string, { published: number; reach: number }>()

    for (const entry of entries) {
      if (entry.status !== 'Published') continue
      const period = entry.publicationDate?.slice(0, 7)
      if (!period || period.length !== 7) continue

      const current = byPeriod.get(period) ?? { published: 0, reach: 0 }
      current.published++
      current.reach +=
        (entry.views ?? 0) + (entry.attendees ?? 0) + (entry.downloads ?? 0)
      byPeriod.set(period, current)
    }

    return {
      clientName: client.company || client.name,
      periods: [...byPeriod.entries()]
        .map(([period, stats]) => ({ period, ...stats }))
        .sort((a, b) => b.period.localeCompare(a.period)),
    }
  },
})
