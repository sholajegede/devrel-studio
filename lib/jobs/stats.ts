export interface StatsJob {
  family: string
  seniority: string
  workplace: string
  regions: string[]
  companySlug: string
  companyName: string
  skills: string[]
  postedAt: number
  salaryMinUsd?: number
  salaryMaxUsd?: number
}

export interface JobStatsData {
  updatedAt: number
  total: number
  byFamily: { id: string; count: number }[]
  bySeniority: { id: string; count: number }[]
  byWorkplace: { id: string; count: number }[]
  byRegion: { id: string; count: number }[]
  byCompany: { slug: string; name: string; count: number }[]
  bySkill: { id: string; count: number }[]
  salaries: { family: string; seniority: string; n: number; p25: number; median: number; p75: number }[]
  postedThisWeek: number
  withSalary: number
  remote: number
}

const WEEK_MS = 7 * 24 * 60 * 60 * 1000
const MIN_SAMPLE = 3

function tally(values: string[]): { id: string; count: number }[] {
  const counts = new Map<string, number>()
  for (const value of values) counts.set(value, (counts.get(value) ?? 0) + 1)
  return [...counts.entries()]
    .map(([id, count]) => ({ id, count }))
    .sort((a, b) => b.count - a.count || a.id.localeCompare(b.id))
}

export function percentile(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0
  const index = (sorted.length - 1) * p
  const low = Math.floor(index)
  const high = Math.ceil(index)
  return Math.round(sorted[low] + (sorted[high] - sorted[low]) * (index - low))
}

export function computeStats(jobs: StatsJob[], now: number): JobStatsData {
  const companies = new Map<string, { slug: string; name: string; count: number }>()
  for (const job of jobs) {
    const entry = companies.get(job.companySlug) ?? { slug: job.companySlug, name: job.companyName, count: 0 }
    entry.count++
    companies.set(job.companySlug, entry)
  }

  const buckets = new Map<string, number[]>()
  const push = (key: string, value: number) => {
    const list = buckets.get(key) ?? []
    list.push(value)
    buckets.set(key, list)
  }
  for (const job of jobs) {
    if (job.salaryMinUsd === undefined || job.salaryMaxUsd === undefined) continue
    const midpoint = Math.round((job.salaryMinUsd + job.salaryMaxUsd) / 2)
    push(`${job.family}|${job.seniority}`, midpoint)
    push(`${job.family}|all`, midpoint)
  }

  const salaries = [...buckets.entries()]
    .filter(([, values]) => values.length >= MIN_SAMPLE)
    .map(([key, values]) => {
      const [family, seniority] = key.split('|')
      const sorted = [...values].sort((a, b) => a - b)
      return {
        family,
        seniority,
        n: sorted.length,
        p25: percentile(sorted, 0.25),
        median: percentile(sorted, 0.5),
        p75: percentile(sorted, 0.75),
      }
    })
    .sort((a, b) => a.family.localeCompare(b.family) || a.seniority.localeCompare(b.seniority))

  return {
    updatedAt: now,
    total: jobs.length,
    byFamily: tally(jobs.map((job) => job.family)),
    bySeniority: tally(jobs.map((job) => job.seniority)),
    byWorkplace: tally(jobs.map((job) => job.workplace)),
    byRegion: tally(jobs.flatMap((job) => job.regions)),
    byCompany: [...companies.values()].sort((a, b) => b.count - a.count || a.name.localeCompare(b.name)).slice(0, 200),
    bySkill: tally(jobs.flatMap((job) => job.skills)).slice(0, 60),
    salaries,
    postedThisWeek: jobs.filter((job) => now - job.postedAt < WEEK_MS).length,
    withSalary: jobs.filter((job) => job.salaryMinUsd !== undefined).length,
    remote: jobs.filter((job) => job.workplace === 'remote').length,
  }
}
