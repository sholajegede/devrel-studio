import { describe, expect, it } from 'vitest'
import { parseMarkdown, parseInline, plainText, safeHref, slugify, wordCount } from '@/lib/blog/markdown'
import { sanitizeSvg } from '@/lib/blog/svg'
import { findDuplicate, pickBacklog, similarity } from '@/lib/blog/topics'
import { checkDraft, draftToText, extractJson, parseClaims, parseDraft } from '@/lib/blog/draft'
import { newToken, sameHash, sha256 } from '@/lib/blog/token'

describe('markdown', () => {
  it('reads headings, lists, code and diagrams', () => {
    const blocks = parseMarkdown('**Answer.**\n\n## A heading\n\n- one\n- two\n\n```svg\n<svg viewBox="0 0 1 1"></svg>\n```\n*Figure: test*\n\n```ts\nconst a = 1\n```')
    expect(blocks.map((b) => b.t)).toEqual(['p', 'h', 'ul', 'svg', 'code'])
    const svg = blocks.find((b) => b.t === 'svg')
    expect(svg && svg.t === 'svg' && svg.caption).toBe('Figure: test')
  })
  it('never keeps an unsafe link', () => {
    expect(safeHref('javascript:alert(1)')).toBeNull()
    expect(safeHref('//evil.com')).toBeNull()
    expect(safeHref('/jobs')).toBe('/jobs')
    const nodes = parseInline('[x](javascript:alert(1))')
    expect(nodes.some((n) => n.t === 'link')).toBe(false)
  })
  it('reads inline code and bold', () => {
    expect(parseInline('a **b** `c`').map((n) => n.t)).toEqual(['text', 'strong', 'text', 'code'])
  })
  it('reads tables', () => {
    const [table] = parseMarkdown('| a | b |\n| - | - |\n| 1 | 2 |')
    expect(table.t).toBe('table')
  })
  it('slugs and counts', () => {
    expect(slugify('How to Measure DevRel?')).toBe('how-to-measure-devrel')
    expect(wordCount('one two three')).toBe(3)
    expect(plainText(parseMarkdown('## Hi there\n\nSome text.'))).toContain('Some text.')
  })
})

describe('sanitizeSvg', () => {
  const good = '<svg viewBox="0 0 10 10" role="img" aria-label="x"><rect x="1" y="1" width="5" height="5" fill="none" stroke="currentColor" /><text x="2" y="2">Hi</text></svg>'
  it('keeps a plain drawing', () => {
    const out = sanitizeSvg(good)
    expect(out).toContain('<rect')
    expect(out).toContain('Hi')
  })
  it('refuses scripts and other documents', () => {
    expect(sanitizeSvg('<svg><script>alert(1)</script></svg>')).toBeNull()
    expect(sanitizeSvg('<svg><foreignObject></foreignObject></svg>')).toBeNull()
    expect(sanitizeSvg('<svg><image href="x"/></svg>')).toBeNull()
    expect(sanitizeSvg('<div></div>')).toBeNull()
  })
  it('drops handlers, links and style', () => {
    const out = sanitizeSvg('<svg viewBox="0 0 1 1" onload="alert(1)"><rect onclick="x()" style="fill:red" href="http://x" width="1"/></svg>')
    expect(out).not.toMatch(/onload|onclick|style|href/)
  })
  it('drops external url() paint', () => {
    const out = sanitizeSvg('<svg viewBox="0 0 1 1"><rect fill="url(http://x)" stroke="url(#a)"/></svg>')
    expect(out).not.toContain('http')
  })
})

describe('topics', () => {
  it('finds overlap regardless of word order', () => {
    expect(similarity('measure developer relations impact', 'how to measure the impact of developer relations')).toBeGreaterThan(0.7)
    expect(similarity('salary levels', 'conference talks')).toBe(0)
  })
  it('finds a duplicate and skips used backlog items', () => {
    const existing = [{ title: 'How to write a CV for a developer relations role', keyword: 'devrel cv' }]
    expect(findDuplicate({ title: 'Writing a CV for DevRel roles', keyword: 'devrel cv' }, existing)).not.toBeNull()
    expect(pickBacklog(existing)).not.toBe('How to write a CV for a developer relations role')
  })
})

