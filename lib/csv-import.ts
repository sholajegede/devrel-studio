import { CATEGORIES, STATUSES, type Category } from './types'
import { normalizeSlug } from './naming'

// ── CSV import ────────────────────────────────────────────────────────────────
//
// Onboarding meant typing a year of history one entry at a time, which is the
// single largest reason someone tries this product and stops.
//
// The parser is deliberately forgiving about shape and strict about meaning: it
// accepts any column order and several spellings of each header, but refuses to
// invent a category or a date it cannot read. A row it cannot understand is
// reported, not silently dropped — an import that quietly loses four rows out of
// two hundred is worse than one that fails.

export interface ParsedRow {
  /** 1-based, matching what a spreadsheet shows, so an error can be found. */
  line: number
  title: string
  client: string
  category: Category
  platform: string
  contentType: string
  publicationDate: string
  status: string
  link: string
  trackingLink: string
  notes: string
  tags: string[]
  views?: number
  downloads?: number
  attendees?: number
  stars?: number
  packageName?: string
  eventName?: string
  podcastName?: string
  repoUrl?: string
}

export interface ParseResult {
  rows: ParsedRow[]
  errors: { line: number; message: string }[]
  /** Headers present in the file that we did not recognise. */
  ignoredColumns: string[]
}

/**
 * Header aliases.
 *
 * People export from Notion, Airtable and Sheets, and none of them agree on
 * capitalisation or wording. Matching loosely here costs a few lines and saves
 * every user from renaming columns by hand.
 */
const COLUMNS: Record<string, string[]> = {
  title: ['title', 'name', 'content', 'headline'],
  client: ['client', 'customer', 'account', 'company'],
  category: ['category', 'type', 'kind'],
  platform: ['platform', 'channel', 'where', 'site'],
  contentType: ['contenttype', 'subtype', 'format'],
  publicationDate: ['publicationdate', 'date', 'published', 'publishedat', 'publisheddate'],
  status: ['status', 'state'],
  link: ['link', 'url', 'permalink'],
  trackingLink: ['trackinglink', 'utm', 'utmlink', 'campaignlink'],
  notes: ['notes', 'note', 'comment', 'description'],
  tags: ['tags', 'labels', 'topics'],
  views: ['views', 'impressions', 'reads'],
  downloads: ['downloads', 'listens', 'installs'],
  attendees: ['attendees', 'attendance', 'registrations'],
  stars: ['stars', 'githubstars'],
  packageName: ['packagename', 'package', 'npmpackage'],
  eventName: ['eventname', 'event', 'conference'],
  podcastName: ['podcastname', 'podcast', 'show'],
  repoUrl: ['repourl', 'repo', 'repository', 'github'],
}

function normalizeHeader(header: string): string {
  return header.trim().toLowerCase().replace(/[\s_-]/g, '')
}

/**
 * Split one CSV line, honouring quotes.
 *
 * Titles contain commas constantly ("Auth, explained"), so a naive split on
 * comma corrupts a large fraction of real files. Doubled quotes inside a quoted
 * field are an escaped quote, per RFC 4180.
 */
export function splitCsvLine(line: string): string[] {
  const fields: string[] = []
  let current = ''
  let inQuotes = false

  for (let i = 0; i < line.length; i++) {
    const char = line[i]

    if (inQuotes) {
      if (char === '"') {
        if (line[i + 1] === '"') {
          current += '"'
          i++
        } else {
          inQuotes = false
        }
      } else {
        current += char
      }
      continue
    }

    if (char === '"') inQuotes = true
    else if (char === ',') {
      fields.push(current)
      current = ''
    } else current += char
  }

  fields.push(current)
  return fields.map((field) => field.trim())
}

/** `12,480`, `12480`, `1.2k` and blank all have to work. */
function parseNumber(raw?: string): number | undefined {
  if (!raw) return undefined

  const cleaned = raw.trim().toLowerCase().replace(/[, ]/g, '')
  if (!cleaned) return undefined

  const multiplier = cleaned.endsWith('k') ? 1_000 : cleaned.endsWith('m') ? 1_000_000 : 1
  const value = Number.parseFloat(multiplier === 1 ? cleaned : cleaned.slice(0, -1))

  return Number.isFinite(value) ? Math.round(value * multiplier) : undefined
}

/**
 * Dates, in the shapes people actually have.
 *
 * Ambiguous forms are the danger: `03/04/2026` is two different days depending
 * on where you live, and guessing produces a report that is silently wrong. Only
 * unambiguous formats are accepted; anything else is an error the user can see
 * and fix.
 */
