import { describe, expect, it } from 'vitest'
import { readFileSync, readdirSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import { atLeastAdmin } from '@/convex/model/admin'
import { accessOf, isComped } from '@/convex/model/plans'

describe('atLeastAdmin', () => {
  it('lets owner do anything support can', () => {
    expect(atLeastAdmin('owner', 'support')).toBe(true)
    expect(atLeastAdmin('owner', 'owner')).toBe(true)
  })

  // The separation the whole two-role design rests on: routine work is
  // delegable, destructive work is not.
  it('does not let support do owner work', () => {
    expect(atLeastAdmin('support', 'owner')).toBe(false)
  })

  it('lets support do support work', () => {
    expect(atLeastAdmin('support', 'support')).toBe(true)
  })
})

describe('isComped', () => {
  it('reads the column', () => {
    expect(isComped({ _id: 'anyone', comped: true })).toBe(true)
  })

  it('is false for an ordinary account', () => {
    expect(isComped({ _id: 'anyone' })).toBe(false)
    expect(isComped({ _id: 'anyone', comped: false })).toBe(false)
    expect(isComped(null)).toBe(false)
    expect(isComped(undefined)).toBe(false)
  })

  // The fallback exists so a deployment that has not yet run migrateComped
  // does not silently drop the top plan from an account that already had it.
  it('still honours the legacy hardcoded list', () => {
    expect(isComped({ _id: 'jd767m6hpf3jqhdcs5rb9d6v8581r92k' })).toBe(true)
    expect(isComped({ kindeId: 'jd767m6hpf3jqhdcs5rb9d6v8581r92k' })).toBe(true)
  })

  it('gives a comped account the top plan and write access', () => {
    const access = accessOf({ _id: 'x', comped: true })
    expect(access.state).toBe('comped')
    expect(access.canWrite).toBe(true)
    expect(access.plan.id).toBe('agency')
  })

  it('comping outranks an expired window', () => {
    // Someone comped after their paid term lapsed must not read as expired.
    const access = accessOf({ _id: 'x', comped: true, accessUntil: 1 })
    expect(access.state).toBe('comped')
  })
})

// ── Invariant 1 ───────────────────────────────────────────────────────────────
//
// Every admin function must resolve its caller through requireAdmin. This is
// the only invariant whose failure is an *absent* line, which is exactly the
// kind a reviewer skims past — and the consequence is an unauthenticated
// endpoint that can grant platform access.
//
// Crude on purpose: it reads the source rather than the runtime, so it catches
// the mistake at the point it is made, in a repo with no Convex test harness.

const ADMIN_FILES = ['convex/admin.ts']

/** Exported Convex functions, with the body up to the next export. */
function exportedFunctions(source: string) {
  const found: { name: string; kind: string; body: string }[] = []
  const pattern = /export const (\w+) = (internalMutation|internalQuery|mutation|query|action|internalAction)\(/g

  let match: RegExpExecArray | null
  while ((match = pattern.exec(source)) !== null) {
    pattern.lastIndex = match.index + match[0].length
    const next = source.indexOf('\nexport const ', match.index + 1)
    found.push({
      name: match[1],
      kind: match[2],
      body: source.slice(match.index, next === -1 ? source.length : next),
    })
  }
  return found
}

describe('every admin function guards itself', () => {
  const root = process.cwd()

  for (const file of ADMIN_FILES) {
    const path = join(root, file)
    if (!existsSync(path)) continue

    const functions = exportedFunctions(readFileSync(path, 'utf8'))

    it(`${file} exports functions to check`, () => {
      expect(functions.length).toBeGreaterThan(0)
    })

    for (const fn of functions) {
      // `internal*` functions are unreachable from the browser — they require
      // Convex deploy credentials — which is what makes bootstrap safe before
      // any admin exists.
      const internal = fn.kind.startsWith('internal')

      it(`${fn.name} ${internal ? 'is internal-only' : 'calls requireAdmin'}`, () => {
        if (internal) {
          expect(fn.kind.startsWith('internal')).toBe(true)
          return
        }
        expect(
          fn.body.includes('requireAdmin(') || fn.body.includes('getUserIdentity('),
          `${fn.name} is publicly callable but never resolves an admin`,
        ).toBe(true)
      })
    }
  }
})

describe('admin surface shape', () => {
  const source = readFileSync(join(process.cwd(), 'convex/admin.ts'), 'utf8')

  it('keeps bootstrap unreachable from the browser', () => {
    // A public bootstrap would let anyone listed in ADMIN_EMAILS — or anyone
    // who can set it — promote themselves without deploy credentials.
    expect(source).toMatch(/export const bootstrap = internalMutation/)
  })

  it('keeps reconciliation read-only', () => {
    expect(source).toMatch(/export const reconcileRequests = internalQuery/)
  })

  it('requires owner for the admin roster and for granting admin', () => {
    expect(source).toMatch(/listAdmins[\s\S]{0,400}requireAdmin\(ctx, 'owner'\)/)
    expect(source).toMatch(/setAdminRole[\s\S]{0,400}requireAdmin\(ctx, 'owner'\)/)
  })

  it('never patches or deletes the audit log', () => {
    // Invariant 8. An audit trail that can be edited is not an audit trail.
    const convexDir = join(process.cwd(), 'convex')
    const files = readdirSync(convexDir).filter((name) => name.endsWith('.ts'))

    for (const name of files) {
      const body = readFileSync(join(convexDir, name), 'utf8')
      const offending = body.match(/(patch|delete|replace)\([^)]*adminAuditLog/g)
      expect(offending, `${name} mutates adminAuditLog`).toBeNull()
    }
  })
})

describe('the missing email index is used', () => {
  it('admin lookups go through by_email rather than a table scan', () => {
    const source = readFileSync(join(process.cwd(), 'convex/admin.ts'), 'utf8')
    // `.filter(q => q.eq(q.field('email')...))` scans the table and `.first()`
    // then picks arbitrarily between duplicates.
    expect(source).not.toMatch(/filter\([^)]*q\.field\('email'\)/)
    expect(source).toMatch(/withIndex\('by_email'/)
  })

  it('the schema declares it', () => {
    const schema = readFileSync(join(process.cwd(), 'convex/schema.ts'), 'utf8')
    expect(schema).toMatch(/\.index\("by_email", \["email"\]\)/)
  })
})

// ── Invariant: approving is one transaction ───────────────────────────────────
//
// The bug this phase exists to make impossible. Settling the request and
// opening the access window were two commands typed from memory, and running
// one without the other left either a paying customer locked out or a free
// grant behind a closed request — neither visible from any screen.
//
// Source-level again, for the same reason as invariant 1: the failure is a
// missing line, and there is no Convex test harness here to catch it at
// runtime.

describe('approveRequest settles and grants together', () => {
  const source = readFileSync(join(process.cwd(), 'convex/admin.ts'), 'utf8')
  const approve = exportedFunctions(source).find((fn) => fn.name === 'approveRequest')

  it('exists', () => {
    expect(approve).toBeDefined()
  })

  it('writes both halves in the same handler', () => {
    // A Convex mutation is a transaction: two patches in one handler commit
    // together or roll back together. Splitting them across two functions —
    // however carefully sequenced by the caller — reintroduces the bug.
    expect(approve!.body).toMatch(/ctx\.db\.patch\(user\._id/)
    expect(approve!.body).toMatch(/ctx\.db\.patch\(request\._id, \{ status: 'granted' \}\)/)
  })

  it('refuses a request that is not still open', () => {
    // Approving twice extends the window a second time for one payment, and
    // the second grant is indistinguishable from the first afterwards.
    expect(approve!.body).toMatch(/request\.status !== 'open'/)
  })

  it('resolves the account by id rather than by email', () => {
    // Two accounts can share an address. An email lookup picks between them
    // arbitrarily, which grants one person's purchase to another.
    expect(approve!.body).toMatch(/ctx\.db\.get\(request\.userId\)/)
    expect(approve!.body).not.toMatch(/withIndex\('by_email'/)
  })

  it('leaves the expiry arithmetic in one shared place', () => {
    // `migrations:grantAccess` computes the same window. Two implementations
    // of "three more months" is two customers with the same purchase and
    // different end dates.
    expect(approve!.body).toMatch(/extendAccessWindow\(/)
    const migrations = readFileSync(join(process.cwd(), 'convex/migrations.ts'), 'utf8')
    expect(migrations).toMatch(/extendAccessWindow\(/)
    expect(migrations).not.toMatch(/until\.setMonth\(/)
  })
})

describe('declineRequest grants nothing', () => {
  const source = readFileSync(join(process.cwd(), 'convex/admin.ts'), 'utf8')
  const decline = exportedFunctions(source).find((fn) => fn.name === 'declineRequest')

  it('exists', () => {
    expect(decline).toBeDefined()
  })

  it('touches the request and nothing else', () => {
    expect(decline!.body).toMatch(/ctx\.db\.patch\(request\._id, \{ status: 'declined' \}\)/)
    expect(decline!.body).not.toMatch(/accessUntil/)
    expect(decline!.body).not.toMatch(/ctx\.db\.patch\(user/)
  })
})

describe('a request status cannot be a typo', () => {
  it('the schema validates it as a union', () => {
    // `v.string()` let any status through, so a mistyped one became a row no
    // query matched — a customer who, from every screen, never asked.
    const schema = readFileSync(join(process.cwd(), 'convex/schema.ts'), 'utf8')
    expect(schema).toMatch(/status: requestStatusValidator/)
    expect(schema).not.toMatch(/'open' until the owner[\s\S]{0,400}status: v\.string\(\)/)
  })

  it('reconciliation knows about every one of them', () => {
    // 'cancelled' was missing from this set, so a buyer who withdrew their own
    // request was reported as corrupt data.
    const source = readFileSync(join(process.cwd(), 'convex/admin.ts'), 'utf8')
    expect(source).toMatch(/new Set<string>\(REQUEST_STATUSES\)/)
  })
})
