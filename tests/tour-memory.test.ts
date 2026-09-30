import { describe, expect, it } from 'vitest'
import { MAX_AUTO_RUNS, mergeMemory, shouldAutoStart, isTourId } from '@/lib/tour-memory'

describe('tour memory', () => {
  it('starts for a new visitor', () => {
    expect(shouldAutoStart({ runs: 0, done: false }, null, undefined)).toBe(true)
  })
  it('stays quiet once any place has seen it through', () => {
    expect(shouldAutoStart({ runs: 0, done: false }, { runs: 1, done: true })).toBe(false)
  })
  it('stops after three automatic runs even if never finished', () => {
    expect(shouldAutoStart({ runs: MAX_AUTO_RUNS - 1, done: false })).toBe(true)
    expect(shouldAutoStart({ runs: MAX_AUTO_RUNS, done: false })).toBe(false)
    expect(shouldAutoStart({ runs: 0, done: false }, { runs: 3, done: false })).toBe(false)
  })
  it('merges by the highest count and any done', () => {
    expect(mergeMemory({ runs: 1, done: false }, { runs: 2, done: true })).toEqual({ runs: 2, done: true })
  })
  it('only accepts known tour ids', () => {
    expect(isTourId('jobs-public')).toBe(true)
    expect(isTourId('nope')).toBe(false)
  })
})
