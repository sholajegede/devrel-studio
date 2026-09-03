import { ImageResponse } from 'next/og'
import { ConvexHttpClient } from 'convex/browser'
import { api } from '@/convex/_generated/api'
import { aggregate, formatCompact } from '@/lib/metrics'

// ── What a client dashboard looks like in Slack ───────────────────────────────
//
// This is the link a DevRel sends and a manager forwards. Its whole distribution
// is other people's inboxes and channels, and until now it unfurled as a bare
// title — the least persuasive form the page can take in the one place it is
// most often seen.
//
// It shows the company's name and the totals rather than any content, for the
// reason the dashboard itself is gated: the entries belong to the engagement and
// an unfurl is rendered by whatever service saw the URL. Counts say the work
// exists without saying what it was.

export const runtime = 'edge'
export const alt = 'Performance dashboard'
export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'

export default async function Image({
  params,
}: {
  params: Promise<{ subdomain: string }>
}) {
  const { subdomain } = await params

  const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL
  const client = convexUrl ? new ConvexHttpClient(convexUrl) : null

  // Both are public reads scoped to the slug, and both degrade to nothing rather
  // than failing: an image generator is the last thing that should be able to
  // take a page down.
  const [gate, entries] = await Promise.all([
    client
      ? client.query(api.managerAccess.getGateInfo, { slug: subdomain }).catch(() => null)
      : null,
    client
      ? client.query(api.content.getContentByClient, { client: subdomain }).catch(() => [])
      : [],
  ])

  const name = gate?.clientName || subdomain
  const totals = aggregate(entries ?? [])

  // Only the metrics this engagement actually has. A card advertising
  // "0 downloads" argues against the page it is promoting.
  const stats = [
    { label: 'Published', value: totals.published.toLocaleString() },
    { label: 'Views', value: formatCompact(totals.views) },
    { label: 'Downloads', value: formatCompact(totals.downloads) },
    { label: 'Attendees', value: formatCompact(totals.attendees) },
  ].filter((stat) => stat.value !== '0')

  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          background: '#14181d',
          padding: 72,
          fontFamily: 'sans-serif',
        }}
      >
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <div
            style={{
              display: 'flex',
              fontSize: 22,
              color: '#4fd1c5',
              letterSpacing: 2,
              textTransform: 'uppercase',
            }}
          >
            Performance Dashboard
          </div>

          <div
            style={{
              display: 'flex',
              marginTop: 24,
              fontSize: 78,
              fontWeight: 600,
              color: '#e6e9ec',
              letterSpacing: -2,
            }}
          >
            {name}
          </div>

          <div style={{ display: 'flex', marginTop: 12, fontSize: 30, color: '#9aa5b1' }}>
            {subdomain}.devrel.studio
          </div>
        </div>

        <div style={{ display: 'flex', gap: 56 }}>
          {stats.map((stat) => (
            <div key={stat.label} style={{ display: 'flex', flexDirection: 'column' }}>
              <div style={{ display: 'flex', fontSize: 46, fontWeight: 600, color: '#e6e9ec' }}>
                {stat.value}
              </div>
              <div style={{ display: 'flex', fontSize: 22, color: '#9aa5b1', marginTop: 4 }}>
                {stat.label}
              </div>
            </div>
          ))}

          <div
            style={{
              display: 'flex',
              marginLeft: 'auto',
              alignItems: 'flex-end',
              fontSize: 24,
              color: '#4a5561',
            }}
          >
            devrel.studio
          </div>
        </div>
      </div>
    ),
    size,
  )
}
