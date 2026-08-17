import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ConvexHttpClient } from 'convex/browser'
import { api } from '@/convex/_generated/api'
import { latestMonth } from '@/lib/metrics'
import { parsePeriod, periodLabel } from '@/lib/report'
import { ReportView } from '@/components/subdomain/report-view'

// The report sits behind the same access gate as the dashboard — see the layout
// in the parent folder. Rendered on the server so the whole document is present
// in the HTML: this is a page people print, forward and open weeks later from an
// email, and none of those survive a client-side fetch gracefully.
export const dynamic = 'force-dynamic'

async function loadReport(slug: string, period: string) {
  const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL
  if (!convexUrl) return null

  try {
    return await new ConvexHttpClient(convexUrl).query(api.reports.getReport, {
      slug,
      period,
    })
  } catch (error) {
    console.error('[report] load failed for', slug, period, error)
    return null
  }
}

export default async function ReportPage({
  params,
  searchParams,
}: {
  params: Promise<{ subdomain: string }>
  searchParams: Promise<{ month?: string; year?: string; period?: string }>
}) {
  const { subdomain } = await params
  const query = await searchParams

  // Load once with a throwaway period to discover what data exists, so an
  // unparseable or absent month can fall back to the newest real one rather
  // than rendering a confidently empty report for an arbitrary month.
  const requested = parsePeriod(query.month ?? query.period, query.year)

  const probe = await loadReport(subdomain, requested ?? '1970-01')
  if (!probe) notFound()

  const period = requested ?? latestMonth(probe.entries) ?? '1970-01'

  const data = requested
    ? probe
    : ((await loadReport(subdomain, period)) ?? probe)

  if (period === '1970-01') {
    return (
      <div className="flex min-h-screen items-center justify-center px-6">
        <div className="max-w-sm text-center">
          <h1 className="text-lg font-semibold text-foreground">No reports yet</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Nothing has been published for {probe.client.name} yet, so there is no period to
            report on.
          </p>
          <Link
            href="/"
            className="mt-6 inline-flex text-sm text-foreground underline underline-offset-4"
          >
            Back to the dashboard
          </Link>
        </div>
      </div>
    )
  }

  return <ReportView data={{ ...data, period }} />
}

// Title carries the period, so a forwarded tab says which report it is. Noindex
// throughout: a client's numbers should never reach a search index.
export async function generateMetadata({
  params,
  searchParams,
}: {
  params: Promise<{ subdomain: string }>
  searchParams: Promise<{ month?: string; year?: string; period?: string }>
}): Promise<Metadata> {
  const { subdomain } = await params
  const query = await searchParams
  const period = parsePeriod(query.month ?? query.period, query.year)

  return {
    title: period
      ? `${periodLabel(period)} report · ${subdomain}`
      : `Performance report · ${subdomain}`,
    robots: { index: false, follow: false },
  }
}
