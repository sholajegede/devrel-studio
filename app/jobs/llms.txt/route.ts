import { field, isoDay, lines, link, llmsResponse, oneLine } from '@/lib/llms-txt'
import { marketSummary, salaryFor } from '@/lib/jobs/copy'
import { loadList, loadStats } from '@/lib/jobs/server'
import { FAMILIES } from '@/lib/jobs/taxonomy'
import { compactUsd, familyLabel, payLabel, seniorityLabel, WORKPLACE_LABEL } from '@/lib/jobs/ui'
import { siteOrigin } from '@/lib/site'

export const dynamic = 'force-dynamic'

const CACHE_SECONDS = 900

export async function GET() {
  const origin = siteOrigin()
  const [stats, list] = await Promise.all([loadStats(), loadList({ limit: 100, includeAdjacent: true })])

  const header = lines(
    '# DevRel Studio: DevRel jobs',
    '',
    `> ${oneLine(marketSummary(stats))}`,
    '',
    field('Board', `${origin}/jobs`),
    field('Salaries', `${origin}/jobs/salaries`),
    field('Companies hiring', `${origin}/jobs/companies`),
    field('JSON API', `${origin}/api/jobs`),
    field('RSS', `${origin}/jobs/feed.xml`),
    field('Source', 'Employers’ own careers feeds (Greenhouse, Lever, Ashby)'),
    field('Refreshed', 'Three times a day: 06:00, 14:00 and 22:00 UTC'),
    field('Generated', isoDay(Date.now())),
  )

  const roles = FAMILIES.map((family) => {
    const count = stats?.byFamily.find((entry) => entry.id === family.id)?.count ?? 0
    const pay = salaryFor(stats, family.id)
    return lines(
      `- ${link(family.label, `${origin}/jobs/roles/${family.id}`)}: ${count} open`,
      pay ? `  - Median listed salary: ${compactUsd(pay.median)} (${pay.n} roles with pay)` : null,
    )
  }).join('\n')

  const jobs = (list?.items ?? [])
    .map((job) =>
      lines(
        `### ${oneLine(job.title)} at ${oneLine(job.companyName)}`,
        '',
        field('URL', `${origin}/jobs/${job.slug}`),
        field('Type', familyLabel(job.family)),
        field('Level', seniorityLabel(job.seniority)),
        field('Workplace', WORKPLACE_LABEL[job.workplace] ?? job.workplace),
        field('Location', oneLine(job.locationLabel)),
        field('Pay', payLabel(job)),
        field('Posted', isoDay(job.postedAt)),
      ),
    )
    .join('\n\n')

  return llmsResponse(
    lines(header, '', '## Role types', '', roles, '', '## Latest roles', '', jobs || '_No open roles yet._'),
    CACHE_SECONDS,
  )
}
