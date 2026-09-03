import { describe, expect, it } from 'vitest'
import { createHash } from 'node:crypto'
import {
  callerCountry,
  callerIp,
  dayStamp,
  hashSessionTokenEdge,
  isBot,
  isPrefetch,
  isTrackablePath,
  referrerHost,
  normaliseRoute,
  sha256Hex,
  visitorHashEdge,
} from '@/lib/view-tracking'

describe('session token hashing', () => {
  // The reason this test exists: proxy.ts computes a session hash with Web
  // Crypto, and lib/manager-auth.ts computes the same hash with node:crypto for
  // the login path. If the two formulas drift, nothing throws — every manager
  // just silently records as anonymous, and the most valuable column in the
  // analytics section quietly becomes wrong.
  it('matches the node:crypto formula in lib/manager-auth', async () => {
    const token = 'a'.repeat(64)
    const secret = 'test-secret'

    const expected = createHash('sha256').update(`${token}:${secret}`).digest('hex')

    await expect(hashSessionTokenEdge(token, secret)).resolves.toBe(expected)
  })
})

describe('visitor hashing', () => {
  it('is stable for the same visitor on the same day', async () => {
    const now = new Date('2026-08-20T09:00:00Z')
    const a = await visitorHashEdge('1.2.3.4', 'Mozilla/5.0', 's', now)
    const b = await visitorHashEdge('1.2.3.4', 'Mozilla/5.0', 's', new Date('2026-08-20T21:00:00Z'))
    expect(a).toBe(b)
  })

  // The privacy property the whole design rests on: the day is inside the hash,
  // so nobody can be followed from one day to the next.
  it('changes for the same visitor on the next day', async () => {
    const a = await visitorHashEdge('1.2.3.4', 'Mozilla/5.0', 's', new Date('2026-08-20T23:59:00Z'))
    const b = await visitorHashEdge('1.2.3.4', 'Mozilla/5.0', 's', new Date('2026-08-21T00:01:00Z'))
    expect(a).not.toBe(b)
  })

  it('separates two visitors on the same day', async () => {
    const now = new Date('2026-08-20T09:00:00Z')
    const a = await visitorHashEdge('1.2.3.4', 'Mozilla/5.0', 's', now)
    const b = await visitorHashEdge('5.6.7.8', 'Mozilla/5.0', 's', now)
    expect(a).not.toBe(b)
  })

  it('never returns a raw identifier', async () => {
    const hash = await visitorHashEdge('203.0.113.7', 'Mozilla/5.0', 's')
    expect(hash).not.toContain('203.0.113.7')
    expect(hash).toMatch(/^[0-9a-f]{64}$/)
  })

  it('uses UTC day boundaries', () => {
    expect(dayStamp(new Date('2026-08-20T23:30:00Z'))).toBe('2026-08-20')
    expect(dayStamp(new Date('2026-08-21T00:30:00Z'))).toBe('2026-08-21')
  })
})

describe('sha256Hex', () => {
  it('agrees with node:crypto', async () => {
    const expected = createHash('sha256').update('hello').digest('hex')
    await expect(sha256Hex('hello')).resolves.toBe(expected)
  })
})

describe('bot filtering', () => {
  it.each([
    'Slackbot-LinkExpanding 1.0',
    'LinkedInBot/1.0',
    'Twitterbot/1.0',
    'facebookexternalhit/1.1',
    'Mozilla/5.0 (compatible; Googlebot/2.1)',
    'curl/8.4.0',
    'python-requests/2.31.0',
  ])('rejects %s', (ua) => {
    expect(isBot(ua)).toBe(true)
  })

  it('treats a missing user agent as a bot', () => {
    expect(isBot(null)).toBe(true)
  })

  it.each([
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36',
    'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Version/17.0 Mobile/15E148 Safari/604.1',
  ])('accepts a real browser', (ua) => {
    expect(isBot(ua)).toBe(false)
  })
})

