'use client'

import Link from 'next/link'
import { useQuery } from 'convex/react'
import { api } from '@/convex/_generated/api'
import { Card } from '@/components/ui/card'
import { AlertTriangle, Clock } from 'lucide-react'

// ── The book ──────────────────────────────────────────────────────────────────
//
// What has been sold, and who runs out next.
//
// Every payment here is a bank transfer answered by hand, so there is no Stripe
// ledger to reconcile against. This is a record of what was *agreed* — the
// amount a buyer typed on the pricing page — and the page says so rather than
// implying an authority it does not have.

export default function AdminRevenuePage() {
  const ledger = useQuery(api.adminRevenue.ledger, { days: 365 })
  const renewals = useQuery(api.adminRevenue.renewalsDue, { days: 45 })

  return (
    <>
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-foreground">Revenue</h1>
        <p className="text-sm text-muted-foreground">
          What was agreed, over the last year. Every payment is a transfer collected
          by hand, so nothing here is reconciled against a bank.
        </p>
      </div>

      {/* Renewals first: it is the only part of this page with a deadline on it.
          A window closing in ten days is an invoice to send now, not a
          notification that fires on the day. */}
      <Card className="mb-4 gap-0 p-5">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="text-sm font-semibold text-foreground">Renewals due</h2>
          <p className="text-xs text-muted-foreground">Next 45 days</p>
        </div>

        {renewals === undefined ? (
          <div className="mt-3 space-y-2">
            {Array.from({ length: 2 }).map((_, index) => (
              <div key={index} className="h-4 w-full animate-pulse rounded bg-muted" />
            ))}
          </div>
        ) : renewals.length === 0 ? (
          <p className="mt-2 text-sm text-muted-foreground">
            Nothing runs out in the next 45 days.
          </p>
        ) : (
          <ul className="mt-3 space-y-2">
            {renewals.map((row) => (
              <li
                key={row.id}
                className="flex flex-wrap items-baseline justify-between gap-2 border-b border-border pb-2 text-sm last:border-0 last:pb-0"
              >
                <span className="min-w-0">
                  <Link
                    href={`/admin/users/${row.id}`}
                    className="text-foreground underline-offset-4 hover:underline"
                  >
                    {row.name ?? row.email}
                  </Link>
                  <span className="text-muted-foreground"> · {row.planName}</span>
                </span>
                <span className="flex items-center gap-3 text-xs">
                  {row.last && (
                    <span className="text-muted-foreground">
                      last {row.last.currency} {row.last.amount.toLocaleString()} for{' '}
                      {row.last.months === 1 ? '1 month' : `${row.last.months} months`}
                    </span>
                  )}
                  <span
                    className={`flex items-center gap-1 tabular-nums ${
                      row.daysLeft <= 14
                        ? 'font-medium text-amber-600 dark:text-amber-500'
                        : 'text-muted-foreground'
                    }`}
                  >
                    <Clock className="h-3 w-3" />
                    {row.daysLeft === 0
                      ? 'today'
                      : `${row.daysLeft} ${row.daysLeft === 1 ? 'day' : 'days'}`}
                  </span>
                </span>
              </li>
            ))}
          </ul>
        )}
      </Card>

      {ledger === undefined ? (
        <Card className="gap-0 p-5">
          <div className="space-y-2">
            {Array.from({ length: 4 }).map((_, index) => (
              <div key={index} className="h-4 w-full animate-pulse rounded bg-muted" />
            ))}
          </div>
        </Card>
      ) : (
        <>
          <div className="mb-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {/* One card per currency. Converting naira and dollars at a rate
                nobody recorded would produce a total that looks authoritative
                and is not. */}
            {ledger.totals.length === 0 ? (
              <Card className="gap-0 p-5">
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Sold
                </p>
                <p className="mt-2 text-3xl font-semibold tabular-nums text-foreground">0</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Nothing has been bought through the pricing page yet
                </p>
              </Card>
            ) : (
              ledger.totals.map((total) => (
                <Card key={total.currency} className="gap-0 p-5">
                  <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    {total.currency}
                  </p>
                  <p className="mt-2 text-3xl font-semibold tabular-nums text-foreground">
                    {total.amount.toLocaleString()}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {total.count} {total.count === 1 ? 'sale' : 'sales'}
                  </p>
                </Card>
              ))
            )}
          </div>

          {/* The gap between grants and sales, named rather than left to look
              like missing money. */}
          {ledger.reconciliation.byHand > 0 && (
            <Card className="mb-4 gap-0 p-4">
              <p className="flex items-start gap-2 text-sm text-muted-foreground">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                <span>
                  {ledger.reconciliation.grants} access{' '}
                  {ledger.reconciliation.grants === 1 ? 'window was' : 'windows were'} opened
                  in this period and {ledger.reconciliation.approvals} came from a request
                  somebody bought through. The other {ledger.reconciliation.byHand}{' '}
                  {ledger.reconciliation.byHand === 1 ? 'was' : 'were'} granted by hand — an
                  advisor, a correction, or a transfer that skipped the pricing page — and{' '}
                  {ledger.reconciliation.byHand === 1 ? 'carries' : 'carry'} no amount because
                  none was ever recorded.
                </span>
              </p>
            </Card>
          )}

          <div className="grid gap-4 lg:grid-cols-3">
            <Card className="gap-0 p-5 lg:col-span-2">
              <h2 className="text-sm font-semibold text-foreground">Sales</h2>
              {ledger.sales.length === 0 ? (
                <p className="mt-2 text-sm text-muted-foreground">
                  No purchases have been approved in this period.
                </p>
              ) : (
                <ul className="mt-3 space-y-2">
                  {ledger.sales.map((sale) => (
                    <li
                      key={sale.id}
                      className="flex flex-wrap items-baseline justify-between gap-2 border-b border-border pb-2 text-sm last:border-0 last:pb-0"
                    >
                      <span className="min-w-0">
                        <Link
                          href={`/admin/users/${sale.userId}`}
                          className="text-foreground underline-offset-4 hover:underline"
                        >
                          {sale.name ?? sale.email}
                        </Link>
                        <span className="text-muted-foreground">
                          {' · '}
                          {sale.planName}
                          {' · '}
                          {sale.months === 1 ? '1 month' : `${sale.months} months`}
                        </span>
                      </span>
                      <span className="shrink-0 tabular-nums text-foreground">
                        {sale.currency} {sale.amount.toLocaleString()}
                        <span className="ml-2 text-xs text-muted-foreground">
                          {formatDate(sale.at)}
                        </span>
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </Card>

            <Card className="gap-0 p-5">
              <h2 className="text-sm font-semibold text-foreground">Terms</h2>
              <p className="mt-1 text-xs text-muted-foreground">
                How long people buy for. Longer terms are fewer transfers to chase.
              </p>
              {ledger.terms.length === 0 ? (
                <p className="mt-3 text-sm text-muted-foreground">Nothing sold yet.</p>
              ) : (
                <ul className="mt-3 space-y-2 text-sm">
                  {ledger.terms.map((term) => (
                    <li key={term.months} className="flex items-baseline justify-between gap-3">
                      <span className="text-muted-foreground">
                        {term.months === 1 ? '1 month' : `${term.months} months`}
                      </span>
                      <span className="tabular-nums text-foreground">{term.count}</span>
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          </div>
        </>
      )}
    </>
  )
}

function formatDate(ms: number): string {
  return new Date(ms).toLocaleDateString(undefined, { day: 'numeric', month: 'short' })
}
