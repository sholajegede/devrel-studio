import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { functionsIn } from './support/convex-source'
import { formatNumber } from '@/components/dashboard/analytics/primitives'

// ── The range selector has to govern the whole page ───────────────────────────
//
// Reported as "the filter by days is not working at all — the numbers are the
// same". They were: the chart and the breakdowns followed the selector while
// the four headline tiles were computed from a hardcoded seven-day slice and
// labelled "· 7d". Picking 30d or 90d redrew everything below a row that never
// moved, which reads as a broken control rather than as a deliberate window.
//
// There is no Convex test harness in this repo, so this reads the source, the
// way tests/dashboard-reads.test.ts does. It catches the specific way the bug
// comes back: somebody reintroduces a fixed window next to the selected one
// because a tile "means" a week.

const overview = functionsIn('convex/analytics.ts').get('overview')
const page = readFileSync(`${process.cwd()}/app/(main)/dashboard/analytics/page.tsx`, 'utf8')

describe('overview', () => {
  it('exists and takes the range as an argument', () => {
    expect(overview?.kind).toBe('query')
    expect(overview?.body).toContain('days: v.optional(v.number())')
  })

  // The whole bug in one assertion. `windowed` is the selected range; any other
  // slice derived from a literal number of days is a second, silent window.
  it('derives no fixed-length window alongside the selected one', () => {
    const fixedWindow = /\bconst\s+\w+\s*=\s*windowed\.filter\([\s\S]{0,60}?\.at\s*>=?[\s\S]{0,40}?DAY_MS/
    expect(overview?.body).not.toMatch(fixedWindow)
  })

  it('computes the range-sensitive tiles from the selected window', () => {
    const body = overview?.body ?? ''
    expect(body).toMatch(/visitors:\s*uniqueBy\(windowed,/)
    expect(body).toMatch(/managerViews:\s*windowed\.filter\(/)
    expect(body).toMatch(/const timed = windowed\.filter\(/)
  })

  // Deliberately fixed, and each says so on the tile: "today" and the all-time
  // row. They are the exception the rule needs, not a counter-example to it.
  it('keeps all-time totals on their own window', () => {
    expect(overview?.body).toMatch(/allTimeViews:\s*allTime\.length/)
    expect(overview?.body).toMatch(/viewsInWindow\(ctx, context\.workspaceId, 365\)/)
  })
})

describe('the analytics page', () => {
  // A tile reading "· 7d" while 90d is selected is the same bug wearing the
  // label of the old one, even if the number underneath is now right.
  it('names the selected range on every range-sensitive tile', () => {
    for (const tile of ['Visitors', 'Manager opens', 'Median read']) {
      expect(page).toContain(`label={\`${tile} · \${days}d\`}`)
    }
  })

  it('leaves no hardcoded 7d label behind', () => {
    expect(page).not.toMatch(/·\s*7d/)
  })

  it('reads the range-neutral tile fields', () => {
    expect(page).toMatch(/tiles\.visitors \?\? tiles\.visitors7d/)
    expect(page).toMatch(/tiles\.managerViews \?\? tiles\.managerViews7d/)
  })
})

// ── A tile must not be able to unmount the route ──────────────────────────────
//
// How the range fix reached production as a blank page: renaming the tile fields
// is a breaking change across a boundary that deploys in two commands, so for
// one release `tiles.visitors` was undefined — and `formatNumber` called
// `.toLocaleString()` on it during render. A TypeError thrown in render unmounts
// the route, so one missing number blanked the whole section.
//
// Same rule the Convex queries are held to in tests/dashboard-reads.test.ts: a
// panel degrades, it does not take the page down.
describe('formatNumber', () => {
  it('renders a count', () => {
    expect(formatNumber(1234)).toBe((1234).toLocaleString())
    expect(formatNumber(0)).toBe('0')
  })

  it('degrades instead of throwing on a field the backend did not send', () => {
    expect(() => formatNumber(undefined)).not.toThrow()
    expect(formatNumber(undefined)).toBe('—')
    expect(formatNumber(null)).toBe('—')
  })
})
