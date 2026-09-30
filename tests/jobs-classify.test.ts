import { describe, expect, it } from 'vitest'
import {
  classifyTitle,
  confirmWithDescription,
  detectSeniority,
} from '@/lib/jobs/taxonomy'
import { eligibility, parseLocations } from '@/lib/jobs/locations'
import { parseSalaryText, parseStructuredSalary } from '@/lib/jobs/salary'
import { extractSkills } from '@/lib/jobs/skills'
import { htmlToText, summarise, textToBlocks } from '@/lib/jobs/html'
import { analyseCv } from '@/lib/jobs/cv'
import { scoreJob } from '@/lib/jobs/match'
import { columnOf, isStageId } from '@/lib/jobs/stages'
import { jobPostingLd, descriptionHtml } from '@/lib/jobs/seo'

const family = (title: string) => classifyTitle(title)?.family ?? null

describe('classifyTitle', () => {
  it.each([
    ['Senior Developer Advocate', 'advocacy'],
    ['Sr. Developer Advocate, Open Source — Omnigent', 'advocacy'],
    ['Developer Relations', 'advocacy'],
    ['Head of Developer Relations', 'advocacy'],
    ['Technical Evangelist', 'advocacy'],
    ['Developer Relations Manager – Data Processing and Databases', 'advocacy'],
    ['Developer Relations Engineer (London, UK)', 'devrel-engineering'],
    ['VoidZero Developer Relations Engineer', 'devrel-engineering'],
    ['Developer Experience Engineer, Cyber', 'devrel-engineering'],
    ['Developer Success Engineer', 'developer-success'],
    ['Developer Support Engineer', 'developer-success'],
    ['Open Source Program Manager', 'community'],
    ['Developer Community Manager', 'community'],
    ['Technical Writer, API Docs', 'content'],
    ['Content Engineer', 'content'],
    ['Developer Education Lead, Claude Platform', 'education'],
    ['Developer Programs Manager', 'programs'],
    ['Developer Marketing Manager', 'marketing'],
    ['Senior Software Engineer – Developer Experience', 'dx'],
  ])('%s is %s', (title, expected) => {
    expect(family(title)).toBe(expected)
  })

  it.each([
    'Product Marketing Manager',
    'Senior Software Engineer, Backend',
    'Account Executive',
    'Solutions Architect',
    'Customer Success Manager',
    'Staff Software Engineer, Infrastructure',
  ])('ignores %s', (title) => {
    expect(classifyTitle(title)).toBeNull()
  })

  it('needs a developer cue for ambiguous community roles', () => {
    const community = classifyTitle('Community Manager, Digital')!
    expect(community.needsDevCue).toBe(true)
    expect(confirmWithDescription(community, 'Run social channels for our retail brand')).toBe(false)
    expect(confirmWithDescription(community, 'Grow our developer community and open source')).toBe(true)
  })
})

describe('detectSeniority', () => {
  it.each([
    ['Senior Developer Advocate', 'senior'],
    ['Sr. Developer Advocate', 'senior'],
    ['Staff Developer Advocate', 'staff'],
    ['Principal Developer Advocate, AI', 'principal'],
    ['Developer Relations Lead', 'manager'],
    ['Senior Manager, Developer Relations', 'manager'],
    ['Manager, Developer Relations - Open Source', 'manager'],
    ['Community Manager', 'mid'],
    ['Director of Developer Relations', 'director'],
    ['Head of Developer Relations', 'head'],
    ['Junior Developer Relations Engineer', 'junior'],
    ['Developer Relations Intern', 'intern'],
    ['Developer Advocate', 'mid'],
  ])('%s is %s', (title, expected) => {
    expect(detectSeniority(title)).toBe(expected)
  })
})

