import { v } from 'convex/values'
import { internal } from './_generated/api'
import { internalAction, internalQuery } from './_generated/server'

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
      const result = await ctx.runAction(internal.email.sendMonthlyReportReady, {
        email: redirect ?? client.email,
        clientName: client.clientName,
        period: monthLabel(month),
        publishedCount: client.publishedCount,
        dashboardUrl: `https://${client.slug}.${root}`,
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
