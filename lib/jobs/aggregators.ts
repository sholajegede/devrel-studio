// Sources that carry many employers, and most of the contract work: RemoteOK,
// We Work Remotely, the Hacker News hiring threads and r/forhire. Each parser
// is pure; fetching lives in convex/jobSync.ts.

import type { RawJob } from './adapters'
import { decodeEntities, htmlToText } from './html'
import { parseStructuredSalary } from './salary'
import { classifyTitle } from './taxonomy'

type Json = Record<string, unknown>

function str(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null
}

// ── RemoteOK ──────────────────────────────────────────────────────────────────

export const REMOTEOK_URL = (tag: string) => `https://remoteok.com/api?tag=${encodeURIComponent(tag)}`

export function parseRemoteOk(json: unknown): RawJob[] {
  if (!Array.isArray(json)) throw new Error('Unexpected RemoteOK response')
  const jobs: RawJob[] = []
  for (const item of json as Json[]) {
    const title = str(item.position)
    const url = str(item.url) ?? str(item.apply_url)
    if (!title || !url || item.id === undefined) continue // the first element is a legal notice
    const tags = Array.isArray(item.tags) ? (item.tags as unknown[]).filter((t): t is string => typeof t === 'string') : []
    const min = typeof item.salary_min === 'number' && item.salary_min > 0 ? item.salary_min : null
    const max = typeof item.salary_max === 'number' && item.salary_max > 0 ? item.salary_max : null
    const epoch = typeof item.epoch === 'number' ? item.epoch * 1000 : Date.parse(String(item.date ?? ''))
    jobs.push({
      externalId: `rok-${item.id}`,
      company: str(item.company),
      title,
      locations: [str(item.location) ?? 'Remote'],
      isRemote: true,
      employment: tags.some((tag) => /contract|freelance/i.test(tag)) ? 'contract' : null,
      descriptionHtml: str(item.description),
      applyUrl: url,
      postedAt: Number.isFinite(epoch) ? epoch : null,
      salary: min && max ? parseStructuredSalary({ min, max, currency: 'USD' }) : null,
    })
  }
  return jobs
}

// ── We Work Remotely (RSS) ────────────────────────────────────────────────────

export const WWR_URL = (slug: string) =>
  slug === 'all' ? 'https://weworkremotely.com/remote-jobs.rss' : `https://weworkremotely.com/categories/${encodeURIComponent(slug)}.rss`

function tag(block: string, name: string): string | null {
  const match = new RegExp(`<${name}[^>]*>([\\s\\S]*?)</${name}>`, 'i').exec(block)
  if (!match) return null
  const inner = match[1].replace(/^\s*<!\[CDATA\[([\s\S]*?)\]\]>\s*$/, '$1')
  return inner.trim() || null
}

export function parseWwr(xml: string): RawJob[] {
  if (!/<rss|<channel/i.test(xml)) throw new Error('Unexpected We Work Remotely response')
  const jobs: RawJob[] = []
  for (const match of xml.matchAll(/<item>([\s\S]*?)<\/item>/gi)) {
    const block = match[1]
    const rawTitle = tag(block, 'title')
    const link = tag(block, 'link') ?? tag(block, 'guid')
    if (!rawTitle || !link) continue
    const decoded = decodeEntities(rawTitle)
    const split = decoded.indexOf(': ')
    const company = split > 0 ? decoded.slice(0, split).trim() : null
    const title = split > 0 ? decoded.slice(split + 2).trim() : decoded
    const published = Date.parse(tag(block, 'pubDate') ?? '')
    jobs.push({
      externalId: `wwr-${link.replace(/^https?:\/\/[^/]+/, '')}`,
      company,
      title,
      locations: [decodeEntities(tag(block, 'region') ?? tag(block, 'country') ?? 'Remote')],
      isRemote: true,
      employment: tag(block, 'type'),
      descriptionHtml: tag(block, 'description'),
      applyUrl: link,
      postedAt: Number.isNaN(published) ? null : published,
    })
  }
  return jobs
}

// ── Hacker News hiring threads ────────────────────────────────────────────────

export const HN_THREADS = (query: string) =>
  `https://hn.algolia.com/api/v1/search_by_date?tags=story,author_whoishiring&query=${encodeURIComponent(query)}&hitsPerPage=3`
export const HN_ITEM = (id: string | number) => `https://hn.algolia.com/api/v1/items/${id}`

export function parseHnThreadIds(json: unknown, titlePattern: RegExp): string[] {
  const hits = (json as { hits?: Json[] } | null)?.hits
  if (!Array.isArray(hits)) throw new Error('Unexpected Hacker News response')
  return hits
    .filter((hit) => titlePattern.test(String(hit.title ?? '')))
    .slice(0, 2)
    .map((hit) => String(hit.objectID))
}

