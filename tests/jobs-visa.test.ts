import { describe, expect, it } from 'vitest'
import { detectVisa } from '@/lib/jobs/visa'

describe('visa sponsorship detection', () => {
  it.each([
    'We offer visa sponsorship for the right candidate.',
    'Visa sponsorship is available.',
    'We can sponsor your work visa and help you relocate.',
    'Relocation and visa support included.',
    'We will sponsor a Skilled Worker visa.',
    'Immigration assistance for you and your family.',
    'Sponsorship may be available for exceptional candidates.',
    'We are a licensed sponsor under the UK points-based system.',
    'We handle your visa and relocation.',
    'H-1B transfer supported.',
  ])('reads an offer: %s', (text) => expect(detectVisa(text)).toBe('yes'))

  it.each([
    'We are unable to sponsor visas for this role.',
    'Unfortunately we cannot offer visa sponsorship.',
    'No visa sponsorship is available.',
    'Candidates must be authorized to work in the US without sponsorship.',
    'We do not sponsor work visas.',
    'Sponsorship is not available for this position.',
    'We are not able to provide visa sponsorship at this time.',
    'Candidates who do not require sponsorship only.',
  ])('reads a refusal: %s', (text) => expect(detectVisa(text)).toBe('no'))

  it('lets a refusal beat an offer in the same text', () => {
    expect(detectVisa('We sponsor visas for some roles, but we cannot sponsor for this one.')).toBe('no')
  })

  it('lets an offer beat a plain right-to-work line', () => {
    expect(detectVisa('You must have the right to work in the UK, or we can sponsor a Skilled Worker visa.')).toBe('yes')
    expect(detectVisa('You must be authorized to work in the United States.')).toBe('no')
  })

  it('stays quiet when the text does not say', () => {
    expect(detectVisa('Fully remote. Build demos, write docs and speak at events.')).toBeUndefined()
    expect(detectVisa('')).toBeUndefined()
    expect(detectVisa('Will you now or in the future require sponsorship?')).toBeUndefined()
  })
})

import { scoreJob } from '../lib/jobs/match'

describe('visa in match scoring', () => {
  const profile = { skills: [], families: [], workplaces: [], needsVisa: true }
  const job = { family: 'advocacy', seniority: 'mid', workplace: 'remote', countries: [], regions: [], skills: [] }

  it('rewards sponsoring roles and marks refusals', () => {
    const yes = scoreJob(profile, { ...job, visa: 'yes' })
    const no = scoreJob(profile, { ...job, visa: 'no' })
    const unknown = scoreJob(profile, { ...job })
    expect(yes.score).toBeGreaterThan(unknown.score)
    expect(no.score).toBeLessThan(unknown.score)
    expect(no.gaps).toContain('Does not sponsor visas')
  })

  it('ignores visa when the profile does not need one', () => {
    const plain = { ...profile, needsVisa: false }
    expect(scoreJob(plain, { ...job, visa: 'no' }).score).toBe(scoreJob(plain, job).score)
  })
})
