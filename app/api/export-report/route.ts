import { NextRequest, NextResponse } from 'next/server'
import { renderToBuffer } from '@react-pdf/renderer'
import { ConvexHttpClient } from 'convex/browser'
import { api } from '@/convex/_generated/api'
import { buildReport, periodLabel, periodsLabel } from '@/lib/report'
import { previousMonth as previousMonthKey } from '@/lib/metrics'
import path from 'node:path'
import { createReportDocument, isSocialPlatform } from './pdf-template'
import type { ReportData, ReportPlatformStat, ReportSocialPost } from './pdf-template'

/** Inter, shipped beside this route and traced into the function bundle. */
const FONT_DIR = path.join(process.cwd(), 'app/api/export-report/fonts')

/** Evidence images over this size are linked instead of embedded. */
const MAX_EMBED_BYTES = 8 * 1024 * 1024

/**
 * Download one evidence image so the renderer embeds bytes, not a URL.
 *
 * A URL handed to the renderer is fetched during rendering, and one slow or
 * failed fetch fails the whole document. Fetched here, a failure costs only
 * that image, which then appears as a link.
 */
async function embeddable(url: string, contentType: string | null) {
  const format = contentType === 'image/png' ? 'png' : contentType === 'image/jpeg' ? 'jpg' : null
  if (!format) return null
  try {
    const response = await fetch(url, { signal: AbortSignal.timeout(10_000) })
    if (!response.ok) return null
    const bytes = Buffer.from(await response.arrayBuffer())
    return bytes.length <= MAX_EMBED_BYTES ? { data: bytes, format: format as 'png' | 'jpg' } : null
  } catch {
    return null
  }
}

export const runtime = 'nodejs'

/**
 * Renders a report to PDF.
 *
 * Two callers, one renderer:
 *
 *   The browser posts a fully-built `ReportData` — it already has the data on
 *   screen and there is no reason to fetch it twice.
 *
 *   The monthly cron posts `{ slug, month }`, because it runs inside Convex
 *   where @react-pdf/renderer cannot. Assembling the payload here rather than
 *   there is what stops the emailed PDF drifting from the downloaded one.
 */
/**
 * A client's branding, looked up here rather than taken from the request.
 *
 * The browser has this already — it draws the header with it — and sending it
 * would have been one less round trip. It is fetched anyway, because the
 * renderer *downloads* the logo it is handed, and a URL that arrives in a
 * request body is a URL somebody else chose. Resolving it from the slug means
 * the only address this route can ever fetch is one an owner uploaded.
 */
async function brandingForSlug(
  slug: string,
): Promise<{ logoUrl: string | null; brandColor: string | null }> {
  const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL
  if (!convexUrl) return { logoUrl: null, brandColor: null }

  const gate = await new ConvexHttpClient(convexUrl)
    .query(api.managerAccess.getGateInfo, { slug })
    .catch(() => null)

  return {
    // The light one: this prints on a white page. `getGateInfo` already falls
    // back to the dark variant when it is the only one uploaded.
    logoUrl: gate?.logoUrl ?? null,
    brandColor: gate?.brandColor ?? null,
  }
}

type Notes = NonNullable<ReportData['notes']>

/**
 * One document for one or more months.
 *
 * Each month is built with the same `buildReport` the page uses, then the
 * months are added together. The written notes are kept per month, under the
 * month's name, because a summary written for July does not describe
 * September. Goals are summed only when every month has one; a sum over a
 * month with no goal would understate the target.
 */
