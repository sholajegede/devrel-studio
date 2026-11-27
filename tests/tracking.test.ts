import { describe, expect, it } from 'vitest'
import {
  buildTrackingLink,
  checkTrackingLink,
  contentSlugFor,
  forbidsPromotionalLinks,
  needsFix,
  normalizeBase,
  placementLinksFor,
  slugify,
  trackingLinkFor,
  utmSourceFor,
} from '@/lib/tracking'

const kinde = { trackingBase: 'https://kinde.com/', utmCampaign: 'shola' }

describe('buildTrackingLink', () => {
  it('writes the agreed format with the parameters in a fixed order', () => {
    expect(
      buildTrackingLink({ base: 'https://kinde.com/', campaign: 'shola', source: 'devto', content: 'my-article' }),
    ).toBe('https://kinde.com/?utm_source=devto&utm_medium=content&utm_campaign=shola&utm_content=my-article')
  })

  it('accepts a base without a scheme or trailing slash', () => {
    expect(normalizeBase('kinde.com')).toBe('https://kinde.com/')
    expect(normalizeBase('https://kinde.com?x=1')).toBe('https://kinde.com/')
    expect(normalizeBase('')).toBeNull()
  })
})

describe('utmSourceFor', () => {
  it('maps platforms to their source', () => {
    expect(utmSourceFor({ category: 'Written', platform: 'Dev.to' })).toBe('devto')
    expect(utmSourceFor({ category: 'Written', platform: 'Hashnode' })).toBe('hashnode')
    expect(utmSourceFor({ category: 'Written', platform: 'Medium' })).toBe('medium')
    expect(utmSourceFor({ category: 'Written', platform: 'LinkedIn' })).toBe('linkedin')
    expect(utmSourceFor({ category: 'Written', platform: 'Twitter/X' })).toBe('x')
    expect(utmSourceFor({ category: 'Video', platform: 'YouTube' })).toBe('youtube')
    expect(utmSourceFor({ category: 'Written', platform: 'The New Stack' })).toBe('thenewstack')
  })

  it('uses one source per category for events, podcasts, packages and demos', () => {
    expect(utmSourceFor({ category: 'Event', platform: 'GDG Lagos' })).toBe('event')
    expect(utmSourceFor({ category: 'Podcast', platform: 'Spotify' })).toBe('podcast')
    expect(utmSourceFor({ category: 'Package', platform: 'npm' })).toBe('npm')
    expect(utmSourceFor({ category: 'Demo', platform: 'Vercel' })).toBe('demo')
  })

  it('gives freeCodeCamp no source, because the platform forbids promotional links', () => {
    expect(forbidsPromotionalLinks('freeCodeCamp')).toBe(true)
    expect(utmSourceFor({ category: 'Written', platform: 'freeCodeCamp' })).toBeNull()
  })
})

describe('contentSlugFor', () => {
  it('uses the article URL and drops the platform suffix', () => {
    expect(
      contentSlugFor({ category: 'Written', link: 'https://dev.to/sholajegede/how-kinde-billing-actually-works-8fc' }),
    ).toBe('how-kinde-billing-actually-works')
  })

  it('falls back to the title', () => {
    expect(contentSlugFor({ category: 'Written', title: 'Authenticating AI Agents: Why?' })).toBe(
      'authenticating-ai-agents-why',
    )
  })

  it('cuts long slugs at a word boundary', () => {
    const slug = slugify('word '.repeat(30))
    expect(slug.length).toBeLessThanOrEqual(60)
    expect(slug.endsWith('-')).toBe(false)
  })

  it('names an event with its year', () => {
    expect(
      contentSlugFor({ category: 'Event', eventName: 'DevFest Lagos', publicationDate: '2026-11-14' }),
    ).toBe('devfest-lagos-2026')
    expect(
      contentSlugFor({ category: 'Event', eventName: 'DevFest Lagos 2026', publicationDate: '2026-11-14' }),
    ).toBe('devfest-lagos-2026')
  })

  it('names a package after its npm name', () => {
    expect(contentSlugFor({ category: 'Package', packageName: '@sholajegede/kinde-testkit' })).toBe(
      'sholajegede-kinde-testkit',
    )
  })

  it('names a demo after its repo', () => {
    expect(contentSlugFor({ category: 'Demo', repoUrl: 'https://github.com/sholajegede/kinde-jev-guard.git' })).toBe(
      'kinde-jev-guard',
    )
  })
})

