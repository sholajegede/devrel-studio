// ── Tracking links ────────────────────────────────────────────────────────────
//
// A client measures DevRel work by the visits and sign-ups that reach their own
// site. That only works when every link carries the same tags in the same form,
// so one function writes every link and one function checks it. Nothing else in
// the app builds a tracking link by hand.
//
// The format is the one Kinde asked for:
//
//   https://kinde.com/?utm_source=<platform>&utm_medium=content
//                     &utm_campaign=<campaign>&utm_content=<slug>
//
// The base URL and the campaign belong to the client (the program), not to the
// app, so a second client gets its own values with no code change.
//
// No imports, so this runs in Convex functions, the browser and tests alike.

/** The medium every content link carries. */
export const TRACKING_MEDIUM = 'content'

/** Query parameters the agreed format allows. Anything else is an old format. */
const ALLOWED_PARAMS = new Set(['utm_source', 'utm_medium', 'utm_campaign', 'utm_content'])

/** What the client has configured for its links. */
export interface TrackingProgram {
  /** Where the link points, e.g. `https://kinde.com/`. */
  trackingBase?: string | null
  /** The campaign name, e.g. `shola`. */
  utmCampaign?: string | null
}

/** The parts of a content entry the link depends on. */
export interface TrackableEntry {
  category?: string | null
  platform?: string | null
  title?: string | null
  link?: string | null
  trackingLink?: string | null
  publicationDate?: string | null
  packageName?: string | null
  eventName?: string | null
  podcastName?: string | null
  repoUrl?: string | null
}

/**
 * Platforms that do not allow promotional links in the piece itself.
 * freeCodeCamp's editorial policy forbids them, so its entries carry no link
 * and are never reported as needing one.
 */
const NO_PROMOTIONAL_LINKS = new Set(['freecodecamp'])

/** Platform names whose source is not simply the name in lowercase. */
const SOURCE_OVERRIDES: Record<string, string> = {
  'dev.to': 'devto',
  'twitter/x': 'x',
  twitter: 'x',
  x: 'x',
  'hacker news': 'hackernews',
  'apple podcasts': 'podcast',
  spotify: 'podcast',
  'youtube podcasts': 'podcast',
}

/** Lowercase, hyphenated, ASCII only, cut at `max` characters. */
export function slugify(value: string, max = 60): string {
  const slug = value
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
  if (slug.length <= max) return slug
  const cut = slug.slice(0, max)
  // Cut at a word boundary when one is close, so a slug does not end mid-word.
  const lastHyphen = cut.lastIndexOf('-')
  return (lastHyphen > max * 0.6 ? cut.slice(0, lastHyphen) : cut).replace(/-+$/g, '')
}

/** True when the platform forbids a promotional link in the piece. */
export function forbidsPromotionalLinks(platform: string | null | undefined): boolean {
  return NO_PROMOTIONAL_LINKS.has(slugify(platform ?? '', 40).replace(/-/g, ''))
}

/**
 * The `utm_source` for an entry, or null when the entry must not carry a link.
 *
 * Events and podcasts use one source for the category, because the event or
 * show name is already in `utm_content`. Every other category uses its
 * platform.
 */
export function utmSourceFor(entry: TrackableEntry): string | null {
  const category = entry.category ?? 'Written'
  if (category === 'Event') return 'event'
  if (category === 'Podcast') return 'podcast'
  if (category === 'Package') return 'npm'
  if (category === 'Demo') return 'demo'

  const platform = (entry.platform ?? '').trim()
  if (!platform) return null
  if (forbidsPromotionalLinks(platform)) return null

  const key = platform.toLowerCase()
  if (SOURCE_OVERRIDES[key]) return SOURCE_OVERRIDES[key]
  return slugify(platform, 40).replace(/-/g, '') || null
}

/** The last meaningful path segment of a URL, or null. */
function lastPathSegment(url: string | null | undefined): string | null {
  if (!url) return null
  try {
    const parts = new URL(url).pathname.split('/').filter(Boolean)
    return parts.length ? decodeURIComponent(parts[parts.length - 1]) : null
  } catch {
    return null
  }
}

/** True when a URL is on dev.to. */
function isDevto(url: string | null | undefined): boolean {
  try {
    return new URL(url ?? '').hostname.replace(/^www\./, '') === 'dev.to'
  } catch {
    return false
  }
}

