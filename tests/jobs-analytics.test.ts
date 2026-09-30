import { describe, expect, it } from 'vitest'
import { cleanEvent, countersFor, dayKey, jobSlugFromPath, normaliseTerm, pathGroup, refHost, weekKey, windowStart } from '@/lib/jobs/analytics'

describe('cleanEvent', () => {
  it('rejects unknown events and junk', () => {
    expect(cleanEvent({ event: 'drop_table' })).toBeNull()
    expect(cleanEvent(null)).toBeNull()
    expect(cleanEvent('x')).toBeNull()
  })
  it('clips, lower-cases labels and bounds the number', () => {
    const event = cleanEvent({ event: 'search', path: '/jobs', label: '  Python   Dev  ', n: 99999999999 })
    expect(event).toEqual({ event: 'search', path: '/jobs', slug: undefined, company: undefined, label: 'python dev', n: 1_000_000 })
  })
  it('defaults the path', () => {
    expect(cleanEvent({ event: 'page_view' })?.path).toBe('/')
  })
})

describe('time buckets', () => {
  it('finds the Monday of a week', () => {
    expect(weekKey(Date.UTC(2026, 8, 30))).toBe('2026-09-28')
    expect(weekKey(Date.UTC(2026, 8, 28))).toBe('2026-09-28')
    expect(weekKey(Date.UTC(2026, 9, 4))).toBe('2026-09-28')
    expect(dayKey(Date.UTC(2026, 8, 30, 23, 59))).toBe('2026-09-30')
  })
  it('counts whole weeks back from the current one', () => {
    expect(windowStart(Date.UTC(2026, 8, 30), 1)).toBe('2026-09-28')
    expect(windowStart(Date.UTC(2026, 8, 30), 4)).toBe('2026-09-07')
  })
})

describe('paths', () => {
  it('groups role pages and leaves hubs alone', () => {
    expect(pathGroup('/jobs/senior-devrel-acme-123')).toBe('/jobs/[role]')
    expect(pathGroup('/jobs/salaries')).toBe('/jobs/salaries')
    expect(pathGroup('/jobs/companies/livekit')).toBe('/jobs/companies/[company]')
    expect(pathGroup('/dashboard/jobs/kit/abc')).toBe('/dashboard/jobs/kit/[role]')
    expect(jobSlugFromPath('/jobs/abc')).toBe('abc')
    expect(jobSlugFromPath('/jobs/remote')).toBeNull()
  })
})

describe('counters', () => {
  it('feeds job, company and label counters', () => {
    const kinds = countersFor({ event: 'apply_click', path: '/jobs/x', slug: 'x', company: 'acme' }).map((c) => c.kind)
    expect(kinds).toEqual(['all', 'job', 'company'])
  })
  it('adds audience counters to page views only', () => {
    const view = countersFor({ event: 'page_view', path: '/jobs' }, { device: 'mobile', country: 'NG', signedIn: false })
    expect(view.map((c) => c.kind)).toEqual(['all', 'path', 'ref', 'device', 'country', 'auth'])
    expect(view.find((c) => c.kind === 'ref')?.dim).toBe('direct')
  })
})

describe('helpers', () => {
  it('ignores the own host as a referrer', () => {
    expect(refHost('https://www.google.com/search', 'devrel.studio')).toBe('google.com')
    expect(refHost('https://devrel.studio/jobs', 'devrel.studio')).toBeUndefined()
    expect(refHost('', 'devrel.studio')).toBeUndefined()
  })
  it('normalises search terms', () => {
    expect(normaliseTerm('  Python   SDK ')).toBe('python sdk')
  })
})
