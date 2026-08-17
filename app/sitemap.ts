import type { MetadataRoute } from 'next'
import { ConvexHttpClient } from 'convex/browser'
import { api } from '@/convex/_generated/api'
import { siteOrigin } from '@/lib/site'

// Regenerated on the same cadence as the portfolios themselves. A sitemap that
// is an hour stale is fine; one that blocks a deploy because Convex is briefly
// unreachable is not, hence the fallback below.
export const revalidate = 3600

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const origin = siteOrigin()

  const staticRoutes: MetadataRoute.Sitemap = [
    { url: `${origin}/`, changeFrequency: 'weekly', priority: 1 },
    { url: `${origin}/pricing`, changeFrequency: 'monthly', priority: 0.8 },
    { url: `${origin}/waitlist`, changeFrequency: 'monthly', priority: 0.5 },
    { url: `${origin}/contact`, changeFrequency: 'yearly', priority: 0.5 },
    { url: `${origin}/demo`, changeFrequency: 'monthly', priority: 0.7 },
    { url: `${origin}/privacy`, changeFrequency: 'yearly', priority: 0.3 },
    { url: `${origin}/terms`, changeFrequency: 'yearly', priority: 0.3 },
  ]

  const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL
  if (!convexUrl) return staticRoutes

  try {
    const handles = await new ConvexHttpClient(convexUrl).query(
      api.portfolio.listPublishedHandles,
      {},
    )

    return [
      ...staticRoutes,
      ...handles.map((entry) => ({
        // The canonical address is the pretty one — /portfolio/<handle> is an
        // internal rewrite target and should never be the URL that gets indexed.
        url: `${origin}/@${entry.handle}`,
        lastModified: new Date(entry.lastModified),
        changeFrequency: 'weekly' as const,
        priority: 0.7,
      })),
    ]
  } catch (error) {
    console.error('[sitemap] could not list portfolios:', error)
    return staticRoutes
  }
}