describe('parseLocations', () => {
  it('reads worldwide remote', () => {
    const place = parseLocations(['Remote, Anywhere'])
    expect(place.workplace).toBe('remote')
    expect(place.remoteScope).toBe('worldwide')
  })

  it('reads country-limited remote', () => {
    const place = parseLocations(['Remote - US'])
    expect(place.remoteScope).toBe('country')
    expect(place.countries).toEqual(['US'])
  })

  it('reads EMEA as regional', () => {
    const place = parseLocations(['Remote, EMEA'])
    expect(place.remoteScope).toBe('regional')
    expect(place.regions).toEqual(expect.arrayContaining(['europe', 'africa']))
  })

  it('maps city and state to country', () => {
    expect(parseLocations(['San Francisco, CA']).countries).toEqual(['US'])
    expect(parseLocations(['London, UK']).countries).toEqual(['GB'])
    expect(parseLocations(['Bengaluru']).countries).toEqual(['IN'])
  })

  it('does not read North America as the United States', () => {
    expect(parseLocations(['Remote, North America']).countries).toEqual([])
  })

  it('splits multiple locations', () => {
    const place = parseLocations(['Remote, Canada; Remote, United States'])
    expect(place.countries.sort()).toEqual(['CA', 'US'])
    expect(place.locations).toHaveLength(2)
  })

  it('flags hybrid and on-site', () => {
    expect(parseLocations(['Hybrid']).workplace).toBe('hybrid')
    expect(parseLocations(['New York City, NY']).workplace).toBe('onsite')
  })

  it('answers whether a Nigerian can apply', () => {
    const worldwide = parseLocations(['Remote, Anywhere'])
    const usOnly = parseLocations(['Remote - US'])
    const emea = parseLocations(['Remote, EMEA'])
    expect(eligibility(worldwide, 'NG')).toBe('yes')
    expect(eligibility(usOnly, 'NG')).toBe('no')
    expect(eligibility(emea, 'NG')).toBe('yes')
    expect(eligibility(parseLocations(['Lagos, Nigeria']), 'NG')).toBe('local')
    expect(eligibility(parseLocations(['Remote']), 'NG')).toBe('unknown')
  })
})

describe('salary', () => {
  it('parses ranges in text', () => {
    expect(parseSalaryText('The range is $190,000 - $260,000 USD per year')).toEqual({
      min: 190000,
      max: 260000,
      currency: 'USD',
    })
    expect(parseSalaryText('Pay: $150k – $200k')).toEqual({ min: 150000, max: 200000, currency: 'USD' })
    expect(parseSalaryText('£70,000 to £90,000')).toEqual({ min: 70000, max: 90000, currency: 'GBP' })
  })

  it('reads hourly rates as annual', () => {
    const range = parseSalaryText('$60 - $80 per hour')
    expect(range?.min).toBe(124800)
  })

  it('rejects numbers that are not pay', () => {
    expect(parseSalaryText('We have 10 - 20 people')).toBeNull()
    expect(parseSalaryText('Founded in 2015 - 2020')).toBeNull()
  })

  it('normalises structured pay', () => {
    expect(parseStructuredSalary({ min: 10000, max: 12000, currency: 'USD', interval: 'month' })).toEqual({
      min: 120000,
      max: 144000,
      currency: 'USD',
    })
    expect(parseStructuredSalary({ min: 0, max: 0 })).toBeNull()
  })
})

describe('text helpers', () => {
  it('turns Greenhouse escaped html into blocks', () => {
    const escaped = '&lt;h3&gt;About&lt;/h3&gt;&lt;p&gt;Hello &amp;amp; welcome&lt;/p&gt;&lt;ul&gt;&lt;li&gt;One&lt;/li&gt;&lt;li&gt;Two&lt;/li&gt;&lt;/ul&gt;'
    const text = htmlToText(escaped)
    expect(text).toContain('## About')
    expect(textToBlocks(text)).toEqual([
      { kind: 'heading', text: 'About' },
      { kind: 'paragraph', text: 'Hello & welcome' },
      { kind: 'list', items: ['One', 'Two'] },
    ])
  })

  it('strips scripts', () => {
    expect(htmlToText('<p>Hi</p><script>alert(1)</script>')).toBe('Hi')
  })

  it('summarises at a word boundary', () => {
    const out = summarise('word '.repeat(200), 50)
    expect(out.length).toBeLessThanOrEqual(51)
    expect(out.endsWith('…')).toBe(true)
  })

  it('extracts skills and topics', () => {
    const { skills, topics } = extractSkills('Build demos in TypeScript and Python with LLMs, MCP and Kubernetes. Give conference talks.')
    expect(skills).toEqual(expect.arrayContaining(['TypeScript', 'Python', 'LLMs', 'MCP', 'Kubernetes', 'Public speaking']))
    expect(topics).toEqual(expect.arrayContaining(['AI', 'Cloud & Infra']))
  })
})


