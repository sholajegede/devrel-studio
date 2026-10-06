import { decodeEntities, htmlToText } from './html'
import type { RawJob } from './adapters'

// Careers pages that are the company's own HTML, not a Greenhouse, Lever or Ashby
// board. Each site is registered here by hand, so the sync only ever fetches
// addresses we chose. A new site is one entry plus one seed line.

export interface CareersPage {
  /** Stored as the source slug. */
  key: string
  company: string
  /** The page that lists open roles. */
  indexUrl: string
  /** A link is a posting when it starts with this. */
  postingPrefix: string
  /** Links under the prefix that are not postings. */
  skip?: string[]
}

export const CAREERS_PAGES: CareersPage[] = [
  {
    key: 'appsignal.com',
    company: 'AppSignal',
    indexUrl: 'https://www.appsignal.com/jobs',
    postingPrefix: 'https://www.appsignal.com/jobs/',
    skip: ['faq'],
  },
]

export const pageFor = (key: string) => CAREERS_PAGES.find((page) => page.key === key)

const attr = (tag: string, name: string) =>
  tag.match(new RegExp(`${name}\\s*=\\s*(?:"([^"]*)"|'([^']*)')`, 'i'))?.slice(1).find(Boolean)

/** Posting addresses found on the index page, in page order. */
export function parsePageIndex(html: string, page: CareersPage): string[] {
  const out: string[] = []
  for (const tag of html.match(/<a\s[^>]*>/gi) ?? []) {
    const href = attr(tag, 'href')
    if (!href) continue
    let url: URL
    try {
      url = new URL(decodeEntities(href), page.indexUrl)
    } catch {
      continue
    }
    url.hash = ''
    url.search = ''
    const full = url.toString().replace(/\/$/, '')
    if (!full.startsWith(page.postingPrefix)) continue
    const rest = full.slice(page.postingPrefix.length)
    if (!rest || rest.includes('/') || page.skip?.includes(rest)) continue
    if (!out.includes(full)) out.push(full)
  }
  return out
}

const clean = (value: string) => decodeEntities(value.replace(/<[^>]+>/g, ' ')).replace(/\s+/g, ' ').trim()

function jobPostingLd(html: string): Record<string, unknown> | null {
  for (const match of html.matchAll(/<script[^>]*application\/ld\+json[^>]*>([\s\S]*?)<\/script>/gi)) {
    try {
      const data = JSON.parse(match[1])
      const nodes: unknown[] = Array.isArray(data) ? data : Array.isArray(data?.['@graph']) ? data['@graph'] : [data]
      for (const node of nodes) {
        const type = (node as Record<string, unknown>)?.['@type']
        if (type === 'JobPosting' || (Array.isArray(type) && type.includes('JobPosting'))) return node as Record<string, unknown>
      }
    } catch {
      // Not JSON. Try the next block.
    }
  }
  return null
}

const EMPLOYMENT = /\b(full[- ]time|part[- ]time|contract(?:or)?|freelance|internship)\b/i

/** One posting page. Uses JobPosting data when the page has it, and the visible text when it does not. */
export function parsePageJob(html: string, url: string, page: CareersPage): RawJob | null {
  const ld = jobPostingLd(html)
  const h1 = html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i)?.[1]
  const title = clean(typeof ld?.title === 'string' ? ld.title : h1 ?? '')
  if (!title) return null

  const main = html.match(/<main[^>]*>([\s\S]*?)<\/main>/i)?.[1] ?? html.match(/<article[^>]*>([\s\S]*?)<\/article>/i)?.[1] ?? html
  const body = htmlToText(typeof ld?.description === 'string' ? ld.description : main)
  if (body.length < 200) return null

  // The line under the heading usually reads "Full-time / CET timezone / (Remote (within 2 hours of CET))".
  const afterTitle = body.slice(body.toLowerCase().indexOf(title.toLowerCase()) + title.length).slice(0, 400)
  const facts = afterTitle.split('\n').map((line) => line.trim()).find((line) => EMPLOYMENT.test(line)) ?? ''
  const employment = (typeof ld?.employmentType === 'string' ? ld.employmentType : facts.match(EMPLOYMENT)?.[1]) ?? null
  const remote = /remote/i.test(facts) || /remote/i.test(JSON.stringify(ld?.jobLocationType ?? ''))
  const place = facts.match(/\(([^()]*(?:\([^()]*\))?[^()]*)\)/)?.[1]?.trim()

  const apply = [...html.matchAll(/<a\s[^>]*>[\s\S]*?<\/a>/gi)]
    .map((match) => match[0])
    .find((tag) => /apply/i.test(clean(tag)) && /^https?:/i.test(attr(tag, 'href') ?? ''))
  const applyUrl = (apply && attr(apply, 'href')) || url

  const posted = typeof ld?.datePosted === 'string' ? Date.parse(ld.datePosted) : NaN

  return {
    externalId: url.slice(page.postingPrefix.length),
    company: page.company,
    title,
    locations: place ? [place] : [],
    isRemote: remote || null,
    employment,
    descriptionText: body,
    applyUrl: decodeEntities(applyUrl),
    postedAt: Number.isNaN(posted) ? null : posted,
  }
}
