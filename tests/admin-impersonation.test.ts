import { describe, expect, it } from 'vitest'
import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { adminFiles, functionsIn, readConvex } from './support/convex-source'

// ── Phase five: impersonation ─────────────────────────────────────────────────
//
// The riskiest change in this project: one function that every user-facing query
// in the product already resolves through now sometimes returns a different
// person. Everything below exists to pin the four properties that make that
// safe rather than reckless.
//
//   1. Nothing the client sends decides whose data comes back.
//   2. It cannot write.
//   3. Authority is never borrowed from the account being viewed.
//   4. It ends — on its own, and on demand, from inside the borrowed view.
//
// Source-level, like the other admin invariants, because each failure here is a
// line that is absent rather than a value that is wrong.

const auth = readConvex('convex/model/auth.ts')

describe('nothing the browser sends decides who you are', () => {
  it('the session is looked up from the signed-in admin', () => {
    // Not from an argument. There is no id to forge because none is accepted:
    // `activeImpersonation` is keyed on the account resolved from the Kinde
    // token, which is the same rule the whole codebase already follows.
    expect(auth).toMatch(/activeImpersonation\(ctx, real\._id\)/)
  })

  it('no admin module takes an acting-as argument', () => {
    // Invariant 9, and this is the phase it was written for.
    for (const file of adminFiles()) {
      expect(readConvex(file), `${file} accepts asUserId`).not.toMatch(/asUserId/)
    }
  })

  it('costs an ordinary account nothing', () => {
    // Only an admin can have a session, so every other caller takes exactly the
    // path it took before this existed — same reads, same result. This is the
    // function every query in the product resolves through, so "provably inert
    // for everybody else" is worth pinning.
    expect(auth).toMatch(/if \(!real\.adminRole\) return real/)
  })

  it('start resolves the subject by id from an owner-guarded mutation', () => {
    const start = functionsIn('convex/adminImpersonate.ts').get('start')!
    expect(start.body).toMatch(/requireAdmin\(ctx, 'owner'\)/)
    expect(start.body).toMatch(/ctx\.db\.get\(args\.userId\)/)
  })
})

