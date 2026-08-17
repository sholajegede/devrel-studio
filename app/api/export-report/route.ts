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
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()

    const data: ReportData | null =
      typeof body?.slug === 'string' && typeof body?.month === 'string'
        ? await reportFromSlug(body.slug, body.month)
        : (body as ReportData)

    if (!data) {
      return NextResponse.json({ error: 'No report for that client and period' }, { status: 404 })
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
