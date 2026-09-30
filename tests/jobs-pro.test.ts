import { describe, expect, it } from 'vitest'
import { proActive, tailorGate, alertLimit, canUseFrequency } from '@/lib/jobs/pro'
import { findSlop, ungroundedNumbers } from '@/lib/jobs/slop'
import { buildPrompt, parseKit } from '@/lib/jobs/kit'

describe('jobs pro gate', () => {
  it('gives three free tailorings then stops', () => {
    expect(tailorGate({ pro: false, used: 0, usedThisMonth: 0 })).toMatchObject({ allowed: true, freeLeft: 3 })
    expect(tailorGate({ pro: false, used: 2, usedThisMonth: 2 }).freeLeft).toBe(1)
    expect(tailorGate({ pro: false, used: 3, usedThisMonth: 3 })).toMatchObject({ allowed: false, reason: 'free-used-up' })
  })
  it('applies fair use to paid accounts', () => {
    expect(tailorGate({ pro: true, used: 500, usedThisMonth: 10 }).allowed).toBe(true)
    expect(tailorGate({ pro: true, used: 500, usedThisMonth: 60 })).toMatchObject({ allowed: false, reason: 'fair-use' })
  })
  it('reads the access window', () => {
    const now = 1_000
    expect(proActive({ jobsProUntil: 2_000 }, now)).toBe(true)
    expect(proActive({ jobsProUntil: 500 }, now)).toBe(false)
    expect(proActive({ comped: true }, now)).toBe(true)
    expect(proActive(null, now)).toBe(false)
  })
  it('limits alerts and instant frequency', () => {
    expect(alertLimit(false)).toBe(2)
    expect(alertLimit(true)).toBe(50)
    expect(canUseFrequency(false, 'instant')).toBe(false)
    expect(canUseFrequency(true, 'instant')).toBe(true)
    expect(canUseFrequency(false, 'daily')).toBe(true)
  })
})

describe('slop check', () => {
  it('flags word list, openers and em dashes', () => {
    const hits = findSlop('I am excited to apply. I leveraged a robust pipeline — a game-changer.')
    const rules = hits.map((hit) => hit.match.toLowerCase())
    expect(rules.some((match) => match.includes('excited'))).toBe(true)
    expect(hits.some((hit) => hit.rule === 'em dash')).toBe(true)
    expect(hits.some((hit) => hit.match === 'robust')).toBe(true)
  })
  it('passes plain text', () => {
    expect(findSlop('Wrote 12 tutorials on Convex. Ran a weekly office hour for 40 developers.')).toEqual([])
  })
  it('catches numbers the source never gave', () => {
    const missing = ungroundedNumbers('Grew signups 340% and wrote 12 tutorials', ['Wrote 12 tutorials on Convex'])
    expect(missing).toEqual(['340%'])
  })
})

describe('kit parsing', () => {
  it('parses fenced JSON and rejects junk', () => {
    const ok = parseKit('```json\n{"summary":"s","bullets":["Wrote docs"],"coverNote":"Hi","gaps":[]}\n```')
    expect(ok?.bullets).toEqual(['Wrote docs'])
    expect(parseKit('nope')).toBeNull()
    expect(parseKit('{"summary":"s","bullets":[],"coverNote":""}')).toBeNull()
  })
  it('puts only supplied facts in the prompt', () => {
    const { user } = buildPrompt(
      { title: 'Developer Advocate', company: 'Acme', seniority: 'senior', skills: ['Go'], description: 'Teach devs.' },
      { skills: ['Convex'], cvText: 'Built things.' },
      [{ title: 'Auth guide', platform: 'freeCodeCamp', date: '2026-01-02', link: 'https://x.test' }],
    )
    expect(user).toContain('Auth guide')
    expect(user).toContain('Acme')
  })
})

import { benchmarkFor, hiringSignals, type InsightJob } from '@/lib/jobs/insights'

function job(partial: Partial<InsightJob>): InsightJob {
  return {
    title: 'Developer Advocate', family: 'advocacy', seniority: 'senior', regions: ['europe'], workplace: 'remote',
    companySlug: 'acme', companyName: 'Acme', slug: 'acme-1', postedAt: 0, ...partial,
  }
}

describe('pro insights', () => {
  it('benchmarks the exact slice and widens when it is thin', () => {
    const rows = [100, 120, 140, 160].map((mid, index) =>
      job({ slug: `a-${index}`, salaryMinUsd: mid * 1000 - 10_000, salaryMaxUsd: mid * 1000 + 10_000 }),
    )
    const exact = benchmarkFor(rows, { family: 'advocacy', seniority: 'senior', region: 'europe' })
    expect(exact?.scope).toBe('exact')
    expect(exact?.n).toBe(4)
    expect(exact?.median).toBe(130_000)
    const widened = benchmarkFor(rows, { family: 'advocacy', seniority: 'staff' })
    expect(widened?.scope).toBe('family')
    expect(benchmarkFor(rows.slice(0, 2), { family: 'advocacy' })).toBeNull()
  })

  it('finds repeat hirers and the longest open roles', () => {
    const now = 100 * 86_400_000
    const active = [
      job({ slug: 'a', postedAt: 10 * 86_400_000 }),
      job({ slug: 'b', postedAt: 99 * 86_400_000 }),
      job({ slug: 'd', postedAt: 97 * 86_400_000 }),
      job({ slug: 'c', companySlug: 'zed', companyName: 'Zed', title: 'DevRel Lead', postedAt: 98 * 86_400_000 }),
    ]
    const signals = hiringSignals(active, [{ companySlug: 'acme', companyName: 'Acme' }, { companySlug: 'acme', companyName: 'Acme' }], now)
    expect(signals.repeat[0].company).toBe('Acme')
    expect(signals.longestOpen[0].days).toBe(90)
    expect(signals.surging[0].company).toBe('Acme')
    expect(signals.churn[0].closedLast30).toBe(2)
  })
})