async function reportForMonths(slug: string, months: string[]): Promise<ReportData | null> {
  const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL
  if (!convexUrl) return null

  const keys = [...new Set(months)].filter((key) => /^\d{4}-\d{2}$/.test(key)).sort().slice(0, 24)
  if (keys.length === 0) return null

  const convex = new ConvexHttpClient(convexUrl)
  const rows = await Promise.all(
    keys.map((period) => convex.query(api.reports.getReport, { slug, period })),
  )
  const first = rows[0]
  if (!first || rows.some((row) => !row)) return null

  const reports = keys.map((period, index) => ({
    period,
    data: rows[index]!,
    report: buildReport(rows[index]!.entries, period),
  }))
  const multi = reports.length > 1
  const last = reports[reports.length - 1]

  const content = reports
    .flatMap(({ report }) => report.published)
    .sort((a, b) => b.publicationDate.localeCompare(a.publicationDate))
    .map((entry) => ({ ...entry, status: entry.status ?? 'Published' }))

  const sum = (pick: (totals: ReturnType<typeof buildReport>['totals']) => number) =>
    reports.reduce((total, { report }) => total + pick(report.totals), 0)

  const highlights = reports
    .flatMap(({ report }) => report.highlights)
    .sort((a, b) => b.metric - a.metric)
    .slice(0, 3)
    .map(({ entry, metric }) => ({
      title: entry.title,
      platform: entry.platform,
      category: entry.category,
      metric,
    }))

  const withNotes = reports.filter(({ data }) => data.notes)
  const section = (pick: (notes: Notes) => string | null | undefined) => {
    const parts = withNotes
      .map(({ period, data }) => ({ period, text: pick(data.notes as Notes)?.trim() }))
      .filter((part): part is { period: string; text: string } => Boolean(part.text))
    if (parts.length === 0) return null
    return multi ? parts.map((part) => `${periodLabel(part.period)}: ${part.text}`).join('\n\n') : parts[0].text
  }
  const notes: ReportData['notes'] = withNotes.length
    ? {
        summary: section((n) => n.summary),
        performanceNote: section((n) => n.performanceNote),
        responseToFeedback: section((n) => n.responseToFeedback),
        quotes: withNotes.flatMap(({ data }) => data.notes?.quotes ?? []),
      }
    : null

  const sumTarget = (pick: (t: { reach: number | null; published: number | null }) => number | null) => {
    const values = reports.map(({ data }) => pick(data.targets))
    return values.every((value) => typeof value === 'number')
      ? (values as number[]).reduce((a, b) => a + b, 0)
      : null
  }

  // LinkedIn and X posts made during the period, about any piece.
  const inPeriod = (date: string) => keys.some((key) => date.startsWith(key))
  const social: ReportSocialPost[] = first.entries
    .flatMap((entry) =>
      (entry.reshares ?? [])
        .filter((reshare) => isSocialPlatform(reshare.platform) && inPeriod(reshare.date))
        .map((reshare) => ({
          platform: reshare.platform,
          link: reshare.link,
          date: reshare.date,
          impressions: reshare.views ?? null,
          asOf: reshare.viewsAsOf ?? null,
          about: entry.title,
        })),
    )
    .sort((a, b) => a.date.localeCompare(b.date))

  // Each platform's own numbers, summed across the months covered, with the
  // screenshots downloaded for embedding.
  const statRows = (
    await Promise.all(keys.map((month) => convex.query(api.platformStats.forReport, { slug, month })))
  ).flat()
  const platformStats: ReportPlatformStat[] = await Promise.all(
    statRows.map(async (row) => ({
      platform: multi ? `${row.platform}, ${periodLabel(row.month)}` : row.platform,
      month: row.month,
      views: row.views,
      reads: row.reads,
      evidenceName: row.evidenceName,
      evidenceUrl: row.evidenceUrl,
      evidenceImage: row.evidenceUrl ? await embeddable(row.evidenceUrl, row.evidenceType) : null,
    })),
  )

  const coverage = rows.reduce(
    (total, row) => ({
      tagged: total.tagged + (row!.linkCoverage?.tagged ?? 0),
      checked: total.checked + (row!.linkCoverage?.checked ?? 0),
      verified: total.verified + (row!.linkCoverage?.verified ?? 0),
    }),
    { tagged: 0, checked: 0, verified: 0 },
  )

  // The month before, for the change under each headline number. Only for a
  // single month: "vs the month before" has no meaning for a quarter.
  const previous = multi ? null : last.report.previous

  return {
    client: first.client.name,
    period: multi ? periodsLabel(keys) : last.report.label,
    preparedBy: first.preparedBy ?? null,
    previousLabel: multi ? null : periodLabel(previousMonthKey(last.period)),
    previousStats: previous
      ? {
          published: previous.published,
          inProgress: 0,
          totalViews: previous.views,
          totalDownloads: previous.downloads,
          totalAttendees: previous.attendees,
          totalStars: previous.stars,
          totalReshares: previous.reshares,
        }
      : null,
    social,
    platformStats,
    linkCoverage: coverage.checked > 0 ? coverage : null,
    // The client's own numbers, summed across the months covered. A month the
    // client sent nothing for adds nothing, and no months at all means no section.
    clientResults: (() => {
      const sent = rows.map((row) => row!.clientResults).filter(Boolean)
      if (sent.length === 0) return null
      const sum = (pick: (r: NonNullable<(typeof sent)[number]>) => number | undefined) => {
        const values = sent.map((r) => pick(r!)).filter((value): value is number => typeof value === 'number')
        return values.length ? values.reduce((a, b) => a + b, 0) : null
      }
      return {
        visits: sum((r) => r.visits),
        signups: sum((r) => r.signups),
        note: sent.map((r) => r!.note).filter(Boolean).join(' ') || null,
      }
    })(),
    branding: {
      logoUrl: first.client.logoUrl ?? null,
      brandColor: first.client.brandColor ?? null,
    },
    content,
    stats: {
      published: sum((t) => t.published),
      // Work still to ship, seen from the end of the last month covered.
      inProgress: last.report.upcoming.length,
      totalViews: sum((t) => t.views),
      totalDownloads: sum((t) => t.downloads),
      totalAttendees: sum((t) => t.attendees),
      totalStars: sum((t) => t.stars),
      totalReshares: sum((t) => t.reshares),
    },
    // The written half. The cron path is the one that reaches a client's inbox,
    // so leaving these out here would mean the emailed PDF silently dropped the
    // only part of the report a person actually wrote.
    notes,
    targets: {
      reach: sumTarget((t) => t.reach),
      published: sumTarget((t) => t.published),
    },
    highlights,
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()

    const months: string[] | null =
      typeof body?.slug !== 'string'
        ? null
        : Array.isArray(body?.months)
          ? body.months.filter((month: unknown): month is string => typeof month === 'string')
          : typeof body?.month === 'string'
            ? [body.month]
            : null
    const fromSlug = months !== null

    const data: ReportData | null = fromSlug
      ? await reportForMonths(body.slug, months)
      : (body as ReportData)

    if (!data) {
      return NextResponse.json({ error: 'No report for that client and period' }, { status: 404 })
    }

    // The browser's payload carries everything on screen and no branding — the
    // page assembles it from what it is displaying, and the logo is not part of
    // that. Without this the downloaded PDF came out unbranded while the emailed
    // one did not, from the same renderer, which is exactly the drift the two
    // callers share a renderer to avoid.
    if (!fromSlug && typeof body?.client === 'string') {
      data.branding = await brandingForSlug(body.client)
    }

    const buffer = await renderToBuffer(createReportDocument(data, { fontDir: FONT_DIR }))

    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${data.client.replace(/[^\w.-]+/g, '-')}-${data.period
          .replace(/[^\w.-]+/g, '-')
          .toLowerCase()}-report.pdf"`,
      },
    })
  } catch (error) {
    console.error('PDF generation error:', error)
    return NextResponse.json(
      {
        error: 'Failed to generate PDF',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 },
    )
  }
}
