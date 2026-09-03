import { NextRequest, NextResponse } from 'next/server'
import { renderToBuffer } from '@react-pdf/renderer'
import { ConvexHttpClient } from 'convex/browser'
import { api } from '@/convex/_generated/api'
import { buildReport } from '@/lib/report'
import { createReportDocument } from './pdf-template'
import type { ReportData } from './pdf-template'

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

async function reportFromSlug(slug: string, month: string): Promise<ReportData | null> {
  const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL
  if (!convexUrl) return null

  const data = await new ConvexHttpClient(convexUrl).query(api.reports.getReport, {
    slug,
    period: month,
  })

  if (!data) return null

  const report = buildReport(data.entries, month)

  return {
    client: data.client.name,
    period: report.label,
    branding: {
      logoUrl: data.client.logoUrl ?? null,
      brandColor: data.client.brandColor ?? null,
    },
    // `published` is filtered on status === 'Published', so status is always
    // present — but the type carries it as optional, and defaulting is honest
    // where a cast would just silence the compiler.
    content: report.published.map((entry) => ({
      ...entry,
      status: entry.status ?? 'Published',
    })),
    stats: {
      published: report.totals.published,
      inProgress: report.upcoming.length,
      totalViews: report.totals.views,
      totalDownloads: report.totals.downloads,
      totalAttendees: report.totals.attendees,
      totalStars: report.totals.stars,
      totalReshares: report.totals.reshares,
    },
    // The written half. The cron path is the one that reaches a client's inbox,
    // so leaving these out here would mean the emailed PDF silently dropped the
    // only part of the report a person actually wrote.
    notes: data.notes ?? null,
    targets: data.targets ?? null,
    highlights: report.highlights.map(({ entry, metric }) => ({
      title: entry.title,
      platform: entry.platform,
      category: entry.category,
      metric,
    })),
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()

    const fromSlug = typeof body?.slug === 'string' && typeof body?.month === 'string'

    const data: ReportData | null = fromSlug
      ? await reportFromSlug(body.slug, body.month)
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

    const buffer = await renderToBuffer(createReportDocument(data))

    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${data.client}-report-${new Date()
          .toISOString()
          .split('T')[0]}.pdf"`,
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
