import { parseStructuredSalary, type SalaryRange } from './salary'

export type SourceKind = 'greenhouse' | 'lever' | 'ashby' | 'remoteok' | 'wwr' | 'hn' | 'reddit' | 'page'

export interface RawJob {
  externalId: string
  /** Set by aggregators, where every listing has its own employer. */
  company?: string | null
  title: string
  locations: string[]
  isRemote?: boolean | null
  workplaceType?: string | null
  employment?: string | null
  department?: string | null
  descriptionHtml?: string | null
  descriptionText?: string | null
  applyUrl: string
  postedAt?: number | null
  salary?: SalaryRange | null
}

type Json = Record<string, unknown>

function asString(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value : null
}

function asTime(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value === 'string') {
    const parsed = Date.parse(value)
    return Number.isNaN(parsed) ? null : parsed
  }
  return null
}

export const GREENHOUSE_LIST = (slug: string) =>
  `https://boards-api.greenhouse.io/v1/boards/${encodeURIComponent(slug)}/jobs`
export const GREENHOUSE_DETAIL = (slug: string, id: string) =>
  `https://boards-api.greenhouse.io/v1/boards/${encodeURIComponent(slug)}/jobs/${encodeURIComponent(id)}?pay_transparency=true`
export const ASHBY_LIST = (slug: string) =>
  `https://api.ashbyhq.com/posting-api/job-board/${encodeURIComponent(slug)}?includeCompensation=true`
export const LEVER_LIST = (slug: string) =>
  `https://api.lever.co/v0/postings/${encodeURIComponent(slug)}?mode=json`

export function parseGreenhouseList(json: unknown): { id: string; title: string }[] {
  const jobs = (json as { jobs?: Json[] } | null)?.jobs
  if (!Array.isArray(jobs)) throw new Error('Unexpected Greenhouse response')
  return jobs.flatMap((job) =>
    job.id !== undefined && asString(job.title)
      ? [{ id: String(job.id), title: job.title as string }]
      : [],
  )
}

export function parseGreenhouseJob(json: unknown): RawJob | null {
  const job = json as Json | null
  if (!job || job.id === undefined || !asString(job.title)) return null

  const ranges = Array.isArray(job.pay_input_ranges) ? (job.pay_input_ranges as Json[]) : []
  const range = ranges[0]
  const salary = range
    ? parseStructuredSalary({
        min: typeof range.min_cents === 'number' ? range.min_cents / 100 : null,
        max: typeof range.max_cents === 'number' ? range.max_cents / 100 : null,
        currency: asString(range.currency_type),
      })
    : null

  const departments = Array.isArray(job.departments) ? (job.departments as Json[]) : []
  const offices = Array.isArray(job.offices) ? (job.offices as Json[]) : []
  const location = asString((job.location as Json | undefined)?.name)
  const officeLocations = offices.map((office) => asString(office.location) ?? asString(office.name))

  return {
    externalId: String(job.id),
    title: job.title as string,
    locations: [location, ...(location ? [] : officeLocations)].filter((v): v is string => Boolean(v)),
    department: asString(departments[0]?.name),
    descriptionHtml: asString(job.content),
    applyUrl: asString(job.absolute_url) ?? '',
    postedAt: asTime(job.first_published) ?? asTime(job.updated_at),
    salary,
  }
}

export function parseAshby(json: unknown): RawJob[] {
  const jobs = (json as { jobs?: Json[] } | null)?.jobs
  if (!Array.isArray(jobs)) throw new Error('Unexpected Ashby response')

  return jobs.flatMap((job) => {
    if (job.isListed === false || !asString(job.id) || !asString(job.title)) return []
    const components = ((job.compensation as Json | undefined)?.summaryComponents ?? []) as Json[]
    const salaryComponent = components.find(
      (component) => String(component.compensationType).toLowerCase() === 'salary',
    )
    const salary = salaryComponent
      ? parseStructuredSalary({
          min: typeof salaryComponent.minValue === 'number' ? salaryComponent.minValue : null,
          max: typeof salaryComponent.maxValue === 'number' ? salaryComponent.maxValue : null,
          currency: asString(salaryComponent.currencyCode),
          interval: asString(salaryComponent.interval),
        })
      : null
    const secondary = Array.isArray(job.secondaryLocations)
      ? (job.secondaryLocations as Json[]).map((entry) => asString(entry.location))
      : []

    return [
      {
        externalId: job.id as string,
        title: job.title as string,
        locations: [asString(job.location), ...secondary].filter((v): v is string => Boolean(v)),
        isRemote: typeof job.isRemote === 'boolean' ? job.isRemote : null,
        workplaceType: asString(job.workplaceType),
        employment: asString(job.employmentType),
        department: asString(job.department) ?? asString(job.team),
        descriptionHtml: asString(job.descriptionHtml),
        descriptionText: asString(job.descriptionPlain),
        applyUrl: asString(job.applyUrl) ?? asString(job.jobUrl) ?? '',
        postedAt: asTime(job.publishedAt),
        salary,
      },
    ]
  })
}

export function parseLever(json: unknown): RawJob[] {
  if (!Array.isArray(json)) throw new Error('Unexpected Lever response')
  return (json as Json[]).flatMap((job) => {
    if (!asString(job.id) || !asString(job.text)) return []
    const categories = (job.categories ?? {}) as Json
    const all = Array.isArray(categories.allLocations) ? (categories.allLocations as unknown[]) : []
    const range = job.salaryRange as Json | undefined
    const salary = range
      ? parseStructuredSalary({
          min: typeof range.min === 'number' ? range.min : null,
          max: typeof range.max === 'number' ? range.max : null,
          currency: asString(range.currency),
          interval: asString(range.interval),
        })
      : null

    return [
      {
        externalId: job.id as string,
        title: job.text as string,
        locations: (all.length ? all : [categories.location]).filter(
          (v): v is string => typeof v === 'string' && Boolean(v),
        ),
        workplaceType: asString(job.workplaceType),
        employment: asString(categories.commitment),
        department: asString(categories.team),
        descriptionText: [job.descriptionPlain, job.additionalPlain]
          .filter((part): part is string => typeof part === 'string')
          .join('\n\n'),
        applyUrl: asString(job.hostedUrl) ?? asString(job.applyUrl) ?? '',
        postedAt: asTime(job.createdAt),
        salary,
      },
    ]
  })
}
