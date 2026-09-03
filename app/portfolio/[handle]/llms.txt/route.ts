import { ConvexHttpClient } from 'convex/browser'
import { api } from '@/convex/_generated/api'
import { siteOrigin } from '@/lib/site'
import {
  absoluteUrl,
  categorySections,
  field,
  isoDay,
  latestPublished,
  lines,
  llmsResponse,
  oneLine,
  totalsLine,
  type LlmsEntry,
} from '@/lib/llms-txt'

// ── /@handle/llms.txt ─────────────────────────────────────────────────────────
//
// Served at the pretty address; this path is the rewrite target, the same way
// the page itself is (see proxy.ts).
//
// Everything here comes from `portfolio.getPortfolio`, which is the query the
// page renders from — so the file cannot drift from the page, and cannot
// contain anything the page does not. That query already excludes drafts,
// scheduled work, notes, tracking links and which client commissioned what;
// this route adds no second opinion about what is publishable.

// Matches the page's own `revalidate`. Published work does not change by the
// minute, and the two surfaces going stale together is one less way for them to
// disagree.
export const revalidate = 300

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ handle: string }> },
) {
  const { handle } = await params
  const origin = siteOrigin()

  const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL
  if (!convexUrl) return new Response('Not found', { status: 404 })

  let data
  try {
    data = await new ConvexHttpClient(convexUrl).query(api.portfolio.getPortfolio, {
      handle,
    })
  } catch (error) {
    console.error('[llms.txt] portfolio load failed for', handle, error)
    return new Response('Temporarily unavailable', { status: 503 })
  }

  // The page 404s on an unclaimed handle, so this does too. A 200 here would
  // tell anybody enumerating handles which ones exist.
  if (!data) return new Response('Not found', { status: 404 })

  const { profile, entries } = data
  const name = `${profile.firstName} ${profile.lastName}`.trim() || `@${profile.handle}`

  // Named field by field rather than spread: see the note in lib/llms-txt.
  const published: LlmsEntry[] = entries.map((entry) => ({
    title: entry.title,
    link: entry.link,
    platform: entry.platform,
    publicationDate: entry.publicationDate,
    category: entry.category,
    contentType: entry.contentType,
    tags: entry.tags,
    status: entry.status,
    views: entry.views,
    downloads: entry.downloads,
    attendees: entry.attendees,
    stars: entry.stars,
    packageName: entry.packageName,
    eventName: entry.eventName,
    eventLocation: entry.eventLocation,
    podcastName: entry.podcastName,
    reshares: Array.from({ length: entry.reshareCount }),
  }))

  const latest = latestPublished(published)

  const summary =
    oneLine(profile.bio) ||
    `${published.length} published ${published.length === 1 ? 'piece' : 'pieces'} of developer content by ${oneLine(name)}.`

  return llmsResponse(
    lines(
      `# ${oneLine(name)} — DevRel Portfolio`,
      '',
      `> ${summary}`,
      '',
      field('URL', `${origin}/@${profile.handle}`),
      field('Handle', `@${profile.handle}`),
      field('Published', `${published.length} ${published.length === 1 ? 'piece' : 'pieces'}`),
      field('Totals', totalsLine(published)),
      field('Latest published', isoDay(latest)),
      field('Website', absoluteUrl(profile.websiteUrl)),
      field('GitHub', profile.githubUsername ? `https://github.com/${oneLine(profile.githubUsername)}` : null),
      field('X', profile.twitterUsername ? `https://x.com/${oneLine(profile.twitterUsername)}` : null),
      field('Index', `${origin}/llms.txt`),
      '',
      published.length
        ? categorySections(published)
        : '## Published work\n\n_Nothing published yet._',
    ),
    revalidate,
  )
}
