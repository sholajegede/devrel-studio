import type { RawJob } from './adapters'
import { htmlToText, summarise } from './html'
import { parseLocations, type RemoteScope, type Workplace } from './locations'
import { parseSalaryText, toUsd } from './salary'
import { extractSkills } from './skills'
import {
  FAMILY_BY_ID,
  classifyTitle,
  confirmWithDescription,
  detectEmployment,
  detectSeniority,
  type EmploymentType,
  type FamilyId,
  type SeniorityId,
} from './taxonomy'

export interface NormalizedJob {
  externalId: string
  slug: string
  title: string
  role: string
  family: FamilyId
  seniority: SeniorityId
  employmentType: EmploymentType
  workplace: Workplace
  remoteScope?: RemoteScope
  locationLabel: string
  locations: string[]
  countries: string[]
  regions: string[]
  companyName: string
  companySlug: string
  salaryMin?: number
  salaryMax?: number
  salaryCurrency?: string
  salaryMinUsd?: number
  salaryMaxUsd?: number
  skills: string[]
  topics: string[]
  summary: string
  description: string
  applyUrl: string
  postedAt: number
  groupKey: string
  contentHash: string
  searchText: string
}

export function slugify(value: string): string {
  return value
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

export function fnv(value: string): string {
  let hash = 0x811c9dc5
  for (let i = 0; i < value.length; i++) {
    hash ^= value.charCodeAt(i)
    hash = Math.imul(hash, 0x01000193)
  }
  return (hash >>> 0).toString(36)
}

const MAX_DESCRIPTION = 40_000

export function normalizeJob(
  raw: RawJob,
  company: { name: string; slug: string },
  now: number = Date.now(),
): NormalizedJob | null {
  if (!raw.applyUrl || !/^https?:\/\//.test(raw.applyUrl)) return null

  const classification = classifyTitle(raw.title)
  if (!classification) return null

  const description = (raw.descriptionText ?? htmlToText(raw.descriptionHtml ?? '')).slice(0, MAX_DESCRIPTION)
  if (!confirmWithDescription(classification, `${raw.title} ${company.name} ${description}`)) return null

  const place = parseLocations(raw.locations, {
    isRemote: raw.isRemote,
    workplaceType: raw.workplaceType,
  })
  const salary = raw.salary ?? parseSalaryText(description)
  const { skills, topics } = extractSkills(`${raw.title}\n${description}`)
  const family = FAMILY_BY_ID[classification.family]
  const seniority = detectSeniority(raw.title)
  const companySlug = company.slug || slugify(company.name)

  const slug = `${slugify(`${company.name} ${raw.title}`).slice(0, 72).replace(/-$/, '')}-${fnv(`${companySlug}:${raw.externalId}`).slice(0, 6)}`
  const groupKey = `${companySlug}|${slugify(raw.title)}`

  const salaryFields = salary
    ? {
        salaryMin: salary.min,
        salaryMax: salary.max,
        salaryCurrency: salary.currency,
        ...(toUsd(salary.min, salary.currency) !== null
          ? {
              salaryMinUsd: toUsd(salary.min, salary.currency) as number,
              salaryMaxUsd: toUsd(salary.max, salary.currency) as number,
            }
          : {}),
      }
    : {}

  const normalized: Omit<NormalizedJob, 'contentHash'> = {
    externalId: raw.externalId,
    slug,
    title: raw.title.trim(),
    role: classification.role,
    family: classification.family,
    seniority,
    employmentType: detectEmployment(raw.employment, raw.title),
    workplace: place.workplace,
    ...(place.remoteScope ? { remoteScope: place.remoteScope } : {}),
    locationLabel: place.label,
    locations: place.locations,
    countries: place.countries,
    regions: place.regions,
    companyName: company.name,
    companySlug,
    ...salaryFields,
    skills,
    topics,
    summary: summarise(description),
    description,
    applyUrl: raw.applyUrl,
    postedAt: raw.postedAt && raw.postedAt <= now ? raw.postedAt : now,
    groupKey,
    searchText: [raw.title, company.name, classification.role, family.label, ...skills, ...place.locations]
      .join(' ')
      .toLowerCase(),
  }

  const contentHash = fnv(
    JSON.stringify([
      normalized.title,
      normalized.locations,
      normalized.salaryMin,
      normalized.salaryMax,
      normalized.applyUrl,
      normalized.description,
    ]),
  )

  return { ...normalized, contentHash }
}
