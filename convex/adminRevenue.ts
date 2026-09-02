import { v } from 'convex/values'
import { query } from './_generated/server'
import { requireAdmin } from './model/admin'
import { PLANS, accessOf, isPlanId } from './model/plans'

// ── Admin, phase five: the book ───────────────────────────────────────────────
//
// What has been sold, and what is about to need collecting again.
//
// Every payment here is a bank transfer answered by hand. There is no Stripe
// ledger to read — Stripe needs a US entity — so the only records of money are
// the amount a buyer entered on the pricing page and the note somebody typed
// when approving it. That shapes everything below: this is a book of what was
// *agreed*, not a reconciliation against a bank feed, and it says so rather than
// implying an authority it does not have.

/**
 * Where an amount can honestly come from.
 *
 * `accessRequests.amount` is the only number in the database that anybody
 * actually typed as money. A grant made by hand — an advisor, a correction, a
 * transfer that arrived without anybody using the pricing page — has no amount,
 * because none was ever recorded.
 *
 * The alternative was parsing the currency out of the free-text note on the
 * audit row, which would put a number on this page that nothing checked. A
 * missing amount that says so beats an invented one.
 */
const DAY = 86_400_000

/**
 * What has been sold, newest first.
 *
 * Read from `accessRequests` rather than from the audit log: the log records
 * that access was granted and by whom, but only the request carries a currency
 * and an amount. Approving one writes both a `request.approve` and an
 * `access.grant` row, so counting grants in the log would double-count against
 * this list — which is why the reconciliation below counts rather than joins.
 */
export const ledger = query({
  args: { days: v.optional(v.number()) },
  handler: async (ctx, args) => {
    await requireAdmin(ctx)

    const days = Math.min(Math.max(args.days ?? 365, 1), 3650)
    const since = Date.now() - days * DAY

    const granted = await ctx.db
      .query('accessRequests')
      .withIndex('by_status', (q) => q.eq('status', 'granted'))
      .collect()

    const inPeriod = granted
      .filter((request) => request.createdAt >= since)
      .sort((a, b) => b.createdAt - a.createdAt)

    // Currencies are not converted. A total mixing naira and dollars at a rate
    // nobody recorded is a number that looks authoritative and is not; the page
    // shows a subtotal per currency instead.
    const byCurrency = new Map<string, { amount: number; count: number }>()
    const byTerm = new Map<number, { count: number; months: number }>()

    for (const request of inPeriod) {
      const currency = byCurrency.get(request.currency) ?? { amount: 0, count: 0 }
      byCurrency.set(request.currency, {
        amount: currency.amount + request.amount,
        count: currency.count + 1,
      })

      const term = byTerm.get(request.months) ?? { count: 0, months: request.months }
      byTerm.set(request.months, { ...term, count: term.count + 1 })
    }

    // What the log says happened, so the two can be compared without pretending
    // one explains the other. A grant with no sale beside it is a hand grant —
    // an advisor, a correction, a transfer that skipped the pricing page.
    const grants = await ctx.db
      .query('adminAuditLog')
      .withIndex('by_time', (q) => q.gte('at', since))
      .collect()

    const grantRows = grants.filter((row) => row.action === 'access.grant').length
    const approvals = grants.filter((row) => row.action === 'request.approve').length

    return {
      days,
      sales: inPeriod.map((request) => ({
        id: request._id,
        userId: request.userId,
        email: request.email,
        name: request.name ?? null,
        plan: request.plan,
        planName: isPlanId(request.plan) ? PLANS[request.plan].name : request.plan,
        months: request.months,
        currency: request.currency,
        amount: request.amount,
        at: request.createdAt,
      })),
      totals: [...byCurrency.entries()]
        .map(([currency, totals]) => ({ currency, ...totals }))
        .sort((a, b) => b.amount - a.amount),
      terms: [...byTerm.values()].sort((a, b) => a.months - b.months),
      reconciliation: {
        /** Access windows opened in the period, from the audit log. */
        grants: grantRows,
        /** How many of those came from a request somebody bought through. */
        approvals,
        /**
         * Opened by hand, with no amount recorded anywhere.
         *
         * Not an error — it is how an advisor, a correction or a transfer that
         * skipped the pricing page looks. It is here so the gap between "grants"
         * and "sales" has a name instead of reading as missing money.
         */
        byHand: Math.max(0, grantRows - approvals),
      },
    }
  },
})

/**
 * Who runs out next.
 *
 * The one genuinely operational number in this section. Every renewal is an
 * invoice somebody has to send, a transfer that has to clear and an approval
 * that has to be typed — so a window closing in ten days is work that starts
 * now, not a notification that fires on the day.
 *
 * Comped accounts are excluded: they have no window to renew, and a permanent
 * grant in a list titled "due" is a line somebody chases forever.
 */
export const renewalsDue = query({
  args: { days: v.optional(v.number()) },
  handler: async (ctx, args) => {
    await requireAdmin(ctx)

    const days = Math.min(Math.max(args.days ?? 45, 1), 365)
    const now = Date.now()
    const horizon = now + days * DAY

    const users = await ctx.db.query('users').collect()
    const due = []

    for (const user of users) {
      const access = accessOf(user, now)
      if (access.state !== 'active' || !access.until) continue
      if (access.until > horizon) continue

      // What they last agreed to pay, so the invoice does not have to be
      // reconstructed from memory. Their most recent granted request.
      const requests = await ctx.db
        .query('accessRequests')
        .withIndex('by_user', (q) => q.eq('userId', user._id))
        .collect()

      const lastSale = requests
        .filter((request) => request.status === 'granted')
        .sort((a, b) => b.createdAt - a.createdAt)[0]

      due.push({
        id: user._id,
        email: user.email,
        name: `${user.firstName ?? ''} ${user.lastName ?? ''}`.trim() || null,
        planName: access.plan.name,
        until: access.until,
        daysLeft: access.daysLeft ?? 0,
        last: lastSale
          ? {
              currency: lastSale.currency,
              amount: lastSale.amount,
              months: lastSale.months,
            }
          : null,
      })
    }

    return due.sort((a, b) => (a.until ?? 0) - (b.until ?? 0))
  },
})
