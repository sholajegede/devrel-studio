import { countryName, type RemoteScope } from './locations'
import { textToBlocks } from './html'
import { payLabel, familyLabel, seniorityLabel } from './ui'

export interface SeoJob {
  slug: string
  title: string
  family: string
  seniority: string
  employmentType?: string
  workplace: string
  remoteScope?: string | null
  locationLabel: string
  locations: string[]
  countries: string[]
  companyName: string
  salaryMin: number | null
  salaryMax: number | null
  salaryCurrency: string | null
  postedAt: number
  status: string
}

const EMPLOYMENT: Record<string, string> = {
  'full-time': 'FULL_TIME',
  'part-time': 'PART_TIME',
  contract: 'CONTRACTOR',
  internship: 'INTERN',
}

const escapeHtml = (value: string) =>
  value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

export function descriptionHtml(text: string): string {
  return textToBlocks(text)
    .map((block) => {
      if (block.kind === 'heading') return `<h3>${escapeHtml(block.text ?? '')}</h3>`
      if (block.kind === 'list') {
        return `<ul>${(block.items ?? []).map((item) => `<li>${escapeHtml(item)}</li>`).join('')}</ul>`
      }
      return `<p>${escapeHtml(block.text ?? '')}</p>`
    })
    .join('')
}

export function jobPostingLd(
  job: SeoJob,
  description: string,
  origin: string,
  expiredAt?: number | null,
) {
  const remote = job.workplace === 'remote'
  const salary =
    job.salaryMin !== null && job.salaryMax !== null && job.salaryCurrency
      ? {
          baseSalary: {
            '@type': 'MonetaryAmount',
            currency: job.salaryCurrency,
            value: {
              '@type': 'QuantitativeValue',
              minValue: job.salaryMin,
              maxValue: job.salaryMax,
              unitText: 'YEAR',
            },
          },
        }
      : {}

  const place = remote
    ? {
        jobLocationType: 'TELECOMMUTE',
        applicantLocationRequirements:
          job.remoteScope === 'worldwide' || job.countries.length === 0
            ? { '@type': 'Country', name: 'Worldwide' }
            : job.countries.map((code) => ({ '@type': 'Country', name: countryName(code) })),
      }
    : {
        jobLocation: (job.locations.length ? job.locations : [job.locationLabel]).map((location) => ({
          '@type': 'Place',
          address: { '@type': 'PostalAddress', addressLocality: location },
        })),
      }

  return {
    '@context': 'https://schema.org',
    '@type': 'JobPosting',
    title: job.title,
    description: descriptionHtml(description) || escapeHtml(job.title),
    identifier: { '@type': 'PropertyValue', name: job.companyName, value: job.slug },
    datePosted: new Date(job.postedAt).toISOString().slice(0, 10),
    ...(expiredAt ? { validThrough: new Date(expiredAt).toISOString() } : {}),
    employmentType: EMPLOYMENT[job.employmentType ?? 'full-time'] ?? 'FULL_TIME',
    hiringOrganization: { '@type': 'Organization', name: job.companyName },
    directApply: false,
    url: `${origin}/jobs/${job.slug}`,
    ...place,
    ...salary,
  }
}

export function itemListLd(
  origin: string,
  name: string,
  jobs: { slug: string; title: string; companyName: string }[],
) {
  return {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    name,
    numberOfItems: jobs.length,
    itemListElement: jobs.map((job, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      url: `${origin}/jobs/${job.slug}`,
      name: `${job.title} at ${job.companyName}`,
    })),
  }
}

export function faqLd(items: { q: string; a: string }[]) {
  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: items.map((item) => ({
      '@type': 'Question',
      name: item.q,
      acceptedAnswer: { '@type': 'Answer', text: item.a },
    })),
  }
}

export function breadcrumbLd(origin: string, trail: { name: string; path: string }[]) {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: trail.map((item, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      name: item.name,
      item: `${origin}${item.path}`,
    })),
  }
}

export function serialiseLd(data: unknown): string {
  return JSON.stringify(data).replace(/</g, '\\u003c').replace(/>/g, '\\u003e').replace(/&/g, '\\u0026')
}

export function jobTitleTag(job: SeoJob): string {
  const where = job.workplace === 'remote' ? 'Remote' : job.locationLabel
  return `${job.title} at ${job.companyName} (${where})`
}

export function jobMetaDescription(job: SeoJob): string {
  const pay = payLabel(job)
  const parts = [
    `${seniorityLabel(job.seniority)} ${familyLabel(job.family).toLowerCase()} role at ${job.companyName}`,
    job.workplace === 'remote' ? 'remote' : job.locationLabel,
    pay ?? '',
  ].filter(Boolean)
  return `${parts.join(' · ')}. Verified against the employer's own careers feed.`
}

export type { RemoteScope }
