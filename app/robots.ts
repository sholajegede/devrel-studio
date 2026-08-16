import type { MetadataRoute } from 'next'
import { siteOrigin } from '@/lib/site'

export default function robots(): MetadataRoute.Robots {
  const origin = siteOrigin()

  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        // The dashboard is behind auth and client dashboards are behind an
        // access code, so a crawler could not read them anyway — but keeping
        // them out of the crawl avoids a wall of soft-404s in Search Console.
        // /portfolio/* is the rewrite target for /@handle; only the pretty URL
        // should ever be indexed, or the same page competes with itself.
        disallow: ['/dashboard/', '/api/', '/sign-in', '/sign-up', '/portfolio/'],
      },
    ],
    sitemap: `${origin}/sitemap.xml`,
  }
}
