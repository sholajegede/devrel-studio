import { describe, expect, it } from 'vitest'
import { parseHnComments, parseHnThreadIds, parseReddit, parseRemoteOk, parseWwr } from '@/lib/jobs/aggregators'
import { normalizeJob } from '@/lib/jobs/normalize'

const NOW = Date.parse('2026-09-30T00:00:00Z')

describe('aggregator parsers', () => {
  it('reads RemoteOK and skips the legal notice', () => {
    const jobs = parseRemoteOk([
      { legal: 'notice' },
      { id: 1, position: 'Developer Advocate', company: 'Acme', url: 'https://remoteok.com/remote-jobs/1', epoch: 1_788_000_000, tags: ['contract'], description: '<p>Teach developers about APIs.</p>', salary_min: 90000, salary_max: 120000 },
    ])
    expect(jobs).toHaveLength(1)
    expect(jobs[0].company).toBe('Acme')
    expect(jobs[0].employment).toBe('contract')
    const normalized = normalizeJob(jobs[0], { name: jobs[0].company!, slug: 'acme' }, NOW)
    expect(normalized?.employmentType).toBe('contract')
    expect(normalized?.family).toBe('advocacy')
  })

  it('reads We Work Remotely RSS', () => {
    const xml = `<?xml version="1.0"?><rss><channel><item>
      <title><![CDATA[Globex: Senior Developer Relations Engineer]]></title>
      <region><![CDATA[Anywhere in the World]]></region><type>Contract</type>
      <description><![CDATA[<p>Build demos and docs.</p>]]></description>
      <pubDate>Tue, 29 Sep 2026 10:00:00 +0000</pubDate>
      <link>https://weworkremotely.com/remote-jobs/globex-senior-devrel</link></item></channel></rss>`
    const jobs = parseWwr(xml)
    expect(jobs[0].company).toBe('Globex')
    expect(jobs[0].title).toBe('Senior Developer Relations Engineer')
    expect(jobs[0].employment).toBe('Contract')
    expect(() => parseWwr('<html></html>')).toThrow()
  })

  it('reads Hacker News hiring comments and keeps only DevRel headers', () => {
    const json = {
      children: [
        { id: 11, created_at_i: 1_788_000_000, text: 'Initech | Developer Advocate | Remote (Europe) | Contract<p>We teach.' },
        { id: 12, created_at_i: 1_788_000_000, text: 'Hooli | Backend Engineer | SF | Onsite<p>Go.' },
        { id: 13, text: 'no header here' },
      ],
    }
    const jobs = parseHnComments(json, 'hiring')
    expect(jobs.map((job) => job.company)).toEqual(['Initech'])
    expect(jobs[0].employment).toBe('contract')
    expect(jobs[0].applyUrl).toBe('https://news.ycombinator.com/item?id=11')
  })

  it('treats the freelancer thread as contract and ignores people seeking work', () => {
    const json = {
      children: [
        { id: 21, text: 'SEEKING FREELANCER | Umbrella | Technical Writer | Remote<p>Docs.' },
        { id: 22, text: 'SEEKING WORK | Jane | Developer Advocate | Remote' },
      ],
    }
    const jobs = parseHnComments(json, 'freelancer')
    expect(jobs).toHaveLength(1)
    expect(jobs[0].company).toBe('Umbrella')
    expect(jobs[0].employment).toBe('contract')
  })

  it('picks the newest hiring thread ids', () => {
    const ids = parseHnThreadIds({ hits: [{ objectID: '5', title: 'Ask HN: Who is hiring? (September 2026)' }, { objectID: '6', title: 'Ask HN: Who wants to be hired?' }] }, /who is hiring/i)
    expect(ids).toEqual(['5'])
  })

  it('keeps r/forhire [HIRING] posts that name a DevRel role', () => {
    const json = { data: { children: [
      { data: { id: 'a', title: '[Hiring] Developer Advocate for API startup', author: 'bob', selftext: 'Remote contract.', permalink: '/r/forhire/comments/a/x/', created_utc: 1_788_000_000 } },
      { data: { id: 'b', title: '[For Hire] Developer Advocate', author: 'sam', permalink: '/r/forhire/comments/b/x/' } },
      { data: { id: 'c', title: '[Hiring] Logo designer', author: 'kim', permalink: '/r/forhire/comments/c/x/' } },
    ] } }
    const jobs = parseReddit(json, 'forhire')
    expect(jobs).toHaveLength(1)
    expect(jobs[0].employment).toBe('contract')
    expect(jobs[0].applyUrl).toContain('reddit.com/r/forhire/comments/a')
  })
})
