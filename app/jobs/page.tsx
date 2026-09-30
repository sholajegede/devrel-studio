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

      <header className="mb-8 max-w-3xl">
        <h1 className="text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
          DevRel jobs
        </h1>
        <p className="mt-3 text-base leading-relaxed text-muted-foreground">{marketSummary(stats)}</p>
        <div className="mt-5">
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