describe('draft', () => {
  const body = ['**Developer advocates get paid less when the role is hidden in a listing.**', '', '**Quick answer:** ' + 'Read the listing for pay, level and scope before you apply. '.repeat(5), '',
    '## What does the listing say?', '', 'A listing tells you about pay and level. ' + 'The team writes it with care so you can judge the work. '.repeat(30), '',
    '## How do you compare two roles?', '', 'Put the roles side by side. ' + 'Use the same fields for each one and compare the gaps. '.repeat(30), '',
    '## Why does level matter?', '', 'Level sets scope. ' + 'Scope sets what you own and who you report to. '.repeat(30), '',
    '## Where does DevRel Studio help?', '', 'The [DevRel Studio job board](/jobs) shows pay and level for each role. ' + 'It reads company pages three times a day. '.repeat(10), '',
    '```svg', '<svg viewBox="0 0 720 360" role="img" aria-label="d"><rect x="1" y="1" width="9" height="9" /></svg>', '```', '*Figure: boxes.*', '',
    '## Limits', '', 'Not every listing shows pay. ' + 'Some teams hire without a public listing at all. '.repeat(10)].join('\n')
  const draft = { title: 'How to read a developer advocate job listing before you apply', description: 'A short guide to the parts of a developer advocate listing that tell you about pay, level and scope, and what to check first.', keyword: 'developer advocate job listing', slug: 'how-to-read-a-developer-advocate-job-listing', body, faq: [{ q: 'a?', a: 'b' }, { q: 'c?', a: 'd' }, { q: 'e?', a: 'f' }] }
  it('round trips through the writer layout', () => {
    const parsed = parseDraft(draftToText(draft))
    expect(parsed?.title).toBe(draft.title)
    expect(parsed?.faq).toHaveLength(3)
    expect(parsed?.slug).toBe('how-to-read-a-developer-advocate-job-listing')
  })
  it('rejects output with no body', () => {
    expect(parseDraft('TITLE: x')).toBeNull()
  })
  it('passes a clean draft and flags slop', () => {
    expect(checkDraft(draft, ['']).filter((p) => !/words|sentences/.test(p))).toEqual([])
    const bad = { ...draft, body: draft.body.replace('Level sets scope.', 'We leverage a robust, seamless process — truly.') }
    const problems = checkDraft(bad, [''])
    expect(problems.join(' ')).toMatch(/leverage/)
    expect(problems.join(' ')).toMatch(/robust/)
  })
  it('flags numbers that are not in the facts', () => {
    const problems = checkDraft({ ...draft, body: draft.body + '\n\nPay rose 37% last year.' }, ['no numbers here'])
    expect(problems.join(' ')).toMatch(/37/)
  })
  it('flags missing structure', () => {
    const problems = checkDraft({ ...draft, body: '## Only\n\nshort', faq: [] }, [''])
    expect(problems.length).toBeGreaterThan(3)
  })
})

describe('model replies', () => {
  it('finds JSON inside prose', () => {
    expect(extractJson<{ a: number }>('Here you go:\n```json\n{"a": 1}\n```')).toEqual({ a: 1 })
    expect(extractJson('nothing')).toBeNull()
  })
  it('reads claims and coerces unknown verdicts', () => {
    const claims = parseClaims('{"claims":[{"claim":"x","verdict":"maybe"},{"claim":"y","verdict":"verified","source_url":"https://a.b"}]}')
    expect(claims?.[0].verdict).toBe('unsupported')
    expect(claims?.[1].verdict).toBe('verified')
  })
})

describe('review token', () => {
  it('hashes and compares', async () => {
    const token = newToken()
    expect(token).toHaveLength(48)
    const hash = await sha256(token)
    expect(sameHash(hash, await sha256(token))).toBe(true)
    expect(sameHash(hash, await sha256(newToken()))).toBe(false)
  })
})
