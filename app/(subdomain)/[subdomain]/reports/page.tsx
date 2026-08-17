import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ConvexHttpClient } from 'convex/browser'
import { api } from '@/convex/_generated/api'
import { formatCompact } from '@/lib/metrics'
import { periodLabel } from '@/lib/report'
import { ArrowRight } from 'lucide-react'

// Behind the same access gate as everything else on a client subdomain.
export const dynamic = 'force-dynamic'

export async function generateMetadata({
  params,
}: {
  params: Promise<{ subdomain: string }>
}): Promise<Metadata> {
  const { subdomain } = await params
  return {
    title: `Reports · ${subdomain}`,
    robots: { index: false, follow: false },
  }
}

/**
 * The archive.
 *
 * Every report was previously reachable only through the email that announced
 * it — lose the email, lose the report. A client asking "what did we get in
 * Q2" had no way to answer it themselves.
 */
export default async function ReportsIndexPage({
  params,
}: {
  params: Promise<{ subdomain: string }>
}) {
  const { subdomain } = await params

  const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL
  if (!convexUrl) notFound()

  const data = await new ConvexHttpClient(convexUrl)
    .query(api.reports.listReportPeriods, { slug: subdomain })
    .catch(() => null)

  if (!data) notFound()

  // Group by year so a long history reads as a history rather than a list.
  const byYear = new Map<string, typeof data.periods>()
  for (const period of data.periods) {
    const year = period.period.slice(0, 4)
    byYear.set(year, [...(byYear.get(year) ?? []), period])
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border">
        <div className="mx-auto max-w-3xl px-6 py-16">
          <p className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
            Archive
          </p>
          <h1 className="mt-3 text-4xl font-semibold tracking-[-0.03em] text-foreground">
            Reports
          </h1>
          <p className="mt-3 text-[15px] text-muted-foreground">
            Every period {data.clientName} has published work in.
          </p>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-6 pb-24">
        {data.periods.length === 0 ? (
          <p className="py-16 text-[15px] text-muted-foreground">
            Nothing has been published yet, so there are no reports.
          </p>
        ) : (
          [...byYear.entries()].map(([year, periods]) => (
            <section key={year} className="border-b border-border py-10 last:border-b-0">
              <h2 className="text-xs uppercase tracking-[0.12em] text-muted-foreground">
                {year}
              </h2>

              <ul className="mt-5 overflow-hidden rounded-xl border border-border">
                {periods.map((period, i) => (
                  <li key={period.period} className={i > 0 ? 'border-t border-border' : ''}>
                    <Link
                      href={`/report?month=${period.period}`}
                      className="group flex items-center gap-4 px-5 py-4 transition-colors hover:bg-muted/40"
                    >
                      <span className="flex-1 text-[15px] font-medium text-foreground">
                        {periodLabel(period.period)}
                      </span>

                      <span className="text-sm tabular-nums text-muted-foreground">
                        {period.published}{' '}
                        {period.published === 1 ? 'piece' : 'pieces'}
                      </span>

                      <span className="w-20 text-right text-sm tabular-nums text-muted-foreground">
                        {period.reach > 0 ? formatCompact(period.reach) : '—'}
                      </span>

                      <ArrowRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          ))
        )}
      </main>
    </div>
  )
}
