import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { functionsIn, readConvex } from './support/convex-source'

// ── Keeping concurrent view writes off each other's rows ──────────────────────
//
// Convex reported `analytics:record` conflicting on `pageViews` roughly 150
// times in three days, three of them failing permanently — a real view, lost.
//
// The cause was two things compounding. Next prefetches every link it can see,
// so one page render sent a burst of requests for pages nobody opened; and the
// deduplication lookup read the visitor's whole history on that target, so all
// of those writes contended on one range whatever page each was for.
//
// Both halves fail silently if they regress. Prefetches come back as plausible
// extra rows, and a widened index range shows up only as a conflict count on a
// dashboard nobody is looking at. So they are asserted here, against the source,
// in the manner of tests/support/convex-source.ts.

describe('the deduplication lookup stays narrow', () => {
  const record = functionsIn('convex/analytics.ts').get('record')

  it('reads the path-scoped index', () => {
    expect(record?.body).toContain("withIndex('by_target_visitor_path_and_time'")
  })

  // The whole point of the change: the visitor's other pages are not read, so
  // two pages loading at once do not collide.
  it('does not read the visitor-wide index', () => {
    expect(record?.body).not.toContain("withIndex('by_target_and_visitor'")
  })

  // A filter after the fact would still have read the range. The bound has to
  // be on the index for the read set to shrink.
  it('bounds the read by the dedupe window on the index', () => {
    expect(record?.body).toMatch(/\.gt\('at', now - DEDUPE_WINDOW_MS\)/)
  })

  it('declares the index with path ahead of time', () => {
    // Order is the substance here, not a formatting detail: `path` must be an
    // equality key so each page gets a range of its own, and `at` must come
    // last so the window is a bound rather than a scan.
    // Whitespace and trailing commas are the formatter's business, not this
    // test's — only the name and the key order are being pinned.
    const schema = readConvex('convex/schema.ts')
      .replace(/\s+/g, '')
      .replace(/,\]/g, ']')
    expect(schema).toContain(
      '.index("by_target_visitor_path_and_time",["target","visitorHash","path","at"])',
    )
  })
})

describe('prefetches are not views', () => {
  const proxy = readFileSync(`${process.cwd()}/proxy.ts`, 'utf8')

  it('the proxy drops them before it counts anything', () => {
    expect(proxy).toContain('if (isPrefetch(req.headers)) return;')
  })

  // Ordering matters: the check has to come before the request is turned into a
  // tracking target, or the burst is already on its way to Convex.
  it('drops them before resolving the target', () => {
    const guard = proxy.indexOf('isPrefetch(req.headers)')
    const resolve = proxy.indexOf('trackingTarget(req, subdomain)')
    expect(guard).toBeGreaterThan(-1)
    expect(resolve).toBeGreaterThan(guard)
  })
})
