import { describe, expect, it } from 'vitest'
import {
  ACTION_CLASSES,
  actionClass,
  ceilingFor,
  clampLevel,
  mayActAlone,
  needsApproval,
  PRESET_LEVELS,
  PRESETS,
  resolveLevel,
} from '@/lib/agents/autonomy'
import {
  canonicalUrl,
  canUndo,
  describeEntryProposal,
  entryDraftProblems,
  isOpen,
  proposalFingerprint,
} from '@/lib/agents/proposals'

describe('autonomy levels', () => {
  it('has a level for every class in every preset', () => {
    for (const preset of PRESETS) {
      for (const cls of ACTION_CLASSES) {
        expect(PRESET_LEVELS[preset][cls.key], `${preset} ${cls.key}`).toBeDefined()
      }
    }
  })

  it('never lets a class go above its ceiling', () => {
    for (const preset of PRESETS) {
      for (const cls of ACTION_CLASSES) {
        const level = resolveLevel(cls.key, preset, 'auto')
        expect(['ask', 'approve', 'auto']).toContain(level)
        expect(level).toBe(ceilingFor(cls))
      }
    }
  })

  it('holds Auto back for a class whose agent has not shipped', () => {
    // entry.create allows Auto in principle, but Scout is what would use it.
    expect(actionClass('entry.create')?.maxLevel).toBe('auto')
    expect(resolveLevel('entry.create', 'hands-off')).toBe('approve')
    expect(mayActAlone('entry.create', 'hands-off')).toBe(false)
    expect(needsApproval('entry.create', 'careful')).toBe(true)
  })

  it('keeps publishing and settings changes human-only whatever the preset', () => {
    for (const preset of PRESETS) {
      expect(resolveLevel('content.publish', preset, 'auto')).toBe('ask')
      expect(resolveLevel('settings.change', preset, 'auto')).toBe('ask')
    }
  })

  it('lets an override lower a level but not raise it past the ceiling', () => {
    expect(resolveLevel('entry.create', 'careful', 'ask')).toBe('ask')
    expect(clampLevel(actionClass('report.draft')!, 'auto')).toBe('approve')
  })

  it('treats an unknown class as Ask', () => {
    expect(resolveLevel('nope' as never, 'hands-off')).toBe('ask')
  })
})

describe('canonicalUrl', () => {
  it('treats the same page written two ways as one', () => {
    const a = canonicalUrl('https://www.dev.to/shola/post-1/?utm_source=x&utm_medium=y#top')
    const b = canonicalUrl('https://dev.to/shola/post-1')
    expect(a).toBe('dev.to/shola/post-1')
    expect(a).toBe(b)
  })

  it('keeps parameters that change the page, sorted', () => {
    expect(canonicalUrl('https://example.com/watch?v=abc&t=3')).toBe('example.com/watch?t=3&v=abc')
  })

  it('drops click tracking', () => {
    expect(canonicalUrl('https://example.com/a?fbclid=1&ref=twitter')).toBe('example.com/a')
  })

  it('returns an empty string for anything that is not an http link', () => {
    expect(canonicalUrl('')).toBe('')
    expect(canonicalUrl('not a url')).toBe('')
    expect(canonicalUrl('javascript:alert(1)')).toBe('')
    expect(canonicalUrl('ftp://example.com/file')).toBe('')
  })
})

describe('entryDraftProblems', () => {
  const ok = {
    client: 'kinde',
    title: 'Shipping type-safe webhooks',
    link: 'https://dev.to/shola/webhooks',
    platform: 'Dev.to',
    publicationDate: '2026-10-20',
  }

  it('accepts a complete draft', () => {
    expect(entryDraftProblems(ok)).toEqual([])
  })

  it('names every problem it finds', () => {
    const problems = entryDraftProblems({ client: '', title: ' ', link: 'dev.to/x', platform: '', publicationDate: '20/10/2026' })
    expect(problems).toHaveLength(5)
  })

  it('rejects a date that does not exist', () => {
    expect(entryDraftProblems({ ...ok, publicationDate: '2026-13-40' })).toHaveLength(1)
  })
})

describe('proposal helpers', () => {
  it('writes the claim as a question a person can answer', () => {
    expect(describeEntryProposal({ title: 'Webhooks', platform: 'Dev.to', client: 'Kinde' })).toBe(
      'Add “Webhooks” on Dev.to to Kinde?',
    )
  })

  it('shares a fingerprint between proposals about the same page', () => {
    expect(proposalFingerprint('entry.create', canonicalUrl('https://dev.to/a/?utm_source=x'))).toBe(
      proposalFingerprint('entry.create', canonicalUrl('https://www.dev.to/a')),
    )
  })

  it('only offers undo for an executed proposal', () => {
    expect(canUndo('executed')).toBe(true)
    expect(canUndo('pending')).toBe(false)
    expect(canUndo('undone')).toBe(false)
    expect(isOpen('pending')).toBe(true)
    expect(isOpen('dismissed')).toBe(false)
  })
})
