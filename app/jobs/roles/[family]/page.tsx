import type { Metadata } from 'next'
import Link from 'next/link'
import { Suspense } from 'react'
import { notFound } from 'next/navigation'
import { JobBoard } from '@/components/jobs/job-board'
import { Crumbs, JobsShell, JsonLd, StaticJobList } from '@/components/jobs/shell'
import { salaryFor } from '@/lib/jobs/copy'
import { breadcrumbLd, itemListLd } from '@/lib/jobs/seo'
import { loadList, loadStats } from '@/lib/jobs/server'
import { FAMILIES, FAMILY_BY_ID, isFamilyId } from '@/lib/jobs/taxonomy'
import { compactUsd } from '@/lib/jobs/ui'
import { siteOrigin } from '@/lib/site'

export const revalidate = 900
export const dynamicParams = false

export function generateStaticParams() {
  return FAMILIES.map((family) => ({ family: family.id }))
}

export async function generateMetadata({ params }: { params: Promise<{ family: string }> }): Promise<Metadata> {
  const { family } = await params
  if (!isFamilyId(family)) return {}
  const info = FAMILY_BY_ID[family]
  return {
    title: `${info.label} jobs`,
    description: `${info.blurb} Open roles from employers’ own careers pages, updated three times a day.`,
    alternates: { canonical: `${siteOrigin()}/jobs/roles/${family}` },
  }
}

export default async function RolePage({ params }: { params: Promise<{ family: string }> }) {
  const { family } = await params
  if (!isFamilyId(family)) notFound()
  const info = FAMILY_BY_ID[family]
  const origin = siteOrigin()

  const [initial, stats] = await Promise.all([
    loadList({ families: [family], includeAdjacent: true, limit: 40 }),
    loadStats(),
  ])
  const count = stats?.byFamily.find((entry) => entry.id === family)?.count ?? initial?.total ?? 0
  const pay = salaryFor(stats, family)

  return (
    <JobsShell>
      <JsonLd
        data={breadcrumbLd(origin, [
          { name: 'Home', path: '/' },
          { name: 'DevRel jobs', path: '/jobs' },
          { name: info.label, path: `/jobs/roles/${family}` },
        ])}
      />
      {initial && <JsonLd data={itemListLd(origin, `${info.label} jobs`, initial.items)} />}

      <Crumbs trail={[{ name: 'DevRel jobs', href: '/jobs' }, { name: info.label }]} />
      <header className="mb-8 max-w-3xl">
        <h1 className="text-3xl font-semibold tracking-tight text-foreground">{info.label} jobs</h1>
        <p className="mt-3 leading-relaxed text-muted-foreground">
          {info.blurb} {count.toLocaleString('en-US')} {count === 1 ? 'role is' : 'roles are'} open right now
          {pay ? `, and the median listed salary is ${compactUsd(pay.median)} a year across ${pay.n} roles that list pay` : ''}.
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          {FAMILIES.filter((other) => other.id !== family).map((other) => (
            <Link
              key={other.id}
              href={`/jobs/roles/${other.id}`}
              className="rounded-full border border-border bg-card px-3 py-1 text-sm text-muted-foreground hover:text-foreground"
            >
              {other.label}
            </Link>
          ))}
        </div>
      </header>

      <Suspense fallback={initial ? <StaticJobList jobs={initial.items} /> : null}>
        <JobBoard initial={initial ?? undefined} stats={stats} lockedFamily={family} />
      </Suspense>
    </JobsShell>
  )
}
