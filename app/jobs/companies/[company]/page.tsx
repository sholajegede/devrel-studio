import type { Metadata } from 'next'
import { Suspense } from 'react'
import { notFound } from 'next/navigation'
import { JobBoard } from '@/components/jobs/job-board'
import { Monogram } from '@/components/jobs/job-card'
import { Crumbs, JobsShell, JsonLd, StaticJobList } from '@/components/jobs/shell'
import { breadcrumbLd, itemListLd } from '@/lib/jobs/seo'
import { loadList, loadStats } from '@/lib/jobs/server'
import { siteOrigin } from '@/lib/site'

export const revalidate = 900
export const dynamicParams = true

export function generateStaticParams() {
  return []
}

export async function generateMetadata({ params }: { params: Promise<{ company: string }> }): Promise<Metadata> {
  const { company } = await params
  const initial = await loadList({ company, includeAdjacent: true, limit: 1 })
  const name = initial?.items[0]?.companyName
  if (!name) return { title: 'Company not found | DevRel Studio', robots: { index: false } }
  return {
    title: `${name} DevRel jobs`,
    description: `Open developer relations, developer advocate and developer success roles at ${name}, taken from their own careers page.`,
    alternates: { canonical: `${siteOrigin()}/jobs/companies/${company}` },
  }
}

export default async function CompanyPage({ params }: { params: Promise<{ company: string }> }) {
  const { company } = await params
  const [initial, stats] = await Promise.all([
    loadList({ company, includeAdjacent: true, limit: 40 }),
    loadStats(),
  ])
  const name = initial?.items[0]?.companyName
  if (!initial || !name) notFound()
  const origin = siteOrigin()

  return (
    <JobsShell>
      <JsonLd
        data={breadcrumbLd(origin, [
          { name: 'Home', path: '/' },
          { name: 'DevRel jobs', path: '/jobs' },
          { name: name, path: `/jobs/companies/${company}` },
        ])}
      />
      <JsonLd data={itemListLd(origin, `${name} DevRel jobs`, initial.items)} />
      <Crumbs
        trail={[
          { name: 'DevRel jobs', href: '/jobs' },
          { name: 'Companies', href: '/jobs/companies' },
          { name },
        ]}
      />
      <header className="mb-8 flex items-center gap-4">
        <Monogram name={name} size={52} />
        <div>
          <h1 className="text-3xl font-semibold tracking-tight text-foreground">{name} DevRel jobs</h1>
          <p className="mt-1 text-muted-foreground">
            {initial.total} open {initial.total === 1 ? 'role' : 'roles'}
          </p>
        </div>
      </header>
      <Suspense fallback={<StaticJobList jobs={initial.items} />}>
        <JobBoard initial={initial} stats={stats} lockedCompany={company} />
      </Suspense>
    </JobsShell>
  )
}