interface HnComment {
  id?: number
  text?: string | null
  created_at_i?: number
}

/**
 * Hacker News headers are free text, so a role can arrive as a stack list such as
 * "Python/Ruby/PHP/Js/Rust/Kotlin/C#/Crystal/Nim/Elixir Developer Advocate positions".
 * Keep the role itself: drop a leading chain of slash-joined names, a trailing
 * "positions" or "roles", and anything after a dash, colon or bracket.
 */
export function tidyHnTitle(raw: string): string {
  let title = raw.replace(/^(?:[\w.#+-]+\/){2,}[\w.#+-]+\s+/, '')
  title = title.replace(/\s+(?:positions?|roles?|openings?|vacancies)$/i, '')
  title = title.split(/\s+[-–—]\s+|\s*[:(\[]/)[0].trim()
  if (title.length > 70) title = title.slice(0, 70).replace(/\s+\S*$/, '').trim()
  return title.length >= 5 ? title : raw.slice(0, 70).trim()
}

/**
 * Top-level comments are one job each. The header is the first line, pipe
 * separated: Company | Role | Location | Remote. Only comments whose header
 * names a DevRel-spectrum role are kept.
 */
export function parseHnComments(json: unknown, mode: 'hiring' | 'freelancer'): RawJob[] {
  const children = (json as { children?: HnComment[] } | null)?.children
  if (!Array.isArray(children)) throw new Error('Unexpected Hacker News thread')
  const jobs: RawJob[] = []
  for (const comment of children) {
    if (!comment.id || !comment.text) continue
    // HN separates paragraphs with a bare <p>, which htmlToText would run together.
    const text = htmlToText(comment.text.replace(/<p>/gi, '\n'))
    const header = text.split('\n').find((line) => line.trim())?.trim() ?? ''
    if (!header.includes('|')) continue
    if (mode === 'freelancer' && !/^seeking freelancer/i.test(header)) continue

    const segments = header
      .split('|')
      .map((segment) => segment.trim())
      .filter(Boolean)
      .filter((segment) => !/^seeking (freelancer|work)$/i.test(segment))
    if (segments.length < 2) continue

    const matched = segments.find((segment, index) => index > 0 && classifyTitle(segment) !== null)
    if (!matched) continue
    const title = tidyHnTitle(matched)
    if (classifyTitle(title) === null) continue
    const company = segments[0]
    const place = segments.filter((segment) => segment !== company && segment !== matched)
    const locations = place.filter((segment) => /remote|onsite|on-site|hybrid|,/i.test(segment) || /\b[A-Z]{2,}\b/.test(segment)).slice(0, 2)

    jobs.push({
      externalId: `hn-${comment.id}`,
      company,
      title,
      locations: locations.length ? locations : ['Remote'],
      isRemote: /\bremote\b/i.test(header) ? true : null,
      employment: mode === 'freelancer' || /\b(contract|freelance|part.?time)\b/i.test(header) ? (/part.?time/i.test(header) ? 'part-time' : 'contract') : null,
      descriptionText: text,
      applyUrl: `https://news.ycombinator.com/item?id=${comment.id}`,
      postedAt: comment.created_at_i ? comment.created_at_i * 1000 : null,
    })
  }
  return jobs
}

// ── Reddit (needs an app-only OAuth token) ────────────────────────────────────

export const REDDIT_LISTING = (subreddit: string) => `https://oauth.reddit.com/r/${encodeURIComponent(subreddit)}/new?limit=100`

export function parseReddit(json: unknown, subreddit: string): RawJob[] {
  const children = (json as { data?: { children?: { data?: Json }[] } } | null)?.data?.children
  if (!Array.isArray(children)) throw new Error('Unexpected Reddit response')
  const jobs: RawJob[] = []
  for (const child of children) {
    const post = child.data
    if (!post) continue
    const raw = str(post.title)
    if (!raw || !/\[hiring\]/i.test(raw)) continue
    const title = raw.replace(/\[[^\]]*\]/g, '').replace(/\s+/g, ' ').trim()
    if (!title || !classifyTitle(title)) continue
    const author = str(post.author) ?? 'reddit'
    jobs.push({
      externalId: `reddit-${post.id}`,
      company: `u/${author} on r/${subreddit}`,
      title,
      locations: ['Remote'],
      isRemote: null,
      employment: 'contract',
      descriptionText: str(post.selftext) ?? title,
      applyUrl: `https://www.reddit.com${str(post.permalink) ?? ''}`,
      postedAt: typeof post.created_utc === 'number' ? post.created_utc * 1000 : null,
    })
  }
  return jobs
}
