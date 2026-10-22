import type { Metadata } from 'next'
import { Suspense } from 'react'
import { JobBoard } from '@/components/jobs/job-board'
import { JobsTour } from '@/components/jobs/jobs-tour'
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

      <header className="mb-14 text-center">
        <h1 className="mx-auto max-w-4xl text-[clamp(2.75rem,7vw,5.25rem)] font-medium leading-[1] tracking-[-0.035em] text-foreground">
          Every DevRel job,
          <br />
          in one place
        </h1>
        <p className="mx-auto mt-7 max-w-2xl text-lg leading-relaxed text-muted-foreground">{marketSummary(stats)}</p>
        {stats && stats.total > 0 && (
          <dl className="mx-auto mt-12 grid max-w-5xl grid-cols-2 gap-3 text-left sm:grid-cols-4">
            {[
              { label: 'Open roles', value: stats.total.toLocaleString('en-US'), tone: 'bg-ochre' },
              { label: 'Companies hiring', value: stats.byCompany.length.toLocaleString('en-US'), tone: 'bg-blue' },
              { label: 'Remote', value: `${Math.round((stats.remote / stats.total) * 100)}%`, tone: 'bg-green' },
              { label: 'Posted this week', value: stats.postedThisWeek.toLocaleString('en-US'), tone: 'bg-sand' },
            ].map((item) => (
              <div key={item.label} className={`rounded-[1.5rem] p-6 text-ink ${item.tone}`}>
                <dd className="text-4xl font-medium tabular-nums tracking-[-0.04em]">{item.value}</dd>
                <dt className="mt-1 text-sm text-ink/70">{item.label}</dt>
              </div>
            ))}
          </dl>
        )}
        <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
          <HubLinks />
          <JobsTour variant="jobs-public" />
        </div>
        <p className="mt-4 text-sm text-muted-foreground">Updated three times a day</p>
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
