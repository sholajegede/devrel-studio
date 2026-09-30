import { describe, expect, it } from 'vitest'
import { normaliseRoute } from '@/lib/view-tracking'

describe('normaliseRoute for the jobs board', () => {
  it('groups job pages under one route', () => {
    expect(normaliseRoute('/jobs/anthropic-developer-relations-a1b2c3')).toBe('/jobs/:job')
  })

  it('keeps the hub pages distinct', () => {
    expect(normaliseRoute('/jobs')).toBe('/jobs')
    expect(normaliseRoute('/jobs/salaries')).toBe('/jobs/salaries')
    expect(normaliseRoute('/jobs/remote')).toBe('/jobs/remote')
    expect(normaliseRoute('/jobs/roles/advocacy')).toBe('/jobs/roles/advocacy')
    expect(normaliseRoute('/jobs/companies')).toBe('/jobs/companies')
  })

  it('groups company pages', () => {
    expect(normaliseRoute('/jobs/companies/datadog')).toBe('/jobs/companies/:company')
  })
})