describe('trackable paths', () => {
  // The OG image is fetched by the unfurler that is already excluded by user
  // agent, but it is also reachable directly, and counting it would inflate
  // every portfolio that gets shared.
  it('excludes the opengraph image route', () => {
    expect(isTrackablePath('/@ada/opengraph-image')).toBe(false)
  })

  it.each(['/_next/static/chunk.js', '/api/track/duration', '/robots.txt', '/sitemap.xml'])(
    'excludes %s',
    (path) => {
      expect(isTrackablePath(path)).toBe(false)
    },
  )

  it.each(['/', '/@ada', '/report', '/reports'])('includes %s', (path) => {
    expect(isTrackablePath(path)).toBe(true)
  })
})

describe('prefetches', () => {
  // The reason this test exists: a prefetch is indistinguishable from a real
  // visit once it has been written down. Both of the things that go wrong when
  // one is counted are invisible afterwards — a breakdown lists pages nobody
  // opened, and a burst of six simultaneous writes for one visitor contends on
  // the same rows until Convex gives up on one of them.

  it.each([
    ['next-router-prefetch', '1'],
    ['purpose', 'prefetch'],
    ['Purpose', 'Prefetch'],
    ['x-purpose', 'prefetch'],
    ['sec-purpose', 'prefetch'],
    ['sec-purpose', 'prefetch;prerender'],
    ['sec-purpose', 'prerender'],
  ])('recognises %s: %s', (name, value) => {
    expect(isPrefetch(new Headers({ [name]: value }))).toBe(true)
  })

  // RSC marks every App Router navigation, a real click included. Treating it
  // as speculative would stop counting client-side navigation altogether, which
  // is most of how anybody moves around a dashboard once it has loaded.
  it('does not treat an RSC navigation as a prefetch', () => {
    expect(isPrefetch(new Headers({ RSC: '1' }))).toBe(false)
  })

  it('does not treat a plain document request as a prefetch', () => {
    expect(isPrefetch(new Headers({ accept: 'text/html' }))).toBe(false)
  })

  // 'purpose: preview' is a link unfurler, already excluded by user agent, and
  // not something this predicate should start claiming.
  it('only matches purpose when it actually says prefetch', () => {
    expect(isPrefetch(new Headers({ purpose: 'preview' }))).toBe(false)
  })
})

describe('referrer', () => {
  it('reduces a full URL to a bare host', () => {
    expect(referrerHost('https://www.linkedin.com/feed/update/123', 'ada.devrel.studio')).toBe(
      'linkedin.com',
    )
  })

  // Query strings on inbound links carry campaign parameters and sometimes an
  // email address; none of it should be stored.
  it('drops the path and query', () => {
    expect(referrerHost('https://x.com/i/web/status/1?email=a@b.com', 'devrel.studio')).toBe('x.com')
  })

  it('ignores internal navigation', () => {
    expect(referrerHost('https://ada.devrel.studio/reports', 'ada.devrel.studio')).toBeUndefined()
    expect(referrerHost('https://devrel.studio/pricing', 'ada.devrel.studio')).toBeUndefined()
  })

  it('survives a malformed referer', () => {
    expect(referrerHost('not a url', 'devrel.studio')).toBeUndefined()
    expect(referrerHost(null, 'devrel.studio')).toBeUndefined()
  })
})

