// ── Checking that a live page carries the tracking link ──────────────────────
//
// devrel.studio can store the right link, but the link that counts is the one in
// the published article, README or npm page. This finds each place an entry's
// link should appear, and judges what the page actually contains.
//
// Pure: fetching happens in convex/linkVerify.ts. No imports beyond the
// tracking rules, so this runs in Convex, the browser and tests alike.

import {
  TRACKING_MEDIUM,
  forbidsPromotionalLinks,
  isConfigured,
  normalizeBase,
  utmSourceFor,
  type TrackableEntry,
  type TrackingProgram,
} from './tracking'

export type VerifyPlace = 'article' | 'github' | 'npm' | 'demo'

/** What a page was found to contain. */
export type VerifyResult =
  /** The link is there, in the agreed format. */
  | 'found'
  /** A link to the client is there, but in an old or wrong format. */
  | 'old_link'
  /** No link to the client at all. */
  | 'not_found'
  /** The page could not be read: blocked, gone or too slow. Never a "no". */
  | 'could_not_check'

export interface VerifyTarget {
  place: VerifyPlace
  label: string
  /** The page a person would open. */
  pageUrl: string
  /** What is actually fetched: an API or raw file where one is more reliable. */
  fetchUrl: string
  /** How to read the response. */
  format: 'html' | 'text' | 'npm-json'
  /** The `utm_source` the link on this page should carry. */
  source: string
}

/** Only public web addresses are fetched. */
export function isFetchableUrl(value: string | null | undefined): boolean {
  if (!value) return false
  let url: URL
  try {
    url = new URL(value)
  } catch {
    return false
  }
  if (url.protocol !== 'https:' && url.protocol !== 'http:') return false
  const host = url.hostname.toLowerCase()
  if (host === 'localhost' || host.endsWith('.local') || host.endsWith('.internal')) return false
  // Bare IP addresses are refused outright; real pages have names.
  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(host) || host.includes(':') || host.startsWith('[')) return false
  return host.includes('.')
}

/** `https://github.com/owner/repo` to its README as raw text. */
export function githubReadmeUrl(repoUrl: string | null | undefined): string | null {
  if (!repoUrl) return null
  try {
    const url = new URL(repoUrl)
    if (url.hostname.replace(/^www\./, '') !== 'github.com') return null
    const [owner, repo] = url.pathname.split('/').filter(Boolean)
    if (!owner || !repo) return null
    return `https://raw.githubusercontent.com/${owner}/${repo.replace(/\.git$/, '')}/HEAD/README.md`
  } catch {
    return null
  }
}

/** The npm registry document for a package, which carries its README. */
export function npmRegistryUrl(packageName: string | null | undefined): string | null {
  const name = packageName?.trim()
  if (!name || !/^(@[a-z0-9-~][a-z0-9-._~]*\/)?[a-z0-9-~][a-z0-9-._~]*$/i.test(name)) return null
  return `https://registry.npmjs.org/${name.replace('/', '%2F')}`
}

/** Every place an entry's tracking link should appear, for one client. */
export function verifyTargets(
  entry: TrackableEntry,
  program: TrackingProgram | null | undefined,
): VerifyTarget[] {
  if (!isConfigured(program)) return []
  const category = entry.category ?? 'Written'
  const targets: VerifyTarget[] = []

  if (category === 'Written' || category === 'Video' || category === 'Podcast') {
    if (forbidsPromotionalLinks(entry.platform)) return []
    const source = utmSourceFor(entry)
    if (source && isFetchableUrl(entry.link)) {
      targets.push({ place: 'article', label: entry.platform || 'Live page', pageUrl: entry.link!, fetchUrl: entry.link!, format: 'html', source })
    }
    return targets
  }

  if (category === 'Package') {
    const registry = npmRegistryUrl(entry.packageName)
    if (registry) {
      targets.push({
        place: 'npm',
        label: 'npm page',
        pageUrl: `https://www.npmjs.com/package/${entry.packageName!.trim()}`,
        fetchUrl: registry,
        format: 'npm-json',
        source: 'npm',
      })
    }
  }

  if (category === 'Package' || category === 'Demo') {
    const readme = githubReadmeUrl(entry.repoUrl)
    if (readme) {
      targets.push({ place: 'github', label: 'GitHub README', pageUrl: entry.repoUrl!, fetchUrl: readme, format: 'text', source: 'github' })
    }
  }

  if (category === 'Demo' && isFetchableUrl(entry.link) && entry.link !== entry.repoUrl) {
    targets.push({ place: 'demo', label: 'Demo app', pageUrl: entry.link!, fetchUrl: entry.link!, format: 'html', source: 'demo' })
  }

  return targets
}

/** Undo the HTML escaping that hides query strings inside `href` attributes. */
function decodeEntities(text: string): string {
  return text
    .replace(/&amp;/gi, '&')
    .replace(/&#0*38;/g, '&')
    .replace(/&#x0*26;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/\\u0026/gi, '&')
    .replace(/\\\//g, '/')
}

/** Every link to `host` that appears anywhere in a page or README. */
export function findLinks(content: string, host: string): string[] {
  const text = decodeEntities(content)
  const escaped = host.replace(/^www\./, '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const pattern = new RegExp(`https?://(?:www\\.)?${escaped}[^\\s"'<>()\\[\\]\`]*`, 'gi')
  return [...new Set(text.match(pattern) ?? [])].map((link) => link.replace(/[.,;:!]+$/, ''))
}

/** Judge what a page contains against the agreed format for one source. */
export function judgeLinks(
  links: string[],
  expected: { source: string; campaign: string },
): Exclude<VerifyResult, 'could_not_check'> {
  if (links.length === 0) return 'not_found'
  const allowed = new Set(['utm_source', 'utm_medium', 'utm_campaign', 'utm_content'])
  const ok = links.some((link) => {
    try {
      const params = new URL(link).searchParams
      return (
        [...params.keys()].every((key) => allowed.has(key)) &&
        params.get('utm_source') === expected.source &&
        params.get('utm_medium') === TRACKING_MEDIUM &&
        params.get('utm_campaign') === expected.campaign &&
        !!params.get('utm_content')
      )
    } catch {
      return false
    }
  })
  return ok ? 'found' : 'old_link'
}

/** The host every link for this client points at. */
export function trackingHost(program: TrackingProgram | null | undefined): string | null {
  const base = normalizeBase(program?.trackingBase)
  return base ? new URL(base).hostname.replace(/^www\./, '') : null
}

/** Pull the searchable text out of a fetched response. */
export function readableContent(body: string, format: VerifyTarget['format']): string {
  if (format !== 'npm-json') return body
  try {
    const doc = JSON.parse(body) as { readme?: string }
    return doc.readme ?? ''
  } catch {
    return ''
  }
}

/** One line for the screen. */
export const VERIFY_TEXT: Record<VerifyResult, string> = {
  found: 'Link found on the live page',
  old_link: 'Live page still has the old link',
  not_found: 'No link on the live page',
  could_not_check: 'Could not read the live page',
}
