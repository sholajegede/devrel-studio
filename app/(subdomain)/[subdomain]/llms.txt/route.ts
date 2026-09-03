import { ConvexHttpClient } from 'convex/browser'
import { api } from '@/convex/_generated/api'
import {
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

// ── <slug>.devrel.studio/llms.txt ─────────────────────────────────────────────
//
// ⚠ This route enforces its own access gate, and must keep doing so.
//
// Every page under this segment is protected by app/(subdomain)/[subdomain]/
// layout.tsx, which checks the manager access code server-side before rendering
// anything. A layout wraps pages — it does not wrap route handlers. So a file
// added here inherits the *address* of a protected dashboard and none of its
// protection, and shipping it without the check below would publish every
// private client's content, in a format designed to be read in bulk, to anyone
// who guessed a slug.
//
// The check is deliberately stricter than the layout's. The layout lets a
// client through when no code has been set yet, so a DevRel mid-setup is not
// locked out of their own workspace. That is a reasonable thing to do for a
// person who typed the address; it is not a reasonable thing to do for a
// crawler. Here, only `isPublic` — a switch the DevRel actually threw — opens
// the file. Everything else gets the stub.

export const revalidate = 300

/** What a host that is gated, unconfigured, or simply not public says. */
function gatedStub(clientName: string | null, host: string): string {
  return lines(
    `# ${oneLine(clientName) || 'Client'} — DevRel Dashboard`,
    '',
    '> A private client dashboard on DevRel Studio.',
    '> Access requires a code issued by the DevRel who owns it.',
    '',
    field('Host', `https://${host}`),
    field('Status', 'access-gated'),
    field('Content', 'not available without a code'),
    field('About', 'https://www.devrel.studio'),
  )
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ subdomain: string }> },
) {
  const { subdomain } = await params
  const host = request.headers.get('host') ?? `${subdomain}.devrel.studio`

  const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL
  if (!convexUrl) return new Response('Not found', { status: 404 })

  const convex = new ConvexHttpClient(convexUrl)

  let gate
  try {
    gate = await convex.query(api.managerAccess.getGateInfo, { slug: subdomain })
  } catch (error) {
    // The gate failing closed is the only acceptable direction. An error here
    // must never fall through to the content below.
    console.error('[llms.txt] gate lookup failed for', subdomain, error)
    return new Response('Temporarily unavailable', { status: 503 })
  }

  // Nobody owns this slug. The wildcard DNS answers for every name under the
  // domain, so without this every company on earth has a 200 here — the same
  // reason the layout calls notFound().
  if (!gate.exists) return new Response('Not found', { status: 404 })

  if (gate.isPublic !== true) {
    return llmsResponse(gatedStub(gate.clientName, host), revalidate)
  }

  // ── Public dashboard ────────────────────────────────────────────────────────
  //
  // The DevRel has published this one, so the page renders to anybody without a
  // code and this file may say what the page says — including work that is not
  // Published yet, which the dashboard shows with a status badge. `withStatus`
  // carries that across; omitting it would let a draft read as shipped.

  let rows
  try {
    rows = await convex.query(api.content.getContentByClient, { client: subdomain })
  } catch (error) {
    console.error('[llms.txt] content load failed for', subdomain, error)
    return new Response('Temporarily unavailable', { status: 503 })
  }

  // `getContentByClient` returns whole documents, and those documents carry
  // `notes` and `trackingLink` — internal fields that exist so a DevRel can
  // write to themselves and measure their own links. Naming each published
  // field here is what keeps them out; never spread the row.
  const entries: LlmsEntry[] = rows.map((row) => ({
    title: row.title,
    link: row.link,
    platform: row.platform,
    publicationDate: row.publicationDate,
    category: row.category,
    contentType: row.contentType,
    tags: row.tags,
    status: row.status,
    views: row.views,
    downloads: row.downloads,
    attendees: row.attendees,
    stars: row.stars,
    packageName: row.packageName,
    eventName: row.eventName,
    eventLocation: row.eventLocation,
    podcastName: row.podcastName,
    reshares: row.reshares,
  }))

  const name = oneLine(gate.clientName) || subdomain
  const published = entries.filter((entry) => entry.status === 'Published')
  const latest = latestPublished(entries)

  return llmsResponse(
    lines(
      `# ${name} — DevRel Dashboard`,
      '',
      `> Developer-relations work delivered for ${name}, tracked in DevRel Studio.`,
      '> This dashboard has been made public by the advocate who owns it.',
      '',
      field('Host', `https://${host}`),
      field('Client', name),
      field('Entries', `${entries.length} total, ${published.length} published`),
      field('Totals', totalsLine(published)),
      field('Latest published', isoDay(latest)),
      field('About', 'https://www.devrel.studio'),
      '',
      entries.length
        ? categorySections(entries, { withStatus: true })
        : '## Work\n\n_Nothing logged yet._',
    ),
    revalidate,
  )
}
