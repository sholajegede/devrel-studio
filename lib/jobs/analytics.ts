// Job board analytics: what can be recorded, how it is cleaned, and which
// counters each event feeds. Shared by the browser, the API route and Convex.

export interface EventDef {
  label: string
  group: 'Pages' | 'Search and filters' | 'Roles' | 'Sharing' | 'Account' | 'CV' | 'Kits and alerts' | 'Tracker' | 'Pro' | 'Tour'
}

export const EVENTS = {
  page_view: { label: 'Page view', group: 'Pages' },
  page_leave: { label: 'Page left (seconds on page)', group: 'Pages' },
  nav_click: { label: 'Navigation click', group: 'Pages' },
  cta_click: { label: 'Sign-up or sign-in click', group: 'Account' },

  search: { label: 'Search', group: 'Search and filters' },
  no_results: { label: 'Search with no results', group: 'Search and filters' },
  filter_on: { label: 'Filter turned on', group: 'Search and filters' },
  filter_off: { label: 'Filter turned off', group: 'Search and filters' },
  adjacent_on: { label: 'Include adjacent roles on', group: 'Search and filters' },
  adjacent_off: { label: 'Include adjacent roles off', group: 'Search and filters' },
  sort_change: { label: 'Sort changed', group: 'Search and filters' },
  country_set: { label: 'Country set', group: 'Search and filters' },
  clear_filters: { label: 'Filters cleared', group: 'Search and filters' },
  load_more: { label: 'Show more roles', group: 'Search and filters' },
  filters_open: { label: 'Filters opened on a phone', group: 'Search and filters' },

  job_open: { label: 'Role opened from a list', group: 'Roles' },
  job_view: { label: 'Role page viewed', group: 'Roles' },
  company_click: { label: 'Company page opened', group: 'Roles' },
  apply_click: { label: 'Apply clicked', group: 'Roles' },
  apply_redirect: { label: 'Apply redirect served', group: 'Roles' },
  outbound_click: { label: 'Outbound link clicked', group: 'Roles' },
  save: { label: 'Role saved to tracker', group: 'Roles' },
  save_signin_click: { label: 'Save clicked while signed out', group: 'Roles' },

  link_copy: { label: 'Link copied', group: 'Sharing' },
  share_click: { label: 'Share clicked', group: 'Sharing' },
  text_copy: { label: 'Text copied', group: 'Sharing' },
  link_menu: { label: 'Right click on a link', group: 'Sharing' },

  cv_upload: { label: 'CV uploaded', group: 'CV' },
  cv_parsed: { label: 'CV read', group: 'CV' },
  cv_failed: { label: 'CV could not be read', group: 'CV' },
  cv_text_saved: { label: 'CV text pasted', group: 'CV' },
  cv_removed: { label: 'CV removed', group: 'CV' },
  profile_saved: { label: 'Preferences saved', group: 'CV' },

  kit_requested: { label: 'Tailored CV requested', group: 'Kits and alerts' },
  kit_done: { label: 'Tailored CV ready', group: 'Kits and alerts' },
  kit_failed: { label: 'Tailored CV failed', group: 'Kits and alerts' },
  kit_copied: { label: 'Tailored CV text copied', group: 'Kits and alerts' },
  alert_created: { label: 'Alert created', group: 'Kits and alerts' },
  alert_removed: { label: 'Alert removed', group: 'Kits and alerts' },

  tracker_add: { label: 'Role added by hand', group: 'Tracker' },
  tracker_move: { label: 'Card moved', group: 'Tracker' },
  tracker_open: { label: 'Card opened', group: 'Tracker' },
  tracker_remove: { label: 'Card removed', group: 'Tracker' },

  pro_view: { label: 'Jobs Pro page viewed', group: 'Pro' },
  pro_requested: { label: 'Jobs Pro requested', group: 'Pro' },

  tour_start: { label: 'Tour started by itself', group: 'Tour' },
  tour_replay: { label: 'Tour started with the button', group: 'Tour' },
  tour_step: { label: 'Tour step shown', group: 'Tour' },
  tour_done: { label: 'Tour finished', group: 'Tour' },
  tour_skip: { label: 'Tour skipped', group: 'Tour' },
} as const satisfies Record<string, EventDef>

export type EventName = keyof typeof EVENTS
export const EVENT_NAMES = Object.keys(EVENTS) as EventName[]
export const isEventName = (value: unknown): value is EventName =>
  typeof value === 'string' && Object.prototype.hasOwnProperty.call(EVENTS, value)

/** Events the browser may send. The rest are written by the server. */
export const SERVER_ONLY: EventName[] = [
  'apply_redirect', 'cv_parsed', 'cv_failed', 'kit_done', 'kit_failed', 'kit_requested', 'alert_created',
  'alert_removed', 'cv_text_saved', 'cv_removed', 'profile_saved', 'tracker_add', 'pro_requested',
]

export interface RawEvent {
  event: EventName
  path: string
  slug?: string
  company?: string
  label?: string
  n?: number
}

