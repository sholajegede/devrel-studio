import { describe, expect, it } from 'vitest'
import {
  agentFacts,
  buildAgentPrompt,
  checkAgentDraft,
  hasPublishedWork,
  parseAgentDraft,
  type AgentInput,
} from '@/lib/report-agent'

const input: AgentInput = {
  clientName: 'Northwind',
  period: '2026-08',
  priorFeedback: [{ comment: 'More video please', rating: 4 }],
  targets: { reach: 50000, published: 4 },
  entries: [
    { title: 'Build a realtime dashboard in 20 minutes', platform: 'YouTube', category: 'Video', status: 'Published', publicationDate: '2026-08-12', views: 31200 },
    { title: 'Shipping type-safe webhooks', platform: 'Dev.to', category: 'Written', status: 'Published', publicationDate: '2026-08-04', views: 12480 },
    { title: 'Rate limiting patterns', platform: 'Dev.to', category: 'Written', status: 'In Review', publicationDate: '2026-08-20', views: 0 },
    { title: 'Earlier post', platform: 'Dev.to', category: 'Written', status: 'Published', publicationDate: '2026-07-10', views: 10000 },
  ],
}

describe('agentFacts', () => {
  const facts = agentFacts(input)

  it('states the totals and the change so the model does no arithmetic', () => {
    expect(facts).toContain('Reach in August 2026: 43,680')
    expect(facts).toContain('Reach in July 2026: 10,000')
    expect(facts).toContain('Change in reach: +33,680 (+337%)')
  })

  it('names the top piece with its metric', () => {
    expect(facts).toContain('"Build a realtime dashboard in 20 minutes" on YouTube, 31,200 views')
  })

  it('carries targets and last period feedback', () => {
    expect(facts).toContain('Reach target: 50,000. Reached 87% of it.')
    expect(facts).toContain('More video please')
  })

  it('lists work that has not shipped as coming up', () => {
    expect(facts).toContain('Coming up: "Rate limiting patterns"')
  })
})

describe('hasPublishedWork', () => {
  it('is false for a period with nothing published', () => {
    expect(hasPublishedWork({ ...input, period: '2026-03' })).toBe(false)
    expect(hasPublishedWork(input)).toBe(true)
  })
})

describe('buildAgentPrompt', () => {
  it('asks for JSON and forbids invented causes', () => {
    const { system, user } = buildAgentPrompt(input)
    expect(system).toContain('"summary"')
    expect(system).toContain('went viral')
    expect(user).toContain('Northwind')
  })
})

describe('parseAgentDraft', () => {
  it('reads a bare object', () => {
    const draft = parseAgentDraft('{"summary":"A","performanceNote":"B","responseToFeedback":"C"}')
    expect(draft).toEqual({ summary: 'A', performanceNote: 'B', responseToFeedback: 'C' })
  })

  it('reads an object wrapped in a code fence', () => {
    const draft = parseAgentDraft('```json\n{"summary":"A","performanceNote":"","responseToFeedback":""}\n```')
    expect(draft?.summary).toBe('A')
  })

  it('rejects text with no object and an object with no summary', () => {
    expect(parseAgentDraft('nothing here')).toBeNull()
    expect(parseAgentDraft('{"performanceNote":"B"}')).toBeNull()
    expect(parseAgentDraft('{broken')).toBeNull()
  })
})

describe('checkAgentDraft', () => {
  const facts = agentFacts(input)

  it('passes a draft that uses only given figures', () => {
    const draft = {
      summary: 'Reach was 43,680 in August 2026, up from 10,000 in July 2026.',
      performanceNote: 'The YouTube video carried it with 31,200 views.',
      responseToFeedback: '',
    }
    expect(checkAgentDraft(draft, facts)).toEqual([])
  })

  it('flags a number that is not in the facts', () => {
    const draft = { summary: 'Reach hit 90,000 this month.', performanceNote: '', responseToFeedback: '' }
    const problems = checkAgentDraft(draft, facts)
    expect(problems.join(' ')).toContain('90000')
  })

  it('flags stock phrases and em dashes', () => {
    const draft = { summary: 'We built a robust plan — and it worked.', performanceNote: '', responseToFeedback: '' }
    const problems = checkAgentDraft(draft, facts).join(' ')
    expect(problems).toContain('robust')
    expect(problems).toContain('em dash')
  })
})
