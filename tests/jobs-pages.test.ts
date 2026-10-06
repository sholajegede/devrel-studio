import { describe, expect, it } from 'vitest'
import { CAREERS_PAGES, parsePageIndex, parsePageJob } from '@/lib/jobs/pages'
import { normalizeJob } from '@/lib/jobs/normalize'

const page = CAREERS_PAGES[0]
const NOW = Date.parse('2026-10-06T00:00:00Z')

const index = `<main>
  <a href="/jobs/faq">hiring FAQ</a>
  <a href="/jobs/developer-relations-product-marketing-manager"><h3>Developer Relations &amp; Product Marketing Manager</h3></a>
  <a href="/jobs/lead-site-reliability-engineer?ref=x#top">Lead SRE</a>
  <a href="/jobs/developer-relations-product-marketing-manager">again</a>
  <a href="/jobs">all jobs</a><a href="https://other.com/jobs/x">other</a>
</main>`

const detail = `<html><body><main><p>Open position</p>
<h1>Developer Relations &amp; Product Marketing Manager</h1>
<p>Full-time / CET timezone / (Remote (within 2 hours of CET))</p>
<p>${'AppSignal is a developer-focused platform. You will prototype ideas, create technical content and engage with the community. '.repeat(4)}</p>
<h2>What You’ll Do</h2><ul><li>Build demos</li><li>Write tutorials</li></ul>
<a href="https://appsignal.homerun.co/developer-relations-product-marketing-manager/en">Apply for this job</a>
</main></body></html>`

describe('careers page source', () => {
  it('lists postings once and skips the FAQ and other hosts', () => {
    expect(parsePageIndex(index, page)).toEqual([
      'https://www.appsignal.com/jobs/developer-relations-product-marketing-manager',
      'https://www.appsignal.com/jobs/lead-site-reliability-engineer',
    ])
  })

  it('reads a posting and finds the apply link', () => {
    const job = parsePageJob(detail, 'https://www.appsignal.com/jobs/developer-relations-product-marketing-manager', page)
    expect(job?.title).toBe('Developer Relations & Product Marketing Manager')
    expect(job?.company).toBe('AppSignal')
    expect(job?.employment).toBe('Full-time')
    expect(job?.isRemote).toBe(true)
    expect(job?.locations).toEqual(['Remote (within 2 hours of CET)'])
    expect(job?.applyUrl).toBe('https://appsignal.homerun.co/developer-relations-product-marketing-manager/en')
    expect(job?.externalId).toBe('developer-relations-product-marketing-manager')
  })

  it('classifies the posting as DevRel', () => {
    const job = parsePageJob(detail, 'https://www.appsignal.com/jobs/developer-relations-product-marketing-manager', page)!
    const normalized = normalizeJob(job, { name: 'AppSignal', slug: 'appsignal' }, NOW)
    expect(normalized).not.toBeNull()
    expect(normalized?.workplace).toBe('remote')
  })

  it('prefers JobPosting data and ignores pages with no usable text', () => {
    const ld = `<script type="application/ld+json">{"@type":"JobPosting","title":"Developer Advocate","datePosted":"2026-10-01","employmentType":"CONTRACTOR","description":"${'<p>Teach developers.</p>'.repeat(20)}"}</script><h1>x</h1>`
    const job = parsePageJob(ld, 'https://www.appsignal.com/jobs/a', page)
    expect(job?.title).toBe('Developer Advocate')
    expect(job?.postedAt).toBe(Date.parse('2026-10-01'))
    expect(parsePageJob('<h1>Short</h1><p>tiny</p>', 'https://www.appsignal.com/jobs/b', page)).toBeNull()
  })
})
