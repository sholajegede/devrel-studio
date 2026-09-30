import type { Metadata } from 'next'
import { Crumbs, JobsShell, JsonLd } from '@/components/jobs/shell'
import { salaryFor } from '@/lib/jobs/copy'
import { breadcrumbLd } from '@/lib/jobs/seo'
import { loadStats } from '@/lib/jobs/server'
import { FAMILIES, SENIORITIES } from '@/lib/jobs/taxonomy'
import { compactUsd } from '@/lib/jobs/ui'
import { siteOrigin } from '@/lib/site'

export const revalidate = 3600

export const metadata: Metadata = {
  title: 'DevRel salaries: what developer advocates and DevRel engineers are paid',
  description:
    'Salary ranges for developer advocate, DevRel engineer, developer success and community roles, calculated from open roles that list pay.',
  alternates: { canonical: `${siteOrigin()}/jobs/salaries` },
}

export default async function SalariesPage() {
  const stats = await loadStats()
  const origin = siteOrigin()
  const advocacy = salaryFor(stats, 'advocacy')
  const updated = stats ? new Date(stats.updatedAt).toISOString().slice(0, 10) : null

  const groups = FAMILIES.map((family) => ({
    family,
    rows: SENIORITIES.map((level) => ({ level, row: salaryFor(stats, family.id, level.id) })).filter(
      (entry) => entry.row,
    ),
    all: salaryFor(stats, family.id),
  })).filter((group) => group.all)

  return (
    <JobsShell>
      <JsonLd
        data={breadcrumbLd(origin, [
          { name: 'Home', path: '/' },
          { name: 'DevRel jobs', path: '/jobs' },
          { name: 'Salaries', path: '/jobs/salaries' },
        ])}
      />
      {stats && (
        <JsonLd
          data={{
            '@context': 'https://schema.org',
            '@type': 'Dataset',
            name: 'DevRel salaries from open job listings',
            description:
              'Median and quartile annual salaries in US dollars for developer relations roles, computed from open listings that state pay.',
            dateModified: updated,
            creator: { '@type': 'Organization', name: 'DevRel Studio', url: origin },
            url: `${origin}/jobs/salaries`,
          }}
        />
      )}

      <Crumbs trail={[{ name: 'DevRel jobs', href: '/jobs' }, { name: 'Salaries' }]} />
      <h1 className="text-3xl font-semibold tracking-tight text-foreground">DevRel salaries</h1>
      <p className="mt-3 max-w-3xl leading-relaxed text-muted-foreground">
        {advocacy
          ? `The median listed salary for developer advocacy roles is ${compactUsd(advocacy.median)} a year. The middle half of roles pay ${compactUsd(advocacy.p25)} to ${compactUsd(advocacy.p75)}, based on ${advocacy.n} open roles that list pay.`
          : 'Salary figures appear here once enough open roles list their pay.'}
      </p>

      <div className="mt-8 space-y-8">
        {groups.map(({ family, rows, all }) => (
          <section key={family.id} aria-labelledby={`h-${family.id}`}>
            <h2 id={`h-${family.id}`} className="text-lg font-semibold text-foreground">
              {family.label}
            </h2>
            <div className="mt-3 overflow-x-auto rounded-xl border border-border bg-card">
              <table className="w-full text-sm">
                <thead className="text-left text-xs uppercase tracking-wide text-muted-foreground">
                  <tr>
                    <th className="px-4 py-3 font-medium">Level</th>
                    <th className="px-4 py-3 font-medium">Roles with pay</th>
                    <th className="px-4 py-3 font-medium">25th percentile</th>
                    <th className="px-4 py-3 font-medium">Median</th>
                    <th className="px-4 py-3 font-medium">75th percentile</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {rows.map(({ level, row }) => (
                    <tr key={level.id}>
                      <td className="px-4 py-3">{level.label}</td>
                      <td className="px-4 py-3 tabular-nums">{row!.n}</td>
                      <td className="px-4 py-3 tabular-nums">{compactUsd(row!.p25)}</td>
                      <td className="px-4 py-3 font-medium tabular-nums">{compactUsd(row!.median)}</td>
                      <td className="px-4 py-3 tabular-nums">{compactUsd(row!.p75)}</td>
                    </tr>
                  ))}
                  <tr className="bg-muted/40">
                    <td className="px-4 py-3 font-medium">All levels</td>
                    <td className="px-4 py-3 tabular-nums">{all!.n}</td>
                    <td className="px-4 py-3 tabular-nums">{compactUsd(all!.p25)}</td>
                    <td className="px-4 py-3 font-medium tabular-nums">{compactUsd(all!.median)}</td>
                    <td className="px-4 py-3 tabular-nums">{compactUsd(all!.p75)}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </section>
        ))}
      </div>

      <section className="mt-12 max-w-3xl text-sm leading-relaxed text-muted-foreground">
        <h2 className="text-base font-semibold text-foreground">How these numbers are made</h2>
        <p className="mt-2">
          Each figure uses the midpoint of the salary range on an open role, converted to US dollars at a fixed rate. A group needs at
          least three roles with pay to appear. Listed pay is a range an employer advertises, not what someone was paid, and many
          roles do not list pay at all.{updated ? ` Last calculated ${updated}.` : ''}
        </p>
      </section>
    </JobsShell>
  )
}