describe('impersonation cannot write', () => {
  it('getCurrentUser refuses in a mutation context', () => {
    // The property the whole design rests on. Making it structural — one branch
    // in the function every write already calls — is the only version that
    // survives somebody adding a mutation next year without reading this file.
    expect(auth).toMatch(/if \(canWrite\(ctx\)\) \{[\s\S]{0,300}throw new ConvexError/)
  })

  it('detects a writer rather than trusting the caller to say', () => {
    // A flag passed by each call site is a flag somebody forgets to pass on the
    // one mutation that matters.
    expect(auth).toMatch(/function canWrite\(ctx: AnyCtx\): boolean/)
    expect(auth).toMatch(/typeof \(ctx\.db as \{ insert\?: unknown \}\)\.insert === 'function'/)
  })

  it('swaps identity only after that check', () => {
    // Order matters: returning the subject and *then* deciding whether the
    // context can write would hand a mutation the impersonated account for as
    // long as it took somebody to reorder two lines.
    const swap = auth.indexOf('ctx.db.get(session.subjectId)')
    const refuse = auth.indexOf('if (canWrite(ctx))')
    expect(refuse).toBeGreaterThan(-1)
    expect(swap).toBeGreaterThan(refuse)
  })

  it('closes the path an action would otherwise take around it', () => {
    // `sync:syncMyStats` is an action: it resolves its own identity from the
    // token and never passes through getCurrentUser, so it would refresh the
    // admin's own statistics from a screen showing somebody else's dashboard.
    const sync = readConvex('convex/sync.ts')
    expect(sync).toMatch(/adminImpersonate\.activeForKindeId/)
    expect(sync).toMatch(/End that session first/)
  })
})

describe('authority is never borrowed', () => {
  it('admin checks resolve the real signed-in account', () => {
    // Otherwise viewing an owner's dashboard would make you an owner, and
    // ending the session would require the authority you had just borrowed.
    const admin = readConvex('convex/model/admin.ts')
    expect(admin).toMatch(/const user = await getRealUser\(ctx\)/)
    expect(admin).not.toMatch(/getCurrentUser\(ctx\)/)
  })

  it('the console keeps working while a session is open', () => {
    // `myAdminRole` resolves the Kinde subject directly, so the admin nav and
    // the banner survive wearing somebody else's account.
    const adminModule = functionsIn('convex/admin.ts').get('myAdminRole')!
    expect(adminModule.body).toMatch(/getUserIdentity\(\)/)
    expect(adminModule.body).not.toMatch(/getCurrentUser\(/)
  })

  it('ending needs less authority than starting', () => {
    // Whatever it took to get in, getting out must never be the thing somebody
    // cannot do.
    const fns = functionsIn('convex/adminImpersonate.ts')
    expect(fns.get('start')!.body).toMatch(/requireAdmin\(ctx, 'owner'\)/)
    expect(fns.get('end')!.body).toMatch(/requireAdmin\(ctx\)/)
    expect(fns.get('end')!.body).not.toMatch(/requireAdmin\(ctx, 'owner'\)/)
  })
})

describe('a session ends', () => {
  const fns = functionsIn('convex/adminImpersonate.ts')

  it('expires without anybody doing anything', () => {
    expect(readConvex('convex/adminImpersonate.ts')).toMatch(/SESSION_MS/)
    expect(auth).toMatch(/session\.expiresAt > now/)
  })

  it('is checked on read rather than swept by a cron', () => {
    // A sweep leaves a window in which the row says one thing and the clock
    // says another, and that window is the one somebody is still inside.
    expect(auth).toMatch(/const now = Date\.now\(\)/)
    expect(auth).not.toMatch(/crons/)
  })

  it('only one can be open at a time', () => {
    // Two would make "whose data am I looking at" depend on which row a query
    // happened to find first.
    expect(fns.get('start')!.body).toMatch(/ctx\.db\.patch\(session\._id, \{ endedAt: now \}\)/)
  })

  it('refuses to impersonate yourself', () => {
    expect(fns.get('start')!.body).toMatch(/subject\._id === admin\._id/)
  })

  it('demands a reason', () => {
    // The one action here that changes no data at all, which is why the record
    // of it has to be the strongest: nothing else will ever show it happened.
    expect(fns.get('start')!.body).toMatch(/if \(!reason\)/)
  })

  it('audits both ends', () => {
    expect(fns.get('start')!.body).toMatch(/'impersonate\.start'/)
    expect(fns.get('end')!.body).toMatch(/'impersonate\.end'/)
  })

  it('keeps the rows after they end', () => {
    // Who looked at whose account, and when, has to stay answerable.
    const source = readConvex('convex/adminImpersonate.ts')
    expect(source).not.toMatch(/ctx\.db\.delete\(/)
  })
})

// ── Revenue ───────────────────────────────────────────────────────────────────

describe('the book only counts money somebody actually typed', () => {
  const source = readConvex('convex/adminRevenue.ts')

  it('reads amounts from requests, not from the audit log', () => {
    // `accessRequests.amount` is the only number in the database entered as
    // money. The alternative was parsing a currency out of the free-text note on
    // an audit row, which would put a figure on the page that nothing checked.
    expect(source).toMatch(/query\('accessRequests'\)/)
    expect(source).not.toMatch(/parseFloat|parseInt|match\(\/[^/]*\d/)
  })

  it('does not convert between currencies', () => {
    // A total mixing naira and dollars at a rate nobody recorded looks
    // authoritative and is not.
    // Asserted on the shape rather than on the absence of words like "rate":
    // the comment explaining why there is no conversion says "rate" itself.
    expect(source).toMatch(/totals: \[\.\.\.byCurrency\.entries\(\)\]/)
    expect(source).toMatch(/\.map\(\(\[currency, totals\]\)/)
  })

  it('names the gap between grants and sales', () => {
    // Hand grants carry no amount. Left unexplained, the difference reads as
    // missing money.
    expect(source).toMatch(/byHand/)
  })

  it('leaves comped accounts out of renewals', () => {
    // A permanent grant in a list called "due" is a line somebody chases for
    // ever. `accessOf` reports 'comped', which this filters on.
    expect(source).toMatch(/access\.state !== 'active'/)
  })
})

// ── Standing invariants, once more ────────────────────────────────────────────

describe('the new modules inherit the standing invariants', () => {
  it('are discovered by the guard test', () => {
    expect(adminFiles()).toContain('convex/adminImpersonate.ts')
    expect(adminFiles()).toContain('convex/adminRevenue.ts')
  })

  it('never mutate the audit log', () => {
    const convexDir = join(process.cwd(), 'convex')
    for (const name of readdirSync(convexDir).filter((f) => f.endsWith('.ts'))) {
      const body = readFileSync(join(convexDir, name), 'utf8')
      expect(
        body.match(/(patch|delete|replace)\([^)]*adminAuditLog/g),
        `${name} mutates adminAuditLog`,
      ).toBeNull()
    }
  })
})
