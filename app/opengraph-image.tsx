import { ImageResponse } from 'next/og'

// The homepage and pricing had no preview card, so every link shared in a Slack
// or a DM rendered as bare text — the exact places this product gets passed
// around. Portfolios already had one; this is the same treatment for the site.

export const runtime = 'edge'
export const alt = 'DevRel Studio — show clients what their DevRel investment is doing'
export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'

export default function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          background: '#f8f0e3',
          padding: 80,
          fontFamily: 'sans-serif',
        }}
      >
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <div style={{ display: 'flex', fontSize: 26, color: '#6e625b' }}>
            devrel<span style={{ color: '#f16b46' }}>.studio</span>
          </div>

          <div
            style={{
              display: 'flex',
              marginTop: 40,
              fontSize: 96,
              fontWeight: 600,
              color: '#180102',
              letterSpacing: -4,
              lineHeight: 1.02,
              maxWidth: 1000,
            }}
          >
            Content shipped. Impact shown.
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', fontSize: 24, color: '#6e625b', maxWidth: 700 }}>
            Log every piece of DevRel work and give each client a live dashboard of what it earned.
          </div>
          <div
            style={{
              display: 'flex',
              fontSize: 22,
              color: '#f8f0e3',
              background: '#f16b46',
              borderRadius: 16,
              padding: '12px 24px',
            }}
          >
            Free 14 days
          </div>
        </div>
      </div>
    ),
    size,
  )
}
