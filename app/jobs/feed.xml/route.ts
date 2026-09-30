import { loadList } from '@/lib/jobs/server'
import { payLabel, familyLabel } from '@/lib/jobs/ui'
import { siteOrigin } from '@/lib/site'

export const dynamic = 'force-dynamic'

const escapeXml = (value: string) =>
  value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

export async function GET() {
  const origin = siteOrigin()
  const result = await loadList({ limit: 100, includeAdjacent: true })
  const items = (result?.items ?? [])
    .map((job) => {
      const pay = payLabel(job)
      const summary = `${familyLabel(job.family)} at ${job.companyName}, ${job.locationLabel}${pay ? `, ${pay}` : ''}. ${job.summary}`
      return `<item><title>${escapeXml(`${job.title} at ${job.companyName}`)}</title><link>${origin}/jobs/${job.slug}</link><guid isPermaLink="true">${origin}/jobs/${job.slug}</guid><pubDate>${new Date(job.postedAt).toUTCString()}</pubDate><description>${escapeXml(summary)}</description></item>`
    })
    .join('')

  const body = `<?xml version="1.0" encoding="UTF-8"?><rss version="2.0"><channel><title>DevRel jobs</title><link>${origin}/jobs</link><description>Open developer relations roles from employers’ own careers pages.</description>${items}</channel></rss>`

  return new Response(body, {
    headers: {
      'Content-Type': 'application/rss+xml; charset=utf-8',
      'Cache-Control': 'public, s-maxage=900, stale-while-revalidate=3600',
    },
  })
}
