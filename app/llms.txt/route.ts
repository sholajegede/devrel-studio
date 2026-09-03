import { ConvexHttpClient } from 'convex/browser'
import { api } from '@/convex/_generated/api'
import { siteOrigin } from '@/lib/site'
import { field, isoDay, lines, llmsResponse, oneLine } from '@/lib/llms-txt'

// ── /llms.txt ─────────────────────────────────────────────────────────────────
//
// The directory. One request tells an agent what this site is and what public
// portfolios exist on it, each with its own llms.txt to read next — which is
// the difference between discovering thirty portfolios and crawling for them.
//
// Client dashboards are deliberately absent. Most are behind an access code, so
// listing them would be an enumeration of who retains whom — a fact the product
// never publishes anywhere else. A public one is still reachable and still
// serves its own llms.txt; it is just not advertised from here.

/**
 * Computed per request, cached at the edge — not prerendered.
 *
 * The obvious `export const revalidate = 3600` was wrong here, and wrong in a
 * way that only shows up on deploy day. It makes this route static, so Vercel
 * builds it once at build time — and Convex deploys are a separate manual step
 * in this repo, which always lands *after* the Vercel build. A build that runs
 * before `listPortfolioIndex` exists takes the catch below and bakes the
 * header-only fallback into a static file for an hour, on every deploy that
 * introduces a query.
 *
 * Dynamic at the origin with an `s-maxage` on the response gets the same
 * caching from the CDN, and a miss recomputes against whatever Convex is
 * actually serving rather than replaying a failure from build time.
 */
export const dynamic = 'force-dynamic'

/** How long the CDN may hold this. Not a Next revalidate — see above. */
const CACHE_SECONDS = 3600

export async function GET() {
  const origin = siteOrigin()

  const header = lines(
    '# DevRel Studio',
    '',
    '> Developer-relations work, logged once and shown to the people paying for it.',
    '> Advocates log what they ship; each client gets a live dashboard, and each',
    '> advocate gets a public portfolio of everything they have published.',
    '',
    field('Site', origin),
    field('Portfolios', `${origin}/@<handle>`),
    field('Per-portfolio llms.txt', `${origin}/@<handle>/llms.txt`),
  )

  const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL
  if (!convexUrl) return llmsResponse(header, CACHE_SECONDS)

  let portfolios: Awaited<ReturnType<typeof loadIndex>> = []
  try {
    portfolios = await loadIndex(convexUrl)
  } catch (error) {
    // A directory missing its listings is still a useful answer. Failing the
    // whole request because Convex blinked would take the description of the
    // site down with the list of pages on it.
    console.error('[llms.txt] could not list portfolios:', error)
    // Short, so a transient Convex failure heals in a minute rather than an hour.
    return llmsResponse(header, 60)
  }

  const body = portfolios
    .map((entry) =>
      lines(
        `## @${entry.handle}`,
        '',
        field('URL', `${origin}/@${entry.handle}`),
        field('llms.txt', `${origin}/@${entry.handle}/llms.txt`),
        field('Name', oneLine(entry.name) || null),
        field('Published', `${entry.published} ${entry.published === 1 ? 'piece' : 'pieces'}`),
        field(
          'Categories',
          entry.categories.map((c) => `${c.category} (${c.count})`).join(', ') || null,
        ),
        field('Updated', isoDay(entry.lastModified)),
        field('Bio', oneLine(entry.bio) || null),
      ),
    )
    .join('\n\n')

  return llmsResponse(
    lines(
      header,
      field('Count', `${portfolios.length} published`),
      field('Generated', isoDay(Date.now())),
      '',
      '## Portfolios',
      '',
      body || '_No published portfolios yet._',
    ),
    CACHE_SECONDS,
  )
}

function loadIndex(convexUrl: string) {
  return new ConvexHttpClient(convexUrl).query(api.portfolio.listPortfolioIndex, {})
}
