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
          background: '#14181d',
          padding: 80,
          fontFamily: 'sans-serif',
        }}
      >
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <div style={{ display: 'flex', fontSize: 26, color: '#9aa5b1' }}>
            devrel<span style={{ color: '#4fd1c5' }}>.studio</span>
          </div>

          <div
            style={{
              display: 'flex',
              marginTop: 40,
              fontSize: 66,
              fontWeight: 600,
              color: '#e6e9ec',
              letterSpacing: -2.5,
              lineHeight: 1.1,
              maxWidth: 900,
            }}
          >
            Show clients what their DevRel investment is actually doing
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', fontSize: 24, color: '#9aa5b1', maxWidth: 700 }}>
            Log content, track live metrics, share a performance dashboard with every client.
          </div>
          <div
            style={{
              display: 'flex',
              fontSize: 22,
              color: '#4fd1c5',
              border: '1px solid #2b323b',
              borderRadius: 8,
              padding: '10px 18px',
            }}
          >
            Pay once
          </div>
        </div>
      </div>
    ),
    size,
  )
}
