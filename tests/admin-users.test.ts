import { describe, expect, it } from 'vitest'
import { adminFiles, functionsIn, readConvex } from './support/convex-source'
import { extendAccessWindow, revokedPatch } from '@/convex/model/access'
import { accessOf } from '@/convex/model/plans'

// ── Phase three: accounts ─────────────────────────────────────────────────────
//
// Grant, revoke and comp — the three things that were previously done in a
// Convex dashboard session against the raw table, with no record of who did
// them or why.
//
// The invariants that matter here are about what a privileged write must leave
// behind (a row in the audit log), who is allowed to make it (owner, for the
// two that take something away), and the fact that revoke means the same thing
// wherever it is typed.

describe('revokedPatch', () => {
  it('clears the window rather than dating it in the past', () => {
    // `accessOf` reports `until` differently for an absent value and a past
    // one. Two revoke paths disagreeing about which to write would leave two
    // accounts in visibly different states after the same decision.
    expect(revokedPatch().accessUntil).toBeUndefined()
  })

  it('marks the account revoked rather than merely lapsed', () => {
    expect(revokedPatch().planStatus).toBe('revoked')
  })

  it('keeps the reason where a human will read it', () => {
    expect(revokedPatch('Refunded in full')).toMatchObject({
      accessNote: 'Access revoked — Refunded in full',
    })
    expect(revokedPatch('   ').accessNote).toBe('Access revoked')
    expect(revokedPatch().accessNote).toBe('Access revoked')
  })

  it('leaves an account unable to write', () => {
    const revoked = { _id: 'x', plan: 'pro', ...revokedPatch('Chargeback') }
    const access = accessOf(revoked)
    expect(access.state).toBe('expired')
    expect(access.canWrite).toBe(false)
  })

  it('does not erase what they bought', () => {
    // The plan records the purchase, not the entitlement. Erasing it would lose
    // the only record of what the refund was for.
    expect(revokedPatch()).not.toHaveProperty('plan')
  })
})