/** The year of a `YYYY-MM-DD` date, or null. */
function yearOf(date: string | null | undefined): string | null {
  const match = /^(\d{4})/.exec(date ?? '')
  return match ? match[1] : null
}

/**
 * The `utm_content` for an entry: which piece of work the visit came from.
 *
 * Uses the entry's own URL when it has one, because that is stable and already
 * unique on the platform. Falls back to the title.
 */
export function contentSlugFor(entry: TrackableEntry): string {
  const category = entry.category ?? 'Written'

  if (category === 'Package' && entry.packageName) {
    return slugify(entry.packageName.replace(/^@/, '').replace('/', '-'))
  }
  if (category === 'Demo') {
    const repo = lastPathSegment(entry.repoUrl)
    if (repo) return slugify(repo.replace(/\.git$/, ''))
  }
  if (category === 'Event') {
    const name = entry.eventName || entry.title || ''
    const year = yearOf(entry.publicationDate)
    const slug = slugify(name, 50)
    return year && !slug.includes(year) ? `${slug}-${year}` : slug
  }
  if (category === 'Podcast') {
    const show = entry.podcastName ? slugify(entry.podcastName, 25) : ''
    const episode = slugify(entry.title ?? '', show ? 34 : 60)
    return [show, episode].filter(Boolean).join('-')
  }

  const fromUrl = lastPathSegment(entry.link)
  if (fromUrl) {
    // Dev.to ends every article slug with a short random suffix ("-8fc",
    // "-20md"). It changes nothing about which piece it is, so it is dropped.
    // Only on Dev.to: elsewhere a short last word is part of the title.
    const trimmed = isDevto(entry.link) ? fromUrl.replace(/-[a-z0-9]{2,5}$/i, '') : fromUrl
    const slug = slugify(trimmed)
    if (slug) return slug
  }
  return slugify(entry.title ?? '')
}

/** True when the program has what a link needs. */
export function isConfigured(program: TrackingProgram | null | undefined): boolean {
  return !!normalizeBase(program?.trackingBase) && !!program?.utmCampaign?.trim()
}

