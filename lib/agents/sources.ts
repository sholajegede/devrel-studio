// ── Source readers ────────────────────────────────────────────────────────────
//
// Scout reads public posts from content platforms and turns each one into a
// candidate entry. This file holds the parts that need no network: building the
// request, reading the response, and choosing which candidates are new.
//
// Both readers are defensive. A platform that changes a field must produce an
// empty page and an error message, never a crash or a half-built entry.

import { canonicalUrl } from './proposals'

export type Provider = 'devto' | 'hashnode'
export const PROVIDERS: readonly Provider[] = ['devto', 'hashnode']

export const PROVIDER_LABEL: Record<Provider, string> = {
  devto: 'Dev.to',
  hashnode: 'Hashnode',
}

/** What the platform column holds for an entry from this provider. */
export const PROVIDER_PLATFORM: Record<Provider, string> = {
  devto: 'Dev.to',
  hashnode: 'Hashnode',
}

export interface Candidate {
  title: string
  link: string
  /** YYYY-MM-DD */
  publicationDate: string
  externalId: string
}

const DEVTO_USER = /^[A-Za-z0-9_-]{1,40}$/
const HOST = /^(?=.{4,253}$)([a-z0-9]([a-z0-9-]*[a-z0-9])?\.)+[a-z]{2,}$/i

/**
 * Check what the person typed and return the form we store, or an error in
 * plain words. Dev.to takes a username. Hashnode takes a blog address; a bare
 * name becomes name.hashnode.dev.
 */
export function normalizeHandle(
  provider: Provider,
  raw: string,
): { ok: true; handle: string } | { ok: false; error: string } {
  const bare = raw.trim().replace(/^https?:\/\//i, '').replace(/^@/, '')
  if (provider === 'devto') {
    const name = bare.replace(/^(www\.)?dev\.to\//i, '').replace(/[/?#].*$/, '')
    return DEVTO_USER.test(name)
      ? { ok: true, handle: name.toLowerCase() }
      : { ok: false, error: 'Enter your Dev.to username, like shola.' }
  }
  const value = bare.replace(/[/?#].*$/, '')
  const host = value.includes('.') ? value : value ? `${value}.hashnode.dev` : ''
  return HOST.test(host)
    ? { ok: true, handle: host.toLowerCase() }
    : { ok: false, error: 'Enter your Hashnode blog address, like name.hashnode.dev.' }
}

export const DEVTO_PAGE_SIZE = 100
export const HASHNODE_PAGE_SIZE = 20
/** A hard stop so a bad response cannot loop forever. */
export const MAX_PAGES = 10

export function devtoUrl(handle: string, page: number): string {
  return `https://dev.to/api/articles?username=${encodeURIComponent(handle)}&per_page=${DEVTO_PAGE_SIZE}&page=${page}`
}

export const HASHNODE_ENDPOINT = 'https://gql.hashnode.com'

export const HASHNODE_QUERY = `query Posts($host: String!, $after: String) {
  publication(host: $host) {
    posts(first: ${HASHNODE_PAGE_SIZE}, after: $after) {
      edges { node { id title url publishedAt } }
      pageInfo { endCursor hasNextPage }
    }
  }
}`

function isoDay(value: unknown): string {
  if (typeof value !== 'string') return ''
  const day = value.slice(0, 10)
  return /^\d{4}-\d{2}-\d{2}$/.test(day) && !Number.isNaN(Date.parse(day)) ? day : ''
}

function text(value: unknown): string {
  return typeof value === 'string' ? value.trim() : ''
}

/** Read one page of the Dev.to articles response. */
export function parseDevtoPage(json: unknown): { items: Candidate[]; done: boolean; error?: string } {
  if (!Array.isArray(json)) {
    return { items: [], done: true, error: 'Dev.to sent a reply we could not read.' }
  }
  const items: Candidate[] = []
  for (const raw of json) {
    const row = (raw ?? {}) as Record<string, unknown>
    const title = text(row.title)
    const link = text(row.url)
    const publicationDate = isoDay(row.published_at ?? row.published_timestamp)
    if (!title || !canonicalUrl(link) || !publicationDate) continue
    items.push({ title, link, publicationDate, externalId: String(row.id ?? link) })
  }
  return { items, done: json.length < DEVTO_PAGE_SIZE }
}

/** Read one page of the Hashnode GraphQL response. */
export function parseHashnodePage(
  json: unknown,
): { items: Candidate[]; done: boolean; cursor?: string; error?: string } {
  const root = (json ?? {}) as { data?: { publication?: unknown }; errors?: unknown }
  const publication = root.data?.publication as
    | { posts?: { edges?: unknown; pageInfo?: { endCursor?: unknown; hasNextPage?: unknown } } }
    | null
    | undefined
  if (publication === null) {
    return { items: [], done: true, error: 'Hashnode has no blog at that address.' }
  }
  const edges = publication?.posts?.edges
  if (!Array.isArray(edges)) {
    return { items: [], done: true, error: 'Hashnode sent a reply we could not read.' }
  }
  const items: Candidate[] = []
  for (const edge of edges) {
    const node = ((edge ?? {}) as { node?: Record<string, unknown> }).node ?? {}
    const title = text(node.title)
    const link = text(node.url)
    const publicationDate = isoDay(node.publishedAt)
    if (!title || !canonicalUrl(link) || !publicationDate) continue
    items.push({ title, link, publicationDate, externalId: String(node.id ?? link) })
  }
  const info = publication?.posts?.pageInfo
  const cursor = typeof info?.endCursor === 'string' ? info.endCursor : undefined
  return { items, done: info?.hasNextPage !== true || !cursor, cursor }
}

/**
 * Keep the candidates that are new: not already an entry, not already proposed
 * in any state, and not repeated inside this batch.
 */
export function newCandidates(
  candidates: Candidate[],
  knownCanonical: ReadonlySet<string>,
): Candidate[] {
  const seen = new Set(knownCanonical)
  const fresh: Candidate[] = []
  for (const candidate of candidates) {
    const key = canonicalUrl(candidate.link)
    if (!key || seen.has(key)) continue
    seen.add(key)
    fresh.push(candidate)
  }
  return fresh
}