describe('callerIp', () => {
  it('takes the left-most forwarded entry', () => {
    const headers = new Headers({ 'x-forwarded-for': '1.2.3.4, 5.6.7.8' })
    expect(callerIp(headers)).toBe('1.2.3.4')
  })

  it('falls back to x-real-ip', () => {
    expect(callerIp(new Headers({ 'x-real-ip': '9.9.9.9' }))).toBe('9.9.9.9')
  })

  it('returns null when neither header is present', () => {
    expect(callerIp(new Headers())).toBeNull()
  })

  // devrel.studio's apex is proxied through Cloudflare while *.devrel.studio is
  // not. On the proxied path x-forwarded-for carries a Cloudflare edge address
  // that changes per connection, so preferring it counted one visitor reloading
  // a portfolio as a new person every time.
  it('prefers the Cloudflare client IP over a proxied forwarded-for', () => {
    const headers = new Headers({
      'cf-connecting-ip': '102.89.1.1',
      'x-forwarded-for': '172.71.150.9',
    })
    expect(callerIp(headers)).toBe('102.89.1.1')
  })

  it('gives one visitor one hash across reloads from rotating Cloudflare edges', async () => {
    const now = new Date('2026-08-21T20:00:00Z')
    const ua = 'Mozilla/5.0 (Macintosh) Chrome/122.0 Safari/537.36'

    const reload = (edge: string) =>
      new Headers({ 'cf-connecting-ip': '102.89.1.1', 'x-forwarded-for': edge })

    const first = await visitorHashEdge(callerIp(reload('172.71.150.9')), ua, 's', now)
    const second = await visitorHashEdge(callerIp(reload('104.23.200.4')), ua, 's', now)
    const third = await visitorHashEdge(callerIp(reload('172.68.24.71')), ua, 's', now)

    expect(new Set([first, second, third]).size).toBe(1)
  })
})

describe('callerCountry', () => {
  // The same root cause: x-vercel-ip-country is resolved from whatever address
  // reached Vercel, which on the proxied path is Cloudflare's Amsterdam edge —
  // reporting every Nigerian portfolio visitor as Dutch.
  it('prefers the Cloudflare country over the edge location', () => {
    const headers = new Headers({ 'cf-ipcountry': 'NG', 'x-vercel-ip-country': 'NL' })
    expect(callerCountry(headers)).toBe('NG')
  })

  it('falls back to Vercel when Cloudflare is not in front', () => {
    expect(callerCountry(new Headers({ 'x-vercel-ip-country': 'NG' }))).toBe('NG')
  })

  it.each(['XX', 'T1'])('ignores the Cloudflare placeholder %s', (code) => {
    const headers = new Headers({ 'cf-ipcountry': code, 'x-vercel-ip-country': 'NG' })
    expect(callerCountry(headers)).toBe('NG')
  })

  it('returns undefined when nothing reports a country', () => {
    expect(callerCountry(new Headers())).toBeUndefined()
  })
})

// ── Routes, not URLs ──────────────────────────────────────────────────────────
//
// Site-wide tracking counts the product's own pages, and a page-view table keyed
// on identifiers is one nobody can group — and one somebody could work backwards
// from to a particular customer's record.

describe('normaliseRoute', () => {
  it('leaves a plain route alone', () => {
    expect(normaliseRoute('/pricing')).toBe('/pricing')
    expect(normaliseRoute('/dashboard/clients')).toBe('/dashboard/clients')
  })

  it('collapses Convex ids to their parameter', () => {
    expect(normaliseRoute('/dashboard/edit/jd7anm6a4kqts6e9sf8bpfyxf181s70m')).toBe(
      '/dashboard/edit/:id',
    )
  })

  it('leaves words and slugs that are not ids', () => {
    // The rule is "long, lowercase alphanumeric, and contains a digit" — which
    // is what separates an id from a word or a hyphenated company slug.
    expect(normaliseRoute('/dashboard/analytics')).toBe('/dashboard/analytics')
    expect(normaliseRoute('/portfolio/acme-industries')).toBe('/portfolio/acme-industries')
  })

  it('hides invitation tokens whatever shape they take', () => {
    expect(normaliseRoute('/invite/abcDEF123-token')).toBe('/invite/:token')
  })

  it('groups report periods', () => {
    expect(normaliseRoute('/reports/2026-09')).toBe('/reports/:period')
  })

  it('keeps the root as the root', () => {
    expect(normaliseRoute('/')).toBe('/')
  })
})
