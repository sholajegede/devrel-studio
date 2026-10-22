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
      <header>
        <div className="mx-auto max-w-3xl px-6 pb-8 pt-20 text-center">
          <h1 className="text-[clamp(2.75rem,7vw,4.5rem)] font-medium leading-[1] tracking-[-0.04em] text-foreground">
            Every report,
            <br />
            in one place
          </h1>
          <p className="mt-5 text-lg text-muted-foreground">
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
            <section key={year} className="py-8">
              <h2 className="text-2xl font-medium tracking-[-0.03em] text-foreground">
                {year}
              </h2>

              <ul className="mt-5 overflow-hidden rounded-[2rem] bg-sand">
                {periods.map((period, i) => (
                  <li key={period.period} className={i > 0 ? 'border-t border-ink/10' : ''}>
                    <Link
                      href={`/report?month=${period.period}`}
                      className="group flex items-center gap-4 px-7 py-5 transition-colors hover:bg-sand-deep"
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
