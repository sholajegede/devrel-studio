import { CATEGORIES, type Category } from './types'
import {
  CATEGORY_METRIC,
  aggregate,
  categoryOf,
  formatCompact,
  type MetricSource,
} from './metrics'

// ── llms.txt ──────────────────────────────────────────────────────────────────
//
// A machine-readable description of a page, served next to it: /llms.txt for
// the site, /@handle/llms.txt for a portfolio, and llms.txt on a client
// dashboard host. The shape follows llmstxt.org — an H1, a blockquote summary,
// then sections — with the dense `- Field: value` lines the Convex components
// directory uses, because an agent reading this wants the numbers without
// parsing prose.
//
// The rule every builder below obeys: **an llms.txt says exactly what the HTML
// page at the same URL already says, and nothing more.** The temptation is to
// reach for the underlying row because it is right there and richer. Doing that
// is how `notes` and `trackingLink` — internal fields on every content entry —
// end up world-readable in a file specifically designed to be hoovered up. Each
// builder is handed a projection, never a document.

/**
 * Flatten a piece of user-authored text into one safe line.
 *
 * Bios, titles, tags and client names are typed by customers and land in a file
 * whose entire audience is machines reading it as structure. A bio containing a
 * newline followed by "## sholajegede" would forge an index entry; one
 * containing "- URL: …" would forge a field on the entry above it. Newlines are
 * what make either possible, so they do not survive, and a line that still
 * begins with markdown structure after that has the marker escaped.
 *
 * This is not paranoia about a specific attack so much as the ordinary rule
 * that user text is data: it may describe itself, and it may not describe the
 * document it sits in.
 */
