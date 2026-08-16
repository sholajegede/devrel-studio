/**
 * Absolute origin for the marketing site and public portfolios.
 *
 * Everything that has to be a full URL — sitemap entries, robots directives,
 * canonical tags, OG images — needs the same answer, and getting it from one
 * place is what stops the sitemap advertising https://localhost:3000.
 *
 * `NEXT_PUBLIC_ROOT_DOMAIN` is a bare host (`devrel.studio`, `localhost:3000`)
 * because the subdomain rewrite in proxy.ts composes it with a client slug.
 */
export function siteOrigin(): string {
  const root = process.env.NEXT_PUBLIC_ROOT_DOMAIN ?? 'localhost:3000'
  const protocol = root.startsWith('localhost') || root.startsWith('127.') ? 'http' : 'https'
  return `${protocol}://${root}`
}
