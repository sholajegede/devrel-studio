import { ImageResponse } from 'next/og'
import { ConvexHttpClient } from 'convex/browser'
import { api } from '@/convex/_generated/api'
import { aggregate, formatCompact } from '@/lib/metrics'

// A portfolio exists to be shared. Without this the link preview is a bare
// title, which is the least persuasive form the page can take in the place it
// is most often seen.

export const runtime = 'edge'
export const alt = 'DevRel portfolio'
export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'

export default async function Image({ params }: { params: Promise<{ handle: string }> }) {
  const { handle } = await params

  const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL
  const data = convexUrl
    ? await new ConvexHttpClient(convexUrl)
        .query(api.portfolio.getPortfolio, { handle })
        .catch(() => null)
    : null

  const name =
    [data?.profile.firstName, data?.profile.lastName].filter(Boolean).join(' ').trim() ||
    `@${handle}`

  const totals = aggregate(data?.entries ?? [])

  // Only the metrics this person actually has. A card advertising "0 downloads"
  // argues against the page it is promoting.
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
            DevRel Portfolio
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
            @{data?.profile.handle ?? handle}
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