describe('both revoke paths write the same fields', () => {
  const console_ = functionsIn('convex/adminUsers.ts').get('revokeAccess')
  const terminal = functionsIn('convex/migrations.ts').get('revokeAccess')

  it('exist', () => {
    expect(console_).toBeDefined()
    expect(terminal).toBeDefined()
  })

  it('share one definition of revoked', () => {
    expect(console_!.body).toMatch(/revokedPatch\(/)
    expect(terminal!.body).toMatch(/revokedPatch\(/)
  })

  it('neither spells the fields out for itself', () => {
    // The way the two drift apart is somebody editing one of them in place, so
    // the assertion is on the patch itself. It cannot be a search for
    // `planStatus: 'revoked'` anywhere in the function: the console's audit row
    // records that exact resulting state, and should.
    for (const fn of [console_!, terminal!]) {
      expect(fn.body).toMatch(/ctx\.db\.patch\([^,]+, revokedPatch\(/)
      expect(fn.body).not.toMatch(/accessUntil: undefined/)
    }
  })
})

// ── Invariant 3 ───────────────────────────────────────────────────────────────
//
// Taking something away is owner work. A support account quietly gaining
// destructive powers is the failure this separation exists to prevent, and it
// is invisible until somebody uses them.

describe('who may do what', () => {
  const fns = functionsIn('convex/adminUsers.ts')

  it('revoking requires owner', () => {
    expect(fns.get('revokeAccess')!.body).toMatch(/requireAdmin\(ctx, 'owner'\)/)
  })

  it('comping requires owner', () => {
    // An unbounded grant with no expiry — the most valuable thing in the
    // console to acquire.
    expect(fns.get('setComped')!.body).toMatch(/requireAdmin\(ctx, 'owner'\)/)
  })

  it('granting is support work, deliberately', () => {
    // The same act as approving a request, for a purchase that never produced
    // one. Owner-only here would mean the routine half of the job could not be
    // delegated whenever a customer skipped the form.
    const grant = fns.get('grantAccess')!.body
    expect(grant).toMatch(/requireAdmin\(ctx\)/)
    expect(grant).not.toMatch(/requireAdmin\(ctx, 'owner'\)/)
  })

  it('reading is support work', () => {
    for (const name of ['searchUsers', 'userDetail', 'overview']) {
      expect(fns.get(name)!.body).toMatch(/requireAdmin\(ctx\)/)
    }
  })
})

// ── Invariant 7 ───────────────────────────────────────────────────────────────
//
// Every privileged write appends exactly one audit row. The log looking
// complete while missing the action somebody needs is worse than no log: it
// answers the question wrongly rather than admitting it cannot.

describe('every write is audited', () => {
  const fns = [...functionsIn('convex/adminUsers.ts').values()]

  const writers = fns.filter(
    (fn) => fn.kind.endsWith('utation') && /ctx\.db\.patch\(/.test(fn.body),
  )

  it('there are writes to check', () => {
    // Listed rather than counted, so a new write has to be acknowledged here
    // before its "exactly one audit row" check below starts running. A test
    // that adapts silently to whatever it finds is not checking anything.
    expect(writers.map((fn) => fn.name).sort()).toEqual([
      'grantAccess',
      'revokeAccess',
      'setComped',
      'setPaused',
    ])
  })

  for (const fn of writers) {
    it(`${fn.name} appends exactly one row`, () => {
      const rows = fn.body.match(/writeAudit\(/g) ?? []
      expect(rows.length, `${fn.name} writes ${rows.length} audit rows`).toBe(1)
    })
  }

  it('nothing here deletes anything', () => {
    // Revoking closes a window. It does not remove the customer's work, their
    // clients, or their clients' dashboards — punishing a client for their
    // DevRel's refund would be the wrong party.
    const source = readConvex('convex/adminUsers.ts')
    expect(source).not.toMatch(/ctx\.db\.delete\(/)
  })
})

// ── Invariant 9 ───────────────────────────────────────────────────────────────

describe('impersonation is not a write path', () => {
  it('no Convex function accepts an acting-as argument', () => {
    // Phase five adds read-only impersonation. If a mutation ever takes the
    // account to act as, every audit row it writes names the wrong person —
    // which is precisely when the log stops being evidence.
    for (const file of adminFiles()) {
      expect(readConvex(file), `${file} accepts asUserId`).not.toMatch(/asUserId/)
    }
  })
})

// ── Reads stay on their indexes ───────────────────────────────────────────────

describe('account lookups use indexes', () => {
  const source = readConvex('convex/adminUsers.ts')

  it('search is a range read on by_email, not a scan', () => {
    expect(source).toMatch(/withIndex\('by_email'/)
    expect(source).toMatch(/q\.gte\('email', term\)/)
    // `.filter(q => q.eq(q.field('email')...))` reads the whole table and then
    // picks arbitrarily between duplicates.
    expect(source).not.toMatch(/q\.field\('email'\)/)
  })

  it('history comes off the subject index', () => {
    expect(source).toMatch(/withIndex\('by_subject'/)
  })

  it('the audit log is only ever read here', () => {
    // Invariant 8, restated for the new file: an audit trail that can be
    // edited is not an audit trail.
    expect(source).not.toMatch(/(patch|delete|replace)\([^)]*adminAuditLog/)
  })
})

// ── One definition of a term ──────────────────────────────────────────────────

describe('a hand grant lands where an approved request would', () => {
  const grant = functionsIn('convex/adminUsers.ts').get('grantAccess')!

  it('uses the shared window arithmetic', () => {
    expect(grant.body).toMatch(/extendAccessWindow\(/)
    expect(grant.body).not.toMatch(/setMonth\(/)
  })

  it('extends an open window rather than restarting it', () => {
    // The property that makes renewing early safe. Pinned here as well as in
    // the access tests because this is the second caller, and a second caller
    // is where a shared function stops being shared.
    const now = Date.UTC(2026, 8, 1)
    const openUntil = Date.UTC(2026, 10, 1)
    const window = extendAccessWindow(openUntil, 3, now)
    expect(window.extended).toBe(true)
    expect(window.until).toBe(Date.UTC(2027, 1, 1))
  })
})

// ── Comping, and what is underneath it ────────────────────────────────────────

describe('a comp hides the window rather than replacing it', () => {
  const now = Date.UTC(2026, 8, 1)
  const future = Date.UTC(2026, 11, 1)

  it('reports no expiry while comped', () => {
    // Which is why the console reads the raw column for its grant preview and
    // its "removing this comp locks them out" warning: the effective date is
    // null for every comped account, so the warning would fire on all of them.
    expect(accessOf({ _id: 'x', comped: true, accessUntil: future }, now).until).toBeNull()
  })

  it('falls back to the paid window when the comp comes off', () => {
    const access = accessOf({ _id: 'x', comped: false, accessUntil: future }, now)
    expect(access.state).toBe('active')
    expect(access.until).toBe(future)
  })

  it('leaves nothing behind when there was never a window', () => {
    // The case the dialog warns about: an account that has only ever been
    // comped is locked out the moment the comp is removed.
    expect(accessOf({ _id: 'x', comped: false }, now).state).toBe('expired')
  })

  it('is what the mutation reports back', () => {
    const source = readConvex('convex/adminUsers.ts')
    expect(source).toMatch(/leavesWithoutAccess/)
    expect(source).toMatch(/accessOf\(\{ \.\.\.user, comped: false \}/)
  })
})