/** `kinde.com` and `https://kinde.com` both become `https://kinde.com/`. */
export function normalizeBase(base: string | null | undefined): string | null {
  const raw = (base ?? '').trim()
  if (!raw) return null
  try {
    const url = new URL(/^https?:\/\//i.test(raw) ? raw : `https://${raw}`)
    url.search = ''
    url.hash = ''
    return url.toString()
  } catch {
    return null
  }
}

/** Build one tracking link. Parameters are always written in the same order. */
export function buildTrackingLink(parts: {
  base: string
  campaign: string
  source: string
  content: string
}): string {
  const base = normalizeBase(parts.base) ?? parts.base
  const query = [
    ['utm_source', parts.source],
    ['utm_medium', TRACKING_MEDIUM],
    ['utm_campaign', parts.campaign.trim()],
    ['utm_content', parts.content],
  ]
    .map(([key, value]) => `${key}=${encodeURIComponent(value)}`)
    .join('&')
  return `${base}?${query}`
}

/**
 * The link an entry should carry, or null when it should carry none or the
 * program has no tracking settings yet.
 */
export function trackingLinkFor(
  entry: TrackableEntry,
  program: TrackingProgram | null | undefined,
): string | null {
  if (!isConfigured(program)) return null
  const source = utmSourceFor(entry)
  if (!source) return null
  const content = contentSlugFor(entry)
  if (!content) return null
  return buildTrackingLink({
    base: program!.trackingBase!,
    campaign: program!.utmCampaign!,
    source,
    content,
  })
}

/** A ready link for one place a package or demo is published. */
export interface PlacementLink {
  placement: 'github' | 'npm' | 'demo'
  label: string
  url: string
  /** A Markdown line to paste into a README. */
  markdown: string
}

/**
 * The links a package or demo needs, one per place it is published.
 *
 * A package lives on GitHub and npm, a demo on GitHub and its own site, and each
 * place gets its own source so the client can tell which one sent the visit.
 */
export function placementLinksFor(
  entry: TrackableEntry,
  program: TrackingProgram | null | undefined,
  brand = 'the product',
): PlacementLink[] {
  if (!isConfigured(program)) return []
  const category = entry.category
  if (category !== 'Package' && category !== 'Demo') return []

  const content = contentSlugFor(entry)
  if (!content) return []

  const placements: Array<{ placement: PlacementLink['placement']; label: string }> =
    category === 'Package'
      ? [
          { placement: 'github', label: 'GitHub README' },
          { placement: 'npm', label: 'npm page' },
        ]
      : [
          { placement: 'github', label: 'GitHub README' },
          { placement: 'demo', label: 'Demo app' },
        ]

  return placements.map(({ placement, label }) => {
    const url = buildTrackingLink({
      base: program!.trackingBase!,
      campaign: program!.utmCampaign!,
      source: placement,
      content,
    })
    return { placement, label, url, markdown: `[${brand}](${url})` }
  })
}

/** How an entry's link compares with the agreed format. */
export type LinkStatus =
  | 'correct'
  | 'old_format'
  | 'wrong_source'
  | 'missing'
  /** The platform forbids promotional links, so none is expected. */
  | 'not_applicable'
  /** The program has no base or campaign yet, so nothing can be checked. */
  | 'unconfigured'

export interface LinkCheck {
  status: LinkStatus
  /** What the builder would write today. Null when no link is expected. */
  expected: string | null
  /** One sentence for the screen. */
  reason: string
}

/** Categories whose tracking link sits in the entry itself. */
const CHECKED_CATEGORIES = new Set(['Written', 'Video', 'Podcast', 'Event'])

/** True when the status means the entry's link needs work. */
export function needsFix(status: LinkStatus): boolean {
  return status === 'old_format' || status === 'wrong_source' || status === 'missing'
}

/**
 * Compare an entry's tracking link with the agreed format.
 *
 * A different `utm_content` slug is accepted: titles change after a link has
 * gone live, and rewriting a working link to chase a title is worse than
 * keeping it.
 */
export function checkTrackingLink(
  entry: TrackableEntry,
  program: TrackingProgram | null | undefined,
): LinkCheck {
  if (!isConfigured(program)) {
    return { status: 'unconfigured', expected: null, reason: 'Set a tracking base and campaign on the client first.' }
  }
  const category = entry.category ?? 'Written'
  if (!CHECKED_CATEGORIES.has(category)) {
    return { status: 'not_applicable', expected: null, reason: 'Packages and demos carry their links on GitHub, npm and the demo site.' }
  }

  const expected = trackingLinkFor(entry, program)
  if (!expected) {
    return { status: 'not_applicable', expected: null, reason: 'This platform does not allow promotional links.' }
  }

  const current = (entry.trackingLink ?? '').trim()
  if (!current) return { status: 'missing', expected, reason: 'No tracking link.' }

  let url: URL
  try {
    url = new URL(/^https?:\/\//i.test(current) ? current : `https://${current}`)
  } catch {
    return { status: 'old_format', expected, reason: 'The link is not a valid URL.' }
  }

  const params = url.searchParams
  const extra = [...params.keys()].filter((key) => !ALLOWED_PARAMS.has(key))
  if (extra.length) {
    return { status: 'old_format', expected, reason: `Has parameters the format does not use: ${extra.join(', ')}.` }
  }
  if (params.get('utm_medium') !== TRACKING_MEDIUM) {
    return { status: 'old_format', expected, reason: `utm_medium must be "${TRACKING_MEDIUM}".` }
  }
  if (params.get('utm_campaign') !== program!.utmCampaign!.trim()) {
    return { status: 'old_format', expected, reason: `utm_campaign must be "${program!.utmCampaign!.trim()}".` }
  }
  if (!params.get('utm_content')) {
    return { status: 'old_format', expected, reason: 'No utm_content.' }
  }

  const expectedSource = new URL(expected).searchParams.get('utm_source')
  if (params.get('utm_source') !== expectedSource) {
    return {
      status: 'wrong_source',
      expected,
      reason: `utm_source is "${params.get('utm_source') ?? ''}", but this platform uses "${expectedSource}".`,
    }
  }

  const base = normalizeBase(program!.trackingBase)!
  if (new URL(base).host !== url.host) {
    return { status: 'old_format', expected, reason: `The link points to ${url.host}, not ${new URL(base).host}.` }
  }

  return { status: 'correct', expected, reason: 'Matches the agreed format.' }
}
