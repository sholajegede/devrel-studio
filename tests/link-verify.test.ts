import { describe, expect, it } from 'vitest'
import {
  findLinks,
  githubReadmeUrl,
  isFetchableUrl,
  judgeLinks,
  npmRegistryUrl,
  readableContent,
  trackingHost,
  verifyTargets,
} from '@/lib/link-verify'

const kinde = { trackingBase: 'https://kinde.com/', utmCampaign: 'shola' }
const good = 'https://kinde.com/?utm_source=devto&utm_medium=content&utm_campaign=shola&utm_content=my-post'

describe('verifyTargets', () => {
  it('checks the live article for written work', () => {
    const targets = verifyTargets({ category: 'Written', platform: 'Dev.to', link: 'https://dev.to/a/b-12ab' }, kinde)
    expect(targets).toEqual([expect.objectContaining({ place: 'article', source: 'devto', format: 'html' })])
  })

  it('skips freeCodeCamp, which allows no promotional links', () => {
    expect(verifyTargets({ category: 'Written', platform: 'freeCodeCamp', link: 'https://freecodecamp.org/x' }, kinde)).toEqual([])
  })

  it('checks a package on npm and GitHub', () => {
    const targets = verifyTargets(
      { category: 'Package', packageName: '@acme/kit', repoUrl: 'https://github.com/acme/kit' },
      kinde,
    )
    expect(targets.map((t) => t.place)).toEqual(['npm', 'github'])
    expect(targets[0].fetchUrl).toBe('https://registry.npmjs.org/@acme%2Fkit')
    expect(targets[1].fetchUrl).toBe('https://raw.githubusercontent.com/acme/kit/HEAD/README.md')
  })

  it('checks a demo on GitHub and its own site', () => {
    const targets = verifyTargets(
      { category: 'Demo', repoUrl: 'https://github.com/a/demo', link: 'https://demo.example.com' },
      kinde,
    )
    expect(targets.map((t) => t.place)).toEqual(['github', 'demo'])
  })

  it('checks nothing for a client with no link settings', () => {
    expect(verifyTargets({ category: 'Written', platform: 'Dev.to', link: 'https://dev.to/a/b' }, {})).toEqual([])
  })
})

describe('urls', () => {
  it('refuses local and IP addresses', () => {
    expect(isFetchableUrl('https://dev.to/a')).toBe(true)
    expect(isFetchableUrl('http://localhost:3000')).toBe(false)
    expect(isFetchableUrl('http://169.254.169.254/latest')).toBe(false)
    expect(isFetchableUrl('file:///etc/passwd')).toBe(false)
  })

  it('builds README and registry addresses', () => {
    expect(githubReadmeUrl('https://github.com/a/b.git')).toBe('https://raw.githubusercontent.com/a/b/HEAD/README.md')
    expect(githubReadmeUrl('https://gitlab.com/a/b')).toBeNull()
    expect(npmRegistryUrl('kinde-testkit')).toBe('https://registry.npmjs.org/kinde-testkit')
    expect(npmRegistryUrl('not a name')).toBeNull()
  })

  it('reads the host from the client settings', () => {
    expect(trackingHost({ trackingBase: 'https://www.kinde.com/' })).toBe('kinde.com')
  })
})

describe('findLinks and judgeLinks', () => {
  it('finds a link inside escaped HTML', () => {
    const html = `<a href="${good.replace(/&/g, '&amp;')}">Kinde</a>`
    expect(findLinks(html, 'kinde.com')).toEqual([good])
  })

  it('finds a link in Markdown and drops trailing punctuation', () => {
    expect(findLinks(`Try [Kinde](${good}).`, 'kinde.com')).toEqual([good])
  })

  it('judges the agreed format as found', () => {
    expect(judgeLinks([good], { source: 'devto', campaign: 'shola' })).toBe('found')
  })

  it('judges an old format as old', () => {
    const old = 'https://kinde.com?utm_source=devto&utm_medium=content&utm_campaign=shola&campaignid=chatgptapp'
    expect(judgeLinks([old], { source: 'devto', campaign: 'shola' })).toBe('old_link')
  })

  it('judges the wrong source as old', () => {
    expect(judgeLinks([good], { source: 'hashnode', campaign: 'shola' })).toBe('old_link')
  })

  it('judges no links as not found', () => {
    expect(judgeLinks([], { source: 'devto', campaign: 'shola' })).toBe('not_found')
  })

  it('reads the README out of an npm registry document', () => {
    expect(readableContent(JSON.stringify({ readme: 'hello' }), 'npm-json')).toBe('hello')
    expect(readableContent('not json', 'npm-json')).toBe('')
  })
})
