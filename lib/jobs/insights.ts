import { percentile } from './stats'

export interface InsightJob {
  title: string
  family: string
  seniority: string
  regions: string[]
  workplace: string
  companySlug: string
  companyName: string
  slug: string
  postedAt: number
  salaryMinUsd?: number
  salaryMaxUsd?: number
}

const DAY = 24 * 60 * 60 * 1000
const MIN_SAMPLE = 3

export interface Benchmark {
  n: number
  p25: number
  median: number
  p75: number
  low: number
  high: number
  scope: 'exact' | 'level' | 'family'
  topPaying: { company: string; slug: string; title: string; max: number }[]
}

function summarise(jobs: InsightJob[]) {
  const pay = jobs
    .filter((job) => job.salaryMinUsd !== undefined && job.salaryMaxUsd !== undefined)
    .map((job) => ({ job, mid: Math.round((job.salaryMinUsd! + job.salaryMaxUsd!) / 2) }))
  const sorted = pay.map((item) => item.mid).sort((a, b) => a - b)
  return { pay, sorted }
}

/**
 * Pay for one role, level and region. Widens honestly when the exact slice has
 * fewer than three salaries: region first, then level, never invented.
 */
export function benchmarkFor(
  jobs: InsightJob[],
  query: { family: string; seniority?: string; region?: string },
): Benchmark | null {
  const inFamily = jobs.filter((job) => job.family === query.family)
  const tries: { scope: Benchmark['scope']; rows: InsightJob[] }[] = [
    {
      scope: 'exact',
      rows: inFamily.filter(
        (job) =>
          (!query.seniority || job.seniority === query.seniority) &&
          (!query.region || job.workplace === 'remote' || job.regions.includes(query.region)),
      ),
    },
    { scope: 'level', rows: inFamily.filter((job) => !query.seniority || job.seniority === query.seniority) },
    { scope: 'family', rows: inFamily },
  ]
  for (const attempt of tries) {
    const { pay, sorted } = summarise(attempt.rows)
    if (sorted.length < MIN_SAMPLE) continue
    return {
      n: sorted.length,
      p25: percentile(sorted, 0.25),
      median: percentile(sorted, 0.5),
      p75: percentile(sorted, 0.75),
      low: sorted[0],
      high: sorted[sorted.length - 1],
      scope: attempt.scope,
      topPaying: [...pay]
        .sort((a, b) => b.job.salaryMaxUsd! - a.job.salaryMaxUsd!)
        .slice(0, 5)
        .map(({ job }) => ({ company: job.companyName, slug: job.slug, title: job.title, max: job.salaryMaxUsd! })),
    }
  }
  return null
}

export interface HiringSignals {
  repeat: { company: string; slug: string; open: number; titles: string[] }[]
  longestOpen: { company: string; slug: string; title: string; jobSlug: string; days: number }[]
  surging: { company: string; slug: string; newThisWeek: number; open: number }[]
  churn: { company: string; slug: string; closedLast30: number }[]
}

export function hiringSignals(
  active: InsightJob[],
  closedRecently: { companySlug: string; companyName: string }[],
  now: number,
): HiringSignals {
  const byCompany = new Map<string, InsightJob[]>()
  for (const job of active) {
    const list = byCompany.get(job.companySlug) ?? []
    list.push(job)
    byCompany.set(job.companySlug, list)
  }

  const repeat = [...byCompany.entries()]
    .map(([slug, jobs]) => {
      const titles = new Map<string, number>()
      for (const job of jobs) titles.set(job.title.toLowerCase(), (titles.get(job.title.toLowerCase()) ?? 0) + 1)
      return {
        company: jobs[0].companyName,
        slug,
        open: jobs.length,
        repeats: [...titles.values()].filter((count) => count > 1).length,
        titles: [...new Set(jobs.map((job) => job.title))].slice(0, 4),
      }
    })
    .filter((row) => row.open >= 2)
    .sort((a, b) => b.repeats - a.repeats || b.open - a.open)
    .slice(0, 15)
    .map(({ repeats: _repeats, ...row }) => row)

  const longestOpen = [...active]
    .sort((a, b) => a.postedAt - b.postedAt)
    .slice(0, 15)
    .map((job) => ({
      company: job.companyName,
      slug: job.companySlug,
      title: job.title,
      jobSlug: job.slug,
      days: Math.max(0, Math.floor((now - job.postedAt) / DAY)),
    }))

  const surging = [...byCompany.entries()]
    .map(([slug, jobs]) => ({
      company: jobs[0].companyName,
      slug,
      newThisWeek: jobs.filter((job) => now - job.postedAt < 7 * DAY).length,
      open: jobs.length,
    }))
    .filter((row) => row.newThisWeek >= 2)
    .sort((a, b) => b.newThisWeek - a.newThisWeek)
    .slice(0, 10)

  const closed = new Map<string, { company: string; slug: string; closedLast30: number }>()
  for (const job of closedRecently) {
    const row = closed.get(job.companySlug) ?? { company: job.companyName, slug: job.companySlug, closedLast30: 0 }
    row.closedLast30++
    closed.set(job.companySlug, row)
  }
  const churn = [...closed.values()].filter((row) => row.closedLast30 >= 2).sort((a, b) => b.closedLast30 - a.closedLast30).slice(0, 10)

  return { repeat, longestOpen, surging, churn }
}
