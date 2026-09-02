// ── View tracking, edge-safe ──────────────────────────────────────────────────
//
// Deliberately separate from lib/manager-auth.ts. That module is `server-only`
// and built on node:crypto, which cannot be imported from proxy.ts — the proxy
// is where client-dashboard views have to be counted, because the dashboard's
// own code is off limits.
//
// Everything here uses Web Crypto, which is present in both the edge and Node
// runtimes, so the same helpers work in the proxy and in an API route.

/** Hex SHA-256. The one primitive everything below is built from. */
export async function sha256Hex(input: string): Promise<string> {
  const bytes = new TextEncoder().encode(input);
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

/**
 * Must stay byte-identical to `hashSessionToken` in lib/manager-auth.ts —
 * `sha256(token:secret)`. The proxy computes this so the tracking mutation can
 * look the session up by `managerSessions.by_token_hash` and learn which client
 * the visitor already has access to. Getting the formula wrong would not throw;
 * it would silently record every manager as anonymous, so the two definitions
 * are covered by a test in tests/view-tracking.test.ts.
 */
export async function hashSessionTokenEdge(
  token: string,
  secret: string,
): Promise<string> {
  return sha256Hex(`${token}:${secret}`);
}

/** UTC day stamp, the rotating component of the visitor hash. */
export function dayStamp(now: Date = new Date()): string {
  return now.toISOString().slice(0, 10);
}

/**
 * A visitor identifier that expires on its own.
 *
 * The day stamp is inside the hash, so the same person on two days produces two
 * unrelated values. That is the whole privacy design: unique-visitor counts are
 * accurate within a day, and nobody can be followed across days even with full
 * access to the table. It is the Plausible model, and it is why this needs no
 * cookie banner — nothing is stored on the visitor's device and nothing durable
 * about them is stored on ours.
 */
export async function visitorHashEdge(
  ip: string | null,
  userAgent: string | null,
  secret: string,
  now: Date = new Date(),
): Promise<string> {
  return sha256Hex(
    `v1:${dayStamp(now)}:${ip ?? 'unknown'}:${userAgent ?? 'unknown'}:${secret}`,
  );
}

// ── Bot filtering ─────────────────────────────────────────────────────────────
//
// Portfolios are indexable and get shared into Slack, LinkedIn and X, every one
// of which fetches the page and its OG image to build a preview card. Counting
// those would make "someone viewed your portfolio" mostly mean "a link preview
// was generated", which is worse than not counting at all: it is a claim about
// a person that is not true.

const BOT_PATTERN =
  /bot|crawler|spider|crawling|slurp|facebookexternalhit|slackbot|linkedinbot|twitterbot|whatsapp|telegrambot|discordbot|embedly|quora|pinterest|vkshare|preview|scrapy|curl|wget|python-requests|headless|lighthouse|pagespeed|gtmetrix|monitor|uptime|pingdom|semrush|ahrefs|mj12|dotbot/i;

export function isBot(userAgent: string | null): boolean {
  if (!userAgent) return true; // No UA at all is a script, not a person.
  return BOT_PATTERN.test(userAgent);
}

/**
 * Paths that are machine traffic even when a real browser asks for them:
 * the OG image route is fetched by the unfurler, not read by anyone.
 */
export function isTrackablePath(pathname: string): boolean {
  if (pathname.startsWith('/_next')) return false;
  if (pathname.startsWith('/api')) return false;
  if (pathname.startsWith('/images')) return false;
  if (pathname.includes('opengraph-image')) return false;
  if (pathname.includes('favicon')) return false;
  if (pathname === '/robots.txt' || pathname === '/sitemap.xml') return false;
  return true;
}

/**
 * Referrer reduced to a bare hostname.
 *
 * The full URL is both more than is needed to answer "where did they come
 * from" and more than should be kept: query strings on inbound links routinely
 * carry campaign parameters and, occasionally, someone's email address.
 */
export function referrerHost(referer: string | null, selfHost: string): string | undefined {
  if (!referer) return undefined;
  try {
    const host = new URL(referer).hostname.replace(/^www\./, '');
    // Internal navigation is not a referral.
    if (!host || host === selfHost.replace(/^www\./, '')) return undefined;
    if (host.endsWith('devrel.studio')) return undefined;
    return host;
  } catch {
    return undefined;
  }
}

/**
 * The visitor's own IP.
 *
 * `cf-connecting-ip` comes first because devrel.studio is not reached the same
 * way on every hostname: the apex is proxied through Cloudflare while the
 * wildcard `*.devrel.studio` goes straight to Vercel. On the proxied path the
 * address Vercel sees is a Cloudflare edge, not the visitor — and Cloudflare
 * answers from a different edge IP per connection, so deriving the visitor hash
 * from it counted one person reloading a page as a new visitor every time.
 * Cloudflare sets this header to the original client address, which is the only
 * value on that path that identifies the actual visitor.
 *
 * Falls through to the previous behaviour on the direct-to-Vercel path, where
 * the Cloudflare headers are absent and x-forwarded-for is already correct.
 */
export function callerIp(headers: Headers): string | null {
  const cloudflare = headers.get('cf-connecting-ip');
  if (cloudflare) return cloudflare.trim() || null;

  const forwarded = headers.get('x-forwarded-for');
  if (forwarded) return forwarded.split(',')[0]?.trim() || null;
  return headers.get('x-real-ip');
}

/**
 * The visitor's country, for the same reason and with the same ordering.
 *
 * `x-vercel-ip-country` is derived from whatever address reached Vercel, so on
 * the Cloudflare-proxied apex it reports where the *edge* is — every portfolio
 * visitor appeared to be in the Netherlands because that is where Cloudflare
 * answered from. `cf-ipcountry` is resolved from the real client address before
 * the request is forwarded.
 */
export function callerCountry(headers: Headers): string | undefined {
  const cloudflare = headers.get('cf-ipcountry');
  // Cloudflare uses XX for "unknown" and T1 for Tor; neither is a place.
  if (cloudflare && cloudflare !== 'XX' && cloudflare !== 'T1') {
    return cloudflare;
  }
  return headers.get('x-vercel-ip-country') || undefined;
}
