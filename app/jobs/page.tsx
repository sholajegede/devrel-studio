import type { Metadata } from 'next'
import { Suspense } from 'react'
import { JobBoard } from '@/components/jobs/job-board'
import { Faq, HubLinks, JobsShell, JsonLd, StaticJobList } from '@/components/jobs/shell'
import { faqItems, marketSummary } from '@/lib/jobs/copy'
import { breadcrumbLd, faqLd, itemListLd } from '@/lib/jobs/seo'
import { loadList, loadStats } from '@/lib/jobs/server'
import { siteOrigin } from '@/lib/site'

export const revalidate = 900

export const metadata: Metadata = {
  title: 'DevRel Jobs: developer advocate, DevRel engineer and developer success roles',
  description:
    'Open developer relations jobs pulled from employers’ own careers pages three times a day. Filter by role, level, pay and whether the role is open in your country.',
  alternates: { canonical: `${siteOrigin()}/jobs` },
}

export default async function JobsPage() {
  const origin = siteOrigin()
  const [initial, stats] = await Promise.all([loadList({ limit: 40 }), loadStats()])
  const faq = faqItems(stats)

  return (
    <JobsShell>
      <JsonLd data={breadcrumbLd(origin, [{ name: 'Home', path: '/' }, { name: 'DevRel jobs', path: '/jobs' }])} />
      <JsonLd data={faqLd(faq)} />
      {initial && <JsonLd data={itemListLd(origin, 'DevRel jobs', initial.items)} />}

      <header className="relative mb-10 overflow-hidden rounded-3xl border border-border bg-gradient-to-br from-accent/10 via-background to-background px-6 py-10 sm:px-10 sm:py-12">
        <div aria-hidden className="pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full bg-accent/15 blur-3xl" />
        <div className="relative max-w-3xl">
          <p className="text-sm font-medium text-accent">Updated three times a day</p>
          <h1 className="mt-2 text-4xl font-semibold tracking-tight text-foreground sm:text-5xl">
            Every DevRel job, in one place
          </h1>
          <p className="mt-4 text-base leading-relaxed text-muted-foreground">{marketSummary(stats)}</p>
        </div>
        {stats && stats.total > 0 && (
          <dl className="relative mt-8 grid grid-cols-2 gap-3 sm:grid-cols-4">
            {[
              { label: 'Open roles', value: stats.total.toLocaleString('en-US') },
              { label: 'Companies hiring', value: stats.byCompany.length.toLocaleString('en-US') },
              { label: 'Remote', value: `${Math.round((stats.remote / stats.total) * 100)}%` },
              { label: 'Posted this week', value: stats.postedThisWeek.toLocaleString('en-US') },
            ].map((item) => (
              <div key={item.label} className="rounded-2xl border border-border bg-card/70 p-4 backdrop-blur">
                <dd className="text-2xl font-semibold tabular-nums text-foreground">{item.value}</dd>
                <dt className="text-xs text-muted-foreground">{item.label}</dt>
              </div>
            ))}
          </dl>
        )}
        <div className="relative mt-6">
          <HubLinks />
        </div>
      </header>

      <Suspense
        fallback={
          <div className="grid gap-8 lg:grid-cols-[250px_1fr]">
            <div className="hidden lg:block" />
            {initial ? <StaticJobList jobs={initial.items} /> : <p className="text-muted-foreground">Loading roles</p>}
          </div>
        }
      >
        <JobBoard initial={initial ?? undefined} stats={stats} />
      </Suspense>

      <Faq items={faq} />
    </JobsShell>
  )
}
