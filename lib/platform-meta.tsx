'use client'

// `PlatformIcon` hides a favicon that fails to load, which needs an onError
// handler — and a handler cannot be passed from a server component. Every other
// caller sits inside a 'use client' page so this went unnoticed; the public
// portfolio is server-rendered, and there it threw during render.

import type React from 'react'
import { BookOpen, Globe, Mail, Rss } from 'lucide-react'

// ── Platform presentation ─────────────────────────────────────────────────────
//
// One registry for "what does this platform look like", shared by the client
// dashboard, the public portfolio and anywhere else a platform is named. It
// used to be an inline map in the subdomain page, which is why most platforms
// in `PLATFORMS_BY_CATEGORY` had no icon at all.
//
// Icons come from Google's favicon service, so adding a platform is one line
// and needs no asset checked into the repo.

function favicon(domain: string): string {
  return `https://www.google.com/s2/favicons?domain=${domain}&sz=32`
}

/** Platforms that map to a real domain. */
export const PLATFORM_DOMAINS: Record<string, string> = {
  // Written
  'Dev.to':            'dev.to',
  freeCodeCamp:        'freecodecamp.org',
  Medium:              'medium.com',
  Hashnode:            'hashnode.com',
  LinkedIn:            'linkedin.com',
  'Twitter/X':         'x.com',
  GitHub:              'github.com',
  // Video
  YouTube:             'youtube.com',
  Loom:                'loom.com',
  Vimeo:               'vimeo.com',
  TikTok:              'tiktok.com',
  // Podcast
  Spotify:             'spotify.com',
  'Apple Podcasts':    'podcasts.apple.com',
  'YouTube Podcasts':  'youtube.com',
  // Package
  npm:                 'npmjs.com',
  // Demo / hosting
  Vercel:              'vercel.com',
  Netlify:             'netlify.com',
  'Cloudflare Pages':  'cloudflare.com',
  // Reshare targets
  Reddit:              'reddit.com',
  'Hacker News':       'news.ycombinator.com',
  'OpenAI Forum':      'community.openai.com',
}

/**
 * Platforms that are a kind of thing rather than a site — there is no domain to
 * fetch a favicon from, so they get a lucide glyph instead.
 */
const GENERIC_ICONS: Record<string, React.ElementType> = {
  Newsletter:    Mail,
  Blog:          Rss,
  Documentation: BookOpen,
  Other:         Globe,
}

/** Favicon URL for a platform, or null when it has no associated site. */
export function platformFaviconUrl(platform: string): string | null {
  const domain = PLATFORM_DOMAINS[platform]
  if (domain) return favicon(domain)
  if (GENERIC_ICONS[platform]) return null

  // Unknown platform — usually a conference or podcast name typed by hand.
  // Guessing `<name>.com` produces a wrong-but-harmless icon more often than a
  // right one, so these fall through to the generic glyph as well.
  return null
}

export function platformGenericIcon(platform: string): React.ElementType {
  return GENERIC_ICONS[platform] ?? Globe
}

/**
 * Renders a platform's icon at a consistent size. Falls back to a glyph when
 * there is no favicon, and hides a broken image rather than showing the
 * browser's placeholder.
 */
export function PlatformIcon({
  platform,
  size = 14,
  className = '',
}: {
  platform: string
  size?: number
  className?: string
}) {
  const url = platformFaviconUrl(platform)

  if (!url) {
    const Icon = platformGenericIcon(platform)
    return (
      <Icon
        className={`shrink-0 text-muted-foreground ${className}`}
        style={{ width: size, height: size }}
        aria-hidden="true"
      />
    )
  }

  return (
    <img
      src={url}
      alt=""
      width={size}
      height={size}
      loading="lazy"
      className={`rounded-sm shrink-0 ${className}`}
      onError={(e) => {
        e.currentTarget.style.display = 'none'
      }}
    />
  )
}
