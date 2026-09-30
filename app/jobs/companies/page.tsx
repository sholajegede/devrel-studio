import type { Metadata } from 'next'
import Link from 'next/link'
import { Monogram } from '@/components/jobs/job-card'
import { Crumbs, JobsShell, JsonLd } from '@/components/jobs/shell'
import { breadcrumbLd } from '@/lib/jobs/seo'
import { loadStats } from '@/lib/jobs/server'
import { siteOrigin } from '@/lib/site'

export const revalidate = 900

export const metadata: Metadata = {
  title: 'Companies hiring for DevRel',
  description: 'Companies with open developer relations, developer advocate and developer success roles right now.',
  alternates: { canonical: `${siteOrigin()}/jobs/companies` },
}

export default async function CompaniesPage() {
  const stats = await loadStats()
  const companies = stats?.byCompany ?? []
  return (
    <JobsShell>
      <JsonLd
        data={breadcrumbLd(siteOrigin(), [
          { name: 'Home', path: '/' },
          { name: 'DevRel jobs', path: '/jobs' },
          { name: 'Companies', path: '/jobs/companies' },
        ])}
      />
      <Crumbs trail={[{ name: 'DevRel jobs', href: '/jobs' }, { name: 'Companies' }]} />
      <h1 className="text-3xl font-semibold tracking-tight text-foreground">Companies hiring for DevRel</h1>
      <p className="mt-3 max-w-3xl text-muted-foreground">
        {companies.length.toLocaleString('en-US')} companies have at least one open developer relations role.
      </p>
      <ul className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {companies.map((company) => (
          <li key={company.slug}>
            <Link
              href={`/jobs/companies/${company.slug}`}
              className="flex items-center gap-3 rounded-xl border border-border bg-card p-4 transition-colors hover:border-foreground/20"
            >
              <Monogram name={company.name} />
              <span className="min-w-0 flex-1 truncate font-medium text-foreground">{company.name}</span>
              <span className="text-sm text-muted-foreground tabular-nums">
                {company.count} {company.count === 1 ? 'role' : 'roles'}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </JobsShell>
  )
}
