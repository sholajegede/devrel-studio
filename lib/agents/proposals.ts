// ── Proposals ─────────────────────────────────────────────────────────────────
//
// A proposal is an action somebody wants taken, written down with its evidence
// and a ready-to-run payload. A person approves it, edits and approves it, or
// dismisses it. Nothing runs until then, unless the workspace has set that kind
// of action to Auto.
//
// Pure rules live here so the Convex mutations and the Inbox screen agree on
// them, and so they can be tested without a database.

export type ProposalStatus =
  | 'pending'
  | 'executed'
  | 'dismissed'
  | 'stale'
  | 'undone'
  | 'failed'

export const DISMISS_REASONS = [
  'Not mine',
  'Already logged',
  'Wrong platform',
  'Not useful',
  'Other',
] as const
export type DismissReason = (typeof DISMISS_REASONS)[number]

export interface Evidence {
  label: string
  url?: string
}

/** The fields a proposal needs to become an entry. */
export interface EntryDraft {
  client: string
  title: string
  link: string
  platform: string
  publicationDate: string
}

// Query parameters that identify a campaign or a click, not a page. Two links
// that differ only by these are the same article.
const TRACKING_PARAMS = new Set([
  'fbclid', 'gclid', 'mc_cid', 'mc_eid', 'ref', 'ref_src', 'source', 'igshid', 'si',
])

/**
 * One form per page, for spotting duplicates.
 *
 * Lower-cases the host, drops `www.`, the fragment, a trailing slash and
 * tracking parameters, and sorts what is left. Returns an empty string for
 * anything that is not an http(s) link, so a caller can tell "no link" from
 * "same link".
 */
export function canonicalUrl(raw: string): string {
  let url: URL
  try {
    url = new URL(raw.trim())
  } catch {
    return ''
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') return ''

  const host = url.hostname.toLowerCase().replace(/^www\./, '')
  const params = [...url.searchParams.entries()]
    .filter(([key]) => !key.toLowerCase().startsWith('utm_') && !TRACKING_PARAMS.has(key.toLowerCase()))
    .sort(([a], [b]) => a.localeCompare(b))
  const query = params.length
    ? '?' + params.map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`).join('&')
    : ''
  const path = url.pathname.replace(/\/+$/, '') || ''

  return `${host}${path}${query}`
}

/** The key two proposals share when they describe the same thing. */
export function proposalFingerprint(kind: string, key: string): string {
  return `${kind}:${key}`
}

const DATE = /^\d{4}-\d{2}-\d{2}$/

/** What is wrong with an entry draft, in words a person can act on. Empty is clean. */
export function entryDraftProblems(draft: EntryDraft): string[] {
  const problems: string[] = []
  if (!draft.title.trim()) problems.push('Add a title.')
  else if (draft.title.trim().length > 200) problems.push('Keep the title under 200 characters.')

  if (!draft.link.trim()) problems.push('Add the link to the piece.')
  else if (!canonicalUrl(draft.link)) problems.push('The link must start with http:// or https://.')

  if (!draft.platform.trim()) problems.push('Choose a platform.')
  if (!draft.client.trim()) problems.push('Choose a program.')

  if (!DATE.test(draft.publicationDate) || Number.isNaN(Date.parse(draft.publicationDate))) {
    problems.push('Use a publication date like 2026-10-27.')
  }
  return problems
}

/** The one sentence an Inbox card leads with. */
export function describeEntryProposal(draft: Pick<EntryDraft, 'title' | 'platform' | 'client'>): string {
  const where = draft.platform.trim() ? ` on ${draft.platform.trim()}` : ''
  const program = draft.client.trim() ? ` to ${draft.client.trim()}` : ''
  return `Add “${draft.title.trim()}”${where}${program}?`
}

/** Pending and stale items need a person; the rest are history. */
export function isOpen(status: ProposalStatus): boolean {
  return status === 'pending'
}

/** Only an executed entry proposal can be undone, and only once. */
export function canUndo(status: ProposalStatus): boolean {
  return status === 'executed'
}