describe('analyseCv', () => {
  const cv = `Wanishola Jegede
Senior Developer Advocate
Kinde · 2023 - Present
Wrote guides on authentication and OAuth in TypeScript and Python. Gave conference talks on AI agents and MCP.
Developer Relations Engineer
Acme · 2020 - 2023
8+ years of professional experience building open source tools.`

  it('reads skills, focus, seniority and years', () => {
    const result = analyseCv(cv, new Date('2026-09-30'))
    expect(result.skills).toEqual(expect.arrayContaining(['TypeScript', 'Python', 'Authentication', 'MCP', 'Public speaking']))
    expect(result.families).toEqual(expect.arrayContaining(['advocacy', 'devrel-engineering']))
    expect(result.seniority).toBe('senior')
    expect(result.yearsExperience).toBe(8)
    expect(result.headline).toBe('Senior Developer Advocate')
  })

  it('falls back to date ranges for experience', () => {
    const result = analyseCv('Developer Advocate\nAcme 2019 - Present', new Date('2026-09-30'))
    expect(result.yearsExperience).toBe(7)
  })
})

describe('scoreJob', () => {
  const profile = {
    skills: ['TypeScript', 'Authentication', 'MCP'],
    families: ['advocacy'],
    seniority: 'senior',
    workplaces: ['remote'],
    country: 'NG',
    minSalaryUsd: 100000,
  }
  const base = {
    family: 'advocacy',
    seniority: 'senior',
    workplace: 'remote',
    remoteScope: 'worldwide',
    countries: [],
    regions: [],
    skills: ['TypeScript', 'Authentication', 'MCP', 'Kubernetes'],
    salaryMaxUsd: 160000,
  }

  it('rewards an open, matching role', () => {
    const result = scoreJob(profile, base)
    expect(result.score).toBeGreaterThanOrEqual(85)
    expect(result.eligibility).toBe('yes')
    expect(result.gaps.join(' ')).toContain('Kubernetes')
  })

  it('marks a role closed to the candidate country', () => {
    const result = scoreJob(profile, { ...base, remoteScope: 'country', countries: ['US'], regions: ['north-america'] })
    expect(result.eligibility).toBe('no')
    expect(result.gaps).toContain('Not open to your location')
    expect(result.score).toBeLessThan(scoreJob(profile, base).score)
  })
})

describe('stages', () => {
  it('groups outcomes into the closed column', () => {
    expect(columnOf('rejected')).toBe('closed')
    expect(columnOf('interview')).toBe('interview')
    expect(isStageId('ghosted')).toBe(false)
  })
})


describe('jobPostingLd', () => {
  const base = {
    slug: 'acme-developer-advocate-abc123',
    title: 'Developer Advocate',
    family: 'advocacy',
    seniority: 'mid',
    employmentType: 'full-time',
    workplace: 'remote',
    remoteScope: 'worldwide',
    locationLabel: 'Remote',
    locations: ['Remote, Anywhere'],
    countries: [],
    companyName: 'Acme',
    salaryMin: 120000,
    salaryMax: 160000,
    salaryCurrency: 'USD',
    postedAt: Date.parse('2026-09-01T00:00:00Z'),
    status: 'active',
  }

  it('describes a remote role with pay', () => {
    const ld = jobPostingLd(base, '## About\n\nBuild things & ship <fast>', 'https://devrel.studio')
    expect(ld['@type']).toBe('JobPosting')
    expect(ld.jobLocationType).toBe('TELECOMMUTE')
    expect(ld.baseSalary?.value.minValue).toBe(120000)
    expect(ld.datePosted).toBe('2026-09-01')
    expect(ld.description).toContain('&amp;')
    expect(ld.description).toContain('&lt;fast&gt;')
    expect(ld).not.toHaveProperty('validThrough')
  })

  it('adds validThrough once the role has closed', () => {
    const ld = jobPostingLd(base, 'x', 'https://devrel.studio', Date.parse('2026-09-20T00:00:00Z'))
    expect(ld.validThrough).toBe('2026-09-20T00:00:00.000Z')
  })

  it('uses a place for on-site roles', () => {
    const ld = jobPostingLd(
      { ...base, workplace: 'onsite', locations: ['London, UK'], salaryMin: null, salaryMax: null, salaryCurrency: null },
      'x',
      'https://devrel.studio',
    )
    expect(ld).toHaveProperty('jobLocation')
    expect(ld).not.toHaveProperty('baseSalary')
  })

  it('escapes html in descriptions', () => {
    expect(descriptionHtml('• <b>x</b>')).toBe('<ul><li>&lt;b&gt;x&lt;/b&gt;</li></ul>')
  })
})