export function oneLine(value: string | null | undefined): string {
  if (!value) return ''
  const flattened = value.replace(/\s+/g, ' ').trim()
  return flattened.replace(/^([#>\-*+]|\d+\.)/, '\\$1')
}

/** `- Label: value`, omitted entirely when there is no value to state. */
export function field(label: string, value: string | number | null | undefined): string | null {
  if (value === null || value === undefined || value === '') return null
  return `- ${label}: ${value}`
}

/** Drops the nulls a run of `field()` calls leaves behind. */
export function lines(...parts: (string | null | undefined)[]): string {
  return parts.filter((part): part is string => part !== null && part !== undefined).join('\n')
}

/**
 * A link whose text cannot break out of the brackets.
 *
 * Falls back to plain text when there is no target. Work that has not shipped
 * yet — a draft, something scheduled — has an empty `link`, and `[Title]()` is
 * both ugly and a promise the file cannot keep.
 */
export function link(text: string, href: string): string {
  const safeText = oneLine(text).replace(/[[\]]/g, '')
  const target = href.trim()
  if (!target) return safeText

  // Only the characters that end a markdown link early are escaped. Running
  // encodeURI over the whole thing would be the obvious move and is wrong: a
  // link that already carries a percent-escape — which any post with a
  // non-ASCII slug does — would come back with its "%" re-encoded and the URL
  // pointing nowhere.
  // Spelled out rather than handed to encodeURIComponent, which leaves "(" and
  // ")" alone — they are unreserved characters, and they are also exactly the
  // two that close a markdown link.
  const ESCAPES: Record<string, string> = {
    '(': '%28',
    ')': '%29',
    '<': '%3C',
    '>': '%3E',
  }
  const safeHref = target.replace(/[\s()<>]/g, (c) => ESCAPES[c] ?? '%20')
  return `[${safeText || safeHref}](${safeHref})`
}

// ── Entries ───────────────────────────────────────────────────────────────────

/**
 * The only shape any builder here accepts.
 *
 * Deliberately narrow. A caller holding a full `contentEntries` document has to
 * name each field it wants to publish, which turns "what leaves the building"
 * into a decision somebody made rather than a consequence of what the document
 * happened to contain.
 */
export interface LlmsEntry extends MetricSource {
  title: string
  link: string
  platform: string
  publicationDate: string
  category?: string
  contentType?: string
  tags?: string[]
  status?: string
  packageName?: string
  eventName?: string
  eventLocation?: string
  podcastName?: string
}

/**
 * The label that names the number this category is measured by.
 *
 * The label is plural in the UI, where it heads a column. Here it follows the
 * number in what reads as a sentence, so a count of one drops the "s" — "1
 * stars" is the kind of thing that makes a generated file look generated.
 */
function metricOf(entry: LlmsEntry): string | null {
  const category = categoryOf(entry)
  const { key, label } = CATEGORY_METRIC[category]
  const value = entry[key]
  if (!value) return null

  const noun = value === 1 ? label.toLowerCase().replace(/s$/, '') : label.toLowerCase()
  return `${formatCompact(value)} ${noun}`
}

/** What a piece of work is called on the page, beyond its title. */
function subtitleOf(entry: LlmsEntry): string | null {
  const category = categoryOf(entry)
  if (category === 'Event') {
    return oneLine([entry.eventName, entry.eventLocation].filter(Boolean).join(', ')) || null
  }
  if (category === 'Podcast') return oneLine(entry.podcastName) || null
  if (category === 'Package') return oneLine(entry.packageName) || null
  return null
}

/**
 * One entry, one line.
 *
 * `withStatus` is off for portfolios, where every entry is Published by
 * construction and the word would be noise, and on for client dashboards, where
 * a manager sees drafts and scheduled work alongside shipped work and the file
 * would misrepresent the page by leaving it out.
 */
export function entryLine(entry: LlmsEntry, options?: { withStatus?: boolean }): string {
  const facts = [
    categoryOf(entry),
    subtitleOf(entry),
    oneLine(entry.platform) || null,
    entry.publicationDate,
    metricOf(entry),
    options?.withStatus ? entry.status : null,
  ].filter(Boolean)

  return `- ${link(entry.title, entry.link)} — ${facts.join(' · ')}`
}

/** Entries grouped under a heading per category, busiest category first. */
export function categorySections(
  entries: readonly LlmsEntry[],
  options?: { withStatus?: boolean; level?: number },
): string {
  const heading = '#'.repeat(options?.level ?? 2)

  const grouped = CATEGORIES.map((category: Category) => ({
    category,
    rows: entries.filter((entry) => categoryOf(entry) === category),
  }))
    .filter((group) => group.rows.length > 0)
    .sort((a, b) => b.rows.length - a.rows.length)

  return grouped
    .map(
      (group) =>
        `${heading} ${group.category} (${group.rows.length})\n\n` +
        group.rows.map((entry) => entryLine(entry, options)).join('\n'),
    )
    .join('\n\n')
}

/**
 * `12.4K views`, `1 star`, or nothing at all when the number is zero.
 *
 * `plural` is spelled out where adding an "s" does not produce the word — the
 * downloads total also carries podcast listens, and "download/listens" is not
 * how anybody writes that.
 */
function count(value: number, singular: string, plural?: string): string | null {
  if (!value) return null
  return `${formatCompact(value)} ${value === 1 ? singular : (plural ?? `${singular}s`)}`
}

/**
 * The headline numbers, as one line.
 *
 * Only metrics a category actually owns are counted — `aggregate` already
 * refuses to add an Event's stray `views` into the views total — so a zero here
 * means nothing of that kind was logged, not that it was logged as nothing.
 */
export function totalsLine(entries: readonly LlmsEntry[]): string | null {
  const totals = aggregate(entries)
  const parts = [
    count(totals.views, 'view'),
    count(totals.downloads, 'download or listen', 'downloads and listens'),
    count(totals.attendees, 'attendee'),
    count(totals.stars, 'star'),
    count(totals.reshares, 'reshare'),
  ].filter(Boolean)

  return parts.length ? parts.join(' · ') : null
}

/**
 * The date of the most recently *published* entry.
 *
 * Published only, deliberately. A client dashboard lists scheduled work too, and
 * taking the newest date across everything would report a talk three weeks from
 * now as the latest thing shipped.
 */
export function latestPublished(entries: readonly LlmsEntry[]): string | null {
  return entries.reduce<string | null>(
    (newest, entry) =>
      entry.status === 'Published' && (!newest || entry.publicationDate > newest)
        ? entry.publicationDate
        : newest,
    null,
  )
}

/**
 * A website as an absolute URL.
 *
 * The settings form accepts "sholajegede.com", and the page renders it through
 * an anchor that the browser resolves. A bare host in a text file resolves
 * against nothing, so anything without a scheme gets https.
 */
export function absoluteUrl(value: string | null | undefined): string | null {
  const trimmed = oneLine(value)
  if (!trimmed) return null
  return /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`
}

/** ISO date for the `Updated:` field, tolerant of a value that is not one. */
export function isoDay(value: string | number | Date | null | undefined): string | null {
  if (value === null || value === undefined || value === '') return null
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? null : date.toISOString().slice(0, 10)
}

// ── Response ──────────────────────────────────────────────────────────────────

/**
 * text/plain, not text/markdown.
 *
 * The file is markdown and every consumer treats it as such, but naming it
 * text/markdown makes a browser download it instead of showing it, and the
 * first thing anybody does with a new llms.txt is open it in a tab to check it.
 */
export function llmsResponse(body: string, cacheSeconds: number): Response {
  return new Response(body.trimEnd() + '\n', {
    headers: {
      'content-type': 'text/plain; charset=utf-8',
      'cache-control': `public, max-age=0, s-maxage=${cacheSeconds}, stale-while-revalidate=${cacheSeconds * 4}`,
    },
  })
}
