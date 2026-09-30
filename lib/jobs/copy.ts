import { FAMILIES, SENIORITY_BY_ID, type SeniorityId } from './taxonomy'
import { compactUsd } from './ui'

export interface CopyStats {
  total: number
  remote: number
  withSalary: number
  postedThisWeek: number
  updatedAt: number
  byCompany: { slug: string; name: string; count: number }[]
  byFamily: { id: string; count: number }[]
  byRegion: { id: string; count: number }[]
  salaries: { family: string; seniority: string; n: number; p25: number; median: number; p75: number }[]
}

export function salaryFor(stats: CopyStats | null, family: string, seniority = 'all') {
  return stats?.salaries.find((row) => row.family === family && row.seniority === seniority) ?? null
}

export function marketSummary(stats: CopyStats | null): string {
  if (!stats || stats.total === 0) {
    return 'Developer relations roles from employers’ own careers pages, refreshed three times a day.'
  }
  const share = Math.round((stats.remote / stats.total) * 100)
  const advocacy = salaryFor(stats, 'advocacy')
  const pay = advocacy
    ? ` The median listed salary for developer advocacy roles is ${compactUsd(advocacy.median)} a year, from ${advocacy.n} roles that list pay.`
    : ''
  return (
    `There are ${stats.total.toLocaleString('en-US')} open developer relations roles across ${stats.byCompany.length.toLocaleString('en-US')} companies. ` +
    `${share}% are remote, ${stats.withSalary.toLocaleString('en-US')} list a salary, and ${stats.postedThisWeek.toLocaleString('en-US')} were posted in the last seven days.` +
    pay
  )
}

export function faqItems(stats: CopyStats | null): { q: string; a: string }[] {
  const families = FAMILIES.filter((family) => family.core).map((family) => family.label.toLowerCase())
  const advocacy = salaryFor(stats, 'advocacy')
  const senior = salaryFor(stats, 'advocacy', 'senior')

  const items = [
    {
      q: 'What is a developer relations job?',
      a: 'A developer relations (DevRel) job helps a company work with the developers who use its product. Typical roles are developer advocate, DevRel engineer, developer success engineer, community manager, technical writer and developer educator.',
    },
    {
      q: 'Which job titles count as DevRel here?',
      a: `This board covers ${families.join(', ')}. Adjacent roles such as developer marketing and internal developer experience engineering are available behind a toggle.`,
    },
  ]

  if (advocacy) {
    items.push({
      q: 'How much do developer advocates earn?',
      a:
        `Among ${advocacy.n} developer advocacy roles that list pay, the median is ${compactUsd(advocacy.median)} a year, and the middle half of roles pay between ${compactUsd(advocacy.p25)} and ${compactUsd(advocacy.p75)}.` +
        (senior ? ` For senior roles the median is ${compactUsd(senior.median)} (${senior.n} roles).` : ''),
    })
  }

  if (stats && stats.total > 0) {
    items.push({
      q: 'Are there remote DevRel jobs?',
      a: `Yes. ${stats.remote.toLocaleString('en-US')} of ${stats.total.toLocaleString('en-US')} open roles are remote. Each listing says whether remote means worldwide, a region or a single country, and you can set where you live to see which roles are open to you.`,
    })
  }

  items.push(
    {
      q: 'Where do these listings come from?',
      a: 'Directly from each employer’s own careers page, through the applicant tracking systems Greenhouse, Lever and Ashby. Every role links to the employer’s application page, and closed roles are removed on the next refresh.',
    },
    {
      q: 'How often is the board updated?',
      a: 'Three times a day, at 06:00, 14:00 and 22:00 UTC.',
    },
  )

  return items
}

export function seniorityName(id: string): string {
  return SENIORITY_BY_ID[id as SeniorityId]?.label ?? id
}
