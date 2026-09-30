import type { MetadataRoute } from 'next'
import { ConvexHttpClient } from 'convex/browser'
import { api } from '@/convex/_generated/api'
import { siteOrigin } from '@/lib/site'
import { FAMILIES } from '@/lib/jobs/taxonomy'

// Regenerated on the same cadence as the portfolios themselves. A sitemap that
// is an hour stale is fine; one that blocks a deploy because Convex is briefly
// unreachable is not, hence the fallback below.
export const revalidate = 3600

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const origin = siteOrigin()

  const staticRoutes: MetadataRoute.Sitemap = [
    { url: `${origin}/`, changeFrequency: 'weekly', priority: 1 },
    { url: `${origin}/pricing`, changeFrequency: 'monthly', priority: 0.8 },
    { url: `${origin}/contact`, changeFrequency: 'yearly', priority: 0.5 },
    { url: `${origin}/demo`, changeFrequency: 'monthly', priority: 0.7 },
    { url: `${origin}/privacy`, changeFrequency: 'yearly', priority: 0.3 },
    { url: `${origin}/terms`, changeFrequency: 'yearly', priority: 0.3 },
    { url: `${origin}/jobs`, changeFrequency: 'hourly', priority: 0.9 },
    { url: `${origin}/jobs/salaries`, changeFrequency: 'daily', priority: 0.8 },
    { url: `${origin}/jobs/companies`, changeFrequency: 'daily', priority: 0.7 },
    { url: `${origin}/jobs/remote`, changeFrequency: 'daily', priority: 0.8 },
    { url: `${origin}/jobs/contract`, changeFrequency: 'daily', priority: 0.8 },
    { url: `${origin}/blog`, changeFrequency: 'weekly', priority: 0.7 },
    ...FAMILIES.map((family) => ({
      url: `${origin}/jobs/roles/${family.id}`,
      changeFrequency: 'daily' as const,
      priority: 0.8,
    })),
  ]

  const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL
  if (!convexUrl) return staticRoutes

  try {
    const convex = new ConvexHttpClient(convexUrl)
    const handles = await convex.query(api.portfolio.listPublishedHandles, {})

    const jobRoutes: MetadataRoute.Sitemap = []
    try {
      const [jobs, stats] = await Promise.all([
        convex.query(api.jobs.sitemapEntries, {}),
        convex.query(api.jobs.stats, {}),
      ])
      for (const job of jobs) {
        jobRoutes.push({
          url: `${origin}/jobs/${job.slug}`,
          lastModified: new Date(job.lastVerifiedAt),
          changeFrequency: 'daily',
          priority: 0.6,
        })
      }
      for (const company of stats?.byCompany ?? []) {
        jobRoutes.push({
          url: `${origin}/jobs/companies/${company.slug}`,
          changeFrequency: 'daily',
          priority: 0.6,
        })
      }
    } catch (error) {
      console.error('[sitemap] could not list jobs:', error)
    }

    const blogRoutes: MetadataRoute.Sitemap = []
    try {
      for (const post of await convex.query(api.blog.list, {})) {
        blogRoutes.push({ url: `${origin}/blog/${post.slug}`, lastModified: new Date(post.publishedAt), changeFrequency: 'monthly', priority: 0.7 })
      }
    } catch (error) {
      console.error('[sitemap] could not list blog posts:', error)
    }

    return [
      ...staticRoutes,
      ...jobRoutes,
      ...blogRoutes,
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
