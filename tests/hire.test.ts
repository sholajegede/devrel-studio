import { describe, expect, it } from 'vitest'
import {
  Listed, TalentInput, cleanTalent, completeness, contactProblems, listingBlockers, matchesFilter,
  rankTalent, safeUrl, scoreTalent, skillFacets, summariseProof,
} from '../lib/hire/talent'

const blank: TalentInput = { workModes: [], engagements: [], families: [], skills: [], languages: [], experience: [], education: [], projects: [], communities: [] }

const person = (over: Partial<Listed> = {}): Listed => ({
  openToWork: true, availability: 'now', skills: ['TypeScript', 'Convex', 'Technical writing'], families: ['advocacy'], seniority: 'senior',
  country: 'NG', workModes: ['remote'], engagements: ['full-time'], headline: 'Developer advocate', summary: 'I write and build demos.',
  experience: [], projects: [], communities: [], education: [], proof: { published: 0, byCategory: {}, highlights: [] }, updatedAt: Date.now(), ...over,
})

describe('cleaning', () => {
  it('keeps only http links and prefixes bare domains', () => {
    expect(safeUrl('javascript:alert(1)')).toBeUndefined()
    expect(safeUrl('example.com/a')).toBe('https://example.com/a')
    expect(safeUrl('nonsense')).toBeUndefined()
  })
  it('drops empty rows, caps lists and removes duplicates', () => {
    const out = cleanTalent({
      ...blank,
      skills: ['React', 'react ', 'React', ''],
      experience: [{ company: '', title: 'x' }, { company: 'Kinde', title: 'Developer Advocate' }],
      projects: [{ name: 'Demo', url: 'ftp://x.y' }],
      country: 'ng',
      yearsExperience: 99,
    })
    expect(out.skills).toEqual(['React', 'react'])
    expect(out.experience).toHaveLength(1)
    expect(out.projects[0].url).toBeUndefined()
    expect(out.country).toBeUndefined()
    expect(out.yearsExperience).toBeUndefined()
  })
})

describe('listing', () => {
  it('blocks a thin profile and passes a full one', () => {
    expect(listingBlockers(blank).length).toBeGreaterThanOrEqual(4)
    const full = { ...blank, headline: 'h', summary: 'x'.repeat(50), skills: ['a', 'b', 'c'], country: 'NG', availability: 'now' }
    expect(listingBlockers(full)).toEqual([])
  })
  it('scores completeness and names the next step', () => {
    expect(completeness(blank, false).score).toBe(0)
    const result = completeness({ ...blank, headline: 'h' }, false)
    expect(result.score).toBe(10)
    expect(result.next).toBe('Write a summary')
  })
})

describe('proof', () => {
  it('leaves small view counts out of the highlights', () => {
    const proof = summariseProof([{ category: 'Written', platform: 'dev.to', publicationDate: '2026-01-01', views: 4000 }])
    expect(proof.highlights).toEqual(['1 published piece'])
  })
  it('shows strong outcomes', () => {
    const proof = summariseProof([
      { category: 'Package', platform: 'npm', publicationDate: '2026-02-01', downloads: 12000 },
      { category: 'Event', platform: 'x', publicationDate: '2026-03-01', attendees: 300 },
    ])
    expect(proof.highlights).toContain('12k package downloads')
    expect(proof.highlights).toContain('1 talk')
    expect(proof.latest).toBe('2026-03-01')
  })
})

describe('filter and rank', () => {
  it('requires every chosen skill', () => {
    expect(matchesFilter(person(), { skills: ['TypeScript', 'convex'] })).toBe(true)
    expect(matchesFilter(person(), { skills: ['TypeScript', 'Rust'] })).toBe(false)
  })
  it('filters by open status, country and work mode', () => {
    expect(matchesFilter(person({ openToWork: false }), { openOnly: true })).toBe(false)
    expect(matchesFilter(person(), { country: 'US' })).toBe(false)
    expect(matchesFilter(person(), { workMode: 'hybrid' })).toBe(false)
  })
  it('ranks skill matches, open status and evidence higher', () => {
    const now = Date.now()
    const strong = person({ proof: { published: 10, byCategory: {}, highlights: [] }, projects: [{ name: 'a' }], experience: [{ company: 'x', title: 'y' }] })
    const weak = person({ openToWork: false, skills: ['Go'], availability: undefined })
    const ranked = rankTalent([weak, strong], { q: 'typescript convex' }, now)
    expect(ranked[0].skills).toContain('TypeScript')
    expect(scoreTalent(strong, {}, now)).toBeGreaterThan(scoreTalent(weak, {}, now))
  })
  it('builds skill facets by count', () => {
    const facets = skillFacets([person(), person({ skills: ['TypeScript', 'Go'] })])
    expect(facets[0]).toEqual({ skill: 'TypeScript', count: 2 })
  })
})

describe('contact checks', () => {
  const ok = { name: 'Ada', email: 'ada@acme.com', company: 'Acme', message: 'We are hiring a developer advocate and would like to talk about the role.' }
  it('accepts a normal message', () => expect(contactProblems(ok)).toEqual([]))
  it('rejects bad email, short message, honeypot and link spam', () => {
    expect(contactProblems({ ...ok, email: 'nope' })).toContain('Enter a valid work email.')
    expect(contactProblems({ ...ok, message: 'hi' })).toContain('Write at least 40 characters about the role.')
    expect(contactProblems({ ...ok, website: 'x' })).toContain('Spam check failed.')
    expect(contactProblems({ ...ok, message: ok.message + ' http://a.com http://b.com http://c.com http://d.com' })).toContain('Use at most three links.')
  })
})
