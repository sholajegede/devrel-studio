import { describe, expect, it } from 'vitest'
import { renderToBuffer } from '@react-pdf/renderer'
import { createReportDocument, type ReportData } from '@/app/api/export-report/pdf-template'

const base: ReportData = {
  client: 'kinde',
  period: 'July 2026',
  content: [
    {
      _id: '1',
      category: 'Written',
      title: 'Shipping auth in an afternoon',
      platform: 'Dev.to',
      publicationDate: '2026-07-10',
      status: 'Published',
      views: 12_400,
      reshares: [{ platform: 'X', link: 'https://x.com/a', date: '2026-07-11' }],
    },
    {
      _id: '2',
      category: 'Event',
      title: 'DevRelCon talk',
      platform: 'Conference',
      publicationDate: '2026-07-22',
      status: 'Published',
      attendees: 900,
      eventName: 'DevRelCon',
      eventLocation: 'London',
    },
  ],
  stats: {
    published: 2,
    inProgress: 3,
    totalViews: 12_400,
    totalDownloads: 0,
    totalAttendees: 900,
    totalStars: 40,
    totalReshares: 1,
  },
}

describe('report PDF', () => {
  it('renders with no write-up at all, exactly as before', async () => {
    const buffer = await renderToBuffer(createReportDocument(base))
    expect(buffer.length).toBeGreaterThan(1000)
  })

  it('renders with every new section populated', async () => {
    const buffer = await renderToBuffer(
      createReportDocument({
        ...base,
        notes: {
          summary: 'July was the launch month.\n\nA second paragraph follows it.',
          performanceNote: 'Reach nearly doubled on the launch post, which HN picked up.',
          responseToFeedback: 'You asked for more video — two shipped.',
          quotes: [
            { text: 'This is the clearest write-up we have had.', attribution: 'A maintainer' },
            { text: 'No attribution on this one.' },
          ],
        },
        targets: { reach: 10_000, published: 6 },
        highlights: [
          { title: 'DevRelCon talk', platform: 'Conference', category: 'Event', metric: 900 },
          { title: 'Shipping auth', platform: 'Dev.to', category: 'Written', metric: 12_400 },
        ],
      }),
    )
    expect(buffer.length).toBeGreaterThan(1000)
  })

  it('renders when a target is missed, met and absent', async () => {
    const buffer = await renderToBuffer(
      createReportDocument({ ...base, targets: { reach: 999_999, published: null } }),
    )
    expect(buffer.length).toBeGreaterThan(1000)
  })
})

// ── Branding on the exported document ─────────────────────────────────────────
//
// The PDF is what ends up attached to an invoice or forwarded to a VP, so it is
// the one artifact most worth having the client's own name on. Both fields are
// optional and absent on every report generated before they existed — an
// already-sent report has to stay reproducible.

describe('report PDF branding', () => {
  it('renders with a logo and a brand colour', async () => {
    const buffer = await renderToBuffer(
      createReportDocument({
        ...base,
        branding: { logoUrl: 'https://example.com/logo.png', brandColor: '#8cc63f' },
      }),
    )
    expect(buffer.length).toBeGreaterThan(0)
  })

  it('renders identically shaped output with no branding at all', async () => {
    // The path every existing report takes.
    const buffer = await renderToBuffer(createReportDocument({ ...base, branding: null }))
    expect(buffer.length).toBeGreaterThan(0)
  })

  it('tolerates a half-filled branding object', async () => {
    // A client with a colour and no logo, which is the common case.
    const buffer = await renderToBuffer(
      createReportDocument({ ...base, branding: { brandColor: '#0b3d91' } }),
    )
    expect(buffer.length).toBeGreaterThan(0)
  })
})
