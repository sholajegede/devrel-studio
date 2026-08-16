// ── Names that live in a URL ──────────────────────────────────────────────────
//
// Three separate namespaces resolve off the domain, and each one needs the same
// answer to "is this name allowed":
//
//   <slug>.devrel.studio   a client dashboard      (proxy.ts, convex/clients.ts)
//   devrel.studio/@handle  a public portfolio      (convex/portfolio.ts)
//
// These used to be two lists that disagreed. `proxy.ts` reserved four
// subdomains; `convex/clients.ts` reserved fifteen. A slug the proxy allowed but
// Convex blocked could not be created; one Convex allowed but the proxy treated
// as reserved created a dashboard that was unreachable — the request never got
// routed to the subdomain handler. Neither failure said anything on screen.
//
// This file has no imports so it can be pulled into the Next.js edge proxy, into
// Convex functions, and into tests without dragging a runtime along with it.

/** Hosts that must keep resolving to the apex app, never to a client dashboard. */
export const RESERVED_SUBDOMAINS: ReadonlySet<string> = new Set([
  // Infrastructure and conventional hostnames
  'www', 'app', 'api', 'admin', 'auth', 'cdn', 'assets', 'static',
  'mail', 'smtp', 'imap', 'ftp', 'ns1', 'ns2',
  // Real or likely routes on the apex domain
  'dashboard', 'login', 'logout', 'signup', 'sign-in', 'sign-up',
  'billing', 'settings', 'members', 'pricing', 'waitlist', 'invite',
  'portfolio', 'about', 'contact', 'support', 'help', 'docs', 'blog',
  'status', 'changelog',
  // Deployment environments
  'staging', 'dev', 'test', 'preview', 'demo', 'local',
])

/**
 * Names a portfolio handle cannot take. A superset of the subdomain list: a
 * handle sits on a path (`/@name`), so it additionally collides with anything
 * that looks like a top-level route.
 */
export const RESERVED_HANDLES: ReadonlySet<string> = new Set([
  ...RESERVED_SUBDOMAINS,
  'me', 'new', 'edit', 'delete', 'search', 'explore', 'home',
  'terms', 'privacy', 'legal', 'security',
])

export function isReservedSubdomain(name: string): boolean {
  return RESERVED_SUBDOMAINS.has(name.trim().toLowerCase())
}

export function isReservedHandle(name: string): boolean {
  return RESERVED_HANDLES.has(name.trim().toLowerCase())
}

/**
 * A client dashboard slug: lowercase, hyphen-separated, no leading or trailing
 * hyphen. Returns '' when nothing usable survives, which callers treat as
 * "no dashboard for this client".
 */
export function normalizeSlug(input: string): string {
  return input
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9-]/g, '')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
}

/** A portfolio handle. Underscores are allowed here but not in a slug. */
export function normalizeHandle(input: string): string {
  return input.trim().toLowerCase().replace(/^@/, '')
}

/** 3–30 characters, starting and ending alphanumeric. */
export const HANDLE_PATTERN = /^[a-z0-9](?:[a-z0-9_-]{1,28}[a-z0-9])$/