const clip = (value: unknown, max: number): string | undefined => {
  if (typeof value !== 'string') return undefined
  const text = value.replace(/\s+/g, ' ').trim().slice(0, max)
  return text || undefined
}

/** Returns null for anything that is not a known event. Never throws. */
export function cleanEvent(input: unknown): RawEvent | null {
  if (!input || typeof input !== 'object') return null
  const raw = input as Record<string, unknown>
  if (!isEventName(raw.event)) return null
  const n = typeof raw.n === 'number' && Number.isFinite(raw.n) ? Math.round(Math.min(Math.max(raw.n, 0), 1_000_000)) : undefined
  return {
    event: raw.event,
    path: clip(raw.path, 160) ?? '/',
    slug: clip(raw.slug, 120),
    company: clip(raw.company, 80),
    label: clip(raw.label, 120)?.toLowerCase(),
    ...(n !== undefined ? { n } : {}),
  }
}

// ── Time buckets ──────────────────────────────────────────────────────────────

export const dayKey = (ms: number): string => new Date(ms).toISOString().slice(0, 10)

/** The Monday of the week holding this UTC day. */
export function weekKey(ms: number): string {
  const date = new Date(ms)
  const offset = (date.getUTCDay() + 6) % 7
  date.setUTCDate(date.getUTCDate() - offset)
  return date.toISOString().slice(0, 10)
}

/** First day of a window of whole weeks that ends with the current week. */
export function windowStart(ms: number, weeks: number): string {
  const monday = new Date(`${weekKey(ms)}T00:00:00Z`).getTime()
  return dayKey(monday - (Math.max(weeks, 1) - 1) * 7 * 86_400_000)
}

// ── Page groups ───────────────────────────────────────────────────────────────

const RESERVED = new Set(['salaries', 'companies', 'remote', 'contract', 'roles', 'out', 'feed.xml', 'llms.txt'])

export function pathGroup(path: string): string {
  const clean = path.split('?')[0].replace(/\/+$/, '') || '/'
  const parts = clean.split('/').filter(Boolean)
  if (parts[0] === 'jobs') {
    if (parts.length === 2 && !RESERVED.has(parts[1])) return '/jobs/[role]'
    if (parts[1] === 'companies' && parts.length === 3) return '/jobs/companies/[company]'
    if (parts[1] === 'roles' && parts.length === 3) return '/jobs/roles/[family]'
  }
  if (parts[0] === 'dashboard' && parts[1] === 'jobs' && parts[2] === 'kit' && parts.length === 4) {
    return '/dashboard/jobs/kit/[role]'
  }
  return clean
}

/** The role slug in a /jobs/<slug> path, or null. */
export function jobSlugFromPath(path: string): string | null {
  const parts = path.split('?')[0].split('/').filter(Boolean)
  if (parts[0] === 'jobs' && parts.length === 2 && !RESERVED.has(parts[1])) return parts[1]
  return null
}

// ── Counters ──────────────────────────────────────────────────────────────────

export type MetricKind = 'all' | 'week' | 'job' | 'company' | 'label' | 'path' | 'ref' | 'device' | 'country' | 'auth'

export interface Counter {
  kind: MetricKind
  dim: string
}

export interface EventContext {
  device?: string
  ref?: string
  country?: string
  signedIn?: boolean
}

/** Day buckets for 'all'; whole-week buckets for everything else. */
export const DAILY_KINDS: MetricKind[] = ['all']

/**
 * The counters one event feeds. Kept small on purpose: each one is a write.
 * Page views carry the extra dimensions, since they say who is looking.
 */
export function countersFor(event: RawEvent, context: EventContext = {}): Counter[] {
  const counters: Counter[] = [{ kind: 'all', dim: 'all' }]
  if (event.slug) counters.push({ kind: 'job', dim: event.slug })
  if (event.company) counters.push({ kind: 'company', dim: event.company })
  if (event.label) counters.push({ kind: 'label', dim: event.label })
  if (event.event === 'page_view') {
    counters.push({ kind: 'path', dim: pathGroup(event.path) })
    counters.push({ kind: 'ref', dim: context.ref || 'direct' })
    if (context.device) counters.push({ kind: 'device', dim: context.device })
    if (context.country) counters.push({ kind: 'country', dim: context.country })
    counters.push({ kind: 'auth', dim: context.signedIn ? 'signed in' : 'signed out' })
  }
  return counters
}

export function deviceFromWidth(width: number): 'mobile' | 'tablet' | 'desktop' {
  if (width < 640) return 'mobile'
  if (width < 1024) return 'tablet'
  return 'desktop'
}

export function refHost(referrer: string, ownHost: string): string | undefined {
  if (!referrer) return undefined
  try {
    const host = new URL(referrer).host.replace(/^www\./, '')
    return host === ownHost.replace(/^www\./, '') ? undefined : host.slice(0, 60)
  } catch {
    return undefined
  }
}

/** Search terms are grouped so that "  Python " and "python" count together. */
export const normaliseTerm = (value: string): string => value.toLowerCase().replace(/\s+/g, ' ').trim().slice(0, 80)
