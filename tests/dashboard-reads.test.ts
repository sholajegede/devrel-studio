import { describe, expect, it } from 'vitest'
import { readdirSync } from 'node:fs'
import { exportedFunctions, functionsIn, readConvex } from './support/convex-source'

// ── Dashboard reads must not throw on a missing caller ────────────────────────
//
// The bug this guards against was reported as "the analytics page breaks and I
// have to reload", and Sentry saw it as a ConvexError from
// `analytics:sinceLastVisit`.
//
// Convex authentication is not a latch. The ID token rotates, the socket
// reconnects when a machine wakes, and Kinde rebuilds its client state on its
// own schedule — each of those leaves the socket without a verified identity for
// a moment, and every mounted query re-runs inside that window. A query built on
// `requireWorkspace` throws there. A `useQuery` that throws, throws during
// render, and that unmounts the route: the page goes blank, the reader reloads,
// and the reload works — which is what made it look intermittent rather than
// structural.
//
// So the rule is a shape, not a fix to one function: a *query* backing a page
// degrades, a *mutation* refuses. This test reads the source because the mistake
// is one of omission — somebody copies a sibling query and keeps its first line,
// and nothing about the result looks wrong.

/** Convex modules the signed-in product reads from, admin console aside. */
function productModules(): string[] {
  return readdirSync(`${process.cwd()}/convex`)
    .filter((name) => name.endsWith('.ts') && !/^admin/.test(name))
    .map((name) => `convex/${name}`)
    .sort()
}

describe('queries the dashboard subscribes to', () => {
  it.each(productModules())('%s has no query that throws on a missing caller', (path) => {
    const offenders = exportedFunctions(readConvex(path))
      .filter((fn) => fn.kind === 'query')
      .filter((fn) => /\brequireWorkspace\(/.test(fn.body) || /\brequireCurrentUser\(/.test(fn.body))
      .map((fn) => fn.name)

    expect(offenders).toEqual([])
  })

  // The inverse mistake is worse and quieter: degrading a *write* turns "you are
  // not allowed to do that" into a no-op the caller is told nothing about.
  it('markSeen still refuses an unauthenticated write', () => {
    const markSeen = functionsIn('convex/analytics.ts').get('markSeen')
    expect(markSeen?.kind).toBe('mutation')
    expect(markSeen?.body).toContain('requireWorkspace(ctx)')
  })
})

describe('the panels each degrade to something renderable', () => {
  const analytics = functionsIn('convex/analytics.ts')

  // Null is the page's existing loading state, so a pending identity keeps the
  // skeleton up rather than flashing a zeroed dashboard at somebody who has data.
  it.each(['overview', 'sinceLastVisit'])('%s answers null while an identity is pending', (name) => {
    expect(analytics.get(name)?.body).toMatch(/state !== 'ok'[\s\S]*?null/)
  })

  it('recentActivity answers an empty log', () => {
    expect(analytics.get('recentActivity')?.body).toMatch(/state !== 'ok'\) return \[\]/)
  })

  it('liveNow answers nobody', () => {
    expect(analytics.get('liveNow')?.body).toMatch(/state !== 'ok'\) return \{ count: 0/)
  })

  // A real account in no workspace is a stable state, not a pending one. It gets
  // the zero shape instead, or the page waits on a skeleton that never resolves.
  it('overview separates a pending identity from an account with no workspace', () => {
    expect(analytics.get('overview')?.body).toContain("seen.state === 'pending' ? null : emptyOverview(days)")
  })
})