describe('trackingLinkFor', () => {
  it('builds the link from the client settings', () => {
    expect(
      trackingLinkFor({ category: 'Written', platform: 'Dev.to', link: 'https://dev.to/x/my-post-ab12' }, kinde),
    ).toBe('https://kinde.com/?utm_source=devto&utm_medium=content&utm_campaign=shola&utm_content=my-post')
  })

  it('builds nothing without client settings', () => {
    expect(trackingLinkFor({ category: 'Written', platform: 'Dev.to', title: 'x' }, {})).toBeNull()
  })

  it('builds nothing for freeCodeCamp', () => {
    expect(trackingLinkFor({ category: 'Written', platform: 'freeCodeCamp', title: 'x' }, kinde)).toBeNull()
  })
})

describe('placementLinksFor', () => {
  it('gives a package a GitHub and an npm link', () => {
    const links = placementLinksFor({ category: 'Package', packageName: 'kinde-testkit' }, kinde, 'Kinde')
    expect(links.map((l) => l.placement)).toEqual(['github', 'npm'])
    expect(links[0].url).toContain('utm_source=github')
    expect(links[1].url).toContain('utm_source=npm')
    expect(links[0].markdown).toMatch(/^\[Kinde\]\(https:\/\/kinde\.com\//)
  })

  it('gives a demo a GitHub and a demo link', () => {
    const links = placementLinksFor({ category: 'Demo', repoUrl: 'https://github.com/a/b' }, kinde)
    expect(links.map((l) => l.placement)).toEqual(['github', 'demo'])
  })

  it('gives written work none', () => {
    expect(placementLinksFor({ category: 'Written', platform: 'Dev.to' }, kinde)).toEqual([])
  })
})

describe('checkTrackingLink', () => {
  const entry = { category: 'Written', platform: 'Dev.to', link: 'https://dev.to/x/my-post-ab12' }

  it('passes a link in the agreed format', () => {
    const link = 'https://kinde.com/?utm_source=devto&utm_medium=content&utm_campaign=shola&utm_content=my-post'
    expect(checkTrackingLink({ ...entry, trackingLink: link }, kinde).status).toBe('correct')
  })

  it('accepts a different slug, so a renamed piece keeps its live link', () => {
    const link = 'https://kinde.com/?utm_source=devto&utm_medium=content&utm_campaign=shola&utm_content=old-title'
    expect(checkTrackingLink({ ...entry, trackingLink: link }, kinde).status).toBe('correct')
  })

  it('flags campaignid and creative as the old format', () => {
    const link =
      'https://kinde.com?utm_source=devto&utm_medium=content&utm_campaign=shola&campaignid=chatgptapp&creative=feb1'
    const result = checkTrackingLink({ ...entry, trackingLink: link }, kinde)
    expect(result.status).toBe('old_format')
    expect(result.reason).toContain('campaignid')
  })

  it('flags a link without utm_content as the old format', () => {
    const link = 'https://kinde.com?utm_source=devto&utm_medium=content&utm_campaign=shola'
    expect(checkTrackingLink({ ...entry, trackingLink: link }, kinde).status).toBe('old_format')
  })

  it('flags an fcc source on a Dev.to entry as the wrong source', () => {
    const link = 'https://kinde.com/?utm_source=fcc&utm_medium=content&utm_campaign=shola&utm_content=my-post'
    expect(checkTrackingLink({ ...entry, trackingLink: link }, kinde).status).toBe('wrong_source')
  })

  it('flags a link that points somewhere else', () => {
    const link = 'https://dev.to/x/my-post?utm_source=devto&utm_medium=content&utm_campaign=shola&utm_content=my-post'
    expect(checkTrackingLink({ ...entry, trackingLink: link }, kinde).status).toBe('old_format')
  })

  it('flags an empty link as missing', () => {
    expect(checkTrackingLink({ ...entry, trackingLink: '' }, kinde).status).toBe('missing')
  })

  it('never asks for a link on freeCodeCamp', () => {
    const result = checkTrackingLink({ category: 'Written', platform: 'freeCodeCamp', trackingLink: '' }, kinde)
    expect(result.status).toBe('not_applicable')
    expect(needsFix(result.status)).toBe(false)
  })

  it('does not check packages and demos, whose links live elsewhere', () => {
    expect(checkTrackingLink({ category: 'Package', packageName: 'x' }, kinde).status).toBe('not_applicable')
  })

  it('reports unconfigured when the client has no settings', () => {
    expect(checkTrackingLink(entry, {}).status).toBe('unconfigured')
  })
})
