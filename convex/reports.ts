import { ConvexError, v } from 'convex/values'
import { api, internal } from './_generated/api'
import { action, internalAction,
  internalMutation,
  internalQuery,
  mutation,
  query,
} from './_generated/server'
import { getCurrentWorkspace, requireInWorkspace } from './model/workspaces'
import { dueNow } from '../lib/schedule'
import { previousMonth } from '../lib/metrics'
import { enforceRateLimit } from './model/rateLimit'

// ── Monthly report notifications ──────────────────────────────────────────────
//
// There is exactly one sender: `sendReportsNow`. The scheduler calls it and so
// does the button in the dashboard. A second path existed briefly and was
// removed — two senders drift, and the way that shows up is the manual button
// quietly not matching what a client actually receives on the 1st.
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

    const notes = await ctx.db
      .query('reportNotes')
      .withIndex('by_slug_and_period', (q) =>
        q.eq('slug', slug).eq('period', args.period),
      )
      .first()

    // What the client said last time. Shown so the report can answer it —
    // feedback that is collected and never referred to again teaches a client
    // that leaving it was pointless.
    const priorPeriod = previousMonth(args.period)
    const priorFeedback = await ctx.db
      .query('reportFeedback')
      .withIndex('by_slug_and_period', (q) =>
        q.eq('slug', slug).eq('period', priorPeriod),
      )
      .collect()

    return {
      client: {
        id: client._id,
        name: client.company || client.name,
        contact: client.name,
        website: client.website,
        slug,
        // Carried so the exported PDF looks like a document prepared for this
        // client rather than a printout from somebody's tool. Both optional and
        // both fall back to the product's own look.
        // The light one. The PDF prints on a white page, so the dark variant
        // would be the wrong choice even when both exist — and it is still
        // better than nothing when it is all there is.
        logoUrl: client.logoStorageId
          ? await ctx.storage.getUrl(client.logoStorageId)
          : client.logoDarkStorageId
            ? await ctx.storage.getUrl(client.logoDarkStorageId)
            : (client.logoUrl ?? null),
        brandColor: client.brandColor ?? null,
      },
      period: args.period,
      entries: visible,
      // The written half of the report. Null when nobody has written one, and
      // every section it feeds renders nothing in that case.
      notes: notes
        ? {
            summary: notes.summary ?? null,
            performanceNote: notes.performanceNote ?? null,
            responseToFeedback: notes.responseToFeedback ?? null,
            quotes: notes.quotes ?? [],
          }
        : null,
      // A period may set its own goal; otherwise the engagement's standing one
      // applies. Resolved here so the page and the PDF cannot disagree.
      targets: {
        reach: notes?.reachTarget ?? client.reachTarget ?? null,
        published: notes?.publishedTarget ?? client.publishedTarget ?? null,
      },
      previousPeriod: priorPeriod,
      previousFeedback: priorFeedback
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
        .map((item) => ({
          id: item._id,
          rating: item.rating,
          comment: item.comment,
          authorName: item.authorName,
          createdAt: item.createdAt,
        })),
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

// ── The write-up ──────────────────────────────────────────────────────────────
//
// The parts of a report a person has to write: the opening paragraph, why the
// numbers moved, an answer to last period's feedback, and anything worth
// quoting. Read by the dashboard composer; the public report reads its own copy
// through `getReport` so an unauthenticated visitor never touches these.

const MAX_SUMMARY = 4000
const MAX_LINE = 600
const MAX_QUOTES = 6

/** One client's write-up for one period, plus what it is answering. */
export const getNotes = query({
  args: { clientId: v.id('clients'), period: v.string() },
  handler: async (ctx, args) => {
    const context = await getCurrentWorkspace(ctx)
    if (!context) return null

    const client = await ctx.db.get(args.clientId)
    if (!client || client.workspaceId !== context.workspaceId) return null

    const notes = await ctx.db
      .query('reportNotes')
      .withIndex('by_client_and_period', (q) =>
        q.eq('clientId', args.clientId).eq('period', args.period),
      )
      .first()

    // The feedback this period's write-up is meant to answer. Loaded alongside
    // so the composer can show it next to the box, rather than asking the
    // writer to remember what was said a month ago.
    const priorFeedback = await ctx.db
      .query('reportFeedback')
      .withIndex('by_slug_and_period', (q) =>
        q.eq('slug', client.slug ?? '').eq('period', previousMonth(args.period)),
      )
      .collect()

    return {
      summary: notes?.summary ?? '',
      performanceNote: notes?.performanceNote ?? '',
      responseToFeedback: notes?.responseToFeedback ?? '',
      quotes: notes?.quotes ?? [],
      // Empty rather than the inherited value, so the field shows the standing
      // goal as a placeholder and saving a blank keeps inheriting it.
      reachTarget: notes?.reachTarget ?? null,
      publishedTarget: notes?.publishedTarget ?? null,
      inheritedReachTarget: client.reachTarget ?? null,
      inheritedPublishedTarget: client.publishedTarget ?? null,
      updatedAt: notes?.updatedAt ?? null,
      previousPeriod: previousMonth(args.period),
      previousFeedback: priorFeedback
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
 * Save the write-up for one period.
 *
 * Editor rather than admin: writing the report is the work, not an
 * administrative act. Sending it stays at admin, because that is what puts
 * something in a client's inbox.
 */
export const saveNotes = mutation({
  args: {
    clientId: v.id('clients'),
    period: v.string(),
    summary: v.optional(v.string()),
    performanceNote: v.optional(v.string()),
    responseToFeedback: v.optional(v.string()),
    quotes: v.optional(v.array(v.object({
      text: v.string(),
      attribution: v.optional(v.string()),
      link: v.optional(v.string()),
    }))),
    reachTarget: v.optional(v.union(v.number(), v.null())),
    publishedTarget: v.optional(v.union(v.number(), v.null())),
  },
  handler: async (ctx, args) => {
    const { user, doc: client } = await requireInWorkspace(ctx, args.clientId, 'editor')

    if (!client.slug) {
      throw new ConvexError('Give this client a dashboard slug before writing a report')
    }
    if (!/^\d{4}-\d{2}$/.test(args.period)) {
      throw new ConvexError('That is not a valid period')
    }

    // An empty box means "say nothing here", which has to be stored as absent
    // rather than as an empty string — otherwise the report renders a heading
    // over nothing.
    const text = (value: string | undefined, max: number) => {
      const trimmed = value?.trim().slice(0, max)
      return trimmed ? trimmed : undefined
    }

    const target = (value: number | null | undefined) => {
      if (value === null || value === undefined) return undefined
      if (!Number.isFinite(value) || value < 0) {
        throw new ConvexError('A target cannot be negative')
      }
      return Math.round(value)
    }

    const quotes = (args.quotes ?? [])
      .map((quote) => ({
        text: quote.text.trim().slice(0, MAX_LINE),
        attribution: quote.attribution?.trim().slice(0, 120) || undefined,
        link: quote.link?.trim().slice(0, 500) || undefined,
      }))
      .filter((quote) => quote.text.length > 0)
      .slice(0, MAX_QUOTES)

    const fields = {
      clientId: args.clientId,
      workspaceId: client.workspaceId,
      slug: client.slug,
      period: args.period,
      summary: text(args.summary, MAX_SUMMARY),
      performanceNote: text(args.performanceNote, MAX_LINE),
      responseToFeedback: text(args.responseToFeedback, MAX_LINE * 2),
      quotes: quotes.length > 0 ? quotes : undefined,
      reachTarget: target(args.reachTarget),
      publishedTarget: target(args.publishedTarget),
      updatedAt: new Date().toISOString(),
      updatedBy: user._id,
    }

    const existing = await ctx.db
      .query('reportNotes')
      .withIndex('by_client_and_period', (q) =>
        q.eq('clientId', args.clientId).eq('period', args.period),
      )
      .first()

    if (existing) await ctx.db.patch(existing._id, fields)
    else await ctx.db.insert('reportNotes', fields)

    return { ok: true }
  },
})

/** The engagement's standing goals, applied to any period that sets none. */
export const saveClientTargets = mutation({
  args: {
    clientId: v.id('clients'),
    reachTarget: v.optional(v.union(v.number(), v.null())),
    publishedTarget: v.optional(v.union(v.number(), v.null())),
  },
  handler: async (ctx, args) => {
    await requireInWorkspace(ctx, args.clientId, 'editor')

    const target = (value: number | null | undefined) => {
      if (value === null || value === undefined) return undefined
      if (!Number.isFinite(value) || value < 0) {
        throw new ConvexError('A target cannot be negative')
      }
      return Math.round(value)
    }

    await ctx.db.patch(args.clientId, {
      reachTarget: target(args.reachTarget),
      publishedTarget: target(args.publishedTarget),
    })

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

// ── Schedules ─────────────────────────────────────────────────────────────────
//
// Convex crons are fixed at deploy time, so per-client timing cannot be its own
// cron job. One hourly job asks every schedule whether it is their hour — which
// is what moves the timing out of a source file and into the dashboard.

/** Every client in the workspace with its schedule, for the settings screen. */
export const listSchedules = query({
  args: {},
  handler: async (ctx) => {
    const context = await getCurrentWorkspace(ctx)
    if (!context) return []

    const clients = await ctx.db
      .query('clients')
      .withIndex('by_workspace', (q) => q.eq('workspaceId', context.workspaceId))
      .collect()

    return await Promise.all(
      clients
        .filter((client) => !!client.slug)
        .map(async (client) => {
          const schedule = await ctx.db
            .query('reportSchedules')
            .withIndex('by_client', (q) => q.eq('clientId', client._id))
            .first()

          const entries = await ctx.db
            .query('contentEntries')
            .withIndex('by_workspace_and_client', (q) =>
              q.eq('workspaceId', context.workspaceId).eq('client', client.slug!),
            )
            .collect()

          // Only periods with published work can be reported on — offering an
          // empty month in the picker invites sending a report that says
          // nothing happened.
          const periods = [
            ...new Set(
              entries
                .filter((entry) => entry.status === 'Published')
                .map((entry) => entry.publicationDate?.slice(0, 7))
                .filter((period): period is string => !!period && period.length === 7),
            ),
          ].sort((a, b) => b.localeCompare(a))

          // Which periods already have something written. Drives the marker on
          // the period chips — a report going out with no write-up is a choice,
          // but it should be a visible one.
          const notes = await ctx.db
            .query('reportNotes')
            .withIndex('by_client_and_period', (q) => q.eq('clientId', client._id))
            .collect()

          const written = notes
            .filter((note) => !!note.summary)
            .map((note) => note.period)

          return {
            clientId: client._id,
            clientName: client.company || client.name,
            slug: client.slug!,
            clientEmail: client.email ?? null,
            reachTarget: client.reachTarget ?? null,
            publishedTarget: client.publishedTarget ?? null,
            written,
            schedule: schedule
              ? {
                  enabled: schedule.enabled,
                  recipients: schedule.recipients,
                  dayOfMonth: schedule.dayOfMonth,
                  hourLocal: schedule.hourLocal,
                  timezone: schedule.timezone,
                  lastSentPeriod: schedule.lastSentPeriod ?? null,
                  lastSentAt: schedule.lastSentAt ?? null,
                }
              : null,
            periods,
          }
        }),
    )
  },
})

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export const saveSchedule = mutation({
  args: {
    clientId: v.id('clients'),
    enabled: v.boolean(),
    recipients: v.array(v.string()),
    dayOfMonth: v.number(),
    hourLocal: v.number(),
    timezone: v.string(),
  },
  handler: async (ctx, args) => {
    const { doc: client } = await requireInWorkspace(ctx, args.clientId, 'admin')

    const recipients = [
      ...new Set(args.recipients.map((email) => email.trim().toLowerCase()).filter(Boolean)),
    ]

    for (const email of recipients) {
      if (!EMAIL.test(email)) throw new ConvexError(`"${email}" is not a valid email address`)
    }

    if (args.enabled && recipients.length === 0) {
      throw new ConvexError('Add at least one recipient before turning the schedule on')
    }

    // 1–28 only. The 29th, 30th and 31st do not exist in every month, and a
    // schedule that silently skips February is worse than one that cannot be set.
    if (args.dayOfMonth < 1 || args.dayOfMonth > 28) {
      throw new ConvexError('Pick a day between 1 and 28 so every month is covered')
    }
    if (args.hourLocal < 0 || args.hourLocal > 23) {
      throw new ConvexError('Hour must be between 0 and 23')
    }

    const existing = await ctx.db
      .query('reportSchedules')
      .withIndex('by_client', (q) => q.eq('clientId', args.clientId))
      .first()

    const fields = {
      clientId: args.clientId,
      workspaceId: client.workspaceId,
      enabled: args.enabled,
      recipients,
      dayOfMonth: args.dayOfMonth,
      hourLocal: args.hourLocal,
      timezone: args.timezone,
    }

    if (existing) await ctx.db.patch(existing._id, fields)
    else await ctx.db.insert('reportSchedules', fields)

    return { ok: true }
  },
})

/** Internal: mark a period as sent so the hourly job does not repeat it. */
export const markSent = internalMutation({
  args: { clientId: v.id('clients'), period: v.string() },
  handler: async (ctx, args) => {
    const schedule = await ctx.db
      .query('reportSchedules')
      .withIndex('by_client', (q) => q.eq('clientId', args.clientId))
      .first()

    if (schedule) {
      await ctx.db.patch(schedule._id, {
        lastSentPeriod: args.period,
        lastSentAt: new Date().toISOString(),
      })
    }
  },
})

/** Internal: everything the sender needs for one client and one period. */
export const sendPayload = internalQuery({
  args: { clientId: v.id('clients'), period: v.string() },
  handler: async (ctx, args) => {
    const client = await ctx.db.get(args.clientId)
    if (!client?.slug) return null

    const schedule = await ctx.db
      .query('reportSchedules')
      .withIndex('by_client', (q) => q.eq('clientId', args.clientId))
      .first()

    const entries = client.workspaceId
      ? await ctx.db
          .query('contentEntries')
          .withIndex('by_workspace_and_client', (q) =>
            q.eq('workspaceId', client.workspaceId).eq('client', client.slug!),
          )
          .collect()
      : []

    const published = entries.filter(
      (entry) =>
        entry.status === 'Published' && entry.publicationDate?.startsWith(args.period),
    ).length

    // Falls back to the client's own address so a manual send works before a
    // schedule has ever been configured.
    const recipients = schedule?.recipients?.length
      ? schedule.recipients
      : client.email
        ? [client.email]
        : []

    return {
      slug: client.slug,
      clientName: client.company || client.name,
      recipients,
      published,
    }
  },
})

/**
 * Send one client's report for a set of periods.
 *
 * Public, and the same code path the scheduler uses. Two senders for one job
 * would drift — the manual button would quietly stop matching what a client
 * actually receives on the 1st, which is the one thing that must not happen.
 *
 * Requires admin: sending a report puts something in a client's inbox, which
 * sits alongside issuing access codes rather than alongside editing an entry.
 */
export const sendReportsNow = action({
  args: {
    clientId: v.id('clients'),
    periods: v.array(v.string()),
    /** Overrides the schedule's recipients for this send only. */
    to: v.optional(v.array(v.string())),
  },
  handler: async (
    ctx,
    args,
  ): Promise<{ sent: number; failed: number; skipped: string[] }> => {
    // Authorisation lives in the mutation, which can read the workspace.
    await ctx.runMutation(api.reports.assertCanSend, { clientId: args.clientId })

    return await ctx.runAction(internal.reports.deliverReports, args)
  },
})

/**
 * The send itself, with no opinion about who asked for it.
 *
 * Split from `sendReportsNow` because the caller is not always a person. The
 * hourly cron reached the send through the public action, which begins by
 * demanding a workspace admin — and a cron is signed in as nobody, so every
 * scheduled report threw `Not authenticated` before it sent anything. The throw
 * was caught and logged, the run returned "checked 1, sent 0", and a failure
 * looked exactly like a quiet hour.
 *
 * Internal, so the only ways in are the public action above, which checks the
 * caller, and the cron, which is authorised by being the cron.
 */
export const deliverReports = internalAction({
  args: {
    clientId: v.id('clients'),
    periods: v.array(v.string()),
    to: v.optional(v.array(v.string())),
  },
  handler: async (
    ctx,
    args,
  ): Promise<{ sent: number; failed: number; skipped: string[] }> => {
    let sent = 0
    let failed = 0
    const skipped: string[] = []

    for (const period of args.periods.slice(0, 24)) {
      const payload = await ctx.runQuery(internal.reports.sendPayload, {
        clientId: args.clientId,
        period,
      })

      if (!payload) {
        skipped.push(`${period}: client not found`)
        continue
      }

      const recipients = args.to?.length ? args.to : payload.recipients
      if (recipients.length === 0) {
        skipped.push(`${period}: no recipient`)
        continue
      }

      // A report saying nothing was published is worse than no report, and a
      // manual send should not be the way that slips out.
      if (payload.published === 0) {
        skipped.push(`${period}: nothing published`)
        continue
      }

      const pdf = await buildReportPdf(payload.slug, period)
      const root = process.env.SITE_URL?.replace(/^https?:\/\//, '') ?? 'devrel.studio'
      const redirect = redirectTarget()

      for (const recipient of recipients) {
        const result = await ctx.runAction(internal.email.sendMonthlyReportReady, {
          email: redirect ?? recipient,
          clientName: payload.clientName,
          period: monthLabel(period),
          publishedCount: payload.published,
          dashboardUrl: `https://${payload.slug}.${root}/report?month=${period}`,
          ...(pdf ? { pdfBase64: pdf, pdfFilename: `${payload.slug}-report-${period}.pdf` } : {}),
        })

        if (result.ok) sent++
        else failed++
      }

      await ctx.runMutation(internal.reports.markSent, {
        clientId: args.clientId,
        period,
      })
    }

    return { sent, failed, skipped }
  },
})

/** Permission check for `sendReportsNow`, which as an action cannot read the db. */
export const assertCanSend = mutation({
  args: { clientId: v.id('clients') },
  handler: async (ctx, args) => {
    await requireInWorkspace(ctx, args.clientId, 'admin')
    return { ok: true }
  },
})

/**
 * The hourly sweep.
 *
 * Every enabled schedule is asked whether this is its hour in its own timezone.
 * Hourly rather than daily because the hour is configurable — a daily job could
 * only ever honour the day.
 */
export const runScheduledReports = internalAction({
  args: {},
  handler: async (ctx): Promise<{ checked: number; sent: number; failed: number }> => {
    const schedules = await ctx.runQuery(internal.reports.dueSchedules, {})

    let sent = 0
    let failed = 0

    for (const item of schedules) {
      // The internal action, not the public one. The public one starts by
      // demanding a workspace admin, and this caller is a cron.
      const result = await ctx
        .runAction(internal.reports.deliverReports, {
          clientId: item.clientId,
          periods: [item.period],
        })
        .catch((error) => {
          console.error(
            `[reports] scheduled send FAILED for client ${item.clientId}, period ${item.period}:`,
            error,
          )
          return null
        })

      if (result) sent += result.sent
      else failed += 1
    }

    // `failed` is returned rather than only logged. Without it a run that sent
    // nothing because everything threw was indistinguishable from a quiet hour
    // with nothing due — which is how a broken schedule went unnoticed until
    // somebody wondered why they were sending reports by hand.
    if (failed > 0) {
      console.error(`[reports] ${failed} of ${schedules.length} scheduled sends failed`)
    }

    return { checked: schedules.length, sent, failed }
  },
})

/** Internal: which schedules are due right now. */
export const dueSchedules = internalQuery({
  args: { at: v.optional(v.number()) },
  handler: async (ctx, args) => {
    const now = args.at ? new Date(args.at) : new Date()

    const schedules = await ctx.db
      .query('reportSchedules')
      .withIndex('by_enabled', (q) => q.eq('enabled', true))
      .collect()

    return schedules
      .map((schedule) => ({ schedule, verdict: dueNow(schedule, now) }))
      .filter(({ verdict }) => verdict.due)
      .map(({ schedule, verdict }) => ({
        clientId: schedule.clientId,
        period: verdict.period,
      }))
  },
})

/**
 * Whether a delivery override is active, and where mail is going instead.
 *
 * Surfaced in the dashboard because the alternative is an interface that lies:
 * the schedule card names a recipient, and with an override set that is not who
 * receives it. A debugging aid that cannot be seen is a trap.
 */
export const deliveryOverride = query({
  args: {},
  handler: async (ctx) => {
    const context = await getCurrentWorkspace(ctx)
    if (!context) return null

    const target = process.env.REPORT_REDIRECT_TO?.trim()
    return target && target.includes('@') ? { redirectingTo: target } : null
  },
})
