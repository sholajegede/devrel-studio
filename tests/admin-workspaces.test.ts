import { describe, expect, it } from 'vitest'
import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { adminFiles, functionsIn, readConvex } from './support/convex-source'

// ── Phase four: workspaces, abuse and the audit reader ────────────────────────
//
// Two of the three are reads, so most of what can go wrong here is reading the
// wrong thing rather than writing it. The invariants that matter are that usage
// is counted the way the product enforces it, that lifting a lockout cannot
// quietly lift the ceiling that stops an attack, and that the audit reader is
// still only a reader.

describe('usage is counted the way the limits are enforced', () => {
  const source = readConvex('convex/adminWorkspaces.ts')

  it('counts by workspace, not by who created the row', () => {
    // `clients:createClient` and `content:createContent` both count
    // `by_workspace` and compare against the workspace owner's plan. Counting
    // `by_user` answers a different question and disagrees with the gate the
    // customer actually hits.
    expect(source).toMatch(/withIndex\('by_workspace'/)
    expect(source).not.toMatch(/withIndex\('by_user'/)
  })

  it('reads the limit from the workspace owner', () => {
    // A workspace has no plan of its own. Resolving the owner is what lets an
    // invited member work without buying anything.
    expect(source).toMatch(/planOf\(owner\)/)
  })

  it('the product still enforces it the same way', () => {
    // If this ever fails, the console is the thing that is right and the
    // product changed underneath it — which is worth knowing either way.
    const clients = readConvex('convex/clients.ts')
    expect(clients).toMatch(/plan\.maxClients/)
    expect(clients).toMatch(/withIndex\('by_workspace'/)
  })

  it('the account page counts the same way', () => {
    // It used to count `by_user`, which missed a member's work and counted work
    // this person did inside somebody else's workspace.
    const detail = functionsIn('convex/adminUsers.ts').get('userDetail')!
    expect(detail.body).toMatch(/withIndex\('by_workspace'/)
    expect(detail.body).not.toMatch(/query\('clients'\)\s*\.withIndex\('by_user'/)
  })

  it('compares per workspace rather than summing first', () => {
    // Two workspaces of three clients each are not one workspace of six.
    // Summing before comparing reports an account over a limit it is nowhere
    // near, which is the kind of wrong number somebody acts on.
    const detail = functionsIn('convex/adminUsers.ts').get('userDetail')!
    expect(detail.body).toMatch(/ownedClients\.length > maxClients/)
  })
})

// ── Lifting a lockout ─────────────────────────────────────────────────────────

describe('clearLockout', () => {
  const clear = functionsIn('convex/adminWorkspaces.ts').get('clearLockout')

  it('exists and guards itself', () => {
    expect(clear).toBeDefined()
    expect(clear!.body).toMatch(/requireAdmin\(ctx\)/)
  })

  it('leaves the whole-dashboard counter alone unless asked', () => {
    // The per-caller rows are the manager who mistyped. The '*' row is the
    // ceiling across every caller — the thing that catches somebody guessing
    // from forty addresses. Clearing the second while doing the first would
    // re-open the door silently.
    expect(clear!.body).toMatch(/args\.includeSlugWide\s*\n?\s*\?\s*rows/)
    expect(clear!.body).toMatch(/row\.bucket !== SLUG_BUCKET/)
  })

  it('refuses to no-op quietly when only the slug-wide row is set', () => {
    // Deleting nothing and reporting success is how somebody concludes the
    // lockout was lifted and the manager is still shut out.
    expect(clear!.body).toMatch(/targets\.length === 0/)
  })

  it('is audited like every other privileged write', () => {
    const rows = clear!.body.match(/writeAudit\(/g) ?? []
    expect(rows.length).toBe(1)
    expect(clear!.body).toMatch(/'abuse\.unlock'/)
  })

  it('records which kind of unlock it was', () => {
    // "Lifted the lockout" and "lifted the ceiling for everyone" must not read
    // the same in the log six months later.
    expect(clear!.body).toMatch(/includedSlugWide/)
  })

  it('grants nothing', () => {
    // It clears a wait. The code still has to be right on the next attempt.
    expect(clear!.body).not.toMatch(/accessUntil/)
    expect(clear!.body).not.toMatch(/managerSessions/)
  })
})

// ── The reader stays a reader ─────────────────────────────────────────────────

describe('the audit log is read and never written here', () => {
  const source = readConvex('convex/adminWorkspaces.ts')

  it('the reader only reads', () => {
    const listAudit = functionsIn('convex/adminWorkspaces.ts').get('listAudit')!
    expect(listAudit.kind).toBe('query')
    expect(listAudit.body).not.toMatch(/ctx\.db\.(insert|patch|delete|replace)/)
  })

  it('nothing in this file edits the log', () => {
    // Invariant 8 again, for the file that finally displays it — the moment a
    // log has a UI is the moment somebody wants a delete button on it.
    expect(source).not.toMatch(/(patch|delete|replace)\([^)]*adminAuditLog/)
  })

  it('no Convex module anywhere mutates it', () => {
    const convexDir = join(process.cwd(), 'convex')
    for (const name of readdirSync(convexDir).filter((f) => f.endsWith('.ts'))) {
      const body = readFileSync(join(convexDir, name), 'utf8')
      expect(
        body.match(/(patch|delete|replace)\([^)]*adminAuditLog/g),
        `${name} mutates adminAuditLog`,
      ).toBeNull()
    }
  })

  it('offers the filter from what the log holds, not from the type', () => {
    // The union says what the code could one day write. The filter should say
    // what is actually in there, or it offers empty categories forever.
    const actions = functionsIn('convex/adminWorkspaces.ts').get('auditActions')!
    expect(actions.body).toMatch(/query\('adminAuditLog'\)/)
    // Asserted on the import rather than the body: the body mentions the union
    // by name in the comment explaining why it does not use it.
    expect(readConvex('convex/adminWorkspaces.ts')).not.toMatch(
      /import[^\n]*AuditAction[^\n]*from/,
    )
  })
})

// ── The CLI command it replaces ───────────────────────────────────────────────

describe('the terminal override is retired', () => {
  it('migrations no longer exports clearAccessAttempts', () => {
    // Two ways to do the same thing is how one of them keeps the behaviour the
    // other one dropped — here, the distinction between a caller's rows and the
    // whole-dashboard ceiling, which the CLI version deleted together.
    const migrations = functionsIn('convex/migrations.ts')
    expect(migrations.has('clearAccessAttempts')).toBe(false)
  })

  it('says where it went', () => {
    // A removed command with no forwarding address is a command somebody
    // re-adds six months later.
    expect(readConvex('convex/migrations.ts')).toMatch(/adminWorkspaces:clearLockout/)
  })

  it('and the replacement is reachable from the browser', () => {
    // The point of moving it: the person who needs it is answering a support
    // email, not holding deploy credentials.
    const clear = functionsIn('convex/adminWorkspaces.ts').get('clearLockout')!
    expect(clear.kind).toBe('mutation')
  })
})

// ── Still true of every admin module ──────────────────────────────────────────

describe('the new module inherits the standing invariants', () => {
  it('is discovered by the guard test', () => {
    expect(adminFiles()).toContain('convex/adminWorkspaces.ts')
  })

  it('takes no acting-as argument', () => {
    expect(readConvex('convex/adminWorkspaces.ts')).not.toMatch(/asUserId/)
  })

  it('never looks an account up by scanning for its email', () => {
    expect(readConvex('convex/adminWorkspaces.ts')).not.toMatch(/q\.field\('email'\)/)
  })
})
