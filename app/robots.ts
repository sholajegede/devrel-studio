import type { MetadataRoute } from 'next'
import { siteOrigin } from '@/lib/site'

export default function robots(): MetadataRoute.Robots {
  const origin = siteOrigin()

  return {
    rules: [
      {
        userAgent: '*',
        allow: [
          '/',
          // The generated link-preview cards live under the rewrite target that
          // the next rule blocks. Without this exception a crawler that honours
          // robots.txt cannot fetch the image, and the shared link falls back to
          // no preview at all — which defeats generating one.
          '/portfolio/*/opengraph-image*',
        ],
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