export function parseDate(raw?: string): string | null {
  if (!raw) return null
  const value = raw.trim()

  // ISO, the only form that means one thing everywhere.
  const iso = /^(\d{4})-(\d{2})-(\d{2})/.exec(value)
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`

  // "12 March 2026" / "March 12, 2026" — unambiguous because the month is named.
  const named = new Date(value)
  if (!Number.isNaN(named.getTime()) && /[a-z]{3}/i.test(value)) {
    const year = named.getFullYear()
    const month = String(named.getMonth() + 1).padStart(2, '0')
    const day = String(named.getDate()).padStart(2, '0')
    return `${year}-${month}-${day}`
  }

  return null
}

function matchCategory(raw?: string): Category | null {
  if (!raw) return null
  const value = raw.trim().toLowerCase()

  const exact = CATEGORIES.find((category) => category.toLowerCase() === value)
  if (exact) return exact as Category

  // Common synonyms, so an export that says "Blog" or "Talk" still lands.
  const synonyms: Record<string, Category> = {
    blog: 'Written', article: 'Written', post: 'Written', tutorial: 'Written',
    doc: 'Written', docs: 'Written', newsletter: 'Written',
    youtube: 'Video', livestream: 'Video',
    talk: 'Event', conference: 'Event', meetup: 'Event', webinar: 'Event', workshop: 'Event',
    episode: 'Podcast', interview: 'Podcast',
    npm: 'Package', library: 'Package', sdk: 'Package', cli: 'Package',
    app: 'Demo', starter: 'Demo', sample: 'Demo', repo: 'Demo',
  }

  return synonyms[value] ?? null
}

function matchStatus(raw?: string): string {
  if (!raw) return 'Published'
  const value = raw.trim().toLowerCase()

  const exact = STATUSES.find((status) => status.toLowerCase() === value)
  if (exact) return exact

  if (['live', 'shipped', 'done', 'complete'].includes(value)) return 'Published'
  if (['review', 'in review', 'pending', 'waiting'].includes(value)) return 'Waiting Approval'
  if (['planned', 'upcoming', 'queued'].includes(value)) return 'Scheduled'

  return 'Draft'
}

export function parseCsv(text: string): ParseResult {
  const lines = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)

  if (lines.length < 2) {
    return {
      rows: [],
      errors: [{ line: 1, message: 'The file needs a header row and at least one entry' }],
      ignoredColumns: [],
    }
  }

  const headers = splitCsvLine(lines[0]).map(normalizeHeader)

  const index: Record<string, number> = {}
  const recognised = new Set<number>()

  for (const [field, aliases] of Object.entries(COLUMNS)) {
    const position = headers.findIndex((header) => aliases.includes(header))
    if (position !== -1) {
      index[field] = position
      recognised.add(position)
    }
  }

  const ignoredColumns = headers.filter(
    (header, i) => header && !recognised.has(i),
  )

  const rows: ParsedRow[] = []
  const errors: { line: number; message: string }[] = []

  const cell = (fields: string[], field: string) =>
    index[field] !== undefined ? fields[index[field]]?.trim() : undefined

  for (let i = 1; i < lines.length; i++) {
    const line = i + 1
    const fields = splitCsvLine(lines[i])

    const title = cell(fields, 'title')
    if (!title) {
      errors.push({ line, message: 'No title' })
      continue
    }

    const category = matchCategory(cell(fields, 'category'))
    if (!category) {
      errors.push({
        line,
        message: `Category "${cell(fields, 'category') ?? ''}" not recognised — use Written, Video, Event, Podcast, Package or Demo`,
      })
      continue
    }

    const publicationDate = parseDate(cell(fields, 'publicationDate'))
    if (!publicationDate) {
      errors.push({
        line,
        message: `Date "${cell(fields, 'publicationDate') ?? ''}" not readable — use YYYY-MM-DD`,
      })
      continue
    }

    const tags = (cell(fields, 'tags') ?? '')
      .split(/[;|]/)
      .map((tag) => tag.trim())
      .filter(Boolean)

    rows.push({
      line,
      title,
      client: normalizeSlug(cell(fields, 'client') ?? ''),
      category,
      platform: cell(fields, 'platform') || 'Other',
      contentType: cell(fields, 'contentType') || category,
      publicationDate,
      status: matchStatus(cell(fields, 'status')),
      link: cell(fields, 'link') ?? '',
      trackingLink: cell(fields, 'trackingLink') ?? '',
      notes: cell(fields, 'notes') ?? '',
      tags,
      views: parseNumber(cell(fields, 'views')),
      downloads: parseNumber(cell(fields, 'downloads')),
      attendees: parseNumber(cell(fields, 'attendees')),
      stars: parseNumber(cell(fields, 'stars')),
      packageName: cell(fields, 'packageName') || undefined,
      eventName: cell(fields, 'eventName') || undefined,
      podcastName: cell(fields, 'podcastName') || undefined,
      repoUrl: cell(fields, 'repoUrl') || undefined,
    })
  }

  return { rows, errors, ignoredColumns }
}

/** A file people can fill in, rather than guessing at the shape. */
export const CSV_TEMPLATE = [
  'Title,Client,Category,Platform,Content Type,Publication Date,Status,Link,Tags,Views,Downloads,Attendees,Stars',
  '"Shipping type-safe webhooks",acme,Written,Dev.to,Tutorial,2026-07-04,Published,https://dev.to/example,"TypeScript;Webhooks",12480,,,',
  '"Auth patterns talk",acme,Event,Conference,Conference Talk,2026-07-19,Published,,"DX;Talk",,,640,',
  '"@acme/webhook-verify",acme,Package,npm,Library,2026-06-11,Published,https://npmjs.com/,"npm;Open Source",,184300,,',
].join('\n')
